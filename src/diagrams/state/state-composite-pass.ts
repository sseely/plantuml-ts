/**
 * Svek-pass builder (mission A4/T4) — walks the composite tree, building one
 * `DotInputGraph` per "pass boundary" (the top-level diagram, or an autonom
 * composite). Pass FIRING order and tree-assembly RECURSION are decoupled
 * (mission A4 Phase L iteration 17 — `CucaDiagramSimplifierState.getOrdered`
 * port, state-composite-classify.ts's `firingOrder` doc has the full
 * mechanism): `resolveAllAutonomPasses` (./state-composite-autonom.ts,
 * mission G4 S3, moved out for the 500-line file cap) fires every autonom
 * composite's own `layoutGraph()` call ONCE, up front, strictly in
 * `ctx.classify.firingOrder` order (deepest nesting level first, source
 * order as tie-break within a level, WHOLE-TREE-WIDE) — NOT per-branch
 * depth-first. `resolveMember`'s tree-assembly recursion (still depth-first,
 * unchanged in shape) merely READS each autonom composite's already-computed
 * result from `ctx.resolvedAutonom` when it reaches one; it never fires a
 * pass itself. Firing-order correctness guarantees the lookup always hits:
 * any autonom composite `resolveMember` can reach during a shallower
 * composite's (or the top level's) own build is, by construction, one of
 * ITS descendants, hence strictly deeper, hence already resolved earlier in
 * the SAME firing-order loop.
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
 * @see ~/git/plantuml/.../dot/CucaDiagramSimplifierState.java#simplify
 */

import type { State, StateDiagramAST, Transition } from './ast.js';
import type { Theme } from '../../core/theme.js';
import type { FontSpec, StringMeasurer } from '../../core/measurer.js';
import { layoutGraph } from '../../core/graph-layout.js';
import type { DotInputNode, DotInputEdge, DotInputCluster, DotInputGraph, DotLayoutResult } from '../../core/graph-layout.js';
import { buildStateGeoTextFields } from './state-sizing.js';
import { classifyDiagram, resolveEndpoint } from './state-composite-classify.js';
import { hasLocalContent } from './state-composite-detect.js';
import { buildLeafNode } from './state-leaf-node.js';
import type { TransitionGeo } from './state-geo-types.js';
import { attachTransitionLabel } from './state-transition-label.js';
import { buildEdgeAttrs } from './state-composite-edge-label.js';
import { resolveAllAutonomPasses } from './state-composite-autonom.js';
import { resolveClusterComposite } from './state-composite-cluster.js';
import { buildNoteGraphPartsByScope, sweepOrphanNoteEdges } from './state-note-layout.js';
// mission G4 S7: pseudo-anchor id resolution + creation-order sibling
// sorting moved to ./state-composite-pseudo.ts (500-line file-cap
// compliance) -- imported for THIS file's own internal use
// (`addLevelEdges`/`buildTopLevelPass` below) AND re-exported so every
// pre-existing EXTERNAL importer of THIS module keeps working unchanged.
import { scopedPseudoIds, sortSpecsByCreationIndex, addLocalPseudoNodes, levelEndpointId } from './state-composite-pseudo.js';
export { scopedPseudoIds, sortSpecsByCreationIndex, addLocalPseudoNodes, levelEndpointId };

import type { DiagramCtx, GeoSpec } from './state-composite-pass-types.js';
// Re-exported so every pre-existing EXTERNAL importer of THIS module
// (`DiagramCtx`/`GeoSpec` from './state-composite-pass.js') keeps working
// unchanged after the G5 C3 types split (this file's own doc comment).
export type { DiagramCtx, GeoSpec };


/** Zero-size placeholder — Svek's `.01in` synthetic anchor node
 *  (ClusterDotString.empty()), converted to our px convention (0.01in*72px).
 *  Exported: `state-composite-cluster.ts`'s zaent-anchor-node push reuses
 *  this same constant, not a re-derived copy. */
export const ANCHOR_SIZE = 0.72;

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
/** Exported for `state-composite-cluster.ts`'s `resolveClusterComposite`. */
export function nextClusterId(): string {
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

/** Push scope `scopeId`'s note DOT nodes into `acc` -- and, for a cluster's
 *  own scope, into `cluster.nodeIds` too (mirrors `addLocalPseudoNodes`'s
 *  pattern for the same reason: a note declared inside a non-autonom
 *  composite's scope is a member of that cluster's subgraph). No-op for a
 *  scope with no notes. */
export function addScopeNotes(scopeId: string, ctx: DiagramCtx, acc: PassAccumulator, cluster?: DotInputCluster): void {
  const parts = ctx.noteParts.get(scopeId);
  if (parts === undefined) return;
  acc.nodes.push(...parts.nodes);
  if (cluster !== undefined) for (const n of parts.nodes) cluster.nodeIds.push(n.id);
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
 * composite `yes`, nimana-36-veco708). A concurrent-region-owning composite's
 * OWN `.transitions` are excluded (not its DESCENDANTS' -- mission A4 Phase L
 * iter 18, giniti-22-fexo000) -- those are already fully handled by
 * `buildConcurrentAutonomSpec`'s local `ids.has(...)`-based partitioning
 * (mechanisms.md's ConcurrentStates doc); folding them into this pool would
 * double-handle an already-working, orthogonal mechanism. The walk still
 * DESCENDS into both `s.children` and every concurrent region's own members
 * regardless of this exclusion -- a region-owning composite is opaque only
 * for ITS OWN transition set, not for its subtree: a deeply-nested regular
 * (non-region) descendant several levels under a `CONC`-owning ancestor can
 * still have a self-originating cross-composite transition (`Radio_Configuring
 * --> Vendor_Radio_Enabled`, written inside `state Radio_Configuring { ... }`,
 * itself nested under `state Radio_Root { ... -- state Radio_Commit_Root {} }`)
 * that only resolves once ITS OWN autonom/cluster ancestor chain has a node in
 * some pass -- exactly the same cross-pass retry `addLevelEdges`'s dangling
 * gate (above) depends on this pool for. Stopping the descent entirely at any
 * region-owning ancestor silently drops every such descendant transition with
 * no fallback. `'[*]'` transitions are excluded -- upstream materializes each
 * `[*]` usage as a genuine scope-local pseudostate CHILD of the scope that
 * wrote it, so those stay on the existing per-scope path (`addLocalPseudoNodes`
 * + `addLevelEdges`), which is unaffected by this pool.
 * @see ~/git/plantuml/.../svek/GraphvizImageBuilder.java#buildImage (attempts
 *      EVERY diagram link, `for (Link link : dotData.getLinks())`)
 * @see ~/git/plantuml/.../svek/GroupMakerState.java#getPureInnerLinks (a
 *      group's own pass attempts only its subtree-contained subset)
 */
function collectRegularTransitions(ast: StateDiagramAST): Transition[] {
  const out: Transition[] = [];
  const isPseudo = (t: Transition): boolean => t.from === '[*]' || t.to === '[*]';
  const walk = (s: State): void => {
    if (s.concurrentRegions.length === 0) {
      for (const t of s.transitions) if (!isPseudo(t)) out.push(t);
    }
    for (const c of s.children) walk(c);
    for (const region of s.concurrentRegions) for (const c of region) walk(c);
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
 * Exported: `state-composite-autonom.ts#buildPlainAutonomSpec` (mission G4
 * S3, moved out for the file-cap split) reuses this SAME function rather
 * than a re-derived copy.
 * @see ~/git/plantuml/.../svek/GraphvizImageBuilder.java#buildImage
 */
export function sweepOrphanEdges(acc: PassAccumulator, ctx: DiagramCtx): void {
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

/** One composite MEMBER at any nesting depth: dispatches leaf / autonom /
 *  non-autonom-cluster. Always pushes flat DOT data into `acc` (the pass's
 *  own shared accumulator, regardless of cluster nesting depth); always
 *  returns a proper GeoSpec TREE node for the renderer. The autonom branch
 *  is a pure LOOKUP (mission A4 Phase L iter 17) -- `resolveAllAutonomPasses`
 *  has already fired every autonom composite's own pass, in the correct
 *  GLOBAL order, before any `resolveMember` walk begins. */
export function resolveMember(s: State, acc: PassAccumulator, ctx: DiagramCtx, parentClusterId: string | undefined): GeoSpec {
  // `hasLocalContent`, not bare children.length -- mission A4 Phase L
  // iter 5, its doc (state-composite-detect.ts) has the full mechanism
  // (GroupMakerState.getImage()'s countChildren()==0 leaf fallback).
  const isComposite = hasLocalContent(s);
  if (!isComposite) {
    acc.nodes.push(buildLeafNode(s, ctx));
    return {
      kind: 'state', id: s.id, stateKind: s.kind, display: s.display,
      ...buildStateGeoTextFields(s, ctx.theme, ctx.measurer, ctx.hideEmptyDescription),
      ...(s.creationIndex !== undefined ? { creationIndex: s.creationIndex } : {}),
    };
  }
  if (ctx.classify.kindOf.get(s.id) === 'autonom') {
    const spec = ctx.resolvedAutonom.get(s.id);
    if (spec === undefined) {
      // Cannot occur given `firingOrder`'s depth-descending guarantee (see
      // its doc, state-composite-classify.ts) -- every autonom composite
      // `resolveMember` can reach is, by construction, strictly deeper than
      // whichever composite/top-level is CURRENTLY being assembled, hence
      // already resolved earlier in the same `resolveAllAutonomPasses` loop.
      // Thrown (not silently defaulted) so a future firing-order regression
      // fails loudly instead of emitting a bogus zero-size node.
      throw new Error(`autonom composite "${s.id}" resolved out of firing order`);
    }
    acc.nodes.push({ id: spec.id, width: spec.width, height: spec.height, shape: 'rounded' });
    return spec;
  }
  return resolveClusterComposite(s, acc, ctx, parentClusterId);
}

export function runPass(acc: PassAccumulator, ctx: DiagramCtx): DotLayoutResult {
  if (acc.nodes.length === 0) return { nodes: [], edges: [], width: 0, height: 0 };
  const graph: DotInputGraph = {
    nodes: acc.nodes,
    edges: acc.edges,
    rankDir: ctx.rankdir,
    omitSepAttrs: true,
    ...(acc.clusters.length > 0 ? { clusters: acc.clusters } : {}),
    // mission G4 S8 mechanism 19 -- see state-dot-graph.ts#buildDotGraph's
    // doc comment for the full derivation (mirrors G2 N29).
    manualArrowheads: true,
  };
  return layoutGraph(graph);
}

/** Fully-labeled TransitionGeo for one pass's own edges — in that pass's OWN
 *  (possibly locally-rooted, pre-shift) coordinate space. Exported for reuse
 *  by ./state-composite-geo.ts's top-level assembly (same helper, no need
 *  for a second copy at the geometry layer). */
export function buildLevelTransitionGeos(acc: PassAccumulator, result: DotLayoutResult): TransitionGeo[] {
  const edgePosMap = new Map(result.edges.map((e) => [e.id, e]));
  // mission G4 S7 (discovered while jar-verifying mechanism 10's own fix,
  // `nelupe-49-xova546`): a `'[*]'` transition's RESOLVED scope-local
  // pseudo-anchor id (`__init_<scopeId>`/`__final_<scopeId>`,
  // `levelEndpointId` above) already lives on `acc.edges` (`addLevelEdges`/
  // `sweepOrphanEdges` both resolve before pushing) -- reading `t.from`/
  // `t.to` directly off the ORIGINAL `Transition` instead re-introduces the
  // raw `'[*]'` AST token into `svgEndpointId`'s `<path id>` build
  // (renderer.ts), which only recognizes the FLAT pipeline's own
  // `INITIAL_ID`/`FINAL_ID` constants -- jar-verified
  // `id="*start*s7_2-to-chat1"` (expected) vs `id="[*]-to-chat1"` (this
  // port, pre-fix).
  const edgeEndpoints = new Map(acc.edges.map((e) => [e.id, { from: e.from, to: e.to }]));
  const geos: TransitionGeo[] = [];
  for (const { t, edgeId } of acc.edgeSources) {
    const edgeResult = edgePosMap.get(edgeId);
    if (edgeResult === undefined) continue;
    const label = attachTransitionLabel(t, edgeResult.points);
    const resolved = edgeEndpoints.get(edgeId);
    geos.push({
      from: resolved?.from ?? t.from, to: resolved?.to ?? t.to, points: edgeResult.points, ...(label !== undefined ? { label } : {}),
      ...(t.creationIndex !== undefined ? { creationIndex: t.creationIndex } : {}),
      ...(t.crossStart !== undefined ? { crossStart: t.crossStart } : {}),
      ...(t.circleEnd !== undefined ? { circleEnd: t.circleEnd } : {}),
    });
  }
  return geos;
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
  const noteParts = buildNoteGraphPartsByScope(ast.notes ?? [], theme, measurer, rankdir);
  const notePool = [...noteParts.values()].flatMap((p) => p.candidates);
  const ctx: DiagramCtx = {
    theme, measurer, rankdir, classify, pool, consumed: new Set(),
    noteParts, notePool, consumedNotes: new Set(), resolvedAutonom: new Map(),
    resolvedRegions: new Map(), hideEmptyDescription: ast.hideEmptyDescription ?? false,
    pseudoCreationIndex: ast.pseudoCreationIndex ?? new Map(),
  };
  resolveAllAutonomPasses(ctx);
  const acc = newAccumulator();
  const specs = ast.states.map((s) => resolveMember(s, acc, ctx, undefined));
  const pseudoSpecs = addLocalPseudoNodes('', ast.transitions, acc, ctx.pseudoCreationIndex);
  addScopeNotes('', ctx, acc);
  addLevelEdges('', ast.transitions, acc, ctx);
  sweepOrphanEdges(acc, ctx);
  sweepOrphanNoteEdges(acc, ctx.notePool, ctx.consumedNotes, (id) => resolveEndpoint(id, ctx.classify));
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
    // mission G4 S8 mechanism 19 -- see state-dot-graph.ts#buildDotGraph's
    // doc comment for the full derivation (mirrors G2 N29).
    manualArrowheads: true,
  };
  const result = layoutGraph(graph);
  // mission G4 S5: real states/composites FIRST, pseudo start/end LAST --
  // matches jar's own document order (`bajelo-54-dixe684`: `Track_FSM`
  // entity first, `.start.`/`.end.` pseudo entities last) and the FLAT
  // pipeline's own existing convention (`layout.ts#buildFlatStateGeos`
  // pushes `buildPseudoNodeGeos` AFTER the real states). The pre-S5
  // `[...pseudoSpecs, ...specs]` order was backward -- previously masked
  // by the flat-transitions childCount short-circuit (S1), only visible
  // once that mismatch was fixed (S5's own transition-nesting mechanism).
  return { acc, result, ctx, specs: sortSpecsByCreationIndex([...specs, ...pseudoSpecs]) };
}
