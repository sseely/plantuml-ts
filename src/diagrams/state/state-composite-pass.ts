/**
 * Recursive svek-pass builder (mission A4/T4) — walks the composite tree,
 * building one `DotInputGraph` per "pass boundary" (the top-level diagram, or
 * an autonom composite) and running `layoutGraph()` for each AS ENCOUNTERED
 * during the depth-first walk. Because an autonom composite's own pass is
 * built (and its `layoutGraph()` call fired) BEFORE the function returns to
 * its caller, and the top-level's own call only fires after the whole tree
 * has been walked, the natural call order is: every descendant autonom pass,
 * deepest-first, THEN the (immediate) container — matching
 * `CucaDiagramSimplifierState`'s bottom-up dump order (mechanisms.md §3)
 * without needing an explicit driver loop.
 *
 * Non-autonom composites are NOT a pass boundary: their members recurse
 * straight into the CURRENT pass's node/edge/cluster accumulator, nested via
 * `DotInputCluster.parentId` — matching `GroupMakerState.getImage()`, which
 * is only ever invoked for autonom groups (mechanisms.md §3, bajelo-54-dixe684
 * confirms an autonom pass can itself contain nested clusters for its own
 * non-autonom children).
 *
 * Two independent outputs come out of the same walk: the flat
 * `PassAccumulator` (nodes/edges/clusters — what actually gets laid out and
 * DOT-emitted) and a `GeoSpec` TREE (what the renderer needs — real visual
 * nesting, not the emitter's flat `parentId` scheme).
 *
 * @see ~/git/plantuml/.../svek/GroupMakerState.java
 */

import type { State, StateDiagramAST, Transition, StateKind } from './ast.js';
import type { Theme } from '../../core/theme.js';
import type { FontSpec, StringMeasurer } from '../../core/measurer.js';
import { layoutGraph } from '../../core/graph-layout.js';
import type { DotInputNode, DotInputEdge, DotInputCluster, DotInputGraph, DotLayoutResult } from '../../core/graph-layout.js';
import { measureState, splitCreoleLines, CIRCLE_START_SIZE, CIRCLE_END_SIZE } from './state-sizing.js';
import { measureAutonomWrapper, type AutonomOffset } from './state-composite-sizing.js';
import { classifyDiagram, zaentId, resolveEndpoint, type ClassifyResult } from './state-composite-classify.js';
import { hasLocalContent } from './state-composite-detect.js';
import { getEntityPosition, isInputPosition, isOutputPosition, BORDER_POINT_SIZE } from './state-entity-position.js';
import type { TransitionGeo } from './state-geo-types.js';
import { attachTransitionLabel } from './state-transition-label.js';
import { buildEdgeAttrs } from './state-composite-edge-label.js';
import { buildConcurrentAutonomSpec } from './state-composite-concurrent.js';

export interface DiagramCtx {
  theme: Theme;
  measurer: StringMeasurer;
  rankdir: 'TB' | 'LR';
  classify: ClassifyResult;
  /** Every REGULAR (non-`'[*]'`) transition in the WHOLE diagram, flattened
   *  regardless of syntactic declaring scope -- see `collectRegularTransitions`
   *  and `sweepOrphanEdges` below (mission A4 Phase L iter 6, link-hoisting
   *  doc). */
  pool: readonly Transition[];
  /** Transition objects already added to SOME pass's `PassAccumulator` --
   *  tracked by object identity so `sweepOrphanEdges` only ever supplies the
   *  ones the existing per-scope `addLevelEdges` mechanism never reached. */
  consumed: Set<Transition>;
}

/** Zero-size placeholder — Svek's `.01in` synthetic anchor node
 *  (ClusterDotString.empty()), converted to our px convention (0.01in*72px). */
const ANCHOR_SIZE = 0.72;
/** One `[*]`-referencing scope's local start/end anchor ids — scoped per
 *  composite (own id) or '' for the top level (pre-existing per-scope
 *  convention, StateDiagram#getStart/getEnd). */
function scopedPseudoIds(scopeId: string): { initialId: string; finalId: string } {
  return scopeId === ''
    ? { initialId: '__initial__', finalId: '__final__' }
    : { initialId: `__init_${scopeId}`, finalId: `__final_${scopeId}` };
}

function usesPseudo(transitions: readonly Transition[]): { start: boolean; end: boolean } {
  return {
    start: transitions.some((t) => t.from === '[*]'),
    end: transitions.some((t) => t.to === '[*]'),
  };
}

/** A leaf node's DOT sizing — normal-kind measurement or the fixed
 *  border-point box (EntityPosition != NORMAL overrides StateKind sizing
 *  regardless of stereotype-derived kind — mechanisms.md §1). */
function buildLeafNode(s: State, ctx: DiagramCtx): DotInputNode {
  if (getEntityPosition(s) !== 'normal') {
    // isPort: true — EntityPosition.usePortP() is true for ENTRY_POINT/
    // EXIT_POINT too, not just PORTIN/PORTOUT (mechanisms.md §4): drives
    // the `:P` edge-ref suffix AND the cluster emitter's port/rank-group
    // placement (state-entity-position.ts, resolveClusterComposite below).
    return { id: s.id, width: BORDER_POINT_SIZE, height: BORDER_POINT_SIZE, shape: 'rect', isPort: true };
  }
  const measured = measureState(s, false, ctx.theme, ctx.measurer, ctx.rankdir);
  return { id: s.id, width: measured.width, height: measured.height, shape: measured.shape };
}

/** Geometry-tree spec — mirrors visual nesting (unlike the flat
 *  `DotInputCluster.nodeIds`/`parentId` scheme the emitter/layout consume).
 *  ./state-composite-geo.ts materializes this into `StateNodeGeo[]` once a
 *  pass's `DotLayoutResult` (real positions) is available. */
export type GeoSpec =
  | { kind: 'state'; id: string; stateKind: StateKind; display: string }
  | {
      kind: 'autonom';
      id: string;
      display: string;
      offset: AutonomOffset;
      width: number;
      height: number;
      localStates: readonly GeoSpec[];
      localPositions: DotLayoutResult;
      localTransitions: readonly TransitionGeo[];
    }
  | { kind: 'cluster'; id: string; display: string; children: readonly GeoSpec[] };

export interface PassAccumulator {
  nodes: DotInputNode[];
  edges: DotInputEdge[];
  clusters: DotInputCluster[];
  /** (transition, edgeId) pairs for THIS pass — used post-layout to build
   *  TransitionGeo entries (label placement needs the routed points). */
  edgeSources: { t: Transition; edgeId: string }[];
}

export function newAccumulator(): PassAccumulator {
  return { nodes: [], edges: [], clusters: [], edgeSources: [] };
}

let edgeCounter = 0;
function nextEdgeId(): string {
  edgeCounter += 1;
  return `edge-${edgeCounter}`;
}

/** `cluster0`, `cluster1`, … — matches the DOT-parity comparator's
 *  `^cluster\d+$` regex (tests/oracle/svek-dot.ts's `parseClusters`), same
 *  numeric-suffix convention as class-dot-graph.ts/description/layout.ts's
 *  cluster id generators (not `s.id`-derived — several composites can share
 *  a display name across nesting scopes). */
let clusterCounter = 0;
function nextClusterId(): string {
  const id = `cluster${clusterCounter}`;
  clusterCounter += 1;
  return id;
}

/** Reset the global edge-id/cluster-id counters — call once per top-level
 *  `layoutState` invocation so ids stay deterministic/reproducible across
 *  renders (no Date.now()/Math.random() in this pipeline, per repo
 *  convention). */
export function resetEdgeCounter(): void {
  edgeCounter = 0;
  clusterCounter = 0;
}

export function addLocalPseudoNodes(scopeId: string, transitions: readonly Transition[], acc: PassAccumulator): GeoSpec[] {
  const { start, end } = usesPseudo(transitions);
  if (!start && !end) return [];
  const { initialId, finalId } = scopedPseudoIds(scopeId);
  const specs: GeoSpec[] = [];
  if (start) {
    acc.nodes.push({ id: initialId, width: CIRCLE_START_SIZE, height: CIRCLE_START_SIZE, shape: 'circle' });
    specs.push({ kind: 'state', id: initialId, stateKind: 'initial', display: '' });
  }
  if (end) {
    acc.nodes.push({ id: finalId, width: CIRCLE_END_SIZE, height: CIRCLE_END_SIZE, shape: 'circle' });
    specs.push({ kind: 'state', id: finalId, stateKind: 'final', display: '' });
  }
  return specs;
}

function levelEndpointId(raw: string, isFrom: boolean, scopeId: string, ctx: DiagramCtx): string {
  if (raw === '[*]') {
    const { initialId, finalId } = scopedPseudoIds(scopeId);
    return isFrom ? initialId : finalId;
  }
  return resolveEndpoint(raw, ctx.classify);
}

export function addLevelEdges(scopeId: string, transitions: readonly Transition[], acc: PassAccumulator, ctx: DiagramCtx): void {
  const font: FontSpec = { family: ctx.theme.fontFamily, size: ctx.theme.fontSize };
  for (const t of transitions) {
    const edgeId = nextEdgeId();
    const from = levelEndpointId(t.from, true, scopeId, ctx);
    const to = levelEndpointId(t.to, false, scopeId, ctx);
    acc.edges.push({ id: edgeId, from, to, attributes: buildEdgeAttrs(t, font, ctx) });
    acc.edgeSources.push({ t, edgeId });
    ctx.consumed.add(t);
  }
}

/**
 * Every REGULAR (non-`'[*]'`) transition in the diagram, flattened regardless
 * of the scope that syntactically declared it -- upstream link ownership is
 * by ENDPOINT ENTITY CONTAINER, not by declaration site (mission A4 Phase L
 * iter 6, link-hoisting doc: `state A { A --> B }` where `B` lives elsewhere,
 * figiza-55-migo973/zageca-24-zino008; `yesno --> yesyes` written at the
 * diagram's TOP scope while both entities are nested inside a DEEPER autonom
 * composite `yes`, nimana-36-veco708). Concurrent-region-owning composites
 * are treated as OPAQUE here (skipped, not recursed into) -- their own
 * transitions are already fully handled by `buildConcurrentAutonomSpec`'s
 * local `ids.has(...)`-based partitioning (mechanisms.md's ConcurrentStates
 * doc); folding them into this pool would double-handle an already-working,
 * orthogonal mechanism. `'[*]'` transitions are excluded -- upstream
 * materializes each `[*]` usage as a genuine scope-local pseudostate CHILD of
 * the scope that wrote it, so those stay on the existing per-scope path
 * (`addLocalPseudoNodes` + `addLevelEdges`), which is unaffected by this pool.
 * @see ~/git/plantuml/.../svek/GraphvizImageBuilder.java#buildImage (attempts
 *      EVERY diagram link, `for (Link link : dotData.getLinks())`)
 * @see ~/git/plantuml/.../svek/GroupMakerState.java#getPureInnerLinks (a
 *      group's own pass attempts only its subtree-contained subset)
 */
function collectRegularTransitions(ast: StateDiagramAST): Transition[] {
  const out: Transition[] = [];
  const isPseudo = (t: Transition): boolean => t.from === '[*]' || t.to === '[*]';
  const walk = (s: State): void => {
    if (s.concurrentRegions.length > 0) return;
    for (const t of s.transitions) if (!isPseudo(t)) out.push(t);
    for (const c of s.children) walk(c);
  };
  for (const t of ast.transitions) if (!isPseudo(t)) out.push(t);
  for (const s of ast.states) walk(s);
  return out;
}

/**
 * Supplemental attempt, run AFTER a pass's own scope-declared transitions are
 * added via `addLevelEdges` (unchanged, so every fixture with zero orphans
 * gets byte-identical edge insertion order/output) -- tries every remaining
 * diagram-wide REGULAR transition against THIS pass's own node set. Mirrors
 * upstream's "attempt every link at every pass, keep only the one where both
 * SvekNodes exist" model: `GraphvizImageBuilder#buildImage` wraps `new
 * SvekEdge(...)` in a try/catch that silently drops the link on
 * `IllegalStateException` when an endpoint has no `SvekNode` at THIS pass;
 * our equivalent is `graph-layout.ts#addEdges`'s existing dangling-node
 * filter (`if (!nodeIds.has(e.from) || !nodeIds.has(e.to)) continue;` --
 * "the old engine dropped dangling edges in buildWorkingGraph"), reused here
 * rather than re-implemented. A transition's resolved endpoints are only
 * ever valid NODE ids in exactly one pass's accumulator (entity ids are
 * globally unique), so attempting the pool at every pass boundary can never
 * produce a duplicate edge.
 * @see ~/git/plantuml/.../svek/GraphvizImageBuilder.java#buildImage
 */
function sweepOrphanEdges(acc: PassAccumulator, ctx: DiagramCtx): void {
  const nodeIds = new Set(acc.nodes.map((n) => n.id));
  const font: FontSpec = { family: ctx.theme.fontFamily, size: ctx.theme.fontSize };
  for (const t of ctx.pool) {
    if (ctx.consumed.has(t)) continue;
    const from = resolveEndpoint(t.from, ctx.classify);
    const to = resolveEndpoint(t.to, ctx.classify);
    if (!nodeIds.has(from) || !nodeIds.has(to)) continue;
    const edgeId = nextEdgeId();
    acc.edges.push({ id: edgeId, from, to, attributes: buildEdgeAttrs(t, font, ctx) });
    acc.edgeSources.push({ t, edgeId });
    ctx.consumed.add(t);
  }
}

/** Title dims for a composite's cluster label (svek's title TABLE — matches
 *  class-dot-graph.ts's namespace-title measurement precedent). */
function measureClusterTitle(display: string, ctx: DiagramCtx): { width: number; height: number } {
  const font: FontSpec = { family: ctx.theme.fontFamily, size: ctx.theme.fontSize };
  const lines = splitCreoleLines(display);
  let width = 0;
  let height = 0;
  for (const line of lines) {
    const m = ctx.measurer.measure(line, font);
    if (m.width > width) width = m.width;
    height += m.height;
  }
  return { width, height };
}

/** One composite MEMBER at any nesting depth: dispatches leaf / autonom /
 *  non-autonom-cluster. Always pushes flat DOT data into `acc` (the pass's
 *  own shared accumulator, regardless of cluster nesting depth); always
 *  returns a proper GeoSpec TREE node for the renderer. */
export function resolveMember(s: State, acc: PassAccumulator, ctx: DiagramCtx, parentClusterId: string | undefined): GeoSpec {
  // `hasLocalContent`, not bare children.length -- mission A4 Phase L
  // iter 5, its doc (state-composite-detect.ts) has the full mechanism
  // (GroupMakerState.getImage()'s countChildren()==0 leaf fallback).
  const isComposite = hasLocalContent(s);
  if (!isComposite) {
    acc.nodes.push(buildLeafNode(s, ctx));
    return { kind: 'state', id: s.id, stateKind: s.kind, display: s.display };
  }
  if (ctx.classify.kindOf.get(s.id) === 'autonom') {
    const spec = buildAutonomSpec(s, ctx);
    acc.nodes.push({ id: spec.id, width: spec.width, height: spec.height, shape: 'rounded' });
    return spec;
  }
  return resolveClusterComposite(s, acc, ctx, parentClusterId);
}

/** Resolve one composite as a non-autonom `Cluster`: recurse its own
 *  children/regions into the SAME pass accumulator (nesting via
 *  `parentId`), add the zaent anchor when needed, add its own scope-local
 *  `[*]` anchors, add its own inner transitions as edges of the SAME pass. */
function resolveClusterComposite(
  s: State,
  acc: PassAccumulator,
  ctx: DiagramCtx,
  parentClusterId: string | undefined,
): GeoSpec {
  const clusterId = nextClusterId();
  const title = measureClusterTitle(s.display, ctx);
  const cluster: DotInputCluster = {
    id: clusterId,
    nodeIds: [],
    label: s.display,
    labelWidth: title.width,
    labelHeight: title.height,
    ...(parentClusterId !== undefined ? { parentId: parentClusterId } : {}),
  };
  acc.clusters.push(cluster);

  const directMembers = [...s.children, ...s.concurrentRegions.flat()];
  const childSpecs = directMembers.map((c) => resolveMember(c, acc, ctx, clusterId));
  for (const c of directMembers) {
    if (ctx.classify.kindOf.get(c.id) !== 'cluster') cluster.nodeIds.push(c.id);
  }
  const pseudoSpecs = addLocalPseudoNodes(s.id, s.transitions, acc);
  for (const p of pseudoSpecs) cluster.nodeIds.push(p.id);
  if (ctx.classify.needsAnchor.has(s.id)) {
    const anchorId = zaentId(s.id);
    // The POINT NODE is strictly narrower than the port-block gate itself
    // (ClassifyResult.needsZaentPoint's doc, state-composite-classify.ts) --
    // a composite with real non-border content in its `ee` wrapper needs no
    // placeholder (bujuta-44-rovo666, diteme-18-favi840); `applyBorderPointRanks`
    // below still fires (self-guards to a no-op with no direct border-point
    // children) so `cluster.portAnchorId` staying a valid (if nodeless) id is
    // harmless -- state diagrams always take the WithLabel branch, which
    // never reads `portAnchorId` (see `portChainLines`'s `!labelOnEe` guard).
    if (ctx.classify.needsZaentPoint.has(s.id)) {
      acc.nodes.push({ id: anchorId, width: ANCHOR_SIZE, height: ANCHOR_SIZE, shape: 'point' });
      cluster.nodeIds.push(anchorId);
    }
    applyBorderPointRanks(directMembers, cluster, anchorId);
  }
  addLevelEdges(s.id, s.transitions, acc, ctx);

  return { kind: 'cluster', id: s.id, display: s.display, children: [...pseudoSpecs, ...childSpecs] };
}

/** Run one CHILD pass's layout — `omitSepAttrs: true` (D3, additive
 *  graph-layout.types.ts extension) so the Svek-DOT emitter prints NO
 *  nodesep/ranksep line at all, matching `GroupMakerState`'s empty
 *  `dotStrings[]` placeholder (mechanisms.md §3). The REAL layout engine
 *  (graph-layout.ts) already omits them whenever `nodeSep`/`rankSep` are
 *  undefined (never set here) — `omitSepAttrs` only affects the emitter. */
/** Group a non-autonom composite's DIRECT border-point (entry/exit/pin)
 *  children into `cluster.portRanks` by input/output position — reuses the
 *  same rank-group DOT shape as genuine PORTIN/PORTOUT ports (needed so the
 *  DOT-parity comparator's brace-stack `{rank=...}` quirk zeroes out this
 *  cluster's member count on BOTH sides symmetrically — see
 *  graph-layout.types.ts's `portRanksLabelOnEe` doc), with the WithLabel/
 *  no-chain rendering (state diagrams never produce PORTIN/PORTOUT, so the
 *  NoLabel/chained hasPort() branch never applies here). No-op when `s` has
 *  no border-point direct children. */
function applyBorderPointRanks(
  directMembers: readonly State[],
  cluster: DotInputCluster,
  anchorId: string,
): void {
  const inputs = directMembers.filter((c) => isInputPosition(getEntityPosition(c))).map((c) => c.id);
  const outputs = directMembers.filter((c) => isOutputPosition(getEntityPosition(c))).map((c) => c.id);
  if (inputs.length === 0 && outputs.length === 0) return;
  cluster.portRanks = [
    ...(inputs.length > 0 ? [{ rank: 'source' as const, nodeIds: inputs }] : []),
    ...(outputs.length > 0 ? [{ rank: 'sink' as const, nodeIds: outputs }] : []),
  ];
  cluster.portAnchorId = anchorId;
  cluster.portRanksLabelOnEe = true;
}

export function runPass(acc: PassAccumulator, ctx: DiagramCtx): DotLayoutResult {
  if (acc.nodes.length === 0) return { nodes: [], edges: [], width: 0, height: 0 };
  const graph: DotInputGraph = {
    nodes: acc.nodes,
    edges: acc.edges,
    rankDir: ctx.rankdir,
    omitSepAttrs: true,
    ...(acc.clusters.length > 0 ? { clusters: acc.clusters } : {}),
  };
  return layoutGraph(graph);
}

/** Fully-labeled TransitionGeo for one pass's own edges — in that pass's OWN
 *  (possibly locally-rooted, pre-shift) coordinate space. Exported for reuse
 *  by ./state-composite-geo.ts's top-level assembly (same helper, no need
 *  for a second copy at the geometry layer). */
export function buildLevelTransitionGeos(acc: PassAccumulator, result: DotLayoutResult): TransitionGeo[] {
  const edgePosMap = new Map(result.edges.map((e) => [e.id, e]));
  const geos: TransitionGeo[] = [];
  for (const { t, edgeId } of acc.edgeSources) {
    const edgeResult = edgePosMap.get(edgeId);
    if (edgeResult === undefined) continue;
    const label = attachTransitionLabel(t, edgeResult.points);
    geos.push({ from: t.from, to: t.to, points: edgeResult.points, ...(label !== undefined ? { label } : {}) });
  }
  return geos;
}

/** Build ONE plain (region-free) composite's own child pass: recurse its
 *  children/inner transitions into a FRESH accumulator, run `layoutGraph()`
 *  (the dump — no nodeSep/rankSep, mechanisms.md §3), wrap the result per
 *  InnerStateAutonom's title+body+child-image formula. */
function buildPlainAutonomSpec(s: State, ctx: DiagramCtx): Extract<GeoSpec, { kind: 'autonom' }> {
  const acc = newAccumulator();
  const memberSpecs = s.children.map((c) => resolveMember(c, acc, ctx, undefined));
  const pseudoSpecs = addLocalPseudoNodes(s.id, s.transitions, acc);
  addLevelEdges(s.id, s.transitions, acc, ctx);
  sweepOrphanEdges(acc, ctx);
  const result = runPass(acc, ctx);
  const wrapper = measureAutonomWrapper(s, { width: result.width, height: result.height }, ctx.theme, ctx.measurer);
  return {
    kind: 'autonom',
    id: s.id,
    display: s.display,
    offset: wrapper.childOffset,
    width: wrapper.width,
    height: wrapper.height,
    localStates: [...pseudoSpecs, ...memberSpecs],
    localPositions: result,
    localTransitions: buildLevelTransitionGeos(acc, result),
  };
}

function buildAutonomSpec(s: State, ctx: DiagramCtx): Extract<GeoSpec, { kind: 'autonom' }> {
  return s.concurrentRegions.length > 0 ? buildConcurrentAutonomSpec(s, ctx) : buildPlainAutonomSpec(s, ctx);
}

/** Top-level entry point: resolve the whole diagram's top scope into ONE
 *  final pass (dumped LAST, carrying nodesep/ranksep — mechanisms.md §3). */
export function buildTopLevelPass(
  ast: StateDiagramAST,
  theme: Theme,
  measurer: StringMeasurer,
): { acc: PassAccumulator; result: DotLayoutResult; ctx: DiagramCtx; specs: GeoSpec[] } {
  resetEdgeCounter();
  const rankdir: 'TB' | 'LR' = ast.rankdir === 'left-to-right' ? 'LR' : 'TB';
  const classify = classifyDiagram(ast.states, ast.transitions);
  const pool = collectRegularTransitions(ast);
  const ctx: DiagramCtx = { theme, measurer, rankdir, classify, pool, consumed: new Set() };
  const acc = newAccumulator();
  const specs = ast.states.map((s) => resolveMember(s, acc, ctx, undefined));
  const pseudoSpecs = addLocalPseudoNodes('', ast.transitions, acc);
  addLevelEdges('', ast.transitions, acc, ctx);
  sweepOrphanEdges(acc, ctx);
  if (acc.nodes.length === 0) {
    return { acc, result: { nodes: [], edges: [], width: 0, height: 0 }, ctx, specs: [] };
  }
  const graph: DotInputGraph = {
    nodes: acc.nodes,
    edges: acc.edges,
    rankDir: rankdir,
    nodeSep: theme.nodeSep ?? 35,
    rankSep: theme.rankSep ?? 60,
    ...(theme.nodeSep !== undefined ? { nodeSepExplicit: true } : {}),
    ...(theme.rankSep !== undefined ? { rankSepExplicit: true } : {}),
    ...(acc.clusters.length > 0 ? { clusters: acc.clusters } : {}),
  };
  const result = layoutGraph(graph);
  return { acc, result, ctx, specs: [...pseudoSpecs, ...specs] };
}
