/**
 * frontier-shadow-layout.ts — obtains the "graphviz-assigned rectangle"
 * `FrontierCalculator`'s `initial` parameter needs (`svek/
 * FrontierCalculator.java`'s constructor takes `Cluster.getRectangleArea()`
 * — the raw box graphviz allocated the cluster's own DOT subgraph, parsed
 * from `DotStringFactory.java:425-434`'s `cluster.setPosition(min,max)`
 * BEFORE `manageEntryExitPoint` overwrites it).
 *
 * `graphviz-ts`'s public API (`LayoutSnapshot`, `getLayout()`) does not
 * expose per-cluster geometry (nodes/edges/overall bounds only) — and this
 * project treats `graphviz-ts` as an out-of-scope, pinned dependency (no
 * reaching into its internal `Graph`/`GraphInfo` model, which isn't part of
 * its public `exports` map either). What IS public: `render(graph, 'xdot',
 * opts)` (`graphviz-ts/render`), which re-serializes the laid-out graph as
 * xdot text — including every subgraph's own `bb="minx,miny,maxx,maxy"`
 * (verified byte-identical to real `dot -Txdot` for this exact shape, see
 * decision-journal.md's J2 entry).
 *
 * This module builds a small, ISOLATED shadow graph — mirroring `svek-dot-
 * emit.ts`'s own `portClusterBlock` structure exactly (ports ranked at the
 * cluster's own level with an ordering chain, a nested `${id}ee` subgraph
 * holding the port-chain's anchor) — runs it through graphviz-ts's public
 * `render(...,'xdot')`, and text-parses the cluster's own `bb=` plus each
 * port's `pos=` back out. It is deliberately NOT wired into the real
 * `layoutGraph()`/`addClusters` construction (the shared seam every diagram
 * type funnels through): reusing that seam here would mean widening the
 * REAL port-cluster's anchor sizing/nesting/edges for every diagram type, a
 * much larger blast radius than this mission's "port FrontierCalculator
 * faithfully" scope. Since a port cluster's horizontal spacing
 * (nodesep-driven) is ALREADY faithful in the real pipeline (verified:
 * `nodeSep`/`rankSep` and the resulting port-to-port gaps match jar's
 * exactly), the caller aligns this shadow calculation's own coordinate
 * frame to the real, already-resolved port positions via a single
 * reference-port translation (`frontier-cluster-bbox.ts
 * #computeAlignedInitial`) — sidestepping any need for the two graphs'
 * internal layouts to share an absolute origin.
 *
 * Scoped to PURE port-only containers (`frontier-cluster-bbox.ts
 * #computePortClusterBbox` only calls this when the cluster's `insides` is
 * empty) — no "insides" placeholder input here; see that module's doc
 * comment for why a mixed cluster falls back to the prior padded-union
 * formula instead of an approximated placeholder through this shadow calc.
 *
 * Node ids the REST of this port assigns (`dotKeyFor`) can carry characters
 * DOT requires quoting (e.g. `set separator .`'s qualified `srv1.br0`) --
 * xdot text-parsing a QUOTED id back out reliably (vs. this module's own
 * choice of always-bare id text) is needless extra risk for ids this
 * module never needs to expose to graphviz's own text syntax at all. So
 * every caller-supplied id is mapped to a synthetic, always-bare internal
 * id (`n0`, `n1`, ...) for graph construction AND xdot parsing, translated
 * back to the caller's own id only in this function's returned map.
 */

import { createGraph, render, setTextMeasurer, LutTextMeasurer } from 'graphviz-ts';
import type { RectangleArea, Point } from './frontier-calculator.js';

// plantuml-ts is a pure SVG library -- no DOM, no canvas (see graph-layout.ts's
// identical pin, this module's own independent graphviz-ts consumer). Text
// measurement is moot here (every shadow node is fixedsize with an empty
// label), but graphviz-ts still probes for a canvas-backed measurer at
// context-creation time unless one is pinned -- pin the canvas-free
// lookup-table measurer so this module works under jsdom/browsers too.
setTextMeasurer(new LutTextMeasurer());

const PX_PER_INCH = 72;
/** graphviz's own subgraph naming rule (`^cluster`) — a single, fixed name
 *  since each call builds exactly one isolated shadow cluster. */
const SHADOW_CLUSTER_NAME = 'clusterpc';
const SHADOW_EE_NAME = 'clusterpcee';
const ANCHOR_ID = 'na';

export interface ShadowPortSpec {
  readonly id: string;
  readonly width: number;
  readonly height: number;
}

export interface ShadowRankSpec {
  readonly rank: 'source' | 'sink';
  readonly ports: readonly ShadowPortSpec[];
}

export interface ShadowLayoutInput {
  readonly ranks: readonly ShadowRankSpec[];
  readonly anchorWidth: number;
  readonly anchorHeight: number;
  readonly nodeSep: number;
  readonly rankSep: number;
  readonly rankdir: 'TB' | 'LR';
}

export interface ShadowLayoutResult {
  /** The cluster's raw graphviz-assigned rect, in this shadow graph's own
   *  y-DOWN frame (not yet aligned to the real pipeline's frame). */
  readonly initial: RectangleArea;
  /** Every port's center point, keyed by the CALLER's own id (this
   *  module's own synthetic internal ids never escape this function), in
   *  the SAME shadow-graph y-DOWN frame. */
  readonly portCenters: ReadonlyMap<string, Point>;
}

/** One port with its caller-facing id resolved to this module's synthetic,
 *  always-bare-DOT-identifier internal id. */
interface SafePort extends ShadowPortSpec {
  readonly safeId: string;
}

interface SafeRank {
  readonly rank: ShadowRankSpec['rank'];
  readonly ports: readonly SafePort[];
}

function inches(px: number): string {
  return (px / PX_PER_INCH).toString();
}

/** Extracts `bb="minx,miny,maxx,maxy"` from the FIRST `graph [...]` block
 *  found in `text` (the root graph's own attrs always come first in xdot
 *  output, before any subgraph). */
function parseRootBounds(text: string): RectangleArea {
  const m = /\bbb="([^"]+)"/.exec(text);
  if (m === undefined || m === null) throw new Error('frontier-shadow-layout: no root bb= found');
  const [minX, minY, maxX, maxY] = m[1]!.split(',').map(Number);
  return { minX: minX!, minY: minY!, maxX: maxX!, maxY: maxY! };
}

/** Extracts the named subgraph's own `bb=`, scoped to the text starting at
 *  `subgraph <name> {` (its `graph [...]` line always comes first inside
 *  that block, before member node lines or a nested subgraph). Subgraph
 *  names are this module's own fixed constants (never caller-supplied), so
 *  no quoting concern applies here. */
function parseSubgraphBounds(text: string, name: string): RectangleArea {
  const start = new RegExp(`subgraph\\s+${name}\\s*\\{`).exec(text);
  if (start === undefined || start === null) {
    throw new Error(`frontier-shadow-layout: no subgraph ${name} found`);
  }
  const scoped = text.slice(start.index);
  const m = /\bbb="([^"]+)"/.exec(scoped);
  if (m === undefined || m === null) throw new Error(`frontier-shadow-layout: no bb= for ${name}`);
  const [minX, minY, maxX, maxY] = m[1]!.split(',').map(Number);
  return { minX: minX!, minY: minY!, maxX: maxX!, maxY: maxY! };
}

/** Extracts one node's `pos="x,y"` from its own (single-line) node
 *  statement. `id` is always one of this module's own synthetic bare
 *  identifiers (see this module's doc comment), never a caller-supplied
 *  one — no quoting concern applies here either. */
function parseNodePos(text: string, id: string): Point {
  const line = new RegExp(`^\\s*${id}\\s*\\[([^\\n]*)\\]`, 'm').exec(text);
  if (line === undefined || line === null) {
    throw new Error(`frontier-shadow-layout: no node statement for ${id}`);
  }
  const m = /\bpos="([^"]+)"/.exec(line[1]!);
  if (m === undefined || m === null) throw new Error(`frontier-shadow-layout: no pos= for ${id}`);
  const [x, y] = m[1]!.split(',').map(Number);
  return { x: x!, y: y! };
}

function toScreenRect(r: RectangleArea, totalHeight: number): RectangleArea {
  return { minX: r.minX, minY: totalHeight - r.maxY, maxX: r.maxX, maxY: totalHeight - r.minY };
}

function toScreenPoint(p: Point, totalHeight: number): Point {
  return { x: p.x, y: totalHeight - p.y };
}

/** Assigns a synthetic, always-bare-DOT-identifier `safeId` (`n0`, `n1`,
 *  ...) to every port, in rank order -- this module's doc comment. */
function assignSafeIds(ranks: readonly ShadowRankSpec[]): SafeRank[] {
  let n = 0;
  return ranks.map((r) => ({
    rank: r.rank,
    ports: r.ports.map((p) => ({ ...p, safeId: `n${n++}` })),
  }));
}

/** Adds a fixed-size, label-less rect node -- matching `graph-layout.ts
 *  #addNodes`' own convention (`fixedsize:true`+empty label means graphviz
 *  uses exactly the declared width/height, no auto-grow-to-content). */
function addFixedNode(
  b: ReturnType<typeof createGraph>,
  id: string,
  width: number,
  height: number,
): void {
  b.addNode(id, {
    shape: 'rect', fixedsize: 'true', label: '',
    width: inches(width), height: inches(height),
  });
}

/** One rank's ordering chain + bare chain-to-anchor link
 *  (`ClusterDotString.printRanks`' hasPort() branch, Cluster.java). */
function addRankChain(
  b: ReturnType<typeof createGraph>,
  sg: ReturnType<ReturnType<typeof createGraph>['addSubgraph']>,
  rank: SafeRank,
  rankIdx: number,
): void {
  const rsub = sg.addSubgraph(`__rank_${rankIdx}`, { rank: rank.rank });
  for (const p of rank.ports) rsub.addNode(p.safeId);
  for (let i = 0; i < rank.ports.length - 1; i++) {
    b.addEdge(rank.ports[i]!.safeId, rank.ports[i + 1]!.safeId, { arrowhead: 'none' });
  }
  // Bare (bracket-less) chain-to-anchor link -- default minlen=1/weight=1.
  b.addEdge(rank.ports[rank.ports.length - 1]!.safeId, ANCHOR_ID, {});
}

/** Builds the isolated shadow graph (see this module's doc comment):
 *  fixed-size port + anchor nodes, ports ranked at the cluster's own level
 *  with an ordering chain to the anchor, anchor nested one level down in
 *  `${id}ee`. */
function buildShadowGraph(
  input: ShadowLayoutInput,
  safeRanks: readonly SafeRank[],
): ReturnType<typeof createGraph> {
  const b = createGraph({ directed: true });
  b.setAttr('nodesep', inches(input.nodeSep));
  b.setAttr('ranksep', inches(input.rankSep));
  if (input.rankdir === 'LR') b.setAttr('rankdir', 'LR');

  for (const r of safeRanks) for (const p of r.ports) addFixedNode(b, p.safeId, p.width, p.height);
  addFixedNode(b, ANCHOR_ID, input.anchorWidth, input.anchorHeight);

  const sg = b.addSubgraph(SHADOW_CLUSTER_NAME, {});
  safeRanks.filter((r) => r.ports.length > 0).forEach((r, i) => addRankChain(b, sg, r, i));

  const ee = sg.addSubgraph(SHADOW_EE_NAME, {});
  ee.addNode(ANCHOR_ID);
  return b;
}

/** Builds and runs the isolated shadow graph (see this module's doc
 *  comment), returning the cluster's raw rect and every port's center
 *  (keyed by the CALLER's own id), in the shadow graph's own y-DOWN
 *  frame. */
export function computePortClusterInitialRect(input: ShadowLayoutInput): ShadowLayoutResult {
  const safeRanks = assignSafeIds(input.ranks);
  const b = buildShadowGraph(input, safeRanks);
  const xdot = render(b.graph, 'xdot', { engine: 'dot' });
  const totalHeight = parseRootBounds(xdot).maxY;
  const rawInitial = parseSubgraphBounds(xdot, SHADOW_CLUSTER_NAME);
  const portCenters = new Map<string, Point>();
  for (const r of safeRanks) {
    for (const p of r.ports) portCenters.set(p.id, toScreenPoint(parseNodePos(xdot, p.safeId), totalHeight));
  }
  return { initial: toScreenRect(rawInitial, totalHeight), portCenters };
}
