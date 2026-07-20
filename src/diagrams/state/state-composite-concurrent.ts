/**
 * Concurrent-region (`--` separator) composite pass building — split out of
 * ./state-composite-pass.ts (mission A4 Phase L, 500-line file-cap
 * compliance; pure move, zero behavior change). `ConcurrentStates`' own
 * region-stack assembly is a large, independently-documented mechanism
 * (mechanisms.md §3) — a coherent unit on its own.
 *
 * Mission A4 Phase L iteration 19 (joleju-94-maru748): each `--`-delimited
 * region's OWN pass is now built at the region's OWN, globally-ordered
 * firing-order turn (`buildConcurrentRegionPass`, called from
 * `resolveAllAutonomPasses` in ./state-composite-pass.ts) rather than
 * inline, eagerly, from inside `buildConcurrentAutonomSpec` — a region is
 * ITS OWN `Entity` upstream (`GroupType.CONCURRENT_STATE`), unconditionally
 * autarkic (`Entity.isAutarkic`, abel/Entity.java:700-701), participating in
 * `CucaDiagramSimplifierState.getOrdered`'s SAME whole-tree list as every
 * composite (state-composite-classify.ts's `firingOrder` doc has the full
 * mechanism). `buildConcurrentAutonomSpec` now only builds its OWNER's own
 * region-0 content (there is no separate upstream Entity for region-0 — it
 * IS the composite's own direct content, so it still fires INLINE as part
 * of the composite's own firing-order turn) and LOOKS UP each of its
 * regions' already-resolved passes from `ctx.resolvedRegions` — the same
 * "decoupled fire vs. assemble" split iteration 17 established for autonom
 * composites via `ctx.resolvedAutonom` (./state-composite-pass.ts's
 * `resolveMember` doc).
 *
 * Mission G4 S3 (mechanism 6): `combineConcurrentPasses` now threads
 * `buildStateGeoTextFields(s, ...)` onto the returned spec too -- a
 * concurrent-region-OWNING composite (`state X { region1 -- region2 }`) is
 * still wrapped by `InnerStateAutonom`'s own title/border box exactly like a
 * plain (region-free) autonom composite (`measureAutonomWrapper` is already
 * called for this case, above) -- only its INNER content differs (stacked
 * region images instead of a single child pass). See
 * `state-composite-autonom.ts#buildPlainAutonomSpec`'s identical threading
 * for the region-free case.
 *
 * Mission G4 S4 (mechanism 7's own concurrent-composite companion --
 * diagnosed while chasing `nelupe-49-xova546`'s regression, a direct read
 * of `ConcurrentStates.java`, not guessed): EACH region's own `inner.
 * calculateDimension()` (the value both `ConcurrentStates.calculateDimensionSlow`'s
 * `Separator.add` stacking-sum AND `drawU`'s `separator.move(dim)` cursor
 * advance use) is `SvekResult#calculateDimension()` -- the SAME ink-extent
 * formula `state-composite-autonom.ts#buildPlainAutonomSpec` already applies
 * for a plain composite's own wrapped child pass, NOT the raw `layoutGraph()`
 * canvas size `p.result.width/height` this file used exclusively before.
 * `buildConcurrentAutonomSpec`'s own `regionDims` (below) and
 * `combineConcurrentPasses`'s own `yShift` BOTH now use this SAME ink-based
 * per-region dimension -- kept consistent deliberately, since upstream ties
 * both the reported SIZE and the actual STACK POSITION to the identical
 * `calculateDimension()` call. `stackConcurrentRegions`'s own separator gap
 * is `0` (see its own doc comment, state-composite-sizing.ts) -- ALSO a
 * direct-source finding from the same investigation, not independent of it.
 * Jar-verified via the full `size-backlog.json` DOT-parity ratchet
 * (268/268 passing) -- see plans/g4-state-svg/ledger.md S4.
 *
 * @see ~/git/plantuml/.../dot/CucaDiagramSimplifierState.java#simplify
 * @see ~/git/plantuml/.../svek/GroupMakerState.java#getImage
 * @see ~/git/plantuml/.../svek/ConcurrentStates.java
 */

import type { State, Transition } from './ast.js';
import type { DotLayoutResult } from '../../core/graph-layout.js';
import type { TransitionGeo } from './state-geo-types.js';
import { buildStateGeoTextFields } from './state-sizing.js';
import { measureAutonomWrapper, stackConcurrentRegions, type AutonomWrapper } from './state-composite-sizing.js';
import { computeSvekResultGeometry } from './layout-ink-extent.js';
import { materializeSpecs, type PosMap } from './state-composite-geo.js';
import {
  type DiagramCtx,
  type PassAccumulator,
  type GeoSpec,
  newAccumulator,
  resolveMember,
  addLocalPseudoNodes,
  addLevelEdges,
  addScopeNotes,
  runPass,
  buildLevelTransitionGeos,
} from './state-composite-pass.js';
import { concurrentRegionScopeId } from './state-parse-state.js';
import { shiftDotLayoutResult } from './state-composite-autonom.js';

/** One region's (or region-0's) resolved pass — the raw laid-out content
 *  BEFORE any composite-level title/border wrapping (a region has none of
 *  its own upstream: `Display.create("")`, StateDiagram.java:204). Shared
 *  shape for both `ctx.resolvedRegions`' entries (./state-composite-pass.ts)
 *  and region-0's own `ownPass` local, so `combineConcurrentPasses` treats
 *  every stacked slice identically regardless of WHEN it was computed. */
export interface ConcurrentRegionPassResult {
  acc: PassAccumulator;
  result: DotLayoutResult;
  specs: GeoSpec[];
}

/** Mission G4 S4: `inner.calculateDimension()` — `SvekResult#calculateDimension()`'s
 *  ink-extent-aware bbox of a region's own drawn content, `Math.max`-floored
 *  against the raw `layoutGraph()` canvas size for the SAME non-regressing-
 *  floor reason `state-composite-autonom.ts#buildPlainAutonomSpec`'s own
 *  `childImg` computation is (see that call site's doc comment — a
 *  composite-internal-labeled-transition residual not yet fully closed).
 *
 *  Mission G4 S6 (mechanism 13's own unmasking cascade, jar-verified
 *  `semala-31-joji042`/`nivanu-50-zajo916`): ALSO returns `computeSvekResult
 *  Geometry`'s own `dx`/`dy` (the SAME `SvekResult#calculateDimension()`
 *  `moveDelta` position correction `state-composite-autonom.ts
 *  #buildPlainAutonomSpec` already applies via `shiftDotLayoutResult` for a
 *  PLAIN composite's own child pass) — pre-S6 this file discarded dx/dy
 *  entirely (used ONLY for sizing), leaving every concurrent region's own
 *  member content un-shifted (a consistent +7,+7 absolute-position gap on
 *  every fixture sampled, the leaf-state-box ink rule's own `-1` min-corner
 *  asymmetry — `layout-ink-extent.ts#addNodeInk` — folded into `JAR_INK_
 *  MARGIN(6) - (-1) = 7`). Renamed from `regionInkDim` to `regionInkGeometry`
 *  since it's no longer JUST a dimension. */
function regionInkGeometry(p: ConcurrentRegionPassResult): { width: number; height: number; dx: number; dy: number } {
  const posMap: PosMap = new Map(p.result.nodes.map((n) => [n.id, n]));
  // mission G4 S5: `materializeSpecs` no longer takes an `outTransitions`
  // accumulator -- see `state-composite-geo.ts#materializeAutonom`'s own
  // doc comment; `computeSvekResultGeometry`'s ink walk recurses into each
  // materialized node's own `.transitions` field directly.
  const states = materializeSpecs(p.specs, posMap);
  const transitions = buildLevelTransitionGeos(p.acc, p.result);
  const ink = computeSvekResultGeometry(states, transitions);
  return {
    width: Math.max(ink.width, p.result.width),
    height: Math.max(ink.height, p.result.height),
    dx: ink.dx,
    dy: ink.dy,
  };
}

/** ConcurrentStates: region 0 (`s.children` — S's own direct pre-separator
 *  content, popScope's doc) stacks visually FIRST, then each synthetic
 *  `CONC1`, `CONC2`, ... region (`s.concurrentRegions`) in declaration
 *  order (`ConcurrentStates`' `inners` list, index 0 = the non-concurrent
 *  leafs build — GroupMakerState.java:124-129). Visual stacking order is
 *  independent of FIRING order (mission A4 Phase L iteration 19 decoupled
 *  the two — see this file's top doc): every region's pass is already fully
 *  resolved in `ctx.resolvedRegions` by the time `s`'s own (shallower)
 *  firing-order turn is reached, so this function only builds region-0's OWN
 *  content, looks up each region, and combines/stacks in SOURCE order.
 *  Inner transitions are partitioned by which region (or neither) their
 *  non-`[*]` endpoint belongs to — our AST has no per-region transition
 *  provenance (state-parse-state.ts's `owner.transitions` is one flat array
 *  for the whole scope), so membership is inferred from endpoint id
 *  (best-effort; every fixture in the corpus that exercises this keeps
 *  region membership unambiguous by construction).
 * @see ~/git/plantuml/.../dot/CucaDiagramSimplifierState.java#simplify
 * @see ~/git/plantuml/.../svek/GroupMakerState.java#getImage
 */
/** `ConcurrentStates.java#Separator.drawSeparator`'s local `DASH` constant --
 *  the dashed separator line's own length is `dimTotal.getWidth() + DASH`
 *  (8), NOT the bare content width -- jar-verified `nelupe-49-xova546`
 *  (`s7_2`'s own separators span x=12..122, content width 102, 102+8=110=
 *  122-12). See `combineConcurrentPasses`'s own separator-geometry doc
 *  comment for the full x1/x2/y derivation. */
const SEPARATOR_LINE_DASH = 8;

export function buildConcurrentAutonomSpec(s: State, ctx: DiagramCtx): Extract<GeoSpec, { kind: 'autonom' }> {
  const ownIds = new Set(s.children.map((c) => c.id));
  const transitionsFor = (ids: ReadonlySet<string>): Transition[] =>
    s.transitions.filter((t) => ids.has(t.from) || ids.has(t.to));

  const ownBuild =
    s.children.length > 0
      ? buildConcurrentBranchAcc(s.children, transitionsFor(ownIds), s.id, s.id, ctx)
      : undefined;
  const ownPass: ConcurrentRegionPassResult | undefined =
    ownBuild !== undefined
      ? { acc: ownBuild.acc, result: runPass(ownBuild.acc, ctx), specs: ownBuild.specs }
      : undefined;

  // Every region is strictly DEEPER than `s` (firingOrder's doc,
  // state-composite-classify.ts), hence already resolved earlier in the
  // same `resolveAllAutonomPasses` loop -- a pure lookup, never a build.
  const regionPasses = s.concurrentRegions.map((_, i) => {
    const key = concurrentRegionScopeId(s.id, i + 1);
    const resolved = ctx.resolvedRegions.get(key);
    if (resolved === undefined) {
      // Thrown (not silently defaulted) so a future firing-order
      // regression fails loudly instead of emitting a bogus zero-size
      // region -- mirrors resolveMember's autonom-lookup guard.
      throw new Error(`concurrent region "${key}" resolved out of firing order`);
    }
    return resolved;
  });

  // Visual stacking order matches SOURCE order (region 0 on top).
  const passes = ownPass !== undefined ? [ownPass, ...regionPasses] : regionPasses;

  const stacked = stackConcurrentRegions(passes.map(regionInkGeometry));
  const wrapper = measureAutonomWrapper(s, stacked, ctx.theme, ctx.measurer);
  return combineConcurrentPasses(s, passes, wrapper, stacked.width, ctx);
}

/** Build and run ONE region's (or region-0's) pass — called either directly
 *  from `resolveAllAutonomPasses`'s firing-order loop (a real `--` region,
 *  via `buildConcurrentRegionPass` below) or inline from
 *  `buildConcurrentAutonomSpec` (region-0, `s.children`, which has no
 *  separate upstream Entity/firing-order entry of its own). */
function buildConcurrentBranchAcc(
  states: readonly State[],
  transitions: readonly Transition[],
  scopeId: string,
  noteScopeId: string,
  ctx: DiagramCtx,
): { acc: PassAccumulator; specs: GeoSpec[] } {
  const acc = newAccumulator();
  const memberSpecs = states.map((c) => resolveMember(c, acc, ctx, undefined));
  const pseudoSpecs = addLocalPseudoNodes(scopeId, transitions, acc);
  addScopeNotes(noteScopeId, ctx, acc);
  addLevelEdges(scopeId, transitions, acc, ctx);
  return { acc, specs: [...pseudoSpecs, ...memberSpecs] };
}

function runOneConcurrentBranch(
  states: readonly State[],
  transitions: readonly Transition[],
  scopeId: string,
  noteScopeId: string,
  ctx: DiagramCtx,
): ConcurrentRegionPassResult {
  const { acc, specs } = buildConcurrentBranchAcc(states, transitions, scopeId, noteScopeId, ctx);
  return { acc, result: runPass(acc, ctx), specs };
}

/** Build ONE `--`-delimited region's own pass — mission A4 Phase L
 *  iteration 19's firing-order entry point, called from
 *  `resolveAllAutonomPasses` (./state-composite-pass.ts) at the region's
 *  OWN (globally-ordered) turn, never from `buildConcurrentAutonomSpec`
 *  directly. `owner.transitions` is filtered to this region's member ids —
 *  same best-effort endpoint-id partitioning `buildConcurrentAutonomSpec`
 *  already used for region-0 (see this file's top doc). */
export function buildConcurrentRegionPass(
  owner: State,
  regionIndex: number,
  members: readonly State[],
  ctx: DiagramCtx,
): ConcurrentRegionPassResult {
  const ids = new Set(members.map((c) => c.id));
  const transitions = owner.transitions.filter((t) => ids.has(t.from) || ids.has(t.to));
  // Mission G4 S6, mechanism 14: `scopeId` was `owner.id` (the SAME string
  // for every region), so `scopedPseudoIds` (state-composite-pass.ts)
  // collapsed EVERY region's own `[*]` pseudo-anchor onto the identical
  // `__init_<owner.id>`/`__final_<owner.id>` id -- `buildStateUidPlan`
  // (renderer-uid.ts) keys its `ent%04d` uid Map by that string, so the
  // LAST region visited silently overwrote every earlier region's own uid.
  // `concurrentRegionScopeId` already computed the correct PER-REGION id
  // for `noteScopeId` (below) -- reuse the SAME value for `scopeId` too,
  // matching jar's own per-region anchor naming (`s7_2.CONC1..start.CONC1`
  // vs region-0's own `s7_2..start.s7_2`, nelupe-49-xova546).
  const scopeId = concurrentRegionScopeId(owner.id, regionIndex + 1);
  return runOneConcurrentBranch(members, transitions, scopeId, scopeId, ctx);
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

/**
 * mission G4 S6, mechanism 13: builds BOTH the flat `localStates`/
 * `localTransitions` (unchanged shape/consumers, a plain region-order
 * concatenation) AND the per-region-grouped `regions` field, plus the
 * dashed `separators` between each pair of stacked regions --
 * `ConcurrentStates.java#drawU`'s own loop: draw region i's content, move
 * the cursor down by region i's own height, THEN (if not the last region)
 * draw a separator spanning the FULL content width at the new cursor y.
 *
 * Separator x1/x2 are LOCAL (pre dx/dy-shift, matching `localPositions`'s
 * own convention): x1=0 (the composite's own wrapped-child-content origin,
 * `InnerStateAutonom.getSpaceYforURL`'s `MARGIN` offset — already folded
 * into `spec.offset.x`/`materializeAutonom`'s `dx`, so 0 here is correct,
 * not a placeholder), x2=`contentWidth + SEPARATOR_LINE_DASH` (the SAME
 * `dimTotal.getWidth()` `stackConcurrentRegions` already returns, passed in
 * as `contentWidth`). jar-verified `nelupe-49-xova546`: composite box
 * x=7, `spec.offset.x`=`MARGIN`=5 -> absolute x1=12 (jar's own `x1="12"`);
 * contentWidth=102 -> absolute x2=12+102+8=122 (jar's own `x2="122"`).
 */
function combineConcurrentPasses(
  s: State,
  passes: readonly ConcurrentRegionPassResult[],
  wrapper: AutonomWrapper,
  contentWidth: number,
  ctx: DiagramCtx,
): Extract<GeoSpec, { kind: 'autonom' }> {
  const localStates: GeoSpec[] = [];
  const localTransitions: TransitionGeo[] = [];
  const regions: { specs: readonly GeoSpec[]; transitions: readonly TransitionGeo[] }[] = [];
  const separators: { x1: number; y1: number; x2: number; y2: number }[] = [];
  let yShift = 0;
  const allNodes: DotLayoutResult['nodes'] = [];
  for (let i = 0; i < passes.length; i++) {
    const p = passes[i]!;
    // mission G4 S6: apply THIS region's own ink-extent `moveDelta`
    // position correction (`geom.dx`/`.dy`) BEFORE stacking -- see
    // `regionInkGeometry`'s own doc comment for why this was missing
    // pre-S6 (a consistent +7,+7 absolute-position gap, jar-verified).
    const geom = regionInkGeometry(p);
    const shiftedResult = shiftDotLayoutResult(p.result, geom.dx, geom.dy);
    for (const n of shiftedResult.nodes) allNodes.push({ ...n, y: n.y + yShift });
    const regionTransitions = buildLevelTransitionGeos(p.acc, shiftedResult).map((t) => shiftTransitionY(t, yShift));
    localStates.push(...p.specs);
    localTransitions.push(...regionTransitions);
    regions.push({ specs: p.specs, transitions: regionTransitions });
    yShift += geom.height;
    if (i < passes.length - 1) {
      separators.push({ x1: 0, y1: yShift, x2: contentWidth + SEPARATOR_LINE_DASH, y2: yShift });
    }
  }
  return {
    kind: 'autonom',
    id: s.id,
    display: s.display,
    offset: wrapper.childOffset,
    width: wrapper.width,
    height: wrapper.height,
    regions,
    separators,
    localStates,
    localPositions: { nodes: allNodes, edges: [], width: wrapper.width, height: wrapper.height },
    localTransitions,
    ...buildStateGeoTextFields(s, ctx.theme, ctx.measurer),
  };
  // #lizard forgives -- faithful port of ConcurrentStates' vertical stack;
  // most of this function is a single accumulation loop.
}
