import type { UShape } from '../UShape.js';
import type { Point2D } from '../UTranslate.js';

/**
 * Dimension2D — a plain `{width, height}` stand-in for upstream's
 * `XDimension2D`, matching the `Point2D` stand-in pattern already
 * established in `UTranslate.ts` (T2). Declared as a named interface
 * (rather than an inline object-literal return type) so the lizard
 * complexity checker's brace matcher does not misattribute later lines
 * to `getDimension`'s span.
 */
export interface Dimension2D {
  readonly width: number;
  readonly height: number;
}

/**
 * UEllipse — width/height plus an optional arc (`start`/`extend`, in
 * degrees), the shape `DriverEllipseSvg.java` serializes to an SVG
 * `<ellipse>` (full ellipse) or an elliptical-arc `<path>` (partial).
 *
 * Upstream: klimt/shape/UEllipse.java. Ported in full — every member of
 * the Java class maps directly with no unported dependency. Geometry
 * types (`XDimension2D`, `XPoint2D`) use plain `{width, height}` /
 * `{x, y}` object shapes locally (reusing the `Point2D` stand-in
 * established in `UTranslate.ts`), per this task's geometry-type
 * adaptation. `deltaShadow` follows `UPath`'s mechanical adaptation
 * note (no shared `AbstractShadowable` base; implemented directly).
 */
export class UEllipse implements UShape {
  private readonly width: number;
  private readonly height: number;
  private readonly start: number;
  private readonly extend: number;
  private deltaShadow = 0;

  constructor(width: number, height: number, start: number, extend: number) {
    this.width = width;
    this.height = height;
    this.start = start;
    this.extend = extend;
  }

  static build(width: number, height: number): UEllipse {
    return new UEllipse(width, height, 0, 0);
  }

  getWidth(): number {
    return this.width;
  }

  getHeight(): number {
    return this.height;
  }

  getStart(): number {
    return this.start;
  }

  getExtend(): number {
    return this.extend;
  }

  getDimension(): Dimension2D {
    return { width: this.width, height: this.height };
  }

  bigger(more: number): UEllipse {
    const result = UEllipse.build(this.width + more, this.height + more);
    result.deltaShadow = this.deltaShadow;
    return result;
  }

  scale(factor: number): UEllipse {
    const result = UEllipse.build(this.width * factor, this.height * factor);
    result.deltaShadow = this.deltaShadow;
    return result;
  }

  getStartingX(y: number): number {
    const yy = (y / this.height) * 2;
    const x = 1 - Math.sqrt(1 - (yy - 1) * (yy - 1));
    return (x * this.width) / 2;
  }

  getEndingX(y: number): number {
    const yy = (y / this.height) * 2;
    const x = 1 + Math.sqrt(1 - (yy - 1) * (yy - 1));
    return (x * this.width) / 2;
  }

  getPointAtAngle(alpha: number): Point2D {
    const x = this.width / 2 + (this.width / 2) * Math.cos(alpha);
    const y = this.height / 2 + (this.height / 2) * Math.sin(alpha);
    return { x, y };
  }

  getDeltaShadow(): number {
    return this.deltaShadow;
  }

  setDeltaShadow(deltaShadow: number): void {
    this.deltaShadow = deltaShadow;
  }
}
