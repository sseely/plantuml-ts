import { XPoint2D } from './XPoint2D.js';

/**
 * CoordinateChange — a local coordinate frame anchored at `p1`, whose
 * "u" axis points from `p1` toward `p2` and whose "v" axis is `u`
 * rotated 90 degrees. `getTrueCoordinate(a, b)` maps a point expressed
 * in that (u, v) frame back to the ambient (x, y) frame — the
 * mechanism `USymbolCloud` uses to place its bump-curve control points
 * "along" and "perpendicular to" each boundary segment regardless of
 * that segment's own absolute orientation.
 *
 * Upstream: klimt/geom/CoordinateChange.java (this task's dependency —
 * `USymbolCloud.java#specialLine`/`bubbleLine`/`addCurve` all construct
 * one per boundary segment via `CoordinateChange.create`). Not part of
 * the base infrastructure T3b landed (that base covers `USymbol`/
 * `TextBlock`/drawing shapes, not this geometry helper) — ported here
 * as a direct prerequisite of `USymbolCloud`'s bump-generation loop,
 * one upstream class per file per this project's porting discipline.
 *
 * Ported: the `create` factory, the 4-arg constructor (throws on a
 * zero-length segment, matching upstream's `IllegalArgumentException`),
 * `getTrueCoordinate`, `getLength`.
 */
export class CoordinateChange {
  private readonly x1: number;
  private readonly y1: number;
  private readonly vectUX: number;
  private readonly vectUY: number;
  private readonly vectVX: number;
  private readonly vectVY: number;
  private readonly len: number;

  static create(p1: XPoint2D, p2: XPoint2D): CoordinateChange {
    return new CoordinateChange(p1.getX(), p1.getY(), p2.getX(), p2.getY());
  }

  constructor(x1: number, y1: number, x2: number, y2: number) {
    this.x1 = x1;
    this.y1 = y1;
    this.len = XPoint2D.distance(x1, y1, x2, y2);
    if (this.len === 0) throw new Error('CoordinateChange: zero-length segment');

    this.vectUX = (x2 - x1) / this.len;
    this.vectUY = (y2 - y1) / this.len;
    this.vectVX = -this.vectUY;
    this.vectVY = this.vectUX;
  }

  getTrueCoordinate(a: number, b: number): XPoint2D {
    const x = a * this.vectUX + b * this.vectVX;
    const y = a * this.vectUY + b * this.vectVY;
    return new XPoint2D(this.x1 + x, this.y1 + y);
  }

  getLength(): number {
    return this.len;
  }
}
