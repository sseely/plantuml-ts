/**
 * Monochrome-sprite tint + PNG rasterization (T5 of SI5b/decisions.md D7).
 *
 * Ports `SpriteMonochrome#toUImage`'s gradient/alpha math exactly.
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/klimt/sprite/SpriteMonochrome.java:180-208
 *
 * ```java
 * final HColorGradient gradient = HColors.gradient(backcolor, color, '\0');
 * double maxCoef = 0;
 * for (col, line) maxCoef = Math.max(maxCoef, 1.0 * gray[line][col] / (grayLevel - 1));
 * for (col, line) {
 *   final int grayValue = gray[line][col];
 *   final double coef = 1.0 * grayValue / (grayLevel - 1);
 *   final int alpha;
 *   if (coef > maxCoef / 4) alpha = 255;
 *   else alpha = (int) (255 * (coef * 4 / maxCoef));
 *   final XColor c = gradient.getColor(colorMapper, coef, alpha);
 *   im.setRGB(col, line, c.getRGB());
 * }
 * ```
 *
 * `HColorGradient#getColor` (klimt/color/HColorGradient.java:69-90) linearly
 * interpolates each RGB channel between `color1` (=`backcolor`) and `color2`
 * (=`color`) by `coef`, truncating (not rounding) via Java's `(int)` cast:
 * `channel = c1 + (int)(coef * (c2 - c1))`.
 *
 * Net effect: gray level 0 always renders fully transparent (`coef=0` at
 * every pixel forces the `else` branch, and if EVERY pixel is gray 0 then
 * `maxCoef` is also 0, so alpha collapses to 0 everywhere -- an all-blank
 * sprite is fully transparent, not a division-by-zero crash). Gray levels
 * within 1/4 of the sprite's own darkest-used level render fully opaque;
 * everything below that threshold ramps alpha linearly. This threshold
 * (not a plain `coef`-to-alpha linear map) is why a light -- outline-only --
 * sprite still renders crisp instead of washed out.
 *
 * T4 (concurrent write-set: `Sprite.ts`, `SpriteGrayLevel.ts`,
 * `SpriteMonochrome.ts`) landed in this same batch while this file was
 * being written. Per the mission brief this file does NOT import those
 * modules -- it depends only on the minimal structural `SpriteLike` shape
 * below. SEAM NOTE FOR THE ORCHESTRATOR: T4's concrete
 * `SpriteMonochrome` (src/core/klimt/sprite/SpriteMonochrome.ts) does
 * NOT structurally satisfy `SpriteLike` as-is -- it exposes `grayLevel`
 * (singular) not `grayLevels`, and `getGray(x, y)` not `pixelAt(x, y)`.
 * A one-line adapter is needed at the call site, e.g.:
 * `{ width: s.width, height: s.height, grayLevels: s.grayLevel, pixelAt: (x, y) => s.getGray(x, y) }`.
 */
import { parseColorString, type RgbColor } from '../../tim/builtin/color-utils.js';
import { encodePng, toBase64DataUri, RGBA_BYTES_PER_PIXEL } from './png-encoder.js';

/**
 * Minimal structural stand-in for T4's `SpriteMonochrome` (in-flight,
 * concurrent write-set -- see file header). `grayLevels` is the sprite's
 * total gray-level count (2, 4, 8, or 16 upstream); `pixelAt` returns the
 * gray value (0..grayLevels-1) at (x, y), matching `SpriteMonochrome#getGray`.
 */
export interface SpriteLike {
  readonly width: number;
  readonly height: number;
  readonly grayLevels: number;
  pixelAt(x: number, y: number): number;
}

/** `HColors.WHITE` -- upstream's `backcolor` default (light-mode only; see file header). */
const DEFAULT_BACK_COLOR: RgbColor = { r: 255, g: 255, b: 255, a: 255 };
/** `HColors.BLACK` -- upstream's `color` (fontColor) default (light-mode only). */
const DEFAULT_FONT_COLOR: RgbColor = { r: 0, g: 0, b: 0, a: 255 };

const FULLY_OPAQUE_ALPHA = 255;
const ALPHA_RAMP_THRESHOLD_DIVISOR = 4;

export interface RgbaBitmap {
  readonly rgba: Uint8Array;
  readonly width: number;
  readonly height: number;
}

function resolveColor(colorString: string | undefined, fallback: RgbColor): RgbColor {
  if (colorString === undefined) return fallback;
  const parsed = parseColorString(colorString);
  if (parsed === undefined) throw new Error(`spriteToRgba: unknown color '${colorString}'`);
  return parsed;
}

function computeMaxCoef(sprite: SpriteLike, maxLevel: number): number {
  let maxCoef = 0;
  for (let row = 0; row < sprite.height; row++) {
    for (let col = 0; col < sprite.width; col++) {
      const coef = sprite.pixelAt(col, row) / maxLevel;
      if (coef > maxCoef) maxCoef = coef;
    }
  }
  return maxCoef;
}

/** `alpha = (coef > maxCoef/4) ? 255 : (int)(255 * coef * 4 / maxCoef)`, `maxCoef===0` -> 0. */
function computeAlpha(coef: number, maxCoef: number): number {
  if (maxCoef === 0) return 0;
  if (coef > maxCoef / ALPHA_RAMP_THRESHOLD_DIVISOR) return FULLY_OPAQUE_ALPHA;
  return Math.trunc(FULLY_OPAQUE_ALPHA * ((coef * ALPHA_RAMP_THRESHOLD_DIVISOR) / maxCoef));
}

/** `channel = c1 + (int)(coef * (c2 - c1))` -- `HColorGradient#getColor`, truncated toward zero. */
function gradientChannel(c1: number, c2: number, coef: number): number {
  return Math.trunc(c1 + coef * (c2 - c1));
}

/**
 * Tints a monochrome sprite to an RGBA raster: `fontColor` (`#rrggbb`,
 * default black) is the gradient's dark end, `backColor` (`#rrggbb`,
 * default white) is the light end, and the per-pixel alpha ramp described
 * in the file header makes low gray values transparent.
 * @see SpriteMonochrome#toUImage (file header, exact math quoted)
 */
export function spriteToRgba(sprite: SpriteLike, fontColor?: string, backColor?: string): RgbaBitmap {
  const color2 = resolveColor(fontColor, DEFAULT_FONT_COLOR);
  const color1 = resolveColor(backColor, DEFAULT_BACK_COLOR);
  const { width, height, grayLevels } = sprite;
  const maxLevel = grayLevels - 1;
  const maxCoef = computeMaxCoef(sprite, maxLevel);
  const rgba = new Uint8Array(width * height * RGBA_BYTES_PER_PIXEL);

  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const coef = sprite.pixelAt(col, row) / maxLevel;
      const alpha = computeAlpha(coef, maxCoef);
      const offset = (row * width + col) * RGBA_BYTES_PER_PIXEL;
      rgba[offset] = gradientChannel(color1.r, color2.r, coef);
      rgba[offset + 1] = gradientChannel(color1.g, color2.g, coef);
      rgba[offset + 2] = gradientChannel(color1.b, color2.b, coef);
      rgba[offset + 3] = alpha;
    }
  }
  return { rgba, width, height };
}

export interface SpritePngResult {
  readonly dataUri: string;
  /** Natural PNG pixel dimensions (matches the encoded IHDR); unaffected by `scale`. */
  readonly naturalWidth: number;
  readonly naturalHeight: number;
  /**
   * Display dimensions for the SVG `<image>` element: `natural{Width,Height} * scale`.
   * See file-header-adjacent divergence note on `spriteToPngDataUri` for why
   * the raster itself is NOT resampled to this size.
   */
  readonly width: number;
  readonly height: number;
}

const DEFAULT_SCALE = 1;

/**
 * Tints and rasterizes `sprite` to a `data:image/png;base64,...` URI.
 *
 * Scale handling -- DISCLOSED DIVERGENCE (journal for DIVERGENCES.md):
 * `UImage#scale` (klimt/shape/UImage.java:79-81) delegates to
 * `MutableImage#withScale`, which for the sprite/img path
 * (`PixelImage#withScale`, net/atmp/PixelImage.java:64-67) MULTIPLIES the
 * cumulative scale and only resamples lazily in `getImage()`
 * (PixelImage.java:69-78) via `PortableImage#scale(scale, interpolationType)`
 * -- for sprites/img atoms `interpolationType` is
 * `AffineTransformType.TYPE_BILINEAR` (SpriteMonochrome.java:207,
 * AtomImg.java:250). The actual resampler
 * (`PortableImageAwt#scale`, klimt/awt/PortableImageAwt.java:113-127) is
 * `java.awt.image.AffineTransformOp` with `TYPE_BILINEAR` -- a JDK Java2D
 * algorithm with no portable spec, infeasible to reproduce byte-exact here
 * and out of scope for a minimal, no-canvas, deterministic encoder
 * (D7, plans/si5b-stdlib/decisions.md). So: contrary to the initial
 * hypothesis that upstream defers scaling entirely to an SVG-level
 * transform, upstream DOES resample the raw PNG bitmap -- just via an
 * unportable AWT filter. This function instead emits the NATURAL-size PNG
 * (no resampling) and returns `width`/`height` (`natural * scale`,
 * unrounded) for the caller to place on the SVG `<image width height>`
 * attributes, letting the browser's own image scaling stand in for AWT's
 * bilinear resample -- functionally equivalent to a deferred-to-SVG-transform
 * approach, chosen as the pragmatic substitute once byte-exact AWT
 * resampling was ruled infeasible. Geometry (the scaled box size) matches
 * upstream's `calculateDimension`/`calculateDimensionSlow`
 * (`width * scale`, `height * scale` -- SpriteMonochrome.java:224,
 * AtomImg.java:239) exactly; only the pixel-resampling algorithm differs.
 */
export function spriteToPngDataUri(
  sprite: SpriteLike,
  fontColor?: string,
  backColor?: string,
  scale: number = DEFAULT_SCALE,
): SpritePngResult {
  const { rgba, width, height } = spriteToRgba(sprite, fontColor, backColor);
  const png = encodePng(rgba, width, height);
  return {
    dataUri: toBase64DataUri(png),
    naturalWidth: width,
    naturalHeight: height,
    width: width * scale,
    height: height * scale,
  };
}
