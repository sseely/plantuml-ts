/**
 * renderer-arrowhead.ts — mission G2 N1, mechanism 2 ("SVG root shell"),
 * part C: replaces `class/renderer.ts`'s SVG-`<marker>`-reference
 * arrowheads (`arrowHeadRef` + `markerEnd`/`markerStart`) with the SAME
 * inline-polygon extremity shapes the description engine already draws
 * (`core/svek/extremity/*`, `SvekEdge.ts`) — jar's class-diagram corpus
 * contains ZERO `<marker>`/`markerEnd` (grep-verified,
 * `plans/g2-class-svg/ledger.md` N0 mechanism 2), exactly like
 * description's.
 *
 * Deliberately NOT a full `SvekEdge` adoption (`core/svek/SvekEdge.ts`):
 * that class also emits a `<g class="link" data-entity-1="..."
 * data-link-type="...">` group wrapper keyed by per-entity `ent%04d` uids
 * this port's class engine does not assign yet (classifiers/namespaces
 * have no uid plan — that is the N2 "geometry family" scope the ledger
 * defers, entity/cluster group-wrapping fidelity). This module draws ONLY
 * the extremity shape (`Extremity#drawU`) via a throwaway `UGraphicSvg`
 * document, extracting its markup with the SAME `core/klimt/
 * document-shell.ts` helpers `description/renderer.ts#unwrapKlimtSvg`
 * uses — reusing the byte-verified extremity machinery (G1 I9) without
 * adopting SvekEdge's group/uid concerns this iteration does not own.
 *
 * Placement math mirrors `SvekEdge`'s constructor (`SvekEdge.ts`) and its
 * underlying `DotPath#getStartAngle`/`getEndAngle` formula exactly
 * (`atan2` between the endpoint and its adjacent control point — see
 * `endpointAnchor` below) WITHOUT going through `buildDotPathFromSplinePoints`
 * itself: that helper throws on anything but a well-formed `1 + 3*n`
 * bezier-spline point list, and `EdgeGeo.points` is not always that shape
 * (a straight 2-point edge is a legitimate, existing input this module
 * must handle, not a "cannot happen" state — see `renderer.test.ts`'s
 * `makeEdgeGeo` helper). For a genuine `1 + 3*n` spline this produces the
 * IDENTICAL point/angle `DotPath` would (points[1]/points[n-2] ARE that
 * spline's first/last control points), so no conformance is lost for the
 * real-DOT-layout case; for any other point count it degrades gracefully
 * to a straight-line secant instead of throwing. The extremity is placed
 * at the RAW (untrimmed) first/last point, tail side negated by
 * `Math.PI` — the path itself is left untouched (`class/
 * renderer.ts#buildPathData`'s straight-line `d` construction is a
 * separate, N2-deferred geometry concern).
 *
 * @see plans/g2-class-svg/ledger.md (N1, mechanism 2 part B doc)
 */

import type { Point2D } from '../../core/klimt/UTranslate.js';
import type { Paint } from '../../core/paint.js';
import type { UDrawable } from '../../core/klimt/shape/UDrawable.js';
import { UGraphicSvg } from '../../core/klimt/drawing/svg/u-graphic-svg.js';
import { basicSvgOption } from '../../core/klimt/drawing/svg/svg-graphics.js';
import { Fore } from '../../core/klimt/Fore.js';
import { Back } from '../../core/klimt/Back.js';
import { UStroke } from '../../core/klimt/UStroke.js';
import { place } from '../../core/svek/svek-edge-extremity.js';
import type { LinkDecorName } from '../../core/svek/extremity/link-decor.js';
import { extractFlatContent } from '../../core/klimt/document-shell.js';
import type { LinkDecor } from './ast.js';
import type { EdgeGeo } from './layout.js';

/** `class/ast.ts#LinkDecor` -> `core/svek/extremity/link-decor.ts
 *  #LinkDecorName` — class's own decor union is already RESOLVED (parsed
 *  from the arrow token at parse time, `class-relationship-parser`-ish
 *  logic upstream of this module), unlike `SvekEdgeInput.tailDecor`/
 *  `.headDecor` (raw matched-substring tokens `lookupDecors1`/
 *  `lookupDecors2` resolve) — so this is a direct name-to-name mapping,
 *  not a token table. Every class decor kind maps 1:1 onto a
 *  `LinkDecorName` whose `buildExtremityFactory` entry ignores its
 *  `backgroundColor` param for most kinds (EXTENDS/ARROW/AGGREGATION/
 *  COMPOSITION/PARENTHESIS/CROWFOOT/CIRCLE_LINE/DOUBLE_LINE/LINE_CROWFOOT
 *  all construct their factory without reading it; SQUARE/PLUS DO read it —
 *  `link-decor.ts`'s own `BUILDERS` table), so the exact `Paint` passed as
 *  `backgroundColor` below is threaded through unconditionally for
 *  correctness against every kind this map produces.
 *
 *  G2 N28: widened past the original 4-entry D6 subset (triangle/open/
 *  diamond/filledDiamond) to cover the remaining `class/ast.ts#LinkDecor`
 *  members `headToDecor` (`class-arrow-grammar.ts`) now produces —
 *  square/plus/parenthesis/crowfoot/circleCrowfoot/circleLine/doubleLine/
 *  lineCrowfoot, each a 1:1 name match onto the already-built
 *  `LinkDecorName` of the same shape family. */
const DECOR_TO_NAME: Record<Exclude<LinkDecor, 'none'>, LinkDecorName> = {
  triangle: 'EXTENDS',
  open: 'ARROW',
  diamond: 'AGGREGATION',
  filledDiamond: 'COMPOSITION',
  square: 'SQUARE',
  plus: 'PLUS',
  parenthesis: 'PARENTHESIS',
  crowfoot: 'CROWFOOT',
  circleCrowfoot: 'CIRCLE_CROWFOOT',
  circleLine: 'CIRCLE_LINE',
  doubleLine: 'DOUBLE_LINE',
  lineCrowfoot: 'LINE_CROWFOOT',
  notNavigable: 'NOT_NAVIGABLE', // G2 N47
};

export function decorName(decor: LinkDecor): LinkDecorName | undefined {
  return decor === 'none' ? undefined : DECOR_TO_NAME[decor];
}

/** Extremities never draw text (every reachable class decor kind is a
 *  pure shape — triangle/arrow/diamond), so this `StringBounder` is never
 *  actually invoked; it exists only to satisfy `UGraphicSvg.build`'s
 *  required 4th parameter. */
const NO_TEXT_BOUNDER = { calculateDimension: (): { width: number } => ({ width: 0 }) };

/** Draws one placed extremity via a throwaway klimt document, matching
 *  `SvekEdge#drawExtremity`'s draw-context construction exactly: `Fore`
 *  (outline/stroke color) then a thickness-only `solid` stroke (extremity
 *  outlines are never dashed, regardless of the edge's own line style —
 *  `SvekEdge.ts`'s own `stroke.onlyThickness()` call) then `Back` (fill —
 *  the edge color for a filled decor, `'none'` for a hollow one). */
function drawExtremityMarkup(
  drawable: UDrawable,
  isFill: boolean,
  color: Paint,
  strokeWidth: number,
): { body: string; extraDefs: string } {
  const ug = UGraphicSvg.build(0, basicSvgOption(), '$version$', NO_TEXT_BOUNDER);
  // G2 N31: `edge.strokeWidth` (`class-geo-builders.ts#buildStrokeOverride`,
  // already the resolved `-[thickness=N]->`/`bold` thickness -- N26) was
  // never read here; every extremity drew at a hardcoded thickness 1
  // regardless of the edge's own override, unlike `SvekEdge.ts#drawU`'s
  // real `stroke.onlyThickness()` (the SAME override, description-side).
  const thicknessOnlyStroke = UStroke.withThickness(strokeWidth);
  const context = ug
    .apply(new Fore(color))
    .apply(thicknessOnlyStroke)
    .apply(new Back(isFill ? color : 'none'));
  drawable.drawU(context);
  return extractFlatContent(ug.getSvgString());
}

export interface EdgeArrowheads {
  /** Tail-side (near `edge.points[0]`) extremity markup, or `''` if
   *  `edge.sourceDecor === 'none'`. */
  readonly tail: string;
  /** Head-side (near the last point) extremity markup, or `''` if
   *  `edge.targetDecor === 'none'`. */
  readonly head: string;
  /** Any `<defs>` payload either extremity emitted (gradients, etc.) —
   *  empty for every reachable class decor kind today (all four are
   *  plain-color shapes), carried through for correctness against future
   *  decor kinds/gradient themes. */
  readonly extraDefs: string;
  /**
   * G2 N28: the tail extremity's `SvekEdge#drawU` `dotPath.moveStartPoint
   * (trim.x, trim.y)` displacement (`svek-edge-extremity.ts#place`'s own
   * `PlacedExtremity.trim`) — `undefined` when the tail carries no decor.
   * Never applied by this module itself (it only draws the shape at the
   * RAW, untrimmed anchor point, matching jar's own extremity placement);
   * the caller (`renderer.ts#renderEdge`) applies it to the CONNECTING
   * PATH's endpoint via {@link applyDecorTrim} so the line stops at the
   * marker's outer edge instead of running underneath it — jar-verified
   * necessary against `zerofa-77-caro506` (a `SQUARE` decor whose `<rect>`
   * position already matched untrimmed, but whose connecting `<path>`
   * needed exactly this shift to reach zero-diff on that family).
   */
  readonly tailTrim?: Point2D;
  /** Head-side counterpart of {@link tailTrim} — `undefined` when the head
   *  carries no decor. */
  readonly headTrim?: Point2D;
}

const EMPTY_ARROWHEADS: EdgeArrowheads = { tail: '', head: '', extraDefs: '' };

/**
 * `Math.atan2` from `from` toward `to` — the direction of travel along
 * that segment. Matches `DotPath#getStartAngle`/`getEndAngle`'s own
 * `atan2(dy, dx)` formula exactly (see this module's header doc comment):
 * `DotPath.getEndAngle()` is `atan2(last - secondToLast)`, i.e.
 * `segmentAngle(secondToLast, last)`; `DotPath.getStartAngle()` is
 * `atan2(cp1 - start)`, i.e. `segmentAngle(first, second)`.
 */
function segmentAngle(from: Point2D, to: Point2D): number {
  return Math.atan2(to.y - from.y, to.x - from.x);
}

/**
 * Builds the inline-polygon/path markup for one edge's tail and head
 * extremities — the replacement for `class/renderer.ts`'s old
 * `targetMarker`/`sourceMarker` (`url(#...)` marker-ref) functions.
 * Returns {@link EMPTY_ARROWHEADS} when the edge has fewer than two
 * points to anchor a direction on, or neither end carries a decor (a
 * plain `--` association).
 */
export function buildEdgeArrowheads(edge: EdgeGeo, color: Paint, backgroundColor: Paint): EdgeArrowheads {
  const tailName = decorName(edge.sourceDecor);
  const headName = decorName(edge.targetDecor);
  if (tailName === undefined && headName === undefined) return EMPTY_ARROWHEADS;
  if (edge.points.length < 2) return EMPTY_ARROWHEADS;

  const first = edge.points[0]!;
  const second = edge.points[1]!;
  const last = edge.points[edge.points.length - 1]!;
  const secondToLast = edge.points[edge.points.length - 2]!;

  let tail = '';
  let head = '';
  let extraDefs = '';
  let tailTrim: Point2D | undefined;
  let headTrim: Point2D | undefined;

  // G2 N31: same default (1) `renderer.ts#renderEdge`'s own connecting
  // `<path strokeWidth={geo.strokeWidth ?? 1}>` already uses -- keeps both
  // shapes' thickness in sync whether or not a bracket override is present.
  const strokeWidth = edge.strokeWidth ?? 1;
  if (tailName !== undefined) {
    // Tail decor faces AWAY from the edge (back toward where it came
    // from) -- the travel direction leaving the start point (first ->
    // second), reversed by PI, matching `SvekEdge`'s
    // `dotPath.getStartAngle() + Math.PI`.
    const tailAngle = segmentAngle(first, second) + Math.PI;
    const placed = place(tailName, first, tailAngle, backgroundColor);
    const drawn = drawExtremityMarkup(placed.drawable, placed.isFill, color, strokeWidth);
    tail = drawn.body;
    extraDefs += drawn.extraDefs;
    tailTrim = placed.trim;
  }
  if (headName !== undefined) {
    // Head decor faces FORWARD, continuing the edge's own direction of
    // travel as it arrives at the end point (secondToLast -> last), NOT
    // reversed -- matching `SvekEdge`'s un-negated `dotPath.getEndAngle()`.
    const headAngle = segmentAngle(secondToLast, last);
    const placed = place(headName, last, headAngle, backgroundColor);
    const drawn = drawExtremityMarkup(placed.drawable, placed.isFill, color, strokeWidth);
    head = drawn.body;
    extraDefs += drawn.extraDefs;
    headTrim = placed.trim;
  }

  return {
    tail, head, extraDefs,
    ...(tailTrim !== undefined ? { tailTrim } : {}),
    ...(headTrim !== undefined ? { headTrim } : {}),
  };
}

/**
 * Shortens `points` so the connecting `<path>` stops at the outer edge of
 * a drawn extremity instead of running underneath it -- the RENDER-side
 * counterpart of `SvekEdge#drawU`'s `dotPath.moveStartPoint`/`.moveEndPoint`
 * calls (`SvekEdge.ts:187,197`), applied here to the flat `EdgeGeo.points`
 * list `class/renderer.ts#buildPathData` consumes instead of to a
 * `DotPath`'s bezier-object array (class's renderer deliberately does not
 * build a `DotPath` at all -- see this module's header doc comment).
 *
 * Mirrors `DotPath.ts#moveStartPointXY`/`#moveEndPoint`'s SIMPLE branch
 * (shift the first/last bezier's own start/end point AND its adjacent
 * control point by the trim delta) exactly: for a `1 + 3n`-point spline,
 * that is `points[0]`/`points[1]` (tail) and `points[len-1]`/`points[len-2]`
 * (head); for a plain 2-point secant (no control points at all -- the
 * straight-line fallback `buildPathData` itself falls back to), the single
 * start/end point is shifted directly. NOT ported: `moveStartPointXY`'s
 * segment-consuming branch (trim magnitude >= the first bezier segment's own
 * length, which drops that whole segment) -- unreached by every corpus
 * fixture this iteration surveyed (every decorationLength this port draws is
 * well under a typical single-segment spline length); named as a residual
 * if a future fixture needs it, not ported speculatively.
 */
export function applyDecorTrim(
  points: EdgeGeo['points'],
  tailTrim: Point2D | undefined,
  headTrim: Point2D | undefined,
): EdgeGeo['points'] {
  if (tailTrim === undefined && headTrim === undefined) return points;
  if (points.length < 2) return points;
  const out = points.map((p) => ({ ...p }));
  const last = out.length - 1;
  if (tailTrim !== undefined) {
    out[0] = { x: out[0]!.x + tailTrim.x, y: out[0]!.y + tailTrim.y };
    if (out.length >= 4) out[1] = { x: out[1]!.x + tailTrim.x, y: out[1]!.y + tailTrim.y };
  }
  if (headTrim !== undefined) {
    out[last] = { x: out[last]!.x + headTrim.x, y: out[last]!.y + headTrim.y };
    if (out.length >= 4) out[last - 1] = { x: out[last - 1]!.x + headTrim.x, y: out[last - 1]!.y + headTrim.y };
  }
  return out;
}
