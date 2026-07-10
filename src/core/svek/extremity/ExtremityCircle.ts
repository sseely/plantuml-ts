import type { UGraphic } from '../../klimt/UGraphic.js';
import type { Point2D } from '../../klimt/UTranslate.js';
import type { Paint } from '../../paint.js';
import { Back } from '../../klimt/Back.js';
import { UStroke } from '../../klimt/UStroke.js';
import { UTranslate } from '../../klimt/UTranslate.js';
import { UEllipse } from '../../klimt/shape/UEllipse.js';
import { Extremity } from './Extremity.js';
import type { ExtremityFactory } from './ExtremityFactory.js';
import type { Side } from './Side.js';

/**
 * ExtremityCircle — the small circle decor for `LinkDecor.CIRCLE` (`0`,
 * hollow — filled with the diagram background) and `LinkDecor
 * .CIRCLE_FILL` (`@`, filled with the current line color).
 *
 * Upstream: svek/extremity/ExtremityCircle.java +
 * ExtremityFactoryCircle.java. Ported: the `create` factory + private
 * constructor, `drawU`, `getDecorationLength` (12, fixed). Radius (6)
 * matches upstream's `private static final double radius = 6`.
 *
 * `createTBRDrawableLegacy` NOT ported (see `ExtremityFactory.ts`).
 */
export class ExtremityCircle extends Extremity {
  private static readonly RADIUS = 6;

  private readonly dest: Point2D;
  private readonly fill: boolean;
  private readonly backgroundColor: Paint;

  private constructor(x: number, y: number, fill: boolean, angle: number, backgroundColor: Paint) {
    super();
    const r = ExtremityCircle.RADIUS;
    this.dest = {
      x: x - r * Math.cos(angle + Math.PI / 2),
      y: y - r * Math.sin(angle + Math.PI / 2),
    };
    this.fill = fill;
    this.backgroundColor = backgroundColor;
  }

  static create(center: Point2D, fill: boolean, angle: number, backgroundColor: Paint): ExtremityCircle {
    return new ExtremityCircle(center.x, center.y, fill, angle, backgroundColor);
  }

  drawU(ug: UGraphic): void {
    const r = ExtremityCircle.RADIUS;
    let applied = ug.apply(UStroke.withThickness(1.5));
    applied = this.fill ? applied.apply(new Back(applied.getParam().getColor())) : applied.apply(new Back(this.backgroundColor));
    applied.apply(new UTranslate(this.dest.x - r, this.dest.y - r)).draw(UEllipse.build(r * 2, r * 2));
  }

  override getDecorationLength(): number {
    return 12;
  }
}

/** Upstream: svek/extremity/ExtremityFactoryCircle.java. */
export class ExtremityFactoryCircle implements ExtremityFactory {
  private readonly fill: boolean;
  private readonly backgroundColor: Paint;

  constructor(fill: boolean, backgroundColor: Paint) {
    this.fill = fill;
    this.backgroundColor = backgroundColor;
  }

  createUDrawable(p0: Point2D, angleIn: number, _side: Side | null): ExtremityCircle {
    const angle = angleIn - Math.PI / 2;
    return ExtremityCircle.create(p0, this.fill, angle, this.backgroundColor);
  }
}
