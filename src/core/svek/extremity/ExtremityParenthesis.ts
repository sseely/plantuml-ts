import type { UGraphic } from '../../klimt/UGraphic.js';
import type { Point2D } from '../../klimt/UTranslate.js';
import { UTranslate } from '../../klimt/UTranslate.js';
import { UStroke } from '../../klimt/UStroke.js';
import { UEllipse } from '../../klimt/shape/UEllipse.js';
import { Extremity } from './Extremity.js';
import type { ExtremityFactory } from './ExtremityFactory.js';
import type { Side } from './Side.js';

/**
 * ExtremityParenthesis — the small arc ("ball-and-socket" interface
 * lollipop tail) decor for `LinkDecor.PARENTHESIS` (`)`/`(`).
 *
 * Upstream: svek/extremity/ExtremityParenthesis.java +
 * ExtremityFactoryParenthesis.java. Ported: the constructor, `drawU`,
 * `getDecorationLength` (10, fixed). `radius2` (9) and `ang` (70,
 * degrees) match upstream's fixed fields exactly.
 *
 * `createTBRDrawableLegacy` NOT ported (see `ExtremityFactory.ts`) —
 * that is also where upstream's `GlobalConfig.USE_INTERFACE_EYE2`
 * branch (`ExtremityParenthesis2`, a distinct "eye" rendering) lives;
 * since that branch is unreachable under `LinkStrategy.SIMPLEST`,
 * `ExtremityParenthesis2.java` is not ported either.
 */
export class ExtremityParenthesis extends Extremity {
  private static readonly RADIUS2 = 9;
  private static readonly ANG = 70;

  private readonly dest: Point2D;
  private readonly ortho: number;

  constructor(p1: Point2D, ortho: number) {
    super();
    this.dest = { x: p1.x, y: p1.y };
    this.ortho = ortho;
  }

  drawU(ug: UGraphic): void {
    const r2 = ExtremityParenthesis.RADIUS2;
    const ang = ExtremityParenthesis.ANG;
    const deg = (-this.ortho * 180) / Math.PI + 90 - ang;
    const arc1 = new UEllipse(2 * r2, 2 * r2, deg, 2 * ang);
    ug.apply(UStroke.withThickness(1.5))
      .apply(new UTranslate(this.dest.x - r2, this.dest.y - r2))
      .draw(arc1);
  }

  override getDecorationLength(): number {
    return 10;
  }
}

/** Upstream: svek/extremity/ExtremityFactoryParenthesis.java. */
export class ExtremityFactoryParenthesis implements ExtremityFactory {
  createUDrawable(p0: Point2D, angle: number, _side: Side | null): ExtremityParenthesis {
    return new ExtremityParenthesis(p0, angle - Math.PI / 2);
  }
}
