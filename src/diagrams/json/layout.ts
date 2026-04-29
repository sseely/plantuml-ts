/**
 * JSON diagram layout engine.
 *
 * Synchronous: JsonDiagramAST + Theme + StringMeasurer → JsonGeometry
 * via the dot layout engine (rankDir: LR).
 *
 * No DOM, no SVG. All I/O is plain data.
 */

import type { JsonDiagramAST } from './ast.js';
import type { Theme } from '../../core/theme.js';
import type { StringMeasurer } from '../../core/measurer.js';
import { layout as dotLayout } from '../../core/dot/index.js';
import type { DotInputGraph } from '../../core/dot/types.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const H_PAD = 8;
const V_PAD = 4;
const MIN_COL_WIDTH = 30;
const MIN_HEIGHT = 15;
const ROW_HEIGHT_MIN = 20;

// ---------------------------------------------------------------------------
// Public output types
// ---------------------------------------------------------------------------

/** A single row within a JSON node block */
export interface JsonRowGeo {
  key: string;
  value: string;
  valueType: 'string' | 'number' | 'boolean' | 'null' | 'nested';
  highlight: boolean;
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
// Row flattening and measurement
// ---------------------------------------------------------------------------

function buildRows(
  node: FlatNode,
  highlightKeys: ReadonlySet<string>,
  measurer: StringMeasurer,
  fontSize: number,
): JsonRowGeo[] {
  const font = { family: 'Arial, sans-serif', size: fontSize };
  const entries = containerEntries(node.value);

  const rows: JsonRowGeo[] = [];
  let currentY = V_PAD;

  for (const [k, v] of entries) {
    const { display, valueType } = getDisplayValue(v);
    const keyDims = measurer.measure(k, font);
    const rowHeight = Math.max(ROW_HEIGHT_MIN, keyDims.height + V_PAD);

    rows.push({
      key: k,
      value: display,
      valueType,
      highlight: highlightKeys.has(k),
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
  highlightKeys: ReadonlySet<string>,
  measurer: StringMeasurer,
  fontSize: number,
): MeasuredNode {
  const font = { family: 'Arial, sans-serif', size: fontSize };
  const rows = buildRows(flatNode, highlightKeys, measurer, fontSize);

  let maxKeyWidth = MIN_COL_WIDTH;
  let maxValueWidth = MIN_COL_WIDTH;

  for (const row of rows) {
    const kw = measurer.measure(row.key, font).width + 2 * H_PAD;
    const vw = measurer.measure(row.value, font).width + 2 * H_PAD;
    if (kw > maxKeyWidth) maxKeyWidth = kw;
    if (vw > maxValueWidth) maxValueWidth = vw;
  }

  const keyColWidth = maxKeyWidth;
  const valueColWidth = maxValueWidth;

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
  // Handle null root (parse failed)
  if (ast.root === null) {
    return { nodes: [], edges: [], width: 0, height: 0 };
  }

  const root = ast.root;

  // Build the set of highlighted top-level keys (first segment of each path)
  const highlightKeys = new Set<string>(
    ast.highlights.map((path) => path[0]).filter((k): k is string => k !== undefined),
  );

  let flatNodes: FlatNode[];

  if (typeof root === 'object' && root !== null) {
    // root is an object or array
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

  // Measure each node
  const measured = flatNodes.map((fn) =>
    measureNode(fn, highlightKeys, measurer, theme.fontSize),
  );

  // Build dot input graph
  const dotNodes = measured.map((m) => ({
    id: m.flatNode.id,
    width: m.totalWidth,
    height: m.totalHeight,
  }));

  const dotEdges = flatNodes
    .filter((fn) => fn.parentId !== null)
    .map((fn) => ({
      id: `${fn.parentId}->${fn.id}`,
      from: fn.parentId!,
      to: fn.id,
    }));

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

  // Map dot result edges → JsonEdgeGeo
  const dotEdgeById = new Map(dotResult.edges.map((e) => [e.id, e]));

  const edges: JsonEdgeGeo[] = [];
  for (const de of dotEdges) {
    const re = dotEdgeById.get(de.id);
    if (re === undefined) continue;
    edges.push({
      points: re.points,
      spline: false,
    });
  }

  // Canvas size from dot result (already computed by dot engine)
  let width = dotResult.width;
  let height = dotResult.height;

  // Ensure canvas covers all placed nodes even if dot result is smaller
  for (const n of nodes) {
    const r = n.x + n.width;
    const b = n.y + n.height;
    if (r > width) width = r;
    if (b > height) height = b;
  }

  return { nodes, edges, width, height };
}
