// The single graph-layout chokepoint.
//
// All graph diagram types (class, component, state, usecase, dot, json — plus
// the transitive object→class and yaml/hcl→json paths) route their layout
// through `layoutGraph()`, the only seam consumer. This adapter wires that seam
// to the `graphviz-ts` package: it serializes a DotInputGraph into a graphviz-ts
// builder graph, runs the requested engine, reads back the geometry snapshot,
// and maps it to the DotLayoutResult shape the renderers already consume (burn
// decision D4 — renderers untouched). See plans/burn-graphviz-engines/.

import {
  createGraph,
  render,
  getLayout,
  setTextMeasurer,
  LutTextMeasurer,
} from 'graphviz-ts';
import type { GvGraphBuilder, LayoutSnapshot } from 'graphviz-ts';
import type {
  DotInputEdge,
  DotInputGraph,
  DotLayoutResult,
} from './graph-layout.types.js';

// plantuml-ts is a pure SVG library — no DOM, no canvas. graphviz-ts otherwise
// auto-selects a canvas-backed text measurer when a `document` is present
// (jsdom, browsers), which both violates that guarantee and is unimplemented
// under jsdom. Pin its built-in lookup-table measurer: canvas-free and
// deterministic across Node, Workers, and the browser. Edge-label sizing is the
// only thing this affects (nodes are laid out fixedsize from caller metrics).
setTextMeasurer(new LutTextMeasurer());

/** graphviz width/height/nodesep/ranksep attrs are in inches; our measured
 *  sizes are in pixels. getLayout returns points (inches × 72), so dividing px
 *  by 72 on the way in round-trips: output points == original pixel value. */
const PX_PER_INCH = 72;

/** Right/bottom canvas padding, matching the in-house engine's old extractResult. */
const MARGIN = 12;

type OutNodes = DotLayoutResult['nodes'];
type OutEdges = DotLayoutResult['edges'];

/** Maps graphviz-ts (tail,head)-keyed edges back to our edge ids. */
interface EdgeIndex {
  /** (tail,head) → our edge ids, in input order (consumed left-to-right). */
  idQueues: Map<string, string[]>;
  inputEdgeById: Map<string, DotInputEdge>;
}

const edgeKey = (tail: string, head: string): string => `${tail} ${head}`;

function applyGraphAttrs(b: GvGraphBuilder, input: DotInputGraph): void {
  if (input.rankDir !== undefined) b.setAttr('rankdir', input.rankDir);
  if (input.nodeSep !== undefined) {
    b.setAttr('nodesep', (input.nodeSep / PX_PER_INCH).toString());
  }
  if (input.rankSep !== undefined) {
    b.setAttr('ranksep', (input.rankSep / PX_PER_INCH).toString());
  }
  if (input.aspect !== undefined) b.setAttr('aspect', input.aspect.toString());
}

function addNodes(b: GvGraphBuilder, input: DotInputGraph): void {
  for (const n of input.nodes) {
    b.addNode(n.id, {
      shape: 'box',
      fixedsize: 'true',
      // Empty label: plantuml renders node text itself, so graphviz must not
      // measure the implicit name-label (its default "Times,serif" has no LUT
      // metrics and would warn). fixedsize keeps the caller's measured size.
      label: '',
      width: (n.width / PX_PER_INCH).toString(),
      height: (n.height / PX_PER_INCH).toString(),
    });
  }
  // Rank constraints (rank=source|sink|same|min|max): graphviz groups nodes by
  // a subgraph carrying `rank=`. Declaring an existing node id inside the
  // subgraph references it (DOT semantics — no duplicate node is created).
  const rankGroups = new Map<string, string[]>();
  for (const n of input.nodes) {
    const r = n.attributes?.rank;
    if (r === undefined) continue;
    const arr = rankGroups.get(r) ?? [];
    arr.push(n.id);
    rankGroups.set(r, arr);
  }
  let rankSubId = 0;
  for (const [rank, ids] of rankGroups) {
    const sub = b.addSubgraph(`__rank_${rankSubId++}`, { rank });
    for (const id of ids) sub.addNode(id);
  }
}

function addEdges(b: GvGraphBuilder, input: DotInputGraph): EdgeIndex {
  const nodeIds = new Set(input.nodes.map((n) => n.id));
  const idQueues = new Map<string, string[]>();
  const inputEdgeById = new Map<string, DotInputEdge>();
  for (const e of input.edges) {
    // Defensive: skip edges to/from unknown nodes (the old engine dropped
    // dangling edges in buildWorkingGraph).
    if (!nodeIds.has(e.from) || !nodeIds.has(e.to)) continue;
    const attrs: Record<string, string> = {};
    const a = e.attributes;
    if (a?.weight !== undefined) attrs.weight = a.weight.toString();
    if (a?.minLen !== undefined) attrs.minlen = a.minLen.toString();
    if (a?.label !== undefined) {
      attrs.label = a.label;
      // Measure with a LUT-known font (graphviz's default "Times,serif" warns).
      attrs.fontname = 'Times';
    }
    b.addEdge(e.from, e.to, attrs);

    const k = edgeKey(e.from, e.to);
    const q = idQueues.get(k) ?? [];
    q.push(e.id);
    idQueues.set(k, q);
    inputEdgeById.set(e.id, e);
  }
  return { idQueues, inputEdgeById };
}

/** graphviz reports node centre coords; renderers expect the top-left corner. */
function mapNodes(snap: LayoutSnapshot): OutNodes {
  return snap.nodes.map((n) => ({
    id: n.name,
    x: n.x - n.width / 2,
    y: n.y - n.height / 2,
    width: n.width,
    height: n.height,
  }));
}

function toEdgeEntry(
  ge: LayoutSnapshot['edges'][number],
  id: string,
  inp: DotInputEdge | undefined,
): OutEdges[number] {
  const entry: OutEdges[number] = {
    id,
    points: ge.points.map((p) => ({ x: p.x, y: p.y })),
  };
  if (ge.label !== undefined) {
    entry.labelX = ge.label.x;
    entry.labelY = ge.label.y;
  }
  // graphviz-ts returns only the label position; echo back the caller's
  // measured label box so renderers size the label as before.
  if (inp?.attributes?.labelWidth !== undefined) {
    entry.labelWidth = inp.attributes.labelWidth;
  }
  if (inp?.attributes?.labelHeight !== undefined) {
    entry.labelHeight = inp.attributes.labelHeight;
  }
  if (ge.points.length > 2) entry.spline = true;
  return entry;
}

function mapEdges(snap: LayoutSnapshot, idx: EdgeIndex): OutEdges {
  const edges: OutEdges = [];
  for (const ge of snap.edges) {
    const q = idx.idQueues.get(edgeKey(ge.tail, ge.head));
    const id = q !== undefined && q.length > 0 ? q.shift() : undefined;
    if (id === undefined) continue;
    edges.push(toEdgeEntry(ge, id, idx.inputEdgeById.get(id)));
  }
  return edges;
}

/** Shift content so the leftmost/topmost rendered point sits at (0,0). */
function shiftToOrigin(nodes: OutNodes, edges: OutEdges): void {
  let minX = Math.min(...nodes.map((n) => n.x));
  let minY = Math.min(...nodes.map((n) => n.y));
  for (const e of edges) {
    for (const p of e.points) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
    }
  }
  if (minX === 0 && minY === 0) return;
  for (const n of nodes) {
    n.x -= minX;
    n.y -= minY;
  }
  for (const e of edges) {
    for (const p of e.points) {
      p.x -= minX;
      p.y -= minY;
    }
    if (e.labelX !== undefined) e.labelX -= minX;
    if (e.labelY !== undefined) e.labelY -= minY;
  }
}

function canvasSize(nodes: OutNodes, edges: OutEdges): { width: number; height: number } {
  let width = 0;
  let height = 0;
  for (const n of nodes) {
    width = Math.max(width, n.x + n.width + MARGIN);
    height = Math.max(height, n.y + n.height + MARGIN);
  }
  for (const e of edges) {
    if (e.labelX !== undefined && e.labelWidth !== undefined) {
      width = Math.max(width, e.labelX + e.labelWidth / 2 + MARGIN);
    }
    for (const p of e.points) {
      width = Math.max(width, p.x + MARGIN);
      height = Math.max(height, p.y + MARGIN);
    }
  }
  return { width, height };
}

/**
 * Lay out a graph via graphviz-ts. The single seam between the graph diagram
 * types and the layout engine.
 *
 * @param input - the graph to lay out (node/edge geometry + rank hints).
 * @param opts  - layout options; `engine` selects a graphviz layout engine
 *                (dot/neato/fdp/sfdp/twopi/circo/osage). Defaults to `dot` —
 *                every current consumer is a hierarchical layout. The old
 *                BFS-depth engine-selection heuristic was intentionally dropped
 *                (burn decision D2).
 */
export function layoutGraph(
  input: DotInputGraph,
  opts?: { engine?: string },
): DotLayoutResult {
  if (input.nodes.length === 0) {
    return { nodes: [], edges: [], width: 0, height: 0 };
  }
  const engine = opts?.engine ?? 'dot';

  const b = createGraph({ directed: true });
  applyGraphAttrs(b, input);
  addNodes(b, input);
  const idx = addEdges(b, input);

  // render triggers layout; getLayout alone returns zeroed coords.
  render(b.graph, 'svg', { engine });
  const snap = getLayout(b.graph, { yAxis: 'down' });

  const nodes = mapNodes(snap);
  const edges = mapEdges(snap, idx);
  shiftToOrigin(nodes, edges);
  const { width, height } = canvasSize(nodes, edges);

  return { nodes, edges, width, height };
}

export type {
  DotInputNode,
  DotInputEdge,
  DotInputGraph,
  DotLayoutResult,
} from './graph-layout.types.js';
