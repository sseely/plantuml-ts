/**
 * renderer-arrowhead.ts — mission G4 S1, mechanism 3 ("arrowhead-drawing
 * mechanism"): replaces `state/renderer.ts`'s SVG-`<marker>`-reference
 * arrowhead (`markerEnd: 'url(#arrow-dependency)'`) with the SAME
 * inline-`<polygon>` extremity shape the class/description engines already
 * draw (`core/svek/extremity/ExtremityArrow.ts`, `LinkDecor.ARROW`) — jar's
 * state-diagram corpus contains ZERO `<marker>`/`markerEnd` (grep-verified
 * across every sampled fixture, `plans/g4-state-svg/ledger.md` S0 mechanism
 * 3), same as class/description's.
 *
 * State transitions always resolve to a SINGLE head-side `ARROW` decor (the
 * plain `-->` trailing arrowhead) — unlike class's `EdgeGeo`, `TransitionGeo`
 * carries no tail-decor field at all (state has no `<--`/multi-decor
 * transition syntax), so this module is a head-only simplification of
 * `class/renderer-arrowhead.ts#buildEdgeArrowheads`/`#edgeExtremityInk`,
 * not a full port.
 *
 * @see plans/g4-state-svg/ledger.md (S1, mechanism 3)
 * @see class/renderer-arrowhead.ts (the class-engine precedent this mirrors)
 */

import type { Point2D } from '../../core/klimt/UTranslate.js';
import type { Paint } from '../../core/paint.js';
import { UGraphicSvg } from '../../core/klimt/drawing/svg/u-graphic-svg.js';
import { basicSvgOption } from '../../core/klimt/drawing/svg/svg-graphics.js';
import { Fore } from '../../core/klimt/Fore.js';
import { Back } from '../../core/klimt/Back.js';
import { UStroke } from '../../core/klimt/UStroke.js';
import { place } from '../../core/svek/svek-edge-extremity.js';
import { extractFlatContent } from '../../core/klimt/document-shell.js';
import { LimitFinder } from '../../core/klimt/drawing/LimitFinder.js';
import type { TransitionGeo } from './state-geo-types.js';
import { XDimension2D } from '../../core/klimt/geom/XDimension2D.js';
import type { StringBounder } from '../../core/klimt/font/StringBounder.js';

/** Extremities never draw text (the ARROW decor is a pure shape) — exists
 *  only to satisfy `UGraphicSvg.build`'s required 4th parameter, mirroring
 *  `class/renderer-arrowhead.ts#NO_TEXT_BOUNDER`. */
const NO_TEXT_BOUNDER = { calculateDimension: (): { width: number } => ({ width: 0 }) };

/** `Math.atan2` from `from` toward `to` — matches `DotPath#getEndAngle`'s
 *  own `atan2(last - secondToLast)` formula (see `class/renderer-arrowhead
 *  .ts#segmentAngle`'s identical doc comment for the upstream citation). */
function segmentAngle(from: Point2D, to: Point2D): number {
  return Math.atan2(to.y - from.y, to.x - from.x);
}

/** Draws the ARROW extremity via a throwaway klimt document, matching
 *  `SvekEdge#drawExtremity`'s draw-context construction (`Fore` then a
 *  thickness-only `solid` stroke then `Back`) — see `class/renderer-
 *  arrowhead.ts#drawExtremityMarkup`'s identical doc comment. */
function drawArrowMarkup(point: Point2D, angle: number, color: Paint, strokeWidth: number): { body: string; extraDefs: string; trim: Point2D } {
  const placed = place('ARROW', point, angle, 'none');
  const ug = UGraphicSvg.build(0, basicSvgOption(), '$version$', NO_TEXT_BOUNDER);
  const thicknessOnlyStroke = UStroke.withThickness(strokeWidth);
  const context = ug.apply(new Fore(color)).apply(thicknessOnlyStroke).apply(new Back(color));
  placed.drawable.drawU(context);
  const drawn = extractFlatContent(ug.getSvgString());
  return { ...drawn, trim: placed.trim };
}

export interface TransitionArrowhead {
  /** The head-side extremity's inline-polygon markup, or `''` when the
   *  transition has fewer than two points to anchor a direction on. */
  readonly markup: string;
  readonly extraDefs: string;
  /** The connecting `<path>`'s endpoint shift so the line stops at the
   *  arrow's outer edge instead of running underneath it (`decorTrim`'s
   *  own `getDecorationLength()`-based delta) — `undefined` when
   *  `markup === ''`. */
  readonly trim?: Point2D;
}

const EMPTY_ARROWHEAD: TransitionArrowhead = { markup: '', extraDefs: '' };

/** Builds the head-side inline-polygon arrowhead markup for one transition
 *  — the replacement for `renderer.ts`'s old `markerEnd: 'url(#arrow-
 *  dependency)'` path attribute. */
export function buildTransitionArrowhead(transition: TransitionGeo, color: Paint, strokeWidth: number): TransitionArrowhead {
  const points = transition.points;
  if (points.length < 2) return EMPTY_ARROWHEAD;
  const last = points[points.length - 1]!;
  const secondToLast = points[points.length - 2]!;
  const angle = segmentAngle(secondToLast, last);
  const drawn = drawArrowMarkup(last, angle, color, strokeWidth);
  return { markup: drawn.body, extraDefs: drawn.extraDefs, trim: drawn.trim };
}

/** Shortens `points` so the connecting `<path>` stops at the outer edge of
 *  the drawn arrowhead — the render-side counterpart of `SvekEdge#drawU`'s
 *  `dotPath.moveEndPoint` call, applied to the flat `TransitionGeo.points`
 *  list `buildPathD` consumes. Mirrors `class/renderer-arrowhead.ts
 *  #applyDecorTrim`'s head-side branch exactly (state has no tail decor to
 *  mirror the tail branch for). */
export function applyHeadTrim(points: TransitionGeo['points'], trim: Point2D | undefined): TransitionGeo['points'] {
  if (trim === undefined || points.length < 2) return points;
  const out = points.map((p) => ({ ...p }));
  const last = out.length - 1;
  out[last] = { x: out[last]!.x + trim.x, y: out[last]!.y + trim.y };
  if (out.length >= 4) out[last - 1] = { x: out[last - 1]!.x + trim.x, y: out[last - 1]!.y + trim.y };
  return out;
}

/** Extremities never draw text — this stub is never actually invoked
 *  (mirrors `class/renderer-arrowhead.ts#INK_STRING_BOUNDER`). */
const INK_STRING_BOUNDER: StringBounder = {
  calculateDimension: () => new XDimension2D(0, 0),
};

export interface TransitionArrowheadInk {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

/** Returns the ink extent of a transition's head-side ARROW extremity, or
 *  `undefined` when the transition has fewer than two points — mirrors
 *  `class/renderer-arrowhead.ts#edgeExtremityInk`'s identical mechanism
 *  (real `LimitFinder` walk over the placed `Extremity#drawU`). Consumed
 *  by `layout-ink-extent.ts#computeStateDocumentDims`. */
export function transitionArrowheadInk(transition: TransitionGeo): TransitionArrowheadInk | undefined {
  const points = transition.points;
  if (points.length < 2) return undefined;
  const last = points[points.length - 1]!;
  const secondToLast = points[points.length - 2]!;
  const angle = segmentAngle(secondToLast, last);
  const finder = LimitFinder.create(INK_STRING_BOUNDER, false);
  place('ARROW', last, angle, 'none').drawable.drawU(finder);
  return { minX: finder.getMinX(), minY: finder.getMinY(), maxX: finder.getMaxX(), maxY: finder.getMaxY() };
}
