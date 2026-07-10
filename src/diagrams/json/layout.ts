/**
 * JSON diagram layout engine.
 *
 * Synchronous: JsonDiagramAST + Theme + StringMeasurer → JsonGeometry
 * via the dot layout engine (rankDir: LR).
 *
 * No DOM, no SVG. All I/O is plain data.
 */

import type { HighlightDirective, JsonDiagramAST } from './ast.js';
import type { Theme } from '../../core/theme.js';
import type { StringMeasurer } from '../../core/measurer.js';
import { layoutGraph as dotLayout } from '../../core/graph-layout.js';
import type { DotInputEdge, DotInputGraph } from '../../core/graph-layout.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const H_PAD = 8;
const V_PAD = 4;
const MIN_COL_WIDTH = 30;
const MIN_HEIGHT = 15;
const ROW_HEIGHT_MIN = 20;
/** Margin added around the entire canvas so nodes don't touch the SVG edge. */
const CANVAS_PAD = 8;

// ---------------------------------------------------------------------------
// Public output types
// ---------------------------------------------------------------------------

/** A single row within a JSON node block */
export interface JsonRowGeo {
  key: string;
  value: string;
  /** Value split on literal \n for multi-line string display. Always ≥ 1 element. */
  valueLines: readonly string[];
  valueType: 'string' | 'number' | 'boolean' | 'null' | 'nested';
  /**
   * Highlight state:
   *   false        — not highlighted
   *   '' (empty)   — highlighted with no named style class (default highlight color)
   *   'h1', 'h2'   — highlighted with a named style class
   */
  highlight: string | false;
  /** y offset within the node (top of row) */
  y: number;
  height: number;
}

/** A positioned JSON node (one object or array) */
export interface JsonNodeGeo {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Width of left (key) column */
  keyColWidth: number;
  /** Width of right (value) column */
  valueColWidth: number;
  rows: JsonRowGeo[];
}

/** A routed edge from a parent node row to a child node */
export interface JsonEdgeGeo {
  points: ReadonlyArray<{ x: number; y: number }>;
  spline: boolean;
}

export interface JsonGeometry {
  nodes: JsonNodeGeo[];
  edges: JsonEdgeGeo[];
  width: number;
  height: number;
  /** Title text from the `title …` directive, if present. */
  title?: string;
  /** When the JSON body could not be parsed, contains the error message to display. */
  error?: string;
}

// ---------------------------------------------------------------------------
// Value display helpers
// ---------------------------------------------------------------------------

type ValueType = 'string' | 'number' | 'boolean' | 'null' | 'nested';

interface DisplayValue {
  display: string;
  valueType: ValueType;
}

function getDisplayValue(v: unknown): DisplayValue {
  if (v === null) {
    return { display: '␀', valueType: 'null' };
  }
  if (typeof v === 'boolean') {
    return {
      display: v ? '☑ true' : '☐ false',
      valueType: 'boolean',
    };
  }
  if (typeof v === 'number') {
    return { display: String(v), valueType: 'number' };
  }
  if (typeof v === 'string') {
    return { display: v, valueType: 'string' };
  }
  // object or array — child node handles it
  return { display: '', valueType: 'nested' };
}

// ---------------------------------------------------------------------------
// Tree walking
// ---------------------------------------------------------------------------

type JsonContainer = Record<string, unknown> | unknown[];

interface FlatNode {
  id: string;
  value: JsonContainer;
  parentId: string | null;
  parentKey: string | null;
}

/** Extract [key, value] entries from an object or array. */
function containerEntries(v: JsonContainer): Array<[string, unknown]> {
  if (Array.isArray(v)) {
    return v.map((item, i) => [String(i), item]);
  }
  return Object.entries(v);
}

/**
 * Walk the JSON tree in DFS order, assigning each nested object/array a
 * unique id ("n0", "n1", ...). Returns a flat list of nodes in DFS order.
 */
function walkTree(root: JsonContainer): FlatNode[] {
  const result: FlatNode[] = [];
  let counter = 0;

  const stack: FlatNode[] = [
    { id: `n${counter++}`, value: root, parentId: null, parentKey: null },
  ];

  while (stack.length > 0) {
    const current = stack.pop()!;
    result.push(current);

    const entries = containerEntries(current.value);

    // Push children in reverse order so they come off the stack in original order
    for (let i = entries.length - 1; i >= 0; i--) {
      const [k, v] = entries[i]!;
      if (v !== null && typeof v === 'object') {
        stack.push({
          id: `n${counter++}`,
          value: v as JsonContainer,
          parentId: current.id,
          parentKey: k,
        });
      }
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Per-node highlight map
// ---------------------------------------------------------------------------

const EMPTY_MAP: ReadonlyMap<string, string> = new Map();

/**
 * Builds a map from nodeId → Map<key, styleClass> by following each highlight
 * path through the node tree.
 *
 * A path like ["address", "city"] starts at the root node, navigates to the
 * child whose parentKey is "address", then marks "city" as highlighted in
 * that child node with the given styleClass. Single-segment paths ["lastName"]
 * mark the key in the root node directly.
 *
 * Wildcard segments are supported:
 *   "*"  — matches all direct children of the current node
 *   "**" — matches the current node and all transitive descendants
 */
function buildHighlightMap(
  flatNodes: FlatNode[],
  highlights: ReadonlyArray<HighlightDirective>,
): Map<string, Map<string, string>> {
  // Build lookup: `${parentId}/${parentKey}` → childNodeId (exact key navigation)
  const childLookup = new Map<string, string>();
  for (const fn of flatNodes) {
    if (fn.parentId !== null) {
      childLookup.set(`${fn.parentId}/${fn.parentKey ?? ''}`, fn.id);
    }
  }

  // Build childrenOf: parentId → childId[] (for * wildcard: all direct children)
  const childrenOf = new Map<string, string[]>();
  for (const fn of flatNodes) {
    if (fn.parentId !== null) {
      let arr = childrenOf.get(fn.parentId);
      if (arr === undefined) { arr = []; childrenOf.set(fn.parentId, arr); }
      arr.push(fn.id);
    }
  }

  // Returns nodeId plus all transitive descendants (for ** wildcard)
  function descendants(nodeId: string): string[] {
    const desc: string[] = [nodeId];
    const queue = [nodeId];
    while (queue.length > 0) {
      const id = queue.shift()!;
      for (const child of (childrenOf.get(id) ?? [])) {
        desc.push(child);
        queue.push(child);
      }
    }
    return desc;
  }

  const rootId = flatNodes[0]?.id;
  const result = new Map<string, Map<string, string>>();

  function navigate(nodeId: string, path: readonly string[], styleClass: string): void {
    if (path.length === 0) return;
    if (path.length === 1) {
      // Mark the last key on this node
      let map = result.get(nodeId);
      if (map === undefined) { map = new Map(); result.set(nodeId, map); }
      map.set(path[0]!, styleClass);
      return;
    }
    const seg = path[0]!;
    const rest = path.slice(1);
    if (seg === '**') {
      // ** = match at any depth from nodeId (inclusive)
      for (const desc of descendants(nodeId)) {
        navigate(desc, rest, styleClass);
      }
    } else if (seg === '*') {
      // * = match all direct children of nodeId
      for (const childId of (childrenOf.get(nodeId) ?? [])) {
        navigate(childId, rest, styleClass);
      }
    } else {
      // Exact match via childLookup
      const childId = childLookup.get(`${nodeId}/${seg}`);
      if (childId !== undefined) navigate(childId, rest, styleClass);
    }
  }

  for (const directive of highlights) {
    if (directive.path.length === 0 || rootId === undefined) continue;
    navigate(rootId, directive.path, directive.styleClass);
  }

  return result;
}

// ---------------------------------------------------------------------------
// String display processing
// ---------------------------------------------------------------------------

/**
 * Apply PlantUML's second-level escape interpretation to a JSON string value.
 *
 * After jsonc-parser decodes standard JSON escapes (\\n → newline, etc.),
 * PlantUML interprets the *literal two-character sequences* that remain in the
 * source text:
 *   \\  (two backslashes) → single backslash in display
 *   \n  (backslash + n)   → newline → row split
 *   \r  (backslash + r)   → empty string → row split to blank
 *   \t  (backslash + t)   → tab character → renders as blank
 *
 * The double-backslash must be protected before the other substitutions so
 * that a literal "\\n" in source becomes "\" + "n" (not a newline).
 */
function processStringDisplay(s: string): string {
  return s
    .replace(/\\\\/g, '\x00') // protect \\ before other replacements
    .replace(/\\n/g, '\n')    // \n → newline (row split)
    .replace(/\\r/g, '')      // \r → empty (blank row)
    .replace(/\\t/g, '\t')    // \t → tab (renders blank)
    .replace(/\x00/g, '\\'); // restore protected \\ as single backslash
}

// ---------------------------------------------------------------------------
// Word-wrap helper
// ---------------------------------------------------------------------------

/**
 * Wrap a single line of text to fit within `maxWidth` pixels, using greedy
 * line-breaking on space boundaries. Only applied to string-type values.
 *
 * Single words wider than `maxWidth` are kept on their own line rather than
 * broken mid-word.
 */
function wordWrapLine(
  line: string,
  maxWidth: number,
  measurer: StringMeasurer,
  font: { family: string; size: number },
): string[] {
  const words = line.split(' ');
  if (words.length === 0) return [line];

  const wrapped: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current.length === 0 ? word : `${current} ${word}`;
    const w = measurer.measure(candidate, font).width;
    if (w > maxWidth && current.length > 0) {
      wrapped.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current.length > 0) wrapped.push(current);
  return wrapped;
}

// ---------------------------------------------------------------------------
// Row flattening and measurement
// ---------------------------------------------------------------------------

interface BuildRowsOptions {
  maximumWidth?: number;
  fontFamily?: string;
  fontBold?: boolean;
  /** When true, measure key text with bold font (matches default renderer behaviour). */
  headerFontBold?: boolean;
}

function buildRows(
  node: FlatNode,
  highlightKeys: ReadonlyMap<string, string>,
  measurer: StringMeasurer,
  fontSize: number,
  options?: BuildRowsOptions,
): JsonRowGeo[] {
  const fontFamily = options?.fontFamily ?? 'sans-serif';
  const font = options?.fontBold
    ? { family: fontFamily, size: fontSize, weight: 'bold' as const }
    : { family: fontFamily, size: fontSize };
  const entries = containerEntries(node.value);
  const maximumWidth = options?.maximumWidth;

  const rows: JsonRowGeo[] = [];
  let currentY = V_PAD;

  for (const [k, v] of entries) {
    const { display, valueType } = getDisplayValue(v);
    // Apply PlantUML escape interpretation to string values, then split on
    // newlines produced by \n sequences. Non-string values are single-line.
    const processed = valueType === 'string' ? processStringDisplay(display) : display;
    let valueLines: string[] = valueType === 'string' ? processed.split('\n') : [display];

    // Apply word-wrap only to string-type values when maximumWidth is set.
    if (valueType === 'string' && maximumWidth !== undefined) {
      const wrapped: string[] = [];
      for (const segment of valueLines) {
        const wl = wordWrapLine(segment, maximumWidth, measurer, font);
        for (const wline of wl) wrapped.push(wline);
      }
      valueLines = wrapped;
    }

    const keyDims = measurer.measure(k, font);
    const lineHeight = Math.max(ROW_HEIGHT_MIN, keyDims.height + V_PAD);
    const rowHeight = valueLines.length * lineHeight;

    rows.push({
      key: k,
      value: processed,
      valueLines,
      valueType,
      highlight: highlightKeys.get(k) ?? false,
      y: currentY,
      height: rowHeight,
    });

    currentY += rowHeight;
  }

  return rows;
}

interface MeasuredNode {
  flatNode: FlatNode;
  rows: JsonRowGeo[];
  keyColWidth: number;
  valueColWidth: number;
  totalWidth: number;
  totalHeight: number;
}

function measureNode(
  flatNode: FlatNode,
  highlightKeys: ReadonlyMap<string, string>,
  measurer: StringMeasurer,
  fontSize: number,
  options?: BuildRowsOptions,
): MeasuredNode {
  const fontFamily = options?.fontFamily ?? 'sans-serif';
  const valFont = options?.fontBold
    ? { family: fontFamily, size: fontSize, weight: 'bold' as const }
    : { family: fontFamily, size: fontSize };
  const keyFont =
    options?.headerFontBold ?? options?.fontBold
      ? { family: fontFamily, size: fontSize, weight: 'bold' as const }
      : { family: fontFamily, size: fontSize };
  const rows = buildRows(flatNode, highlightKeys, measurer, fontSize, options);

  let maxKeyWidth = MIN_COL_WIDTH;
  let maxValueWidth = MIN_COL_WIDTH;

  for (const row of rows) {
    const kw = measurer.measure(row.key, keyFont).width + 2 * H_PAD;
    // For multi-line values, use the widest individual line
    const vw = Math.max(...row.valueLines.map((l) => measurer.measure(l, valFont).width + 2 * H_PAD));
    if (kw > maxKeyWidth) maxKeyWidth = kw;
    if (vw > maxValueWidth) maxValueWidth = vw;
  }

  const keyColWidth = maxKeyWidth;
  // Cap value column at maximumWidth + padding when wrapping is active.
  const rawValueColWidth = maxValueWidth;
  const maximumWidth = options?.maximumWidth;
  const valueColWidth =
    maximumWidth !== undefined
      ? Math.min(rawValueColWidth, maximumWidth + 2 * H_PAD)
      : rawValueColWidth;

  const lastRow = rows.at(-1);
  const rawHeight = lastRow !== undefined ? lastRow.y + lastRow.height + V_PAD : V_PAD * 2;
  const totalHeight = Math.max(MIN_HEIGHT, rawHeight);
  const totalWidth = keyColWidth + valueColWidth;

  return { flatNode, rows, keyColWidth, valueColWidth, totalWidth, totalHeight };
}

// ---------------------------------------------------------------------------
// Public layout function
// ---------------------------------------------------------------------------

export function layoutJson(
  ast: JsonDiagramAST,
  theme: Theme,
  measurer: StringMeasurer,
): JsonGeometry {
  // Handle parse failure: return an error geometry that the renderer will
  // display as PlantUML's canonical "Your data does not sound like JSON data".
  if (ast.parseError) {
    return {
      nodes: [],
      edges: [],
      width: 0,
      height: 0,
      error: 'Your data does not sound like JSON data',
    };
  }

  const root = ast.root;

  let flatNodes: FlatNode[];

  if (typeof root === 'object' && root !== null) {
    flatNodes = walkTree(root as JsonContainer);
  } else {
    // Primitive root: wrap in a synthetic single-entry object so the
    // generic row-building machinery handles it uniformly.
    flatNodes = [
      {
        id: 'n0',
        value: { '': root },
        parentId: null,
        parentKey: null,
      },
    ];
  }

  // Build per-node highlight map: nodeId → Map<key, styleClass>.
  // Each #highlight path navigates from the root node through child nodes
  // following all but the last segment, then marks the last segment as
  // highlighted in that destination node.
  const highlightMap = buildHighlightMap(flatNodes, ast.highlights);

  // Read jsonDiagram.node theme overrides for layout purposes
  const jsonTheme = theme.colors.graph.json;
  const nodeFontSize = jsonTheme?.nodeFontSize ?? theme.fontSize;
  const nodeFontFamily = jsonTheme?.nodeFontFamily ?? theme.fontFamily;
  const nodeFontBold = jsonTheme?.nodeFontBold ?? false;
  const maximumWidth = jsonTheme?.maximumWidth;
  // Default true: matches plantuml.skin jsonDiagram.node.header { FontStyle bold }
  const headerFontBold = jsonTheme?.headerFontBold !== false;

  const measureOptions: BuildRowsOptions = {
    fontFamily: nodeFontFamily,
    ...(nodeFontBold ? { fontBold: true } : {}),
    ...(headerFontBold ? { headerFontBold: true } : {}),
    ...(maximumWidth !== undefined ? { maximumWidth } : {}),
  };

  // Measure each node
  const measured = flatNodes.map((fn) =>
    measureNode(
      fn,
      highlightMap.get(fn.id) ?? EMPTY_MAP,
      measurer,
      nodeFontSize,
      measureOptions,
    ),
  );

  // Build dot input graph
  const dotNodes = measured.map((m) => ({
    id: m.flatNode.id,
    width: m.totalWidth,
    height: m.totalHeight,
  }));

  // Build lookup for parent geometry to compute tailportY
  const measuredById = new Map(measured.map((m) => [m.flatNode.id, m]));

  const dotEdges: DotInputEdge[] = flatNodes
    .filter((fn) => fn.parentId !== null)
    .map((fn) => {
      const parentM = measuredById.get(fn.parentId!);
      let tailportY: number | undefined;
      if (parentM !== undefined && parentM.totalHeight > 0) {
        const row = parentM.rows.find((r) => r.key === (fn.parentKey ?? ''));
        if (row !== undefined) {
          const rowCenterFromTop = row.y + row.height / 2;
          tailportY = (rowCenterFromTop - parentM.totalHeight / 2) / parentM.totalHeight;
        }
      }
      const edge: DotInputEdge = {
        id: `${fn.parentId!}->${fn.id}`,
        from: fn.parentId!,
        to: fn.id,
      };
      if (tailportY !== undefined) edge.attributes = { tailportY };
      return edge;
    });

  const dotInput: DotInputGraph = {
    nodes: dotNodes,
    edges: dotEdges,
    rankDir: 'LR',
    rankSep: 40,
    nodeSep: 20,
  };

  const dotResult = dotLayout(dotInput);

  // Map dot result nodes → JsonNodeGeo
  const dotNodeById = new Map(dotResult.nodes.map((n) => [n.id, n]));

  const nodes: JsonNodeGeo[] = [];
  for (const m of measured) {
    const dn = dotNodeById.get(m.flatNode.id);
    if (dn === undefined) continue;
    nodes.push({
      id: m.flatNode.id,
      x: dn.x,
      y: dn.y,
      width: m.totalWidth,
      height: m.totalHeight,
      keyColWidth: m.keyColWidth,
      valueColWidth: m.valueColWidth,
      rows: m.rows,
    });
  }

  // Apply titleOffset and CANVAS_PAD to node positions first so that edge
  // anchor points computed below are in final canvas coordinates.
  const titleOffset = ast.title !== undefined ? Math.ceil(theme.fontSize * 1.8) + 8 : 0;
  for (const n of nodes) {
    n.x += CANVAS_PAD;
    n.y += CANVAS_PAD + titleOffset;
  }

  // Compute per-rank right boundary: the rightmost edge of any node at that rank.
  // Edges from narrow nodes would otherwise travel through the right portion of
  // wider siblings at the same rank. Routing via the rank boundary keeps all
  // edge paths in the clear gap between ranks.
  const rankMaxRight = new Map<number, number>();
  for (const n of nodes) {
    const cur = rankMaxRight.get(n.x) ?? 0;
    rankMaxRight.set(n.x, Math.max(cur, n.x + n.width));
  }

  // Build edges anchored to parent rows, not to node centers.
  // Java: createEdge sets tailport="P{rowIndex}" so graphviz routes from the
  // specific row's port on the right side of the parent node. We replicate this
  // by computing the start point directly from the parent row's geometry.
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const edges: JsonEdgeGeo[] = [];
  for (const fn of flatNodes) {
    if (fn.parentId === null) continue;
    const parent = nodeById.get(fn.parentId);
    const child = nodeById.get(fn.id);
    if (parent === undefined || child === undefined) continue;

    // Find the row in the parent whose key matches this child's entry.
    const parentRow = parent.rows.find((r) => r.key === (fn.parentKey ?? ''));
    const startX = parent.x + parent.width;
    const startY =
      parentRow !== undefined
        ? parent.y + parentRow.y + parentRow.height / 2
        : parent.y + parent.height / 2;
    const endX = child.x;
    const endY = child.y + child.height / 2;

    // If a wider sibling exists at the same rank, add a horizontal waypoint at
    // the rank boundary so the edge travels through the inter-rank gap rather
    // than cutting through that sibling's bounding box.
    const rankRight = rankMaxRight.get(parent.x) ?? startX;
    const points: Array<{ x: number; y: number }> = [{ x: startX, y: startY }];
    if (rankRight > startX) points.push({ x: rankRight, y: startY });
    points.push({ x: endX, y: endY });

    edges.push({ points, spline: false });
  }

  // Canvas size: rightmost/bottommost extent of all positioned nodes plus a
  // right/bottom margin equal to CANVAS_PAD. Nodes already include the left/top
  // CANVAS_PAD in their x/y, so we just need to ensure the right/bottom padding.
  let width = 0;
  let height = 0;
  for (const n of nodes) {
    const r = n.x + n.width + CANVAS_PAD;
    const b = n.y + n.height + CANVAS_PAD;
    if (r > width) width = r;
    if (b > height) height = b;
  }

  // Ensure the canvas is wide enough for the title text.
  if (ast.title !== undefined) {
    const titleFont = { family: theme.fontFamily, size: theme.fontSize, weight: 'bold' as const };
    const titleWidth = measurer.measure(ast.title, titleFont).width + 2 * CANVAS_PAD;
    if (titleWidth > width) width = titleWidth;
  }

  const result: JsonGeometry = { nodes, edges, width, height };
  if (ast.title !== undefined) result.title = ast.title;
  return result;
}
