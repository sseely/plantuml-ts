import type { UGraphic } from '../../klimt/UGraphic.js';
import type { Point2D } from '../../klimt/UTranslate.js';
import { Extremity } from './Extremity.js';
import type { ExtremityFactory } from './ExtremityFactory.js';
import type { Side } from './Side.js';
import { rotatePoint } from './rotate-point.js';
import { drawLineSegment } from './draw-line-segment.js';

/**
 * ExtremityLineCrowfoot — the ERD "one-or-many" decor for `LinkDecor
 * .LINE_CROWFOOT` (`}|`/`|{`): a crow's-foot plus a short perpendicular
 * bar set back from the wings.
 *
 * Upstream: svek/extremity/ExtremityLineCrowfoot.java +
 * ExtremityFactoryLineCrowfoot.java. Ported in full: the constructor,
 * `drawU`, `getDecorationLength` (8, fixed). `lineHeight` (4) matches
 * upstream's `private final double lineHeight = 4`.
 *
 * `createTBRDrawableLegacy` NOT ported (see `ExtremityFactory.ts`).
 */
export class ExtremityLineCrowfoot extends Extremity {
  private static readonly LINE_HEIGHT = 4;

  private readonly contact: Point2D;
  private readonly angle: number;

  constructor(p1: Point2D, angleIn: number) {
    super();
    this.contact = { x: p1.x, y: p1.y };
    this.angle = this.manageround(angleIn + Math.PI / 2);
  }

  override getDecorationLength(): number {
    return 8;
  }

  drawU(ug: UGraphic): void {
    const xWing = 8;
    const yAperture = 6;
    const lineHeight = ExtremityLineCrowfoot.LINE_HEIGHT;
    const middle: Point2D = { x: 0, y: 0 };
    const left = rotatePoint({ x: 0, y: -yAperture }, this.angle);
    const base = rotatePoint({ x: -xWing, y: 0 }, this.angle);
    const lineTop = rotatePoint({ x: -xWing - 2, y: -lineHeight }, this.angle);
    const lineBottom = rotatePoint({ x: -xWing - 2, y: lineHeight }, this.angle);
    const right = rotatePoint({ x: 0, y: yAperture }, this.angle);

    drawLineSegment(ug, this.contact, base, left);
    drawLineSegment(ug, this.contact, base, right);
    drawLineSegment(ug, this.contact, base, middle);
    drawLineSegment(ug, this.contact, lineTop, lineBottom);
  }
}

/** Upstream: svek/extremity/ExtremityFactoryLineCrowfoot.java. */
export class ExtremityFactoryLineCrowfoot implements ExtremityFactory {
  createUDrawable(p0: Point2D, angle: number, _side: Side | null): ExtremityLineCrowfoot {
    return new ExtremityLineCrowfoot(p0, angle - Math.PI / 2);
  }
}
