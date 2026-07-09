import type { Positionable } from './Positionable.js';
import type { XDimension2D } from './XDimension2D.js';
import { XPoint2D } from './XPoint2D.js';

/**
 * PositionableImpl — the plain `Positionable` implementation:
 * a movable point plus a fixed size. `TextBlockUtils.asPositionable`
 * constructs one via `create(pt, dim)` for either a `TextBlock`'s
 * measured dimension or a bare `XDimension2D`.
 *
 * Upstream: klimt/geom/PositionableImpl.java. Ported in full: both
 * constructors (collapsed to one — see below), `create`,
 * `getPosition`/`getSize`, `moveDelta`.
 *
 * TS-mechanics deviation: upstream has a public `(x, y, dim)`
 * constructor plus a `create(pt, dim)` static factory that unpacks
 * `pt.getX()/getY()` into it. Both are kept — `create` still delegates
 * to the constructor, matching upstream's own call shape.
 */
export class PositionableImpl implements Positionable {
  private pos: XPoint2D;
  private readonly dim: XDimension2D;

  constructor(x: number, y: number, dim: XDimension2D) {
    this.pos = new XPoint2D(x, y);
    this.dim = dim;
  }

  static create(pt: XPoint2D, dim: XDimension2D): PositionableImpl {
    return new PositionableImpl(pt.getX(), pt.getY(), dim);
  }

  getPosition(): XPoint2D {
    return this.pos;
  }

  getSize(): XDimension2D {
    return this.dim;
  }

  moveDelta(deltaX: number, deltaY: number): void {
    this.pos = this.pos.move(deltaX, deltaY);
  }
}
