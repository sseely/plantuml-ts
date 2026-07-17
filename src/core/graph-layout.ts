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
  DotInputCluster,
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

/** `plantuml.skin`'s `arrow { FontSize 13 }` block (`svek/GraphvizImageBuilder
 *  .java#getStyleArrowCardinality` resolves the `arrow.cardinality` style,
 *  which falls through to the plain `arrow` block — no diagram in the corpus
 *  overrides `cardinality` specifically) — the font graphviz-ts must measure
 *  `tailLabel`/`headLabel` text with so its `xladjust` placement search uses
 *  the same box size jar's own `cardinalityFont` would. */
const CARDINALITY_FONT_SIZE = 13;

type OutNodes = DotLayoutResult['nodes'];
type OutEdges = DotLayoutResult['edges'];

/** Maps graphviz-ts (tail,head)-keyed edges back to our edge ids. */
interface EdgeIndex {
  /** (tail,head) → our edge ids, in input order (consumed left-to-right). */
  idQueues: Map<string, string[]>;
  inputEdgeById: Map<string, DotInputEdge>;
}

const edgeKey = (tail: string, head: string): string => `${tail} ${head}`;

// Instrumentation seam for the oracle DOT-parity workstream. When set, every
// layoutGraph() call hands its input here before layout — letting the parity
// tests capture the exact graph plantuml-ts feeds graphviz, for one fixture, to
// compare against the oracle's svek-*.dot. Undefined (no-op) by default and in
// every production path. See oracle/README.md and tests/oracle/.
let layoutInputObserver: ((input: DotInputGraph) => void) | undefined;

export function setLayoutInputObserver(
  fn: ((input: DotInputGraph) => void) | undefined,
): void {
  layoutInputObserver = fn;
}

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

/**
 * Forward `input.clusters` to graphviz-ts as `cluster<N>` subgraphs so dot
 * lays out container members together (contained) and routes splines across
 * cluster boundaries — the faithful upstream model (one graph, cluster
 * subgraphs, single pass). Nesting is honored via `parentId`. Member ids
 * reference nodes already added by addNodes (DOT semantics: declaring an
 * existing id in a subgraph references it — no duplicate node), mirroring the
 * rank-subgraph code above.
 *
 * Subgraph names are assigned as `cluster0`, `cluster1`, … (a fresh numeric
 * index per cluster) rather than `cluster_${c.id}` — graphviz only requires
 * the `cluster` prefix, but a digits-only suffix additionally matches the
 * DOT-parity oracle comparator's `parseClusters` regex (`^cluster\d+$`,
 * tests/oracle/svek-dot.ts:109), keeping this emission consistent with the
 * Svek-DOT emitter's own `clusterN` naming (src/core/svek-dot-emit.ts) even
 * though that emitter is a separate code path (it serializes `input.clusters`
 * directly and never calls this function).
 *
 * Additive: callers that pass no `clusters` are unaffected (the field was
 * previously emitter-only).
 */
function addClusters(b: GvGraphBuilder, input: DotInputGraph): void {
  const clusters = input.clusters;
  if (clusters === undefined || clusters.length === 0) return;
  const byId = new Map<string, DotInputCluster>(
    clusters.map((c) => [c.id, c]),
  );
  const builderById = new Map<string, GvGraphBuilder>();
  const nameById = new Map<string, string>();
  let nextIndex = 0;
  const nameFor = (c: DotInputCluster): string => {
    const cached = nameById.get(c.id);
    if (cached !== undefined) return cached;
    const name = `cluster${nextIndex++}`;
    nameById.set(c.id, name);
    return name;
  };
  const builderFor = (c: DotInputCluster): GvGraphBuilder => {
    const cached = builderById.get(c.id);
    if (cached !== undefined) return cached;
    const parent =
      c.parentId !== undefined && byId.has(c.parentId)
        ? builderFor(byId.get(c.parentId)!)
        : b;
    const attrs = c.label !== undefined ? { label: c.label } : {};
    const sg = parent.addSubgraph(nameFor(c), attrs);
    builderById.set(c.id, sg);
    return sg;
  };
  for (const c of clusters) {
    const sg = builderFor(c);
    for (const id of c.nodeIds) sg.addNode(id);
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
    // I9 mechanism (plans/g1-description-svg/ledger.md): callers that draw
    // arrowheads manually (`DotInputGraph.manualArrowheads` — currently only
    // `description`'s SvekEdge/extremity polygons) must tell graphviz-ts the
    // same `arrowhead=none`/`arrowtail=none` the Svek-DOT text emitter
    // already writes for every diagram type, or it defaults to
    // `arrowhead=normal` and reserves an arrow-length gap when clipping the
    // spline to the target node's boundary — shortening the routed edge by
    // ~10-11px versus both real graphviz and the jar's own layout (verified
    // by feeding one fixture's exact node/edge geometry to both `dot -Txdot`
    // and this seam — splines matched only once the attrs below were added).
    // NOT applied unconditionally: `class`/`state`/`dot`/`json` draw their
    // arrowhead via an SVG `marker-end` sitting at the raw spline endpoint
    // and rely on graphviz's default reservation to leave room for it
    // without overlapping the target box (see `DotInputGraph
    // .manualArrowheads`'s own doc comment) — scoped to avoid regressing
    // their already-correct, already-tested output.
    const a = e.attributes;
    const attrs: Record<string, string> = input.manualArrowheads === true || a?.noArrow === true
      ? { arrowtail: 'none', arrowhead: 'none' }
      : {};
    if (a?.weight !== undefined) attrs.weight = a.weight.toString();
    if (a?.minLen !== undefined) attrs.minlen = a.minLen.toString();
    if (a?.label !== undefined) {
      attrs.label = a.label;
      // Measure with a LUT-known font (graphviz's default "Times,serif" warns).
      attrs.fontname = 'Times';
    }
    // G2/N25: feed the ACTUAL text (not just DOT-gate sizing) into the real
    // layout call so graphviz-ts's own `placeLabels`/`xladjust` (`label/
    // xlabels.ts`, a faithful port of `lib/label/xlabels.c`) computes the
    // same external-label position real graphviz would — see
    // `DotInputEdge.attributes.tailLabel`'s own doc comment for why the
    // angle/distance formula never applies here. `layoutGraph()` extracts
    // the computed position back out via `extractPortLabelPositions` (no
    // public snapshot API exposes it directly — ADR-1 in graphviz-ts hides
    // the internal `Edge` model).
    if (a?.tailLabel !== undefined) {
      attrs.taillabel = a.tailLabel;
      attrs.labelfontname = 'Times';
      attrs.labelfontsize = CARDINALITY_FONT_SIZE.toString();
    }
    if (a?.headLabel !== undefined) {
      attrs.headlabel = a.headLabel;
      attrs.labelfontname = 'Times';
      attrs.labelfontsize = CARDINALITY_FONT_SIZE.toString();
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

// ---------------------------------------------------------------------------
// External tail/head label position extraction (G2/N25)
//
// graphviz-ts's public `getLayout()` snapshot never exposes `tail_label`/
// `head_label` positions (ADR-1: the internal `Edge` model is intentionally
// not re-exported), even though the SAME layout call already computes them
// (`gvPostprocess` -> `addXLabels`, `label/xlabels.ts`) whenever an edge
// carries a `taillabel`/`headlabel` attr. The only public surface that
// reveals them is the rendered SVG string `render()` already produces (and
// `layoutGraph()` already calls, purely to trigger layout — its return value
// was previously discarded). This mirrors upstream's OWN technique for the
// exact same problem (`SvekEdge.java#solveLine`'s `getXY(fullSvg, color)`,
// scanning a raw intermediate SVG for a marker's rendered position) instead
// of re-deriving the placement algorithm by hand.
// ---------------------------------------------------------------------------

/** Minimal decode for the handful of entities graphviz-ts's SVG emitter uses
 *  in `<title>` text (`->` renders as `&#45;&gt;`). */
function decodeSvgEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#45;/g, '-')
    .replace(/&quot;/g, '"');
}

/** Bounding-box center of a `<g id="nodeN" class="node">` block's own
 *  `<polygon points="...">`, keyed by the node id in its `<title>` — used to
 *  derive the constant translation between graphviz-ts's raw `render()`
 *  coordinate frame and `getLayout()`'s frame (see `computeRenderOffset`). */
function parseNodeRenderCenters(svg: string): Map<string, { x: number; y: number }> {
  const centers = new Map<string, { x: number; y: number }>();
  const nodeRe = /<g id="node\d+" class="node">\s*<title>([^<]*)<\/title>([\s\S]*?)<\/g>/g;
  let m: RegExpExecArray | null;
  while ((m = nodeRe.exec(svg)) !== null) {
    const id = decodeSvgEntities(m[1] ?? '');
    const ptsMatch = /points="([^"]+)"/.exec(m[2] ?? '');
    if (ptsMatch === null) continue;
    const pts = (ptsMatch[1] ?? '').trim().split(/\s+/).map((p) => {
      const [px, py] = p.split(',').map(Number);
      return { x: px ?? 0, y: py ?? 0 };
    });
    if (pts.length === 0) continue;
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    centers.set(id, {
      x: (Math.min(...xs) + Math.max(...xs)) / 2,
      y: (Math.min(...ys) + Math.max(...ys)) / 2,
    });
  }
  return centers;
}

/** Constant (dx,dy) translation from graphviz-ts's raw `render()` SVG frame
 *  into `getLayout({yAxis:'down'})`'s frame — derived from any one node
 *  present in both (a pure translation: one match fully determines it).
 *  `undefined` when no id matched (defensive; not expected for a non-empty
 *  graph since every `input.node.id` is also the render SVG's node title). */
function computeRenderOffset(
  svg: string,
  nodes: LayoutSnapshot['nodes'],
): { dx: number; dy: number } | undefined {
  const centers = parseNodeRenderCenters(svg);
  for (const n of nodes) {
    const c = centers.get(n.name);
    if (c === undefined) continue;
    return { dx: c.x - n.x, dy: c.y - n.y };
  }
  return undefined;
}

/** One `<g id="edgeN" class="edge">` block's tail/head node ids (from its
 *  `<title>`) and the ordered `<text>` positions it carries (raw render
 *  frame). Emit order is "label, xlabel, head, tail"
 *  (`gvc/edge-labels.ts#renderEdgeLabels`'s own doc comment); this seam
 *  never sets `xlabel`. */
interface PortLabelBlock {
  tail: string;
  head: string;
  texts: Array<{ x: number; y: number }>;
}

function parsePortLabelBlocks(svg: string): PortLabelBlock[] {
  const blocks: PortLabelBlock[] = [];
  const edgeRe = /<g id="edge\d+" class="edge">\s*<title>([^<]*)<\/title>([\s\S]*?)<\/g>/g;
  const textRe = /<text\b[^>]*\bx="(-?[\d.]+)"[^>]*\by="(-?[\d.]+)"[^>]*>/g;
  let m: RegExpExecArray | null;
  while ((m = edgeRe.exec(svg)) !== null) {
    const title = decodeSvgEntities(m[1] ?? '');
    const sep = title.indexOf('->');
    if (sep === -1) continue;
    const tail = title.slice(0, sep);
    const head = title.slice(sep + 2);
    const body = m[2] ?? '';
    const texts: Array<{ x: number; y: number }> = [];
    textRe.lastIndex = 0;
    let tm: RegExpExecArray | null;
    while ((tm = textRe.exec(body)) !== null) {
      texts.push({ x: Number(tm[1]), y: Number(tm[2]) });
    }
    blocks.push({ tail, head, texts });
  }
  return blocks;
}

/** Pick the head/tail label text out of one block's ordered `texts`, per
 *  that edge's own input attrs (see `PortLabelBlock`'s doc comment for the
 *  emit order). An empty `label` (`edgeLabelAttrs`'s `CONSTRAINT_SPOT`
 *  branch) draws NO text upstream (`common_init_edge`'s `str[0]` guard), so
 *  only a non-empty label consumes a slot. */
function pickPortLabelTexts(
  block: PortLabelBlock,
  a: DotInputEdge['attributes'],
): { head?: { x: number; y: number }; tail?: { x: number; y: number } } {
  let i = 0;
  if (a?.label !== undefined && a.label !== '') i++;
  const head = a?.headLabel !== undefined ? block.texts[i++] : undefined;
  const tail = a?.tailLabel !== undefined ? block.texts[i++] : undefined;
  return {
    ...(head !== undefined ? { head } : {}),
    ...(tail !== undefined ? { tail } : {}),
  };
}

/** Extracts `tailLabel`/`headLabel` CENTER positions (translated into
 *  `getLayout()`'s coordinate frame) for every edge that requested one,
 *  keyed by our own edge id. Mirrors `mapEdges`'s own same-(tail,head)-pair
 *  left-to-right queue consumption — neither `render()` nor `getLayout()`
 *  publicly exposes a per-edge identity to match on directly, and both walk
 *  the same underlying model, so the same ordering assumption `mapEdges`
 *  already relies on applies here too.
 *  #lizard forgives -- straight-line extraction/merge, not branchy logic. */
function extractPortLabelPositions(
  svg: string,
  input: DotInputGraph,
  snapNodes: LayoutSnapshot['nodes'],
): Map<string, { headX?: number; headY?: number; tailX?: number; tailY?: number }> {
  const result = new Map<string, { headX?: number; headY?: number; tailX?: number; tailY?: number }>();
  const offset = computeRenderOffset(svg, snapNodes);
  if (offset === undefined) return result;

  const blockQueues = new Map<string, PortLabelBlock[]>();
  for (const block of parsePortLabelBlocks(svg)) {
    const k = edgeKey(block.tail, block.head);
    const arr = blockQueues.get(k) ?? [];
    arr.push(block);
    blockQueues.set(k, arr);
  }

  const nodeIds = new Set(input.nodes.map((n) => n.id));
  for (const e of input.edges) {
    if (!nodeIds.has(e.from) || !nodeIds.has(e.to)) continue;
    const q = blockQueues.get(edgeKey(e.from, e.to));
    const block = q !== undefined && q.length > 0 ? q.shift() : undefined;
    if (block === undefined) continue;
    const { head, tail } = pickPortLabelTexts(block, e.attributes);
    if (head === undefined && tail === undefined) continue;
    result.set(e.id, {
      ...(head !== undefined ? { headX: head.x - offset.dx, headY: head.y - offset.dy } : {}),
      ...(tail !== undefined ? { tailX: tail.x - offset.dx, tailY: tail.y - offset.dy } : {}),
    });
  }
  return result;
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
    if (e.tailLabelX !== undefined) e.tailLabelX -= minX;
    if (e.tailLabelY !== undefined) e.tailLabelY -= minY;
    if (e.headLabelX !== undefined) e.headLabelX -= minX;
    if (e.headLabelY !== undefined) e.headLabelY -= minY;
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
  layoutInputObserver?.(input);
  if (input.nodes.length === 0) {
    return { nodes: [], edges: [], width: 0, height: 0 };
  }
  const engine = opts?.engine ?? 'dot';

  const b = createGraph({ directed: true });
  applyGraphAttrs(b, input);
  addNodes(b, input);
  addClusters(b, input);
  const idx = addEdges(b, input);

  // render triggers layout; getLayout alone returns zeroed coords. Its own
  // SVG return value is normally unneeded (getLayout covers every other
  // consumer) -- captured only when some edge requested a tail/head label
  // position (G2/N25), the one thing getLayout's public snapshot can't
  // report (see `extractPortLabelPositions`'s own doc comment).
  const needsPortLabels = input.edges.some(
    (e) => e.attributes?.tailLabel !== undefined || e.attributes?.headLabel !== undefined,
  );
  const renderedSvg = render(b.graph, 'svg', { engine });
  const snap = getLayout(b.graph, { yAxis: 'down' });

  const nodes = mapNodes(snap);
  const edges = mapEdges(snap, idx);
  if (needsPortLabels) {
    const portLabels = extractPortLabelPositions(renderedSvg, input, snap.nodes);
    for (const e of edges) {
      const pl = portLabels.get(e.id);
      if (pl === undefined) continue;
      if (pl.headX !== undefined) e.headLabelX = pl.headX;
      if (pl.headY !== undefined) e.headLabelY = pl.headY;
      if (pl.tailX !== undefined) e.tailLabelX = pl.tailX;
      if (pl.tailY !== undefined) e.tailLabelY = pl.tailY;
    }
  }
  shiftToOrigin(nodes, edges);
  const { width, height } = canvasSize(nodes, edges);

  return { nodes, edges, width, height };
}

export type {
  DotInputNode,
  DotInputNodeShape,
  DotInputEdge,
  DotInputCluster,
  DotInputGraph,
  DotLayoutResult,
} from './graph-layout.types.js';
