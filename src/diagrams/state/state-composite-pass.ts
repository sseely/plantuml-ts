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
import { measureAutonomWrapper, stackConcurrentRegions, type AutonomOffset } from './state-composite-sizing.js';
import { classifyDiagram, zaentId, resolveEndpoint, type ClassifyResult } from './state-composite-classify.js';
import { getEntityPosition, isInputPosition, isOutputPosition, BORDER_POINT_SIZE } from './state-entity-position.js';
import type { TransitionGeo } from './state-geo-types.js';
import { attachTransitionLabel } from './state-transition-label.js';

export interface DiagramCtx {
  theme: Theme;
  measurer: StringMeasurer;
  rankdir: 'TB' | 'LR';
  classify: ClassifyResult;
}

/** Zero-size placeholder — Svek's `.01in` synthetic anchor node
 *  (ClusterDotString.empty()), converted to our px convention (0.01in*72px). */
const ANCHOR_SIZE = 0.72;
/** ConcurrentStates region-stack separator, reused for the composite's own
 *  non-region leaf pass's vertical offset (see state-composite-sizing.ts). */
const REGION_GAP = 60;

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

function newAccumulator(): PassAccumulator {
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

function addLocalPseudoNodes(scopeId: string, transitions: readonly Transition[], acc: PassAccumulator): GeoSpec[] {
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

/** Guard/action/plain label — same precedence as ./state-dot-graph.ts's
 *  `transitionLabelText` (duplicated to avoid an import cycle: layout.ts
 *  imports THIS module; both read the same four `Transition` fields). */
function transitionLabelOf(t: Transition): string | undefined {
  if (t.label !== undefined) return t.label;
  if (t.guard !== undefined && t.action !== undefined) return `[${t.guard}] / ${t.action}`;
  if (t.guard !== undefined) return `[${t.guard}]`;
  if (t.action !== undefined) return `/ ${t.action}`;
  return undefined;
}

function edgeLabelAttrs(t: Transition, font: FontSpec, measurer: StringMeasurer): NonNullable<DotInputEdge['attributes']> {
  const text = transitionLabelOf(t);
  if (text === undefined) return {};
  const m = measurer.measure(text, font);
  return { label: text, labelWidth: m.width, labelHeight: m.height };
}

function addLevelEdges(scopeId: string, transitions: readonly Transition[], acc: PassAccumulator, ctx: DiagramCtx): void {
  const font: FontSpec = { family: ctx.theme.fontFamily, size: ctx.theme.fontSize };
  for (const t of transitions) {
    const edgeId = nextEdgeId();
    const from = levelEndpointId(t.from, true, scopeId, ctx);
    const to = levelEndpointId(t.to, false, scopeId, ctx);
    acc.edges.push({ id: edgeId, from, to, attributes: { minLen: (t.length ?? 2) - 1, ...edgeLabelAttrs(t, font, ctx.measurer) } });
    acc.edgeSources.push({ t, edgeId });
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
function resolveMember(s: State, acc: PassAccumulator, ctx: DiagramCtx, parentClusterId: string | undefined): GeoSpec {
  const isComposite = s.children.length > 0 || s.concurrentRegions.length > 0;
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
    acc.nodes.push({ id: anchorId, width: ANCHOR_SIZE, height: ANCHOR_SIZE, shape: 'point' });
    cluster.nodeIds.push(anchorId);
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

function runPass(acc: PassAccumulator, ctx: DiagramCtx): DotLayoutResult {
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

/** ConcurrentStates: each region is its own always-autonom pass (dumped in
 *  source order), stacked vertically; a composite's non-region direct
 *  children (rare mixed case) get one more pass, dumped last among this
 *  composite's own new work (GroupMakerState.java:123-134). Inner
 *  transitions are partitioned by which region (or neither) their non-`[*]`
 *  endpoint belongs to — our AST has no per-region transition provenance
 *  (state-parse-state.ts's `owner.transitions` is one flat array for the
 *  whole scope), so membership is inferred from endpoint id (best-effort;
 *  every fixture in the corpus that exercises this keeps region membership
 *  unambiguous by construction).
 */
function buildConcurrentAutonomSpec(s: State, ctx: DiagramCtx): Extract<GeoSpec, { kind: 'autonom' }> {
  const regionIdSets = s.concurrentRegions.map((region) => new Set(region.map((c) => c.id)));
  const ownIds = new Set(s.children.map((c) => c.id));
  const transitionsFor = (ids: ReadonlySet<string>): Transition[] =>
    s.transitions.filter((t) => ids.has(t.from) || ids.has(t.to));

  const passes: { acc: PassAccumulator; result: DotLayoutResult; specs: GeoSpec[] }[] = [];
  if (s.children.length > 0) passes.push(runOneConcurrentBranch(s.children, transitionsFor(ownIds), s.id, ctx));
  for (let i = 0; i < s.concurrentRegions.length; i++) {
    passes.push(runOneConcurrentBranch(s.concurrentRegions[i]!, transitionsFor(regionIdSets[i]!), s.id, ctx));
  }

  const stacked = stackConcurrentRegions(passes.map((p) => ({ width: p.result.width, height: p.result.height })));
  const wrapper = measureAutonomWrapper(s, stacked, ctx.theme, ctx.measurer);
  return combineConcurrentPasses(s, passes, wrapper);
}

function runOneConcurrentBranch(
  states: readonly State[],
  transitions: readonly Transition[],
  scopeId: string,
  ctx: DiagramCtx,
): { acc: PassAccumulator; result: DotLayoutResult; specs: GeoSpec[] } {
  const acc = newAccumulator();
  const memberSpecs = states.map((c) => resolveMember(c, acc, ctx, undefined));
  const pseudoSpecs = addLocalPseudoNodes(scopeId, transitions, acc);
  addLevelEdges(scopeId, transitions, acc, ctx);
  return { acc, result: runPass(acc, ctx), specs: [...pseudoSpecs, ...memberSpecs] };
}

/** Shift a TransitionGeo's points AND label (if any) vertically by the
 *  region's stack offset — omitting the label shift was a real bug caught
 *  during T4's own review (a label would render at its PRE-stack y). */
function shiftTransitionY(t: TransitionGeo, dy: number): TransitionGeo {
  return {
    ...t,
    points: t.points.map((pt) => ({ x: pt.x, y: pt.y + dy })),
    ...(t.label !== undefined ? { label: { ...t.label, y: t.label.y + dy } } : {}),
  };
}

function combineConcurrentPasses(
  s: State,
  passes: readonly { acc: PassAccumulator; result: DotLayoutResult; specs: GeoSpec[] }[],
  wrapper: { width: number; height: number; childOffset: AutonomOffset },
): Extract<GeoSpec, { kind: 'autonom' }> {
  const localStates: GeoSpec[] = [];
  const localTransitions: TransitionGeo[] = [];
  let yShift = 0;
  const allNodes: DotLayoutResult['nodes'] = [];
  for (const p of passes) {
    for (const n of p.result.nodes) allNodes.push({ ...n, y: n.y + yShift });
    for (const t of buildLevelTransitionGeos(p.acc, p.result)) localTransitions.push(shiftTransitionY(t, yShift));
    localStates.push(...p.specs);
    yShift += p.result.height + REGION_GAP;
  }
  return {
    kind: 'autonom',
    id: s.id,
    display: s.display,
    offset: wrapper.childOffset,
    width: wrapper.width,
    height: wrapper.height,
    localStates,
    localPositions: { nodes: allNodes, edges: [], width: wrapper.width, height: wrapper.height },
    localTransitions,
  };
  // #lizard forgives -- faithful port of ConcurrentStates' vertical stack;
  // most of this function is a single accumulation loop.
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
  const classify = classifyDiagram(ast.states);
  const ctx: DiagramCtx = { theme, measurer, rankdir, classify };
  const acc = newAccumulator();
  const specs = ast.states.map((s) => resolveMember(s, acc, ctx, undefined));
  const pseudoSpecs = addLocalPseudoNodes('', ast.transitions, acc);
  addLevelEdges('', ast.transitions, acc, ctx);
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
