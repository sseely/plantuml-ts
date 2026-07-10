import type { UGraphic } from '../../klimt/UGraphic.js';
import type { Point2D } from '../../klimt/UTranslate.js';
import type { Paint } from '../../paint.js';
import { UTranslate } from '../../klimt/UTranslate.js';
import { UStroke } from '../../klimt/UStroke.js';
import { Back } from '../../klimt/Back.js';
import { UEllipse } from '../../klimt/shape/UEllipse.js';
import { Extremity } from './Extremity.js';
import type { ExtremityFactory } from './ExtremityFactory.js';
import type { Side } from './Side.js';

/**
 * ExtremityCircleConnect — the small filled circle plus a quarter-arc
 * decor for `LinkDecor.CIRCLE_CONNECT` (`0)`/`(0`).
 *
 * Upstream: svek/extremity/ExtremityCircleConnect.java +
 * ExtremityFactoryCircleConnect.java. Ported: the constructor, `drawU`,
 * `getDecorationLength` (10, fixed). `radius` (6, the filled circle)
 * and `radius2` (10, the arc) match upstream's fixed fields.
 *
 * NOT ported: the commented-out `getPointOnCircle`/`drawLine` dead
 * code (already inactive in upstream itself). `createTBRDrawableLegacy`
 * NOT ported (see `ExtremityFactory.ts`).
 */
export class ExtremityCircleConnect extends Extremity {
  private static readonly RADIUS = 6;
  private static readonly RADIUS2 = 10;

  private readonly dest: Point2D;
  private readonly ortho: number;
  private readonly backgroundColor: Paint;

  constructor(p1: Point2D, ortho: number, backgroundColor: Paint) {
    super();
    this.dest = { x: p1.x, y: p1.y };
    this.ortho = ortho;
    this.backgroundColor = backgroundColor;
  }

  drawU(ug: UGraphic): void {
    const radius = ExtremityCircleConnect.RADIUS;
    const radius2 = ExtremityCircleConnect.RADIUS2;
    const applied = ug.apply(UStroke.withThickness(1.5)).apply(new Back(this.backgroundColor));
    applied
      .apply(new UTranslate(this.dest.x - radius, this.dest.y - radius))
      .draw(UEllipse.build(radius * 2, radius * 2));

    const deg = (-this.ortho * 180) / Math.PI + 90 - 45;
    const arc1 = new UEllipse(2 * radius2, 2 * radius2, deg, 90);
    applied.apply(new UTranslate(this.dest.x - radius2, this.dest.y - radius2)).draw(arc1);
  }

  override getDecorationLength(): number {
    return 10;
  }
}

/** Upstream: svek/extremity/ExtremityFactoryCircleConnect.java. */
export class ExtremityFactoryCircleConnect implements ExtremityFactory {
  private readonly backgroundColor: Paint;

  constructor(backgroundColor: Paint) {
    this.backgroundColor = backgroundColor;
  }

  createUDrawable(p0: Point2D, angleIn: number, _side: Side | null): ExtremityCircleConnect {
    const angle = angleIn - Math.PI / 2;
    return new ExtremityCircleConnect(p0, angle, this.backgroundColor);
  }
}
