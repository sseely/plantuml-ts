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

import type { NotePosition, State, StateDiagramAST, Transition, StateKind } from './ast.js';
import type { Theme } from '../../core/theme.js';
import type { FontSpec, StringMeasurer } from '../../core/measurer.js';
import { layoutGraph } from '../../core/graph-layout.js';
import type { DotInputNode, DotInputEdge, DotInputCluster, DotInputGraph, DotLayoutResult } from '../../core/graph-layout.js';
import { measureState, splitCreoleLines, CIRCLE_START_SIZE, CIRCLE_END_SIZE } from './state-sizing.js';
import { measureAutonomWrapper, stackConcurrentRegions, type AutonomOffset } from './state-composite-sizing.js';
import { classifyDiagram, zaentId, resolveEndpoint, type ClassifyResult } from './state-composite-classify.js';
import { hasLocalContent } from './state-composite-detect.js';
import { getEntityPosition, isInputPosition, isOutputPosition, BORDER_POINT_SIZE } from './state-entity-position.js';
import type { TransitionGeo } from './state-geo-types.js';
import { attachTransitionLabel } from './state-transition-label.js';

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

/** `note on link` box padding — duplicated from ./state-dot-graph.ts (D1,
 *  same avoid-import-cycle rationale as `transitionLabelOf` above). Mirrors
 *  class engine's note-on-entity measurement (class/note-layout.ts). */
const LINK_NOTE_HPAD = 8;
const LINK_NOTE_VPAD = 6;
const LINK_NOTE_FOLD = 10;

interface LabelDims {
  width: number;
  height: number;
}

function measureLinkNote(text: string, font: FontSpec, measurer: StringMeasurer): LabelDims {
  const lines = text.split('\n');
  const lineHeight = font.size * 1.4;
  let maxW = 0;
  for (const ln of lines) maxW = Math.max(maxW, measurer.measure(ln, font).width);
  return {
    width: maxW + LINK_NOTE_HPAD * 2 + LINK_NOTE_FOLD,
    height: lines.length * lineHeight + LINK_NOTE_VPAD * 2,
  };
}

/** Combine a transition's own label with its attached `note on link` — see
 *  ./state-dot-graph.ts's `mergeNoteWithLabel` (SvekEdge.java:308-326). */
function mergeNoteWithLabel(label: LabelDims | undefined, note: LabelDims, position: NotePosition): LabelDims {
  if (label === undefined) return note;
  if (position === 'left' || position === 'right') {
    return { width: label.width + note.width, height: Math.max(label.height, note.height) };
  }
  return { width: Math.max(label.width, note.width), height: label.height + note.height };
}

function edgeLabelAttrs(t: Transition, font: FontSpec, measurer: StringMeasurer): NonNullable<DotInputEdge['attributes']> {
  const text = transitionLabelOf(t);
  const labelDims = text === undefined ? undefined : measurer.measure(text, font);
  const noteDims = t.linkNote === undefined ? undefined : measureLinkNote(t.linkNote, font, measurer);
  if (labelDims === undefined && noteDims === undefined) return {};
  const merged =
    noteDims === undefined ? labelDims! : mergeNoteWithLabel(labelDims, noteDims, t.linkNotePosition ?? 'bottom');
  return { label: text ?? t.linkNote ?? '', labelWidth: merged.width, labelHeight: merged.height };
}

/** Under `skinparam linetype ortho`, svek routes the main edge label through
 *  `xlabel` instead of `label` (SvekEdge.java:434-441) — duplicated from
 *  ./state-dot-graph.ts's `moveLabelToXlabel` (D1). */
function moveLabelToXlabel(attrs: NonNullable<DotInputEdge['attributes']>): void {
  if (attrs.label === undefined) return;
  attrs.xlabel = attrs.label;
  attrs.xlabelWidth = attrs.labelWidth!;
  attrs.xlabelHeight = attrs.labelHeight!;
  delete attrs.label;
  delete attrs.labelWidth;
  delete attrs.labelHeight;
}

function buildEdgeAttrs(t: Transition, font: FontSpec, ctx: DiagramCtx): NonNullable<DotInputEdge['attributes']> {
  const attrs: NonNullable<DotInputEdge['attributes']> = {
    minLen: (t.length ?? 2) - 1,
    ...edgeLabelAttrs(t, font, ctx.measurer),
  };
  if (ctx.theme.linetype === 'ortho') moveLabelToXlabel(attrs);
  return attrs;
}

function addLevelEdges(scopeId: string, transitions: readonly Transition[], acc: PassAccumulator, ctx: DiagramCtx): void {
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
function resolveMember(s: State, acc: PassAccumulator, ctx: DiagramCtx, parentClusterId: string | undefined): GeoSpec {
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

/** ConcurrentStates: region 0 (`s.children` — S's own direct pre-separator
 *  content, popScope's doc) stacks visually FIRST, then each synthetic
 *  `CONC1`, `CONC2`, ... region (`s.concurrentRegions`) in declaration
 *  order (`ConcurrentStates`' `inners` list, index 0 = the non-concurrent
 *  leafs build — GroupMakerState.java:124-129). DUMP order (the sequence
 *  `layoutGraph()`/`runPass()` actually fires in, i.e. svek-N numbering)
 *  is DIFFERENT from visual order: `CucaDiagramSimplifierState`'s bottom-up
 *  driver (mechanisms.md §3) resolves every OTHER child group of `s` before
 *  `s` itself — nested composites WITHIN region 0 that are independently
 *  autarkic dump at their natural (declaration) position via `resolveMember`
 *  (region 0 is textually first, so those precede every CONC region's own
 *  dump); each CONC region is `GroupType.CONCURRENT_STATE` and thus ALWAYS
 *  autarkic (short-circuit true), so it dumps unconditionally; region 0's
 *  OWN wrapping pass (`GroupMakerState.getImage()`'s
 *  `filter(group.leafs())` build, GroupMakerState.java:125-126) only fires
 *  once `s` itself is resolved — LATER than every CONC region, since `s` is
 *  shallower than its own child groups. Verified via darime-88-moda428 (own
 *  nested composite non-autarkic: dumps [CONC1, region0-build, outer]) and
 *  sapelo-46-jafe280 (own nested composite autarkic: dumps [nested-own,
 *  CONC1, region0-build, outer]) — `resolveMember`'s existing depth-first
 *  recursion already produces the nested-own-dump-first behavior for free;
 *  only the CONC-region-then-region0-build split needed to be built here.
 *  Inner transitions are partitioned by which region (or neither) their
 *  non-`[*]` endpoint belongs to — our AST has no per-region transition
 *  provenance (state-parse-state.ts's `owner.transitions` is one flat array
 *  for the whole scope), so membership is inferred from endpoint id
 *  (best-effort; every fixture in the corpus that exercises this keeps
 *  region membership unambiguous by construction).
 * @see ~/git/plantuml/.../dot/CucaDiagramSimplifierState.java#simplify
 * @see ~/git/plantuml/.../svek/GroupMakerState.java#getImage
 */
function buildConcurrentAutonomSpec(s: State, ctx: DiagramCtx): Extract<GeoSpec, { kind: 'autonom' }> {
  const regionIdSets = s.concurrentRegions.map((region) => new Set(region.map((c) => c.id)));
  const ownIds = new Set(s.children.map((c) => c.id));
  const transitionsFor = (ids: ReadonlySet<string>): Transition[] =>
    s.transitions.filter((t) => ids.has(t.from) || ids.has(t.to));

  // Resolve region 0's members (and any independently-autarkic nested
  // composite's own dump) before touching the CONC regions — DEFER region
  // 0's own runPass()/dump until after every CONC region has resolved.
  const ownBuild =
    s.children.length > 0 ? buildConcurrentBranchAcc(s.children, transitionsFor(ownIds), s.id, ctx) : undefined;

  const regionPasses = s.concurrentRegions.map((region, i) =>
    runOneConcurrentBranch(region, transitionsFor(regionIdSets[i]!), s.id, ctx),
  );

  const ownPass =
    ownBuild !== undefined
      ? { acc: ownBuild.acc, result: runPass(ownBuild.acc, ctx), specs: ownBuild.specs }
      : undefined;

  // Visual stacking order matches SOURCE order (region 0 on top).
  const passes = ownPass !== undefined ? [ownPass, ...regionPasses] : regionPasses;

  const stacked = stackConcurrentRegions(passes.map((p) => ({ width: p.result.width, height: p.result.height })));
  const wrapper = measureAutonomWrapper(s, stacked, ctx.theme, ctx.measurer);
  return combineConcurrentPasses(s, passes, wrapper);
}

/** Resolve one concurrent branch's members into a FRESH accumulator —
 *  split from `runOneConcurrentBranch` so `buildConcurrentAutonomSpec` can
 *  defer region 0's `runPass()` call (its DUMP) until after every CONC
 *  region has resolved, while still resolving region 0's own MEMBERS (and
 *  any nested autarkic composite's own dump) at their natural depth-first
 *  position. */
function buildConcurrentBranchAcc(
  states: readonly State[],
  transitions: readonly Transition[],
  scopeId: string,
  ctx: DiagramCtx,
): { acc: PassAccumulator; specs: GeoSpec[] } {
  const acc = newAccumulator();
  const memberSpecs = states.map((c) => resolveMember(c, acc, ctx, undefined));
  const pseudoSpecs = addLocalPseudoNodes(scopeId, transitions, acc);
  addLevelEdges(scopeId, transitions, acc, ctx);
  return { acc, specs: [...pseudoSpecs, ...memberSpecs] };
}

function runOneConcurrentBranch(
  states: readonly State[],
  transitions: readonly Transition[],
  scopeId: string,
  ctx: DiagramCtx,
): { acc: PassAccumulator; result: DotLayoutResult; specs: GeoSpec[] } {
  const { acc, specs } = buildConcurrentBranchAcc(states, transitions, scopeId, ctx);
  return { acc, result: runPass(acc, ctx), specs };
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
