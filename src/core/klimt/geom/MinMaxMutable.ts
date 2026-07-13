import type { XPoint2D } from './XPoint2D.js';
import { XDimension2D } from './XDimension2D.js';

/**
 * MinMaxMutable — the mutable bounding-box accumulator `LimitFinder`
 * (klimt/drawing/LimitFinder.java) mutates in place while walking a
 * shape tree, snapshotting to an immutable `MinMax` only once drawing
 * finishes (`MinMax.fromMutable`).
 *
 * Upstream: klimt/geom/MinMaxMutable.java. Ported in full: the private
 * canonical constructor (arg order `minX, minY, maxX, maxY`; NaN in any
 * coordinate throws), `getEmpty(initToZero)`, `isInfinity` (tests
 * `minX === Double.MAX_VALUE` — the sentinel `getEmpty(false)` seeds and
 * `addPoint` can never reproduce once any real point has been added,
 * since every real x is `<= MAX_VALUE`), `addPoint` (both the `XPoint2D`
 * and loose-`(x,y)` overloads, each individually NaN-guarded per
 * upstream), `fromMax`, the plain accessors, `getDimension`, `reset`,
 * `toString`.
 */
export class MinMaxMutable {
  private minX: number;
  private minY: number;
  private maxX: number;
  private maxY: number;

  private constructor(minX: number, minY: number, maxX: number, maxY: number) {
    if (Number.isNaN(minX)) throw new Error('MinMaxMutable: minX is NaN');
    if (Number.isNaN(maxX)) throw new Error('MinMaxMutable: maxX is NaN');
    if (Number.isNaN(minY)) throw new Error('MinMaxMutable: minY is NaN');
    if (Number.isNaN(maxY)) throw new Error('MinMaxMutable: maxY is NaN');
    this.minX = minX;
    this.minY = minY;
    this.maxX = maxX;
    this.maxY = maxY;
  }

  static getEmpty(initToZero: boolean): MinMaxMutable {
    if (initToZero) return new MinMaxMutable(0, 0, 0, 0);
    return new MinMaxMutable(Number.MAX_VALUE, Number.MAX_VALUE, -Number.MAX_VALUE, -Number.MAX_VALUE);
  }

  isInfinity(): boolean {
    return this.minX === Number.MAX_VALUE;
  }

  addPoint(...args: [number, number] | [XPoint2D]): void {
    const [x, y] = args.length === 1 ? [args[0].getX(), args[0].getY()] : args;
    if (Number.isNaN(x)) throw new Error('MinMaxMutable.addPoint: x is NaN');
    if (Number.isNaN(y)) throw new Error('MinMaxMutable.addPoint: y is NaN');
    this.maxX = Math.max(x, this.maxX);
    this.maxY = Math.max(y, this.maxY);
    this.minX = Math.min(x, this.minX);
    this.minY = Math.min(y, this.minY);
  }

  static fromMax(maxX: number, maxY: number): MinMaxMutable {
    if (Number.isNaN(maxX)) throw new Error('MinMaxMutable.fromMax: maxX is NaN');
    if (Number.isNaN(maxY)) throw new Error('MinMaxMutable.fromMax: maxY is NaN');
    const result = MinMaxMutable.getEmpty(true);
    result.addPoint(maxX, maxY);
    return result;
  }

  getMaxX(): number {
    return this.maxX;
  }

  getMaxY(): number {
    return this.maxY;
  }

  getMinX(): number {
    return this.minX;
  }

  getMinY(): number {
    return this.minY;
  }

  getDimension(): XDimension2D {
    return new XDimension2D(this.maxX - this.minX, this.maxY - this.minY);
  }

  reset(): void {
    this.maxX = 0;
    this.maxY = 0;
    this.minX = 0;
    this.minY = 0;
  }

  toString(): string {
    return `X=${this.minX} to ${this.maxX} and Y=${this.minY} to ${this.maxY}`;
  }
}
