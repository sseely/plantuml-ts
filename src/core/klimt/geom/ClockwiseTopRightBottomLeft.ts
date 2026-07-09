import { UTranslate } from '../UTranslate.js';
import { XDimension2D } from './XDimension2D.js';

/**
 * ClockwiseTopRightBottomLeft — a CSS-`margin`-shorthand-style
 * (top, right, bottom, left) quad, read clockwise from the top —
 * `TextBlockMarged`'s margin-quad constructor overload takes one of
 * these instead of four loose numbers.
 *
 * Upstream: style/ClockwiseTopRightBottomLeft.java. Ported:
 * `same`/`none`/`margin1margin2`/`topRightBottomLeft` factories, `read`
 * (the "1/2/3/4 space-separated numbers" CSS-shorthand parser),
 * `incTop`, the four getters, `getTranslate`, `apply` (widens an
 * `XDimension2D` by the quad), `isZero`, `toString`.
 *
 * NOT ported: `marginForDocument(StyleBuilder)` — requires the unported
 * `Style`/`StyleBuilder`/`StyleSignatureBasic`/`SName` style-resolution
 * subsystem. No caller in this task's write-set needs it (`TextBlockUtils
 * .withMargin` only needs the plain quad, not style-resolved margins);
 * omitted rather than stubbed-to-throw since it is a pure convenience
 * factory with no required call site here.
 */
export class ClockwiseTopRightBottomLeft {
  private static readonly NONE = new ClockwiseTopRightBottomLeft(0, 0, 0, 0);
  private static readonly NUMBERS_ONLY = /^[0-9 ]+$/;

  private readonly top: number;
  private readonly right: number;
  private readonly bottom: number;
  private readonly left: number;

  private constructor(top: number, right: number, bottom: number, left: number) {
    this.top = top;
    this.right = right;
    this.bottom = bottom;
    this.left = left;
  }

  static same(value: number): ClockwiseTopRightBottomLeft {
    return new ClockwiseTopRightBottomLeft(value, value, value, value);
  }

  static none(): ClockwiseTopRightBottomLeft {
    return ClockwiseTopRightBottomLeft.NONE;
  }

  static topRightBottomLeft(top: number, right: number, bottom: number, left: number): ClockwiseTopRightBottomLeft {
    return new ClockwiseTopRightBottomLeft(top, right, bottom, left);
  }

  static margin1margin2(margin1: number, margin2: number): ClockwiseTopRightBottomLeft {
    return ClockwiseTopRightBottomLeft.topRightBottomLeft(margin1, margin2, margin1, margin2);
  }

  private static isNumericShorthand(value: string): boolean {
    return ClockwiseTopRightBottomLeft.NUMBERS_ONLY.test(value);
  }

  private static parseNumbers(value: string): number[] {
    const trimmed = value.trim();
    const split = trimmed.split(/ +/);
    return split.map((s) => Number.parseInt(s, 10));
  }

  private static containsNaN(nums: readonly number[]): boolean {
    return nums.some((n) => Number.isNaN(n));
  }

  /** Parses a CSS-margin-shorthand string of 1-4 space-separated
   * integers ("10", "10 20", "10 20 5", "10 20 5 8"). Any non-numeric
   * input (or a count outside 1-4) falls back to `none()`, matching
   * upstream's `NumberFormatException` catch-all. */
  static read(value: string): ClockwiseTopRightBottomLeft {
    const isNumeric = ClockwiseTopRightBottomLeft.isNumericShorthand(value);
    if (isNumeric === false) {
      return ClockwiseTopRightBottomLeft.none();
    }

    const nums = ClockwiseTopRightBottomLeft.parseNumbers(value);
    const hasNaN = ClockwiseTopRightBottomLeft.containsNaN(nums);
    if (hasNaN === true) {
      return ClockwiseTopRightBottomLeft.none();
    }

    return ClockwiseTopRightBottomLeft.readParsed(nums);
  }

  private static readParsed(nums: readonly number[]): ClockwiseTopRightBottomLeft {
    const [a, b, c, d] = nums;
    if (nums.length === 1) return new ClockwiseTopRightBottomLeft(a!, a!, a!, a!);
    if (nums.length === 2) return new ClockwiseTopRightBottomLeft(a!, b!, a!, b!);
    if (nums.length === 3) return new ClockwiseTopRightBottomLeft(a!, b!, c!, b!);
    if (nums.length === 4) return new ClockwiseTopRightBottomLeft(a!, b!, c!, d!);
    return ClockwiseTopRightBottomLeft.none();
  }

  incTop(delta: number): ClockwiseTopRightBottomLeft {
    return new ClockwiseTopRightBottomLeft(this.top + delta, this.right, this.bottom, this.left);
  }

  toString(): string {
    return `${this.top}:${this.right}:${this.bottom}:${this.left}`;
  }

  getTop(): number {
    return this.top;
  }

  getRight(): number {
    return this.right;
  }

  getBottom(): number {
    return this.bottom;
  }

  getLeft(): number {
    return this.left;
  }

  getTranslate(): UTranslate {
    return new UTranslate(this.left, this.top);
  }

  apply(dim: XDimension2D): XDimension2D {
    return new XDimension2D(this.left + dim.getWidth() + this.right, this.top + dim.getHeight() + this.bottom);
  }

  isZero(): boolean {
    return this.left === 0 && this.right === 0 && this.top === 0 && this.bottom === 0;
  }
}
