/**
 * Autonom-composite pass building (`resolveAllAutonomPasses`,
 * `buildAutonomSpec`, `buildPlainAutonomSpec`) — split out of
 * ./state-composite-pass.ts (mission G4 S3, 500-line file-cap compliance;
 * pure move, PLUS the mechanism-6 `headerLines`/`bodyLines`/`color` threading
 * — see `buildPlainAutonomSpec`'s own doc comment).
 * Mirrors state-composite-cluster.ts's / state-composite-concurrent.ts's
 * existing identical split (same file-cap rationale).
 *
 * @see ~/git/plantuml/.../svek/GroupMakerState.java
 * @see ~/git/plantuml/.../dot/CucaDiagramSimplifierState.java#simplify
 */

import type { State } from './ast.js';
import { buildStateGeoTextFields } from './state-sizing.js';
import { measureAutonomWrapper } from './state-composite-sizing.js';
import { buildConcurrentAutonomSpec, buildConcurrentRegionPass } from './state-composite-concurrent.js';
import {
  type DiagramCtx,
  type GeoSpec,
  newAccumulator,
  resolveMember,
  addLocalPseudoNodes,
  addScopeNotes,
  addLevelEdges,
  sweepOrphanEdges,
  runPass,
  buildLevelTransitionGeos,
} from './state-composite-pass.js';
import { sweepOrphanNoteEdges } from './state-note-layout.js';
import { resolveEndpoint } from './state-composite-classify.js';

type ExtractAutonomSpec = Extract<GeoSpec, { kind: 'autonom' }>;

/** Build ONE plain (region-free) composite's own child pass: recurse its
 *  children/inner transitions into a FRESH accumulator, run `layoutGraph()`
 *  (the dump — no nodeSep/rankSep, mechanisms.md §3), wrap the result per
 *  InnerStateAutonom's title+body+child-image formula.
 *
 *  Mission G4 S3 (mechanism 6): threads `buildStateGeoTextFields(s, ...)`
 *  onto the returned spec (`headerLines`/`bodyLines`/`color`) — the SAME
 *  shared builder the flat leaf pipeline and `resolveMember`'s leaf branch
 *  already use (mission G4 S2, mechanism 5's own precedent) — so the
 *  composite box's own title/action-zone text renders through the SAME
 *  measured-text machinery instead of the renderer's unmeasured fallback.
 *  `s.kind` is always `'normal'` for a composite declaration (`state X {
 *  ... }`, `ast.ts#State.kind` doc), so `buildStateGeoTextFields`'s
 *  `'normal'` branch (header = display, body = description lines) always
 *  fires here — jar-verified `bajelo-54-dixe684` (`Track_FSM`, no body
 *  lines; `Track_FSM.Run.Do_Sector`, 2 body lines) — see
 *  `renderer-composite-box.ts` for the shape this feeds.
 *
 *  Mission G4 S3 (DIAGNOSED, explicitly NOT landed): mechanism 6's own
 *  childCount fix unmasked that `measureAutonomWrapper`'s `childImg` param
 *  here is `{width: result.width, height: result.height}` — `layoutGraph()`'s
 *  raw output, which bakes in a generic per-graph canvas margin
 *  (`MARGIN=12`, `graph-layout.ts#canvasSize`) — where upstream's
 *  `InnerStateAutonom.calculateDimensionSlow` wants `im.calculateDimension
 *  (...)`, i.e. `SvekResult#calculateDimension()`: a TIGHT content bbox +
 *  `.delta(15,15)` (the SAME formula `state-composite-cluster.ts
 *  #tightContentDimension` already applies for a concurrent region leaf's
 *  identical `SvekResult`-typed `im`). Jar-verified via `coteta-47-mare883`
 *  (composite outer-box width off by exactly the leading-whitespace-
 *  adjacent constant this margin mismatch predicts) and `lonuti-97-
 *  voko521`. A trial fix (`tightContentDimension(result)` + 15) was
 *  IMPLEMENTED, VERIFIED to shrink `coteta-47-mare883`'s own diff count
 *  (21→18) and `lonuti-97-voko521`'s (80→67), but ALSO jar-verified to
 *  REGRESS two ALREADY-PINNED `oracle/goldens/state/size-backlog.json`
 *  entries past their own ratchet allowance (`nelupe-49-xova546`:
 *  1.555555→1.597222; `pesita-10-dene726`: 0.195792→0.237459) —
 *  `size-backlog.json` is a tighten-only boundary (never widen), so the
 *  trial fix was REVERTED rather than landed with a boundary violation.
 *  Ruled out: NOT the SAME bug as the still-separate, still-unresolved
 *  child POSITION-offset residual (`localPositions`, `spec.offset` below)
 *  — that residual is independently confirmed present on `coteta-47-
 *  mare883` even AFTER the width/height trial fix (nested child `rect/@x`
 *  still off by a constant, unrelated to `SvekResult#calculateDimension`'s
 *  own width/height formula). The TRUE fix likely needs BOTH pieces
 *  (tight+15 dimension AND the correct child position re-basing) landed
 *  TOGETHER before either individually stops regressing a size-backlog
 *  entry — queued whole for S4, not re-attempted piecemeal this iteration.
 *
 *  `s.transitions` can hold a SELF-referencing entry (`Radio_Configuring -->
 *  Vendor_Radio_Enabled`, written literally inside `state Radio_Configuring {
 *  ... }` — upstream's per-state `:`/`-->` scoping convention repeats the
 *  CURRENT state's own name as a prefix) whose `from`/`to === s.id` resolves
 *  to the composite's OWN id — which is never a node in ITS OWN content pass
 *  (only its CHILDREN are; the composite re-enters its PARENT pass as a
 *  proxy, `resolveMember`'s autonom branch). Unlike `resolveClusterComposite`
 *  (whose `acc` is the SHARED, still-growing pass accumulator — a sibling
 *  resolved LATER in the same walk can supply the missing node before that
 *  pass's own single, deferred `layoutGraph()` call), THIS accumulator is
 *  fresh and gets its own immediate `runPass()` a few lines down: nothing
 *  will ever be added to it after this point, so a self-referencing entry
 *  can never resolve here regardless of order. Excluded from THIS call
 *  (not `addLocalPseudoNodes`, which only reads `'[*]'` endpoints and is
 *  unaffected) so it is never marked `ctx.consumed` here; `collectRegularTransitions`
 *  already pools every composite's own `.transitions` (self-referencing or
 *  not), so `sweepOrphanEdges` retries it — successfully, once against
 *  whichever pass's accumulator DOES contain this composite's re-entry proxy
 *  node (mission A4 Phase L iter 18, giniti-22-fexo000).
 * @see ~/git/plantuml/.../svek/GraphvizImageBuilder.java#buildImage (attempts
 *      EVERY diagram link; a missing SvekNode drops it at THIS pass only) */
export function buildPlainAutonomSpec(s: State, ctx: DiagramCtx): ExtractAutonomSpec {
  const acc = newAccumulator();
  const memberSpecs = s.children.map((c) => resolveMember(c, acc, ctx, undefined));
  const pseudoSpecs = addLocalPseudoNodes(s.id, s.transitions, acc);
  addScopeNotes(s.id, ctx, acc);
  const localTransitions = s.transitions.filter((t) => t.from !== s.id && t.to !== s.id);
  addLevelEdges(s.id, localTransitions, acc, ctx);
  sweepOrphanEdges(acc, ctx);
  sweepOrphanNoteEdges(acc, ctx.notePool, ctx.consumedNotes, (id) => resolveEndpoint(id, ctx.classify));
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
    ...buildStateGeoTextFields(s, ctx.theme, ctx.measurer),
  };
}

function buildAutonomSpec(s: State, ctx: DiagramCtx): ExtractAutonomSpec {
  return s.concurrentRegions.length > 0 ? buildConcurrentAutonomSpec(s, ctx) : buildPlainAutonomSpec(s, ctx);
}

/**
 * Fire every autonom composite's own svek pass AND every concurrent
 * region's own pass ONCE, in `ctx.classify.firingOrder` order (deepest
 * nesting level first, source order as tie-break within a level — mission
 * A4 Phase L iteration 17, extended iteration 19 to cover regions;
 * `CucaDiagramSimplifierState.getOrdered` port; firingOrder's doc,
 * state-composite-classify.ts, has the full equivalence argument). Must run
 * BEFORE any `resolveMember` walk (top-level or nested) so every lookup in
 * `resolveMember`'s autonom branch hits, AND before any
 * `buildConcurrentAutonomSpec` call so every region lookup hits too.
 *
 * `buildAutonomSpec`/`buildConcurrentAutonomSpec` are otherwise UNCHANGED
 * (still recurse via `resolveMember` for their own children, and now via a
 * pure `ctx.resolvedRegions` lookup for their own regions) — firing order
 * correctness alone guarantees any autonom composite or region reachable
 * from a shallower build is already resolved, so decoupling firing from
 * assembly required no change to `resolveClusterComposite` either, only to
 * WHEN and WHERE each lookup reads its result from.
 * @see ~/git/plantuml/.../dot/CucaDiagramSimplifierState.java#simplify
 */
export function resolveAllAutonomPasses(ctx: DiagramCtx): void {
  for (const unit of ctx.classify.firingOrder) {
    if (unit.kind === 'composite') {
      ctx.resolvedAutonom.set(unit.id, buildAutonomSpec(unit.state, ctx));
    } else {
      ctx.resolvedRegions.set(unit.id, buildConcurrentRegionPass(unit.owner, unit.regionIndex, unit.members, ctx));
    }
  }
}
