import type { UGraphic } from '../../klimt/UGraphic.js';
import type { Point2D } from '../../klimt/UTranslate.js';
import { Extremity } from './Extremity.js';
import type { ExtremityFactory } from './ExtremityFactory.js';
import type { Side } from './Side.js';
import { rotatePoint } from './rotate-point.js';
import { drawLineSegment } from './draw-line-segment.js';

/**
 * ExtremityDoubleLine — the ERD "exactly-one" decor for `LinkDecor
 * .DOUBLE_LINE` (`||`): two short parallel perpendicular bars.
 *
 * Upstream: svek/extremity/ExtremityDoubleLine.java +
 * ExtremityFactoryDoubleLine.java. Ported in full: the constructor,
 * `drawU`, `getDecorationLength` (8, fixed). `lineHeight` (4) matches
 * upstream's `private final double lineHeight = 4`.
 *
 * `createTBRDrawableLegacy` NOT ported (see `ExtremityFactory.ts`).
 */
export class ExtremityDoubleLine extends Extremity {
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
    const xWing = 4;
    const lineHeight = ExtremityDoubleLine.LINE_HEIGHT;
    const firstLineTop = rotatePoint({ x: -xWing, y: -lineHeight }, this.angle);
    const firstLineBottom = rotatePoint({ x: -xWing, y: lineHeight }, this.angle);
    const secondLineTop = rotatePoint({ x: -xWing - 3, y: -lineHeight }, this.angle);
    const secondLineBottom = rotatePoint({ x: -xWing - 3, y: lineHeight }, this.angle);
    const middle = rotatePoint({ x: 0, y: 0 }, this.angle);
    const base = rotatePoint({ x: -xWing - 4, y: 0 }, this.angle);

    drawLineSegment(ug, this.contact, firstLineTop, firstLineBottom);
    drawLineSegment(ug, this.contact, secondLineTop, secondLineBottom);
    drawLineSegment(ug, this.contact, base, middle);
  }
}

/** Upstream: svek/extremity/ExtremityFactoryDoubleLine.java. */
export class ExtremityFactoryDoubleLine implements ExtremityFactory {
  createUDrawable(p0: Point2D, angle: number, _side: Side | null): ExtremityDoubleLine {
    return new ExtremityDoubleLine(p0, angle - Math.PI / 2);
  }
}
