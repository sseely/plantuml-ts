import type { UGraphic } from '../../klimt/UGraphic.js';
import type { Point2D } from '../../klimt/UTranslate.js';
import { UPath } from '../../klimt/shape/UPath.js';
import { Extremity } from './Extremity.js';
import type { ExtremityFactory } from './ExtremityFactory.js';
import type { Side } from './Side.js';
import { rotateAndTranslate } from './rotate-point.js';

/**
 * ExtremityNotNavigable — the small "X" decor for `LinkDecor
 * .NOT_NAVIGABLE` (`x`): two crossing short lines.
 *
 * Upstream: svek/extremity/ExtremityNotNavigable.java +
 * ExtremityFactoryNotNavigable.java. Ported: the constructor's
 * resulting geometry and `drawU`, `getDecorationLength` (8, fixed).
 *
 * Geometry-build adaptation: upstream builds the two line segments at
 * the origin, then chains `UPath#translate(0, move)` ->
 * `UPath#rotate(angle + PI)` -> `UPath#translate(p1.x, p1.y)`. This
 * port's `UPath` does not have `rotate()` (see `rotate-point.ts`'s
 * module doc comment), so the four endpoints are computed directly via
 * `rotateAndTranslate({x, y: y + move}, angle + PI, p1)` — algebraically
 * identical to upstream's three-step chain (translate-by-move folds
 * into the point's `y` before the single rotate+translate composite).
 *
 * `createTBRDrawableLegacy` NOT ported (see `ExtremityFactory.ts`).
 */
export class ExtremityNotNavigable extends Extremity {
  private readonly path: UPath;

  constructor(p1: Point2D, angleIn: number) {
    super();
    const angle = this.manageround(angleIn) + Math.PI;
    const size = 4;
    const move = 5;
    const at = (x: number, y: number): Point2D => rotateAndTranslate({ x, y: y + move }, angle, p1);

    this.path = UPath.none();
    this.path.moveTo(at(-size, 0));
    this.path.lineTo(at(size, 2 * size));
    this.path.moveTo(at(size, 0));
    this.path.lineTo(at(-size, 2 * size));
  }

  drawU(ug: UGraphic): void {
    ug.draw(this.path);
  }

  override getDecorationLength(): number {
    return 8;
  }
}

/** Upstream: svek/extremity/ExtremityFactoryNotNavigable.java. */
export class ExtremityFactoryNotNavigable implements ExtremityFactory {
  createUDrawable(p0: Point2D, angle: number, _side: Side | null): ExtremityNotNavigable {
    return new ExtremityNotNavigable(p0, angle - Math.PI / 2);
  }
}
