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
 * @see ~/git/plantuml/.../dot/CucaDiagramSimplifierState.java#simplify
 * @see ~/git/plantuml/.../svek/GroupMakerState.java#getImage
 */

import type { State, Transition } from './ast.js';
import type { DotLayoutResult } from '../../core/graph-layout.js';
import type { TransitionGeo } from './state-geo-types.js';
import { measureAutonomWrapper, stackConcurrentRegions, type AutonomWrapper } from './state-composite-sizing.js';
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

/** ConcurrentStates region-stack separator, reused for the composite's own
 *  non-region leaf pass's vertical offset (see state-composite-sizing.ts). */
const REGION_GAP = 60;

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

  const stacked = stackConcurrentRegions(passes.map((p) => ({ width: p.result.width, height: p.result.height })));
  const wrapper = measureAutonomWrapper(s, stacked, ctx.theme, ctx.measurer);
  return combineConcurrentPasses(s, passes, wrapper);
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
  return runOneConcurrentBranch(members, transitions, owner.id, concurrentRegionScopeId(owner.id, regionIndex + 1), ctx);
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
  passes: readonly ConcurrentRegionPassResult[],
  wrapper: AutonomWrapper,
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
