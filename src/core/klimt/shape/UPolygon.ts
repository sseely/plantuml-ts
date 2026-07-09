import type { UShape } from '../UShape.js';
import type { Point2D } from '../UTranslate.js';

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
 * Deferred (not read by the SVG driver, out of D3' scope, reported):
 * - `checkMiddleContactForSpecificTriangle(center)` — a one-off
 *   triangle-arrowhead helper used elsewhere in svek/arrow layout, not
 *   by the SVG driver.
 * - `rotate(theta)` / `affine(rotate)` — require `XAffineTransform`,
 *   out of scope for this task's geometry surface.
 * - `getMinMax()` / `getWidth()` / `getHeight()` / `getMinX/Y()` /
 *   `getMaxX/Y()` — the running min/max bounds tracker (used by layout
 *   code, not the driver); would require the full `MinMax` class.
 * - `name` field / constructor(name) / `toString()` — debug/display
 *   only, not read by the SVG driver.
 * - `compressionMode` field + getter/setter — requires
 *   `CompressionMode`, the compression subsystem, not built yet.
 */
export class UPolygon implements UShape {
  private readonly all: Point2D[] = [];
  private deltaShadow = 0;

  constructor(points?: readonly Point2D[]) {
    if (points !== undefined) this.all.push(...points);
  }

  getPoint(idx: number): Point2D {
    const pt = this.all[idx];
    if (pt === undefined) throw new Error(`UPolygon.getPoint: index ${idx} out of range`);
    return pt;
  }

  addPoint(...args: [number, number] | [Point2D]): void {
    const [x, y] = args.length === 1 ? [args[0].x, args[0].y] : args;
    this.all.push({ x, y });
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
