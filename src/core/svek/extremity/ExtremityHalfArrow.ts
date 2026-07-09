import type { UGraphic } from '../../klimt/UGraphic.js';
import type { Point2D } from '../../klimt/UTranslate.js';
import { UTranslate } from '../../klimt/UTranslate.js';
import { Back } from '../../klimt/Back.js';
import { ULine } from '../../klimt/shape/ULine.js';
import { Extremity } from './Extremity.js';
import type { ExtremityFactory } from './ExtremityFactory.js';
import type { Side } from './Side.js';
import { rotatePoint } from './rotate-point.js';

/**
 * ExtremityHalfArrow — the single-wing "half arrow" decor for
 * `LinkDecor.HALF_ARROW_UP` (`\\`, `direction=1`) and `LinkDecor
 * .HALF_ARROW_DOWN` (`//`, `direction=-1`).
 *
 * Upstream: svek/extremity/ExtremityHalfArrow.java +
 * ExtremityFactoryHalfArrow.java. Ported: the single-point constructor
 * (`ExtremityHalfArrow(XPoint2D p0, double angle, int direction)` — the
 * only one `ExtremityFactoryHalfArrow#createUDrawable` calls), `drawU`.
 * No `getDecorationLength` override upstream — inherits `Extremity`'s
 * default of 8.
 *
 * NOT ported: the two-point/`center` constructor overload + its `line`/
 * `center` field — only used by `createTBRDrawableLegacy`, dead under
 * `LinkStrategy.SIMPLEST` (see `ExtremityFactory.ts`).
 */
export class ExtremityHalfArrow extends Extremity {
  private readonly contact: Point2D;
  private readonly line: Point2D;
  private readonly otherLine: Point2D;

  constructor(p0: Point2D, angleIn: number, direction: number) {
    super();
    const angle = this.manageround(angleIn);
    const xWing = 9;
    const yAperture = 4 * direction;
    this.contact = p0;
    this.line = rotatePoint({ x: -xWing, y: -yAperture }, angle);
    this.otherLine = rotatePoint({ x: -8, y: 0 }, angle);
  }

  drawU(ug: UGraphic): void {
    const applied = ug.apply(new Back(ug.getParam().getColor()));
    const length = Math.hypot(this.line.x, this.line.y);
    if (length > 2) {
      const position = new UTranslate(this.contact.x, this.contact.y);
      applied.apply(position).draw(new ULine(this.line.x, this.line.y));
      applied.apply(position).draw(new ULine(this.otherLine.x, this.otherLine.y));
    }
  }
}

/** Upstream: svek/extremity/ExtremityFactoryHalfArrow.java. */
export class ExtremityFactoryHalfArrow implements ExtremityFactory {
  private readonly direction: number;

  constructor(direction: number) {
    this.direction = direction;
  }

  createUDrawable(p0: Point2D, angle: number, _side: Side | null): ExtremityHalfArrow {
    return new ExtremityHalfArrow(p0, angle, this.direction);
  }
}
