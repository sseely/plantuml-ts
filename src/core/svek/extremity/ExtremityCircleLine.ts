import type { UGraphic } from '../../klimt/UGraphic.js';
import type { Point2D } from '../../klimt/UTranslate.js';
import { UTranslate } from '../../klimt/UTranslate.js';
import { UStroke } from '../../klimt/UStroke.js';
import { UEllipse } from '../../klimt/shape/UEllipse.js';
import { Extremity } from './Extremity.js';
import type { ExtremityFactory } from './ExtremityFactory.js';
import type { Side } from './Side.js';
import { rotatePoint } from './rotate-point.js';
import { drawLineSegment } from './draw-line-segment.js';

/**
 * ExtremityCircleLine — the ERD "zero-or-one" decor for `LinkDecor
 * .CIRCLE_LINE` (`|o`/`o|`): a circle plus a short perpendicular bar,
 * both sized off the current stroke thickness.
 *
 * Upstream: svek/extremity/ExtremityCircleLine.java +
 * ExtremityFactoryCircleLine.java. Ported in full: the constructor,
 * `drawU` (including the thickness-driven radius/lineHeight formula —
 * `4 + thickness - 1`), `getDecorationLength` (15, fixed).
 *
 * `createTBRDrawableLegacy` NOT ported (see `ExtremityFactory.ts`).
 */
export class ExtremityCircleLine extends Extremity {
  private readonly contact: Point2D;
  private readonly angle: number;

  constructor(p1: Point2D, angleIn: number) {
    super();
    this.contact = { x: p1.x, y: p1.y };
    this.angle = this.manageround(angleIn + Math.PI / 2);
  }

  override getDecorationLength(): number {
    return 15;
  }

  drawU(ug: UGraphic): void {
    const thickness = ug.getParam().getStroke().getThickness();
    const radius = 4 + thickness - 1;
    const lineHeight = 4 + thickness - 1;
    const xWing = 4;
    const middle: Point2D = { x: 0, y: 0 };
    const base = rotatePoint({ x: -xWing - radius - 3, y: 0 }, this.angle);
    const circleBase = base;
    const lineTop = rotatePoint({ x: -xWing, y: -lineHeight }, this.angle);
    const lineBottom = rotatePoint({ x: -xWing, y: lineHeight }, this.angle);

    drawLineSegment(ug, this.contact, base, middle);
    const stroke = UStroke.withThickness(thickness);
    ug.apply(
      new UTranslate(this.contact.x + circleBase.x - radius, this.contact.y + circleBase.y - radius),
    )
      .apply(stroke)
      .draw(UEllipse.build(2 * radius, 2 * radius));
    drawLineSegment(ug.apply(stroke), this.contact, lineTop, lineBottom);
  }
}

/** Upstream: svek/extremity/ExtremityFactoryCircleLine.java. */
export class ExtremityFactoryCircleLine implements ExtremityFactory {
  createUDrawable(p0: Point2D, angle: number, _side: Side | null): ExtremityCircleLine {
    return new ExtremityCircleLine(p0, angle - Math.PI / 2);
  }
}
