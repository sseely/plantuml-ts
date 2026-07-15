/**
 * layout-ink-shift.ts — G1b/J1 (mechanism C): `SvekResult
 * #calculateDimension`'s `moveDelta` shift (svek/SvekResult.java:125-136),
 * replacing this port's former flat node-box document margin
 * (`layout-geo-post.ts`'s pre-G1b `computeGlobalShift`,
 * `LAYOUT_MARGIN_LEADING=7` against the raw graphviz node-box minimum).
 *
 * Upstream chain (jar-verified — see `plans/g1-description-svg/ledger.md`
 * §I7 "mechanism C" and `plans/g1b-ink-extent/decision-journal.md` for the
 * full citation trail and numeric cases this recipe reproduces):
 *
 *  1. `calculateDimension` (memoized, called once): `minMax =
 *     TextBlockUtils.getMinMax(this, sb, false)` — a `LimitFinder` ink walk
 *     over `SvekResult#drawU`'s OWN draw sequence (every cluster, then every
 *     leaf, then every edge — `renderer-draw-sequence.ts`'s `drawClusters`/
 *     `drawEntities`/`drawEdges`, the SAME functions the real render pass
 *     uses) run over the RAW graphviz-assigned positions, BEFORE any
 *     document margin exists yet (`minMax` starts `null`; this is the
 *     FIRST — and only — time the walk runs).
 *  2. `clusterManager.moveDelta(6 - minMax.getMinX(), 6 - minMax.getMinY())`
 *     (`DotStringFactory#moveDelta`, svek/DotStringFactory.java:653-661)
 *     permanently shifts EVERY shape, line, AND cluster position by that
 *     delta — a single uniform translate applied once, before the real draw
 *     pass ever runs (by the time `drawU` executes for real, the shift has
 *     already been baked into every node/cluster/edge's stored position).
 *
 * Constant **6** (not a per-shape or per-axis parameter) is upstream's own
 * literal — the same value on both axes.
 *
 * Closed X/Y formula (mission's "close the X-axis open sub-question with
 * jar evidence FIRST" instruction — resolved by implementing the GENERAL
 * walk below rather than a further per-shape hand-derivation): `dx = 6 -
 * rawInkMinX`, `dy = 6 - rawInkMinY`, where `rawInkMinX`/`rawInkMinY` are
 * independent per-axis reductions over the SAME assembled ink-point set —
 * jar's own `MinMax#getMinX()`/`getMinY()` are computed from the same
 * `addPoint` stream, not from two separate per-axis walks, so X and Y need
 * not be bound by the SAME entity's own offset. `component/
 * zanibo-14-sami874` (actor→component→component chain) closes both axes
 * numerically:
 *   - Y: `EMP` (actor)'s own ink-top sits `thickness()=0.5` below its box
 *     top (`ActorStickMan#drawU`: `head` ellipse drawn at local y=`
 *     thickness()`, `LimitFinder#drawEllipse` has NO min-corner inset —
 *     `addPoint(x,y)` directly). Jar's golden actor `ellipse@cy=14` (`ry=8`,
 *     top=6) implies box top `14-8-0.5=5.5` = `6-0.5` exactly.
 *   - X: `APP` (plain component, `URectangle`-shaped)'s box is the GLOBAL X
 *     minimum in this fixture (not the actor — `EMP`'s ink-left, computed
 *     analytically from `ActorStickMan`'s local geometry — `startX =
 *     max(armsLenght,legsX) - headDiam/2 + thickness = max(13,13)-8+0.5=
 *     5.5`, body path's local leftmost x=`-armsLenght=-13` relative to
 *     `centerX=startX+headDiam/2=13.5`, giving absolute ink-left
 *     `13.5-13=0.5` — a MUCH wider box-relative offset than a plain rect's,
 *     so `EMP` never competes for the X minimum in a chain layout).
 *     `LimitFinder#drawRectangle` has a `-1` MIN-CORNER inset on BOTH axes
 *     (`addPoint(x-1,y-1)`, `LimitFinder.ts:184-186`), so a rect-shaped
 *     leaf's ink-min-x = `box.x - 1`. Jar's golden `APP` `rect@x=7` implies
 *     ink-min-x = `7-1=6` — exactly the forced constant. (This ALSO
 *     explains, per `renderer-ink-extent.ts`'s own doc comment, why the
 *     OLD flat `LAYOUT_MARGIN_LEADING=7` already reproduced jar exactly for
 *     every rect-topmost/leftmost fixture: `7` coincidentally equals
 *     `6 - (-1)` — the flat margin was RIGHT for rectangles and WRONG for
 *     every other shape, which is exactly the ~40+-fixture reach this
 *     mission targets.)
 *
 * No shape-specific X-vs-Y formula exists upstream or here — each ported
 * `drawU`/`LimitFinder` branch already contributes its own real ink offset
 * to the SAME accumulator; this module supplies no hand-coded per-shape
 * offset table (mission instruction, explicit).
 */
import type { Theme } from '../../core/theme.js';
import type { StringMeasurer } from '../../core/measurer.js';
import type { DescriptionNodeGeo, DescriptionEdgeGeo } from './layout-helpers.js';
import type { SpriteRegistry } from '../../core/sprite-commands.js';
import { buildUidPlan } from './renderer-uid.js';
import { collectByKind, drawClusters, drawEntities, drawEdges } from './renderer-draw-sequence.js';
import { runInkWalk, driverBounderFor } from './renderer-ink-extent.js';

/** `SvekResult.java:133`'s forced constant — `moveDelta(6 - minMax.getMinX(),
 *  6 - minMax.getMinY())`. Same value on both axes; see this module's doc
 *  comment for the closed per-axis derivation. */
const JAR_INK_MARGIN = 6;

export interface InkShift {
  readonly dx: number;
  readonly dy: number;
}

/**
 * Replaces the pre-G1b `computeGlobalShift` (`layout-geo-post.ts`): the
 * shift needed to move the RAW (graphviz-normalized, pre-shift) assembled
 * geometry so its real drawn ink extent's top-left corner sits at
 * `(JAR_INK_MARGIN, JAR_INK_MARGIN)`, mirroring `SvekResult
 * #calculateDimension`'s `moveDelta` exactly (see this module's own doc
 * comment).
 *
 * `rawEdges` must already be built (via `buildEdgeGeos`) with a zero
 * (dx=0,dy=0) mapping — the ink walk needs edges in their fully-resolved
 * draw shape (spline-clipped, labeled) at their RAW positions, not the
 * final shifted ones (`layout.ts#buildGeoAndEdges` builds `rawEdges` once,
 * pre-shift, and reuses the SAME `buildEdgeGeos` call a second time with
 * the real `dx`/`dy` this function returns — translation of an
 * already-clipped spline commutes with clipping a not-yet-shifted one, so
 * this is not a double-clip).
 *
 * `respectHidden=false` for every draw call here (`drawClusters`/
 * `drawEntities`/`drawEdges`'s own `respectHidden` param) — matches jar's
 * `LimitFinder extends UGraphicNo`, whose `getParam().isHidden()` is
 * hardcoded `false` (see `renderer-draw-sequence.ts#drawClusters`'s own
 * doc comment): a hidden entity still contributes its full ink extent to
 * the shift, even though the real draw pass never paints it.
 */
export function computeInkShift(
  rawNodes: readonly DescriptionNodeGeo[],
  rawEdges: readonly DescriptionEdgeGeo[],
  theme: Theme,
  measurer: StringMeasurer,
  sprites: SpriteRegistry | undefined,
): InkShift {
  const plan = buildUidPlan({ nodes: [...rawNodes], edges: [...rawEdges] });
  const { containers, leaves } = collectByKind(rawNodes);
  const driverBounder = driverBounderFor(measurer);
  const minMax = runInkWalk(
    (ug) => {
      drawClusters(ug, containers, theme, plan, false);
      drawEntities(ug, leaves, theme, plan, sprites, false);
      drawEdges(ug, rawEdges, theme, plan, false);
    },
    driverBounder,
    measurer,
  );
  return {
    dx: JAR_INK_MARGIN - minMax.getMinX(),
    dy: JAR_INK_MARGIN - minMax.getMinY(),
  };
}
