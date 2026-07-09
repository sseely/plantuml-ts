import type { UGraphic } from '../../klimt/UGraphic.js';
import type { Point2D } from '../../klimt/UTranslate.js';
import { UTranslate } from '../../klimt/UTranslate.js';
import { ULine } from '../../klimt/shape/ULine.js';

/**
 * drawLineSegment — the `drawLine(UGraphic, double x, double y,
 * XPoint2D p1, XPoint2D p2)` private static helper upstream repeats,
 * verbatim, in `ExtremityCrowfoot`/`ExtremityCircleCrowfoot`/
 * `ExtremityLineCrowfoot`/`ExtremityCircleLine`/`ExtremityDoubleLine`
 * (five identical copies across those five files — genuine upstream
 * duplication, not a special case). Consolidated into one shared
 * helper here: pure drawing-primitive utility, not diagram behavior, so
 * this dedup does not touch any of the per-decor special-case math this
 * project's porting discipline protects.
 */
export function drawLineSegment(ug: UGraphic, origin: Point2D, p1: Point2D, p2: Point2D): void {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  ug.apply(new UTranslate(origin.x + p1.x, origin.y + p1.y)).draw(new ULine(dx, dy));
}
