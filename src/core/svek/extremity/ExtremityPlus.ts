import type { UGraphic } from '../../klimt/UGraphic.js';
import type { Point2D } from '../../klimt/UTranslate.js';
import type { Paint } from '../../paint.js';
import { UTranslate } from '../../klimt/UTranslate.js';
import { Back } from '../../klimt/Back.js';
import { UEllipse } from '../../klimt/shape/UEllipse.js';
import { Extremity } from './Extremity.js';
import type { ExtremityFactory } from './ExtremityFactory.js';
import type { Side } from './Side.js';
import { drawLineSegment } from './draw-line-segment.js';

/**
 * ExtremityPlus — the small filled circle plus a "+" cross decor for
 * `LinkDecor.PLUS` (`+`).
 *
 * Upstream: svek/extremity/ExtremityPlus.java +
 * ExtremityFactoryPlus.java. Ported: the `create` factory + private
 * constructor, `drawU`, `getPointOnCircle`, `getDecorationLength` (16,
 * fixed). `radius` (8) matches upstream's `private static final double
 * radius = 8`.
 *
 * `createTBRDrawableLegacy` NOT ported (see `ExtremityFactory.ts`).
 */
export class ExtremityPlus extends Extremity {
  private static readonly RADIUS = 8;

  private readonly circle: UEllipse;
  private readonly px: number;
  private readonly py: number;
  private readonly angle: number;
  private readonly backgroundColor: Paint;

  private constructor(x: number, y: number, angle: number, backgroundColor: Paint) {
    super();
    const r = ExtremityPlus.RADIUS;
    this.circle = UEllipse.build(2 * r, 2 * r);
    this.px = x;
    this.py = y;
    this.angle = angle;
    this.backgroundColor = backgroundColor;
  }

  static create(p1: Point2D, angle: number, backgroundColor: Paint): ExtremityPlus {
    const r = ExtremityPlus.RADIUS;
    const x = p1.x - r + r * Math.sin(angle);
    const y = p1.y - r - r * Math.cos(angle);
    return new ExtremityPlus(x, y, angle, backgroundColor);
  }

  private getPointOnCircle(angle: number): Point2D {
    const r = ExtremityPlus.RADIUS;
    return { x: this.px + r + r * Math.cos(angle), y: this.py + r + r * Math.sin(angle) };
  }

  drawU(ug: UGraphic): void {
    ug.apply(new Back(this.backgroundColor)).apply(new UTranslate(this.px, this.py)).draw(this.circle);
    const origin: Point2D = { x: 0, y: 0 };
    drawLineSegment(ug, origin, this.getPointOnCircle(this.angle - Math.PI / 2), this.getPointOnCircle(this.angle + Math.PI / 2));
    drawLineSegment(ug, origin, this.getPointOnCircle(this.angle), this.getPointOnCircle(this.angle + Math.PI));
  }

  override getDecorationLength(): number {
    return 16;
  }
}

/** Upstream: svek/extremity/ExtremityFactoryPlus.java. */
export class ExtremityFactoryPlus implements ExtremityFactory {
  private readonly backgroundColor: Paint;

  constructor(backgroundColor: Paint) {
    this.backgroundColor = backgroundColor;
  }

  createUDrawable(p0: Point2D, angleIn: number, _side: Side | null): ExtremityPlus {
    return ExtremityPlus.create(p0, angleIn - Math.PI / 2, this.backgroundColor);
  }
}
