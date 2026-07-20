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
import type { DotLayoutResult } from '../../core/graph-layout.js';
import { buildStateGeoTextFields } from './state-sizing.js';
import { measureAutonomWrapper } from './state-composite-sizing.js';
import { computeSvekResultGeometry } from './layout-ink-extent.js';
import { materializeSpecs, type PosMap } from './state-composite-geo.js';
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

/** Uniformly translate a pass's own raw layout result — mission G4 S4,
 *  mechanism 7's own position-offset half: reproduces `SvekResult
 *  #calculateDimension()`'s `clusterManager.moveDelta(...)` side effect
 *  (which mutates a wrapped child pass's own node/edge positions in place,
 *  BEFORE that pass is ever drawn — see `layout-ink-extent.ts
 *  #computeSvekResultGeometry`'s own doc comment) as a pure, non-mutating
 *  transform over our own `DotLayoutResult`. */
export function shiftDotLayoutResult(result: DotLayoutResult, dx: number, dy: number): DotLayoutResult {
  if (dx === 0 && dy === 0) return result;
  return {
    ...result,
    nodes: result.nodes.map((n) => ({
      ...n,
      x: n.x + dx,
      y: n.y + dy,
      ...(n.xlabelX !== undefined ? { xlabelX: n.xlabelX + dx } : {}),
      ...(n.xlabelY !== undefined ? { xlabelY: n.xlabelY + dy } : {}),
    })),
    edges: result.edges.map((e) => ({
      ...e,
      points: e.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
      ...(e.labelX !== undefined ? { labelX: e.labelX + dx } : {}),
      ...(e.labelY !== undefined ? { labelY: e.labelY + dy } : {}),
      ...(e.tailLabelX !== undefined ? { tailLabelX: e.tailLabelX + dx } : {}),
      ...(e.tailLabelY !== undefined ? { tailLabelY: e.tailLabelY + dy } : {}),
      ...(e.headLabelX !== undefined ? { headLabelX: e.headLabelX + dx } : {}),
      ...(e.headLabelY !== undefined ? { headLabelY: e.headLabelY + dy } : {}),
    })),
  };
  // #lizard forgives -- faithful mechanical field-by-field translate, one
  // guarded branch per optional coordinate pair, no decision complexity.
}

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
 *  Mission G4 S4 (mechanism 7, LANDED): `InnerStateAutonom
 *  .calculateDimensionSlow`'s `im.calculateDimension(...)` — i.e.
 *  `SvekResult#calculateDimension()` — is an ink-extent-aware bbox of the
 *  wrapped child pass's own DRAWN content (`.delta(15,15)` for the
 *  dimension, `moveDelta(6-minX,6-minY)` for the position shift, BOTH
 *  derived from the SAME ink walk — `layout-ink-extent.ts
 *  #computeSvekResultGeometry`'s own doc comment has the full mechanism and
 *  jar-derivation, INCLUDING why it excludes arrowhead ink for THIS call
 *  site specifically). `result` (this pass's own raw `layoutGraph()`
 *  output) is neither the right SIZE (bakes in a generic per-graph canvas
 *  margin, `MARGIN=12`, unrelated to `SvekResult`'s own `delta(15,15)`) nor
 *  the right POSITION (never gets `SvekResult`'s own internal `moveDelta`
 *  side-effect at all) to feed `measureAutonomWrapper`/`localPositions`
 *  directly — `geometry` below fixes both from the SAME ink-extent bbox,
 *  computed over this pass's own content MATERIALIZED into `StateNodeGeo`
 *  (via `state-composite-geo.ts#materializeSpecs`, reused rather than
 *  re-derived, so nested autonom/cluster composites get the SAME real
 *  ink-box treatment `addNodeInk` already gives them at the top level).
 *  Jar-verified byte-exact (outer box width/height AND innermost leaf
 *  child's own absolute position) on `coteta-47-mare883` (1 level),
 *  `lonuti-97-voko521` (2 levels, mixed leaf+nested-composite), and
 *  `bajelo-54-dixe684` (3 levels, unchanged/non-regressing) — see
 *  plans/g4-state-svg/ledger.md S4.
 *
 *  `childImg` takes `Math.max(geometry.*, result.*)`, NOT `geometry.*`
 *  alone — NAMED, NOT FULLY CLOSED this iteration: a composite whose own
 *  dominant content is 1-2 short INTERNAL labeled transitions
 *  (`bunade-42-fudu910`'s `NotShooting`, `[*] --> Idle`/`Idle <-->
 *  Configuring`) needs edge-LABEL ink (its own measured text width, which
 *  `TransitionGeo.label` does not carry) folded in to reach jar's real
 *  size; a same-iteration attempt to measure it inline (`ctx.measurer`) was
 *  jar-verified DIRECTIONALLY correct on `bunade` but OVERSHOT on other
 *  single-labeled-edge fixtures (`beguxu-19-tize774`), a worse net result
 *  than not attempting it at all — reverted. `result.*` (the SAME raw
 *  canvas value used before mechanism 7 landed) stands in as a
 *  non-regressing FLOOR for every case the ink-extent computation still
 *  undercounts, while the ink-extent value wins wherever it's ALREADY
 *  bigger (every jar-verified case above). Queued for S5: a byte-exact fix
 *  needs the label's real measured width reconciled against
 *  `attachTransitionLabel`'s own placement formula (`state-transition-
 *  label.ts`), not a floor.
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

  const localSpecs = [...pseudoSpecs, ...memberSpecs];
  const rawPosMap: PosMap = new Map(result.nodes.map((n) => [n.id, n]));
  // mission G4 S5: `materializeSpecs` no longer takes an `outTransitions`
  // accumulator -- every nested pass's own edges attach directly to its
  // own returned node's `.transitions` field, and `computeSvekResultGeometry`
  // (via `addNodeInk`) recurses into that field, so ink coverage is
  // unchanged (see `state-composite-geo.ts#materializeAutonom`'s own doc
  // comment).
  const inkStates = materializeSpecs(localSpecs, rawPosMap);
  const inkTransitions = buildLevelTransitionGeos(acc, result);
  const geometry = computeSvekResultGeometry(inkStates, inkTransitions);
  const childImg = {
    width: Math.max(geometry.width, result.width),
    height: Math.max(geometry.height, result.height),
  };

  const wrapper = measureAutonomWrapper(s, childImg, ctx.theme, ctx.measurer);
  const shiftedResult = shiftDotLayoutResult(result, geometry.dx, geometry.dy);
  return {
    kind: 'autonom',
    id: s.id,
    display: s.display,
    offset: wrapper.childOffset,
    width: wrapper.width,
    height: wrapper.height,
    localStates: localSpecs,
    localPositions: shiftedResult,
    localTransitions: buildLevelTransitionGeos(acc, shiftedResult),
    ...buildStateGeoTextFields(s, ctx.theme, ctx.measurer),
  };
  // #lizard forgives -- faithful single-pass assembly (build accumulator,
  // run layout, compute ink-extent geometry, wrap, shift, return); each
  // line is one straight-line step of InnerStateAutonom's own build
  // sequence, not decision complexity to simplify.
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
