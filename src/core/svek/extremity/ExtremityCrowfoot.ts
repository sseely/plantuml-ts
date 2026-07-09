import type { UGraphic } from '../../klimt/UGraphic.js';
import type { Point2D } from '../../klimt/UTranslate.js';
import { Extremity } from './Extremity.js';
import type { ExtremityFactory } from './ExtremityFactory.js';
import { Side } from './Side.js';
import { rotatePoint } from './rotate-point.js';
import { drawLineSegment } from './draw-line-segment.js';

/**
 * ExtremityCrowfoot — the ERD "many" crow's-foot decor for
 * `LinkDecor.CROWFOOT` (`}`/`{`): three lines (left wing, right wing,
 * center spike) fanning out from the contact point.
 *
 * Upstream: svek/extremity/ExtremityCrowfoot.java +
 * ExtremityFactoryCrowfoot.java. Ported in full: the constructor,
 * `drawU` (including the `side`-driven WEST/EAST/NORTH/SOUTH wing-
 * endpoint clamp — the one reachable-set class whose `createUDrawable`
 * actually reads its `side` parameter), `getDecorationLength` (8, fixed).
 *
 * `side` wiring (reported): `SvekEdge.ts`'s adapter interface does not
 * receive node rectangle geometry at draw time (see its own doc
 * comment's cut-line note), so every call site passes `side=null` —
 * matching upstream's own behavior when `nodeContact == null`
 * (`SvekEdge#getExtremitySimplier`). `createTBRDrawableLegacy` NOT
 * ported (see `ExtremityFactory.ts`).
 */
export class ExtremityCrowfoot extends Extremity {
  private readonly contact: Point2D;
  private readonly angle: number;
  private readonly side: Side | null;

  constructor(p1: Point2D, angleIn: number, side: Side | null) {
    super();
    this.contact = { x: p1.x, y: p1.y };
    this.angle = this.manageround(angleIn + Math.PI / 2);
    this.side = side;
  }

  override getDecorationLength(): number {
    return 8;
  }

  drawU(ug: UGraphic): void {
    const xWing = 8;
    const yAperture = 8;
    const middle: Point2D = { x: 0, y: 0 };
    let left = rotatePoint({ x: 0, y: -yAperture }, this.angle);
    const base = rotatePoint({ x: -xWing, y: 0 }, this.angle);
    let right = rotatePoint({ x: 0, y: yAperture }, this.angle);

    if (this.side === Side.WEST || this.side === Side.EAST) {
      left = { x: middle.x, y: left.y };
      right = { x: middle.x, y: right.y };
    }
    if (this.side === Side.SOUTH || this.side === Side.NORTH) {
      left = { x: left.x, y: middle.y };
      right = { x: right.x, y: middle.y };
    }

    drawLineSegment(ug, this.contact, base, left);
    drawLineSegment(ug, this.contact, base, right);
    drawLineSegment(ug, this.contact, base, middle);
  }
}

/** Upstream: svek/extremity/ExtremityFactoryCrowfoot.java. */
export class ExtremityFactoryCrowfoot implements ExtremityFactory {
  createUDrawable(p0: Point2D, angle: number, side: Side | null): ExtremityCrowfoot {
    return new ExtremityCrowfoot(p0, angle - Math.PI / 2, side);
  }
}
