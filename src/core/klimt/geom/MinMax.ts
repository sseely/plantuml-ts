import type { UTranslate } from '../UTranslate.js';
import { XDimension2D } from './XDimension2D.js';
import type { XPoint2D } from './XPoint2D.js';
import type { MinMaxMutable } from './MinMaxMutable.js';

/**
 * MinMax — an immutable axis-aligned bounding-box accumulator: the ink
 * extent `LimitFinder` (klimt/drawing/LimitFinder.java) and
 * `TextBlockUtils#getMinMax` (klimt/shape/TextBlockUtils.java) report
 * back to callers.
 *
 * Upstream: klimt/geom/MinMax.java. Ported: the private canonical
 * constructor (arg order `minX, minY, maxX, maxY`; NaN in any coordinate
 * throws), `getEmpty(initToZero)` (`true` -> `(0,0,0,0)`; `false` ->
 * `(MAX_VALUE, MAX_VALUE, -MAX_VALUE, -MAX_VALUE)` — the "nothing added
 * yet" sentinel `MinMaxMutable#isInfinity` tests for), `fromMutable`,
 * `addPoint` (both the `XPoint2D` and loose-`(x,y)` overloads),
 * `addMinMax`, `fromMax`, `fromDim`, the plain accessors
 * (`getMinX`/`getMinY`/`getMaxX`/`getMaxY`), `getWidth`/`getHeight`/
 * `getDimension`, `translate(UTranslate)`, `enlarge(dx,dy)` (grows the
 * MAX corner only — the MIN corner is left untouched, matching upstream
 * exactly), `doesHorizontalCross`, `toString`.
 *
 * NOT ported: `draw`/`drawGray` — both need a REAL rendering `UGraphic`
 * plus `HColor`/`HColors`/`URectangle#build`-through-a-driver; `HColor`
 * is not ported anywhere in this port (see `UBackground.ts`/`Fore.ts`
 * seam notes), and drawing a diagnostic gray box is out of scope for
 * this task's ink-extent-measurement machinery.
 */
export class MinMax {
  private readonly minX: number;
  private readonly minY: number;
  private readonly maxX: number;
  private readonly maxY: number;

  private constructor(minX: number, minY: number, maxX: number, maxY: number) {
    if (Number.isNaN(minX)) throw new Error('MinMax: minX is NaN');
    if (Number.isNaN(maxX)) throw new Error('MinMax: maxX is NaN');
    if (Number.isNaN(minY)) throw new Error('MinMax: minY is NaN');
    if (Number.isNaN(maxY)) throw new Error('MinMax: maxY is NaN');
    this.minX = minX;
    this.minY = minY;
    this.maxX = maxX;
    this.maxY = maxY;
  }

  static getEmpty(initToZero: boolean): MinMax {
    if (initToZero) return new MinMax(0, 0, 0, 0);
    return new MinMax(Number.MAX_VALUE, Number.MAX_VALUE, -Number.MAX_VALUE, -Number.MAX_VALUE);
  }

  static fromMutable(minmax: MinMaxMutable): MinMax {
    return new MinMax(minmax.getMinX(), minmax.getMinY(), minmax.getMaxX(), minmax.getMaxY());
  }

  static fromMax(maxX: number, maxY: number): MinMax {
    return MinMax.getEmpty(true).addPoint(maxX, maxY);
  }

  static fromDim(dim: XDimension2D): MinMax {
    return MinMax.fromMax(dim.getWidth(), dim.getHeight());
  }

  addPoint(...args: [number, number] | [XPoint2D]): MinMax {
    const [x, y] = args.length === 1 ? [args[0].getX(), args[0].getY()] : args;
    return new MinMax(
      Math.min(x, this.minX),
      Math.min(y, this.minY),
      Math.max(x, this.maxX),
      Math.max(y, this.maxY),
    );
  }

  addMinMax(other: MinMax): MinMax {
    return new MinMax(
      Math.min(other.minX, this.minX),
      Math.min(other.minY, this.minY),
      Math.max(other.maxX, this.maxX),
      Math.max(other.maxY, this.maxY),
    );
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

  getHeight(): number {
    return this.maxY - this.minY;
  }

  getWidth(): number {
    return this.maxX - this.minX;
  }

  getDimension(): XDimension2D {
    return new XDimension2D(this.maxX - this.minX, this.maxY - this.minY);
  }

  translate(translate: UTranslate): MinMax {
    const dx = translate.getDx();
    const dy = translate.getDy();
    return new MinMax(this.minX + dx, this.minY + dy, this.maxX + dx, this.maxY + dy);
  }

  /** Grows the MAX corner only — the MIN corner is untouched (upstream quirk, preserved). */
  enlarge(dx: number, dy: number): MinMax {
    return new MinMax(this.minX, this.minY, this.maxX + dx, this.maxY + dy);
  }

  doesHorizontalCross(pt1: XPoint2D, pt2: XPoint2D): boolean {
    if (pt1.getY() !== pt2.getY()) throw new Error('MinMax.doesHorizontalCross: pt1.y !== pt2.y');
    if (pt1.getX() === pt2.getX()) throw new Error('MinMax.doesHorizontalCross: pt1.x === pt2.x');
    const y = pt1.getY();
    if (y < this.minY || y > this.maxY) return false;
    if (pt1.getX() < this.minX && pt2.getX() > this.maxX) return true;
    if (pt2.getX() < this.minX && pt1.getX() > this.maxX) return true;
    return false;
  }

  toString(): string {
    return `(${this.minX},${this.minY})->(${this.maxX},${this.maxY})`;
  }
}
