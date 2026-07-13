import type { UShape } from '../UShape.js';
import type { Point2D } from '../UTranslate.js';
import { MinMax } from '../geom/MinMax.js';

/**
 * UPolygon — an ordered vertex list, the shape `DriverPolygonSvg.java`
 * serializes to an SVG `<polygon>`.
 *
 * Upstream: klimt/shape/UPolygon.java (~183 ln). D3' scope note (this
 * task's mission brief, explicit): port "points list + convex-hull
 * helpers ONLY if the SVG driver reads them; defer the rest with a
 * note." `DriverPolygonSvg.draw` reads exactly `getPointArray(x, y)`
 * and `getDeltaShadow()` — nothing else. Ported: the points list
 * (`addPoint`/`getPoint`/`getPoints`), `translate`, `getPointArray`,
 * and `deltaShadow` (see `UPath`'s mechanical-adaptation note —
 * UPolygon also extends `AbstractShadowable` upstream).
 *
 * `getMinX()`/`getMinY()`/`getMaxX()`/`getMaxY()` (klimt/geom/
 * limitfinder mission, T1 — write-set expansion, journaled):
 * `LimitFinder#drawUPolygon` reads exactly these four accessors (plus
 * `getMinX() - HACK_X_FOR_POLYGON`/`getMaxX() + HACK_X_FOR_POLYGON`, the
 * caller's own concern), so the running `MinMax` tracker upstream
 * maintains via `manageMinMax` is now ported too — narrowly: only the
 * four accessors are exposed, not the full `getMinMax(): MinMax` method
 * (still deferred below, unchanged — no caller in this port's write-set
 * needs the full `MinMax` object off a polygon).
 *
 * Deferred (not read by the SVG driver, out of D3' scope, reported):
 * - `checkMiddleContactForSpecificTriangle(center)` — a one-off
 *   triangle-arrowhead helper used elsewhere in svek/arrow layout, not
 *   by the SVG driver.
 * - `rotate(theta)` / `affine(rotate)` — require `XAffineTransform`,
 *   out of scope for this task's geometry surface.
 * - `getMinMax()` / `getWidth()` / `getHeight()` — the running min/max
 *   bounds tracker's remaining surface (used by layout code, not the
 *   driver or `LimitFinder`).
 * - `name` field / constructor(name) / `toString()` — debug/display
 *   only, not read by the SVG driver.
 * - `compressionMode` field + getter/setter — requires
 *   `CompressionMode`, the compression subsystem, not built yet.
 */
export class UPolygon implements UShape {
  private readonly all: Point2D[] = [];
  private deltaShadow = 0;
  private minmax: MinMax = MinMax.getEmpty(false);

  constructor(points?: readonly Point2D[]) {
    if (points !== undefined) {
      this.all.push(...points);
      for (const pt of this.all) this.minmax = this.minmax.addPoint(pt.x, pt.y);
    }
  }

  getPoint(idx: number): Point2D {
    const pt = this.all[idx];
    if (pt === undefined) throw new Error(`UPolygon.getPoint: index ${idx} out of range`);
    return pt;
  }

  addPoint(...args: [number, number] | [Point2D]): void {
    const [x, y] = args.length === 1 ? [args[0].x, args[0].y] : args;
    this.all.push({ x, y });
    this.minmax = this.minmax.addPoint(x, y);
  }

  getMinX(): number {
    return this.minmax.getMinX();
  }

  getMinY(): number {
    return this.minmax.getMinY();
  }

  getMaxX(): number {
    return this.minmax.getMaxX();
  }

  getMaxY(): number {
    return this.minmax.getMaxY();
  }

  getPoints(): readonly Point2D[] {
    return this.all;
  }

  translate(dx: number, dy: number): UPolygon {
    const result = new UPolygon();
    for (const pt of this.all) result.addPoint(pt.x + dx, pt.y + dy);
    return result;
  }

  getPointArray(x: number, y: number): number[] {
    const points: number[] = new Array<number>(this.all.length * 2).fill(0);
    let i = 0;
    for (const pt of this.all) {
      points[i++] = pt.x + x;
      points[i++] = pt.y + y;
    }
    return points;
  }

  getDeltaShadow(): number {
    return this.deltaShadow;
  }

  setDeltaShadow(deltaShadow: number): void {
    this.deltaShadow = deltaShadow;
  }
}
