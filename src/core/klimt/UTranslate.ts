import type { UChange } from './UChange.js';

/**
 * A 2D point, local to this module. Upstream's `getTranslated` takes/
 * returns `klimt.geom.XPoint2D`; that geometry class is not yet ported
 * (out of scope for T2 — see mission brief), so a minimal `{ x, y }`
 * shape stands in at this seam. Any future `XPoint2D` port should be
 * structurally compatible with this type.
 */
export interface Point2D {
  readonly x: number;
  readonly y: number;
}

/**
 * UTranslate — an immutable (dx, dy) offset. It is itself a `UChange`:
 * applying one to a `UGraphic` composes it with the graphic's current
 * translate to produce a new, independent state (see
 * `AbstractCommonUGraphic#apply`).
 *
 * Upstream: klimt/UTranslate.java. Ported members: the constructor,
 * `none`/`dx`/`dy` factories, `getDx`/`getDy`, `isAlmostSame`,
 * `getTranslated`, `scaled`, `compose`, `reverse`, `multiplyBy`, `sym`,
 * `getPosition`. NOT ported: the `point(XPoint2D)` factory, `apply
 * (XRectangle2D)`, and `rotate(double)` — each depends on geometry
 * classes (`XPoint2D`, `XRectangle2D`, `XAffineTransform`) that are not
 * yet part of this port; adding them here would silently expand T2's
 * write-set. Re-add when those geometry types land.
 */
export class UTranslate implements UChange {
  private readonly dx: number;
  private readonly dy: number;

  constructor(dx: number, dy: number) {
    this.dx = dx;
    this.dy = dy;
  }

  static none(): UTranslate {
    return new UTranslate(0, 0);
  }

  static dx(dx: number): UTranslate {
    return new UTranslate(dx, 0);
  }

  static dy(dy: number): UTranslate {
    return new UTranslate(0, dy);
  }

  getDx(): number {
    return this.dx;
  }

  getDy(): number {
    return this.dy;
  }

  isAlmostSame(other: UTranslate): boolean {
    return this.dx === other.dx || this.dy === other.dy;
  }

  getTranslated(p: Point2D | undefined): Point2D | undefined {
    if (p === undefined) return undefined;
    return { x: p.x + this.dx, y: p.y + this.dy };
  }

  scaled(scale: number): UTranslate {
    return new UTranslate(this.dx * scale, this.dy * scale);
  }

  compose(other: UTranslate): UTranslate {
    return new UTranslate(this.dx + other.dx, this.dy + other.dy);
  }

  reverse(): UTranslate {
    return new UTranslate(-this.dx, -this.dy);
  }

  multiplyBy(v: number): UTranslate {
    return new UTranslate(this.dx * v, this.dy * v);
  }

  sym(): UTranslate {
    return new UTranslate(this.dy, this.dx);
  }

  getPosition(): Point2D {
    return { x: this.dx, y: this.dy };
  }

  toString(): string {
    return `translate dx=${this.dx} dy=${this.dy}`;
  }
}
