import type { UShape } from '../UShape.js';
import type { Point2D } from '../UTranslate.js';

/**
 * ULine — a relative (dx, dy) offset, the shape `DriverLineSvg.java`
 * serializes to an SVG `<line>` from `(x, y)` to `(x + dx, y + dy)`.
 *
 * Upstream: klimt/shape/ULine.java. Ported: the constructor, `create`/
 * `hline`/`vline` factories, the plain accessors, and `deltaShadow`
 * (see `UPath`'s mechanical-adaptation note — ULine also extends
 * `AbstractShadowable` upstream).
 *
 * Deferred (out of D3' scope, reported):
 * - `rotate(theta)` — requires `XAffineTransform`, out of scope for
 *   this task's geometry surface (same deferral as `UPath#rotate`).
 */
export class ULine implements UShape {
  private readonly dx: number;
  private readonly dy: number;
  private deltaShadow = 0;

  constructor(dx: number, dy: number) {
    this.dx = dx;
    this.dy = dy;
  }

  static create(p1: Point2D, p2: Point2D): ULine {
    return new ULine(p2.x - p1.x, p2.y - p1.y);
  }

  static hline(dx: number): ULine {
    return new ULine(dx, 0);
  }

  static vline(dy: number): ULine {
    return new ULine(0, dy);
  }

  toString(): string {
    return `ULine dx=${this.dx} dy=${this.dy}`;
  }

  getDX(): number {
    return this.dx;
  }

  getDY(): number {
    return this.dy;
  }

  getLength(): number {
    return Math.sqrt(this.dx * this.dx + this.dy * this.dy);
  }

  getWidth(): number {
    return this.dx;
  }

  getHeight(): number {
    return this.dy;
  }

  getDeltaShadow(): number {
    return this.deltaShadow;
  }

  setDeltaShadow(deltaShadow: number): void {
    this.deltaShadow = deltaShadow;
  }
}
