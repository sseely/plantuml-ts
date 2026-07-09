import type { UShape } from '../UShape.js';
import { UPath } from './UPath.js';

interface URectangleFields {
  readonly width: number;
  readonly height: number;
  readonly rx: number;
  readonly ry: number;
  readonly ignoreForCompressionOnX: boolean;
  readonly ignoreForCompressionOnY: boolean;
}

/**
 * URectangle — width/height plus optional corner rounding (`rx`/`ry`),
 * the shape `DriverRectangleSvg.java` serializes to an SVG `<rect>`.
 *
 * Upstream: klimt/shape/URectangle.java. Ported: the immutable
 * `with*`/`rounded`/`ignoreForCompression*` builders, the plain
 * accessors, `diagonalCorner`/`halfRounded` (both build a `UPath`
 * outline — no new geometry deps beyond `UPath`, already ported above),
 * and `deltaShadow` (see `UPath`'s mechanical-adaptation note on
 * `AbstractShadowable`).
 *
 * Rounding semantics (acceptance-criteria note): `rounded(r)` stores
 * `r` directly as both `rx` and `ry` — it is NOT halved here.
 * `DriverRectangleSvg.java` halves it at serialization time
 * (`svg.svgRectangle(..., rx / 2, ry / 2, ...)`), which is a driver
 * concern, out of scope for this shape task.
 *
 * Mechanical adaptation: upstream's 8-arg private constructor collapses
 * to a single `URectangleFields` params object here to stay under the
 * project's per-function param complexity budget (the `comment`/
 * `codeLine` args are dropped too — see below).
 *
 * Deferred (out of D3' scope, reported):
 * - `clip(UClip)` — upstream's body is `return this;` unconditionally
 *   (UClip never actually inspected), but `UClip` itself is not ported;
 *   deferred rather than typed as `unknown` for an identity no-op.
 * - `getMinMax()` — requires the full `MinMax` class (which itself pulls
 *   in `UGraphic`/`HColor`/`HColors`), out of scope for a shape.
 * - `drawWhenCompressed(ug, mode)` / `isIgnoreForCompressionOn(mode)` —
 *   require `CompressionMode` + `UEmpty`, the compression subsystem,
 *   not built yet.
 * - `comment`/`codeLine` fields — upstream stores them but every getter
 *   is commented out in URectangle.java itself (dead fields on the
 *   Java side); not ported here either, matching upstream's own
 *   inactive state.
 */
export class URectangle implements UShape {
  private readonly f: URectangleFields;
  private deltaShadow = 0;

  private constructor(fields: URectangleFields) {
    if (fields.height === 0) throw new Error(`height=${fields.height}`);
    if (fields.width === 0) throw new Error(`width=${fields.width}`);
    this.f = fields;
  }

  static build(widthOrDim: number | { width: number; height: number }, height?: number): URectangle {
    if (typeof widthOrDim === 'number') {
      return new URectangle({
        width: widthOrDim,
        height: height!,
        rx: 0,
        ry: 0,
        ignoreForCompressionOnX: false,
        ignoreForCompressionOnY: false,
      });
    }
    return URectangle.build(widthOrDim.width, widthOrDim.height);
  }

  private withDeltaShadow(result: URectangle): URectangle {
    result.deltaShadow = this.deltaShadow;
    return result;
  }

  withHeight(newHeight: number): URectangle {
    return this.withDeltaShadow(new URectangle({ ...this.f, height: newHeight }));
  }

  withWidth(newWidth: number): URectangle {
    return this.withDeltaShadow(new URectangle({ ...this.f, width: newWidth }));
  }

  rounded(round: number): URectangle {
    return new URectangle({ ...this.f, rx: round, ry: round });
  }

  ignoreForCompressionOnX(): URectangle {
    return new URectangle({ ...this.f, ignoreForCompressionOnX: true });
  }

  ignoreForCompressionOnY(): URectangle {
    return new URectangle({ ...this.f, ignoreForCompressionOnY: true });
  }

  /**
   * Builds a UPath outline with the four corners diagonally cut by
   * `diagonalCorner` pixels. Returns `this` unchanged (matching
   * upstream's `Shadowable` return type) when `diagonalCorner === 0`.
   */
  diagonalCorner(diagonalCorner: number): URectangle | UPath {
    if (this.f.ignoreForCompressionOnX || this.f.ignoreForCompressionOnY) {
      throw new Error('diagonalCorner: illegal state (ignoreForCompression set)');
    }
    if (diagonalCorner === 0) return this;

    const { width, height } = this.f;
    const result = UPath.none();
    result.moveTo(diagonalCorner, 0);
    result.lineTo(width - diagonalCorner, 0);
    result.lineTo(width, diagonalCorner);
    result.lineTo(width, height - diagonalCorner);
    result.lineTo(width - diagonalCorner, height);
    result.lineTo(diagonalCorner, height);
    result.lineTo(0, height - diagonalCorner);
    result.lineTo(0, diagonalCorner);
    result.lineTo(diagonalCorner, 0);
    return result;
  }

  /** Builds a UPath outline with the four corners rounded via arcs. */
  halfRounded(roundCorner: number): URectangle | UPath {
    if (roundCorner === 0) return this;

    const { width, height } = this.f;
    const path = UPath.none();
    path.moveTo(roundCorner / 2, 0);
    path.lineTo(width - roundCorner / 2, 0);
    path.arcTo(roundCorner / 2, roundCorner / 2, 0, 0, 1, width, roundCorner / 2);
    path.lineTo(width, height);
    path.lineTo(0, height);
    path.lineTo(0, roundCorner / 2);
    path.arcTo(roundCorner / 2, roundCorner / 2, 0, 0, 1, roundCorner / 2, 0);
    return path;
  }

  toString(): string {
    return `width=${this.f.width} height=${this.f.height}`;
  }

  getWidth(): number {
    return this.f.width;
  }

  getHeight(): number {
    return this.f.height;
  }

  getRx(): number {
    return this.f.rx;
  }

  getRy(): number {
    return this.f.ry;
  }

  getDeltaShadow(): number {
    return this.deltaShadow;
  }

  setDeltaShadow(deltaShadow: number): void {
    this.deltaShadow = deltaShadow;
  }
}
