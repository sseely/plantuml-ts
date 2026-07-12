/**
 * Concurrent-region (`--` separator) composite pass building — split out of
 * ./state-composite-pass.ts (mission A4 Phase L, 500-line file-cap
 * compliance; pure move, zero behavior change). `ConcurrentStates`' own
 * region-stack assembly is a large, independently-documented mechanism
 * (mechanisms.md §3) — a coherent unit on its own.
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
export function buildConcurrentAutonomSpec(s: State, ctx: DiagramCtx): Extract<GeoSpec, { kind: 'autonom' }> {
  const regionIdSets = s.concurrentRegions.map((region) => new Set(region.map((c) => c.id)));
  const ownIds = new Set(s.children.map((c) => c.id));
  const transitionsFor = (ids: ReadonlySet<string>): Transition[] =>
    s.transitions.filter((t) => ids.has(t.from) || ids.has(t.to));

  // Resolve region 0's members (and any independently-autarkic nested
  // composite's own dump) before touching the CONC regions — DEFER region
  // 0's own runPass()/dump until after every CONC region has resolved.
  const ownBuild =
    s.children.length > 0
      ? buildConcurrentBranchAcc(s.children, transitionsFor(ownIds), s.id, s.id, ctx)
      : undefined;

  const regionPasses = s.concurrentRegions.map((region, i) =>
    runOneConcurrentBranch(
      region,
      transitionsFor(regionIdSets[i]!),
      s.id,
      concurrentRegionScopeId(s.id, i + 1),
      ctx,
    ),
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
): { acc: PassAccumulator; result: DotLayoutResult; specs: GeoSpec[] } {
  const { acc, specs } = buildConcurrentBranchAcc(states, transitions, scopeId, noteScopeId, ctx);
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
