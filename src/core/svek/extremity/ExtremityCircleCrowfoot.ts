import type { UGraphic } from '../../klimt/UGraphic.js';
import type { Point2D } from '../../klimt/UTranslate.js';
import { UTranslate } from '../../klimt/UTranslate.js';
import { UEllipse } from '../../klimt/shape/UEllipse.js';
import { Extremity } from './Extremity.js';
import type { ExtremityFactory } from './ExtremityFactory.js';
import type { Side } from './Side.js';
import { rotatePoint } from './rotate-point.js';
import { drawLineSegment } from './draw-line-segment.js';

/**
 * ExtremityCircleCrowfoot — the ERD "zero-or-many" decor for
 * `LinkDecor.CIRCLE_CROWFOOT` (`}o`/`o{`): a crow's-foot plus a small
 * circle set back from the wings.
 *
 * Upstream: svek/extremity/ExtremityCircleCrowfoot.java +
 * ExtremityFactoryCircleCrowfoot.java. Ported in full: the constructor,
 * `drawU`, `getDecorationLength` (18, fixed). Radius (4) matches
 * upstream's `private final double radius = 4`.
 *
 * `createTBRDrawableLegacy` NOT ported (see `ExtremityFactory.ts`).
 */
export class ExtremityCircleCrowfoot extends Extremity {
  private static readonly RADIUS = 4;

  private readonly contact: Point2D;
  private readonly angle: number;

  constructor(p1: Point2D, angleIn: number) {
    super();
    this.contact = { x: p1.x, y: p1.y };
    this.angle = this.manageround(angleIn + Math.PI / 2);
  }

  override getDecorationLength(): number {
    return 18;
  }

  drawU(ug: UGraphic): void {
    const xWing = 8;
    const yAperture = 6;
    const radius = ExtremityCircleCrowfoot.RADIUS;
    const middle: Point2D = { x: 0, y: 0 };
    const left = rotatePoint({ x: 0, y: -yAperture }, this.angle);
    const base = rotatePoint({ x: -xWing, y: 0 }, this.angle);
    const right = rotatePoint({ x: 0, y: yAperture }, this.angle);
    const circleBase = rotatePoint({ x: -xWing - radius - 2, y: 0 }, this.angle);

    drawLineSegment(ug, this.contact, base, left);
    drawLineSegment(ug, this.contact, base, right);
    drawLineSegment(ug, this.contact, base, middle);
    ug.apply(
      new UTranslate(this.contact.x + circleBase.x - radius, this.contact.y + circleBase.y - radius),
    ).draw(UEllipse.build(2 * radius, 2 * radius));
  }
}

/** Upstream: svek/extremity/ExtremityFactoryCircleCrowfoot.java. */
export class ExtremityFactoryCircleCrowfoot implements ExtremityFactory {
  createUDrawable(p0: Point2D, angle: number, _side: Side | null): ExtremityCircleCrowfoot {
    return new ExtremityCircleCrowfoot(p0, angle - Math.PI / 2);
  }
}
