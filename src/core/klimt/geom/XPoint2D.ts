/**
 * XPoint2D — an immutable (x, y) point.
 *
 * Upstream: klimt/geom/XPoint2D.java. Ported: the constructor,
 * `getX`/`getY`, `distance` (both the instance form and the static
 * 4-arg form), `distanceSq`, `move` (both overloads), `equals`,
 * `toString`.
 *
 * NOT ported: `transform(XAffineTransform)` / `hashCode` — the former
 * requires `XAffineTransform`, out of scope for this task's geometry
 * surface (same deferral `XDimension2D.ts`/`UPath.ts` already document
 * for AWT-transform-dependent members); the latter has no caller in this
 * port (nothing keys a hash-based collection off `XPoint2D` value
 * equality — see `UStroke.ts`'s identical `hashCode` omission rationale).
 */
export class XPoint2D {
  readonly x: number;
  readonly y: number;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  getX(): number {
    return this.x;
  }

  getY(): number {
    return this.y;
  }

  distance(other: XPoint2D): number {
    const px = other.getX() - this.getX();
    const py = other.getY() - this.getY();
    return Math.sqrt(px * px + py * py);
  }

  distanceSq(other: XPoint2D): number {
    const px = other.getX() - this.getX();
    const py = other.getY() - this.getY();
    return px * px + py * py;
  }

  static distance(x1: number, y1: number, x2: number, y2: number): number {
    const dx = x1 - x2;
    const dy = y1 - y2;
    return Math.sqrt(dx * dx + dy * dy);
  }

  move(dx: number, dy: number): XPoint2D {
    return new XPoint2D(this.x + dx, this.y + dy);
  }

  moveByPoint(delta: XPoint2D): XPoint2D {
    return new XPoint2D(this.x + delta.x, this.y + delta.y);
  }

  equals(other: XPoint2D): boolean {
    return this.x === other.x && this.y === other.y;
  }

  toString(): string {
    return `(${this.x},${this.y})`;
  }
}
