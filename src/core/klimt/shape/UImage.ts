import type { UShape } from '../UShape.js';

interface UImageFields {
  readonly width: number;
  readonly height: number;
  readonly href: string;
}

/**
 * UImage — width/height plus a pre-encoded `data:image/...` href, the shape
 * `DriverImageSvg.ts` (`drawing/svg/driver-image-svg.ts`) serializes to an
 * SVG `<image>` element (SI5b+E2r decisions.md D7 — sprite/img inline-atom
 * rendering, mission T7).
 *
 * NOT a port of upstream's `klimt.shape.UImage` (which wraps a
 * `PortableImage` + `AffineTransformType` and resamples lazily via
 * `getImage()` — see `sprite-raster.ts`'s own doc comment on why byte-exact
 * AWT bilinear resampling is out of scope for this port). This is a
 * minimal, scoped shape carrying exactly what T7's atom renderer already
 * computed by the time it reaches the draw call: the SAME scaled
 * width/height `creole-atoms.ts#measureInlineAtom` used to size the label
 * during layout (D9 — "drawing and measuring agree"), plus a data-URI
 * href (verbatim for an `<img>` atom per D7; T5's tinted-PNG output for a
 * `<$sprite>` atom). See `src/diagrams/description/render-atoms.ts` for
 * the resolver that builds these three values.
 */
export class UImage implements UShape {
  private constructor(private readonly f: UImageFields) {}

  static build(width: number, height: number, href: string): UImage {
    return new UImage({ width, height, href });
  }

  getWidth(): number {
    return this.f.width;
  }

  getHeight(): number {
    return this.f.height;
  }

  getHref(): string {
    return this.f.href;
  }

  toString(): string {
    return `UImage[${this.f.width}x${this.f.height}]`;
  }
}
