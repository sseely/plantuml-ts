import type { UGraphic } from '../../klimt/UGraphic.js';
import type { Point2D } from '../../klimt/UTranslate.js';
import type { Paint } from '../../paint.js';
import { Back } from '../../klimt/Back.js';
import { UStroke } from '../../klimt/UStroke.js';
import { UTranslate } from '../../klimt/UTranslate.js';
import { URectangle } from '../../klimt/shape/URectangle.js';
import { Extremity } from './Extremity.js';
import type { ExtremityFactory } from './ExtremityFactory.js';
import type { Side } from './Side.js';

/**
 * ExtremitySquare — the small square decor for `LinkDecor.SQUARE` (`#`).
 *
 * Upstream: svek/extremity/ExtremitySquare.java +
 * ExtremityFactorySquare.java. Ported in full: the constructor, `drawU`,
 * `getDecorationLength` (5, fixed). Radius (5) matches upstream's
 * `private final double radius = 5`.
 *
 * `createTBRDrawableLegacy` NOT ported (see `ExtremityFactory.ts`).
 */
export class ExtremitySquare extends Extremity {
  private static readonly RADIUS = 5;

  private readonly dest: Point2D;
  private readonly backgroundColor: Paint;

  constructor(p1: Point2D, backgroundColor: Paint) {
    super();
    this.dest = { x: p1.x, y: p1.y };
    this.backgroundColor = backgroundColor;
  }

  drawU(ug: UGraphic): void {
    const r = ExtremitySquare.RADIUS;
    ug.apply(UStroke.withThickness(1.5))
      .apply(new Back(this.backgroundColor))
      .apply(new UTranslate(this.dest.x - r, this.dest.y - r))
      .draw(URectangle.build(r * 2, r * 2));
  }

  override getDecorationLength(): number {
    return 5;
  }
}

/** Upstream: svek/extremity/ExtremityFactorySquare.java. */
export class ExtremityFactorySquare implements ExtremityFactory {
  private readonly backgroundColor: Paint;

  constructor(backgroundColor: Paint) {
    this.backgroundColor = backgroundColor;
  }

  createUDrawable(p0: Point2D, _angle: number, _side: Side | null): ExtremitySquare {
    return new ExtremitySquare(p0, this.backgroundColor);
  }
}
