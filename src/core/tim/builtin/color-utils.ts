/**
 * Minimal color-math helpers for the seven color builtins (`Darken`,
 * `Lighten`, `HslColor`, `IsDark`, `IsLight`, `ReverseColor`,
 * `ReverseHsluvColor`). Ports only the pure numeric algorithms those seven
 * builtins call, as free functions over a plain `{ r, g, b, a }` tuple
 * standing in for `XColor`.
 *
 * Hex/name parsing (`parseColorString`) delegates to
 * `klimt/color/HColorSet.ts#parseSimpleColor` -- the SAME table
 * `paint.ts#paintToSvg` and `svg-graphics-core.ts` resolve fills/strokes
 * through (G1c: one table, one resolver, no per-call-site copies). Closes
 * this file's own former "disclosed divergence" (a compact ~40-name
 * subset table, pre-G1c) now that the full ~150-name `ColorTrieNode` port
 * exists.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/klimt/color/HColorSet.java#parseSimpleColor
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/klimt/color/HSLColor.java
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/klimt/color/HColorSimple.java
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/klimt/color/ColorUtils.java
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/klimt/color/HUSLColorConverter.java
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/klimt/color/ColorOrder.java
 */

import { parseSimpleColor } from '../../klimt/color/HColorSet.js';

/** Stand-in for `net.sourceforge.plantuml.klimt.awt.XColor`: 8-bit RGBA. */
export interface RgbColor {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  /** 0-255, matching `XColor#getAlpha`; 255 = fully opaque. */
  readonly a: number;
}

/** Thrown in place of upstream's `NoSuchColorException`. */
export class NoSuchColorError extends Error {
  constructor() {
    super('No such color');
    this.name = 'NoSuchColorError';
  }
}

/**
 * Parse a color string (hex or named). `klimt/color/HColorSet.ts#parseSimpleColor`
 * IS `HColorSet#parseSimpleColor` (hex 1/3/6/8-digit forms, then the full
 * ~150-name `ColorTrieNode` table); `RgbColor` and `ResolvedColor` are the
 * same shape, so this is a direct re-export under this file's own type
 * name (kept for its established call sites' import stability).
 * `undefined` where upstream returns Java `null` (unresolvable).
 */
export function parseColorString(sIn: string): RgbColor | undefined {
  return parseSimpleColor(sIn);
}

/** @throws NoSuchColorError mirroring `HColorSet#getColor`. */
export function requireColor(s: string): RgbColor {
  const c = parseColorString(s);
  if (c === undefined) throw new NoSuchColorError();
  return c;
}

/**
 * `HColorSimple#asString`: `#RRGGBB` when fully opaque, else `#AARRGGBB`
 * (alpha-first, matching upstream's `"#%02x%02x%02x%02x", alpha, red,
 * green, blue` format string exactly -- not the more common RRGGBBAA order).
 */
export function colorToString(c: RgbColor): string {
  const hex2 = (n: number): string => n.toString(16).padStart(2, '0');
  if (c.a === 255) return `#${hex2(c.r)}${hex2(c.g)}${hex2(c.b)}`.toUpperCase();
  return `#${hex2(c.a)}${hex2(c.r)}${hex2(c.g)}${hex2(c.b)}`;
}

/** `[h(0-360), s(0-100), l(0-100)]`. @see HSLColor#fromRGB */
export type Hsl = readonly [number, number, number];

/** @see ~/git/plantuml/.../klimt/color/HSLColor.java#fromRGB */
export function rgbToHsl(c: RgbColor): Hsl {
  const r = c.r / 255;
  const g = c.g / 255;
  const b = c.b / 255;
  const min = Math.min(r, g, b);
  const max = Math.max(r, g, b);

  let h = 0;
  if (max === min) h = 0;
  else if (max === r) h = ((60 * (g - b)) / (max - min) + 360) % 360;
  else if (max === g) h = (60 * (b - r)) / (max - min) + 120;
  else h = (60 * (r - g)) / (max - min) + 240;

  const l = (max + min) / 2;
  let s = 0;
  if (max === min) s = 0;
  else if (l <= 0.5) s = (max - min) / (max + min);
  else s = (max - min) / (2 - max - min);

  return [h, s * 100, l * 100];
}

function hueToRgb(p: number, q: number, hIn: number): number {
  let h = hIn;
  if (h < 0) h += 1;
  if (h > 1) h -= 1;
  if (6 * h < 1) return p + (q - p) * 6 * h;
  if (2 * h < 1) return q;
  if (3 * h < 2) return p + (q - p) * 6 * (2 / 3 - h);
  return p;
}

/** @see ~/git/plantuml/.../klimt/color/HSLColor.java#toRGB */
export function hslToRgb([hIn, sIn, lIn]: Hsl, alpha255 = 255): RgbColor {
  const s = Math.min(100, Math.max(0, sIn)) / 100;
  const l = Math.min(100, Math.max(0, lIn)) / 100;
  const h = (((hIn % 360) + 360) % 360) / 360;

  const q = l < 0.5 ? l * (1 + s) : l + s - s * l;
  const p = 2 * l - q;

  const r = Math.max(0, hueToRgb(p, q, h + 1 / 3));
  const g = Math.max(0, hueToRgb(p, q, h));
  const b = Math.max(0, hueToRgb(p, q, h - 1 / 3));

  return {
    r: Math.round(Math.min(r, 1) * 255),
    g: Math.round(Math.min(g, 1) * 255),
    b: Math.round(Math.min(b, 1) * 255),
    a: alpha255,
  };
}

/** @see ~/git/plantuml/.../klimt/color/HColorSimple.java#lighten */
export function lighten(c: RgbColor, ratio: number): RgbColor {
  const [h, s, l] = rgbToHsl(c);
  return hslToRgb([h, s, l + l * (ratio / 100)], c.a);
}

/** @see ~/git/plantuml/.../klimt/color/HColorSimple.java#darken */
export function darken(c: RgbColor, ratio: number): RgbColor {
  const [h, s, l] = rgbToHsl(c);
  return hslToRgb([h, s, l - l * (ratio / 100)], c.a);
}

/**
 * YIQ grayscale, integer-truncated exactly as upstream (two nested integer
 * divisions in Java: `(r*299+g*587+b*114) / 1000`).
 * @see ~/git/plantuml/.../klimt/color/ColorUtils.java#getGrayScale
 */
export function grayScale(c: RgbColor): number {
  return Math.trunc((c.r * 299 + c.g * 587 + c.b * 114) / 1000);
}

/** @see ~/git/plantuml/.../klimt/color/HColorSimple.java#isDark */
export function isDark(c: RgbColor): boolean {
  return grayScale(c) < 128;
}

/** `ColorOrder.RGB.getReverse`: per-channel 255-complement, no channel reorder. */
export function reverseRgb(c: RgbColor): RgbColor {
  return { r: 255 - c.r, g: 255 - c.g, b: 255 - c.b, a: c.a };
}

// ---------------------------------------------------------------------------
// HSLuv (a perceptually-uniform HSL variant) -- ported subset of
// HUSLColorConverter sufficient for `reverseHsluv` below: rgbToXyz, xyzToLuv,
// luvToLch, lchToHsluv/hsluvToLch (via getBounds/maxChromaForLH), lchToLuv,
// luvToXyz, xyzToRgb.
// @see ~/git/plantuml/.../klimt/color/HUSLColorConverter.java
// ---------------------------------------------------------------------------

const M: readonly (readonly number[])[] = [
  [3.240969941904521, -1.537383177570093, -0.498610760293],
  [-0.96924363628087, 1.87596750150772, 0.041555057407175],
  [0.055630079696993, -0.20397695888897, 1.056971514242878],
];
const MINV: readonly (readonly number[])[] = [
  [0.41239079926595, 0.35758433938387, 0.18048078840183],
  [0.21263900587151, 0.71516867876775, 0.072192315360733],
  [0.019330818715591, 0.11919477979462, 0.95053215224966],
];
const REF_U = 0.19783000664283;
const REF_V = 0.46831999493879;
const KAPPA = 903.2962962;
const EPSILON = 0.0088564516;

function dot3(a: readonly number[], b: readonly [number, number, number]): number {
  return (a[0] ?? 0) * b[0] + (a[1] ?? 0) * b[1] + (a[2] ?? 0) * b[2];
}

function toLinear(c: number): number {
  return c > 0.04045 ? ((c + 0.055) / 1.055) ** 2.4 : c / 12.92;
}

function fromLinear(c: number): number {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
}

function xyzToRgbUnit(tuple: readonly [number, number, number]): readonly [number, number, number] {
  return [fromLinear(dot3(M[0]!, tuple)), fromLinear(dot3(M[1]!, tuple)), fromLinear(dot3(M[2]!, tuple))];
}

function rgbToXyz(tuple: readonly [number, number, number]): readonly [number, number, number] {
  const rgbl: readonly [number, number, number] = [toLinear(tuple[0]), toLinear(tuple[1]), toLinear(tuple[2])];
  return [dot3(MINV[0]!, rgbl), dot3(MINV[1]!, rgbl), dot3(MINV[2]!, rgbl)];
}

function yToL(y: number): number {
  return y <= EPSILON ? y * KAPPA : 116 * y ** (1 / 3) - 16;
}

function lToY(l: number): number {
  return l <= 8 ? l / KAPPA : ((l + 16) / 116) ** 3;
}

function xyzToLuv([x, y, z]: readonly [number, number, number]): readonly [number, number, number] {
  const varU = (4 * x) / (x + 15 * y + 3 * z);
  const varV = (9 * y) / (x + 15 * y + 3 * z);
  const l = yToL(y);
  if (l === 0) return [0, 0, 0];
  return [l, 13 * l * (varU - REF_U), 13 * l * (varV - REF_V)];
}

function luvToXyz([l, u, v]: readonly [number, number, number]): readonly [number, number, number] {
  if (l === 0) return [0, 0, 0];
  const varU = u / (13 * l) + REF_U;
  const varV = v / (13 * l) + REF_V;
  const y = lToY(l);
  const x = 0 - (9 * y * varU) / ((varU - 4) * varV - varU * varV);
  const z = (9 * y - 15 * varV * y - varV * x) / (3 * varV);
  return [x, y, z];
}

function luvToLch([l, u, v]: readonly [number, number, number]): readonly [number, number, number] {
  const c = Math.sqrt(u * u + v * v);
  if (c < 0.00000001) return [l, c, 0];
  let h = (Math.atan2(v, u) * 180) / Math.PI;
  if (h < 0) h += 360;
  return [l, c, h];
}

function lchToLuv([l, c, h]: readonly [number, number, number]): readonly [number, number, number] {
  const hrad = (h / 360) * 2 * Math.PI;
  return [l, Math.cos(hrad) * c, Math.sin(hrad) * c];
}

function getBounds(l: number): (readonly [number, number])[] {
  const result: (readonly [number, number])[] = [];
  const sub1 = (l + 16) ** 3 / 1560896;
  const sub2 = sub1 > EPSILON ? sub1 : l / KAPPA;

  for (const row of M) {
    const [m1, m2, m3] = row as [number, number, number];
    for (const t of [0, 1]) {
      const top1 = (284517 * m1 - 94839 * m3) * sub2;
      const top2 = (838422 * m3 + 769860 * m2 + 731718 * m1) * l * sub2 - 769860 * t * l;
      const bottom = (632260 * m3 - 126452 * m2) * sub2 + 126452 * t;
      result.push([top1 / bottom, top2 / bottom]);
    }
  }
  return result;
}

function maxChromaForLH(l: number, h: number): number {
  const hrad = (h / 360) * Math.PI * 2;
  let min = Number.MAX_VALUE;
  for (const [m1, b1] of getBounds(l)) {
    const length = b1 / (Math.sin(hrad) - m1 * Math.cos(hrad));
    if (length >= 0) min = Math.min(min, length);
  }
  return min;
}

function lchToHsluv([l, c, h]: readonly [number, number, number]): readonly [number, number, number] {
  if (l > 99.9999999) return [h, 0, 100];
  if (l < 0.00000001) return [h, 0, 0];
  const max = maxChromaForLH(l, h);
  return [h, (c / max) * 100, l];
}

function hsluvToLch([h, s, l]: readonly [number, number, number]): readonly [number, number, number] {
  if (l > 99.9999999) return [100, 0, h];
  if (l < 0.00000001) return [0, 0, h];
  const max = maxChromaForLH(l, h);
  return [l, (max / 100) * s, h];
}

/** RGB (0-1 components) -> HSLuv `[h, s, l]`. @see HUSLColorConverter#rgbToHsluv */
function rgbUnitToHsluv(tuple: readonly [number, number, number]): readonly [number, number, number] {
  return lchToHsluv(luvToLch(xyzToLuv(rgbToXyz(tuple))));
}

/** HSLuv `[h, s, l]` -> RGB (0-1 components). @see HUSLColorConverter#hsluvToRgb */
function hsluvToRgbUnit(tuple: readonly [number, number, number]): readonly [number, number, number] {
  return xyzToRgbUnit(luvToXyz(lchToLuv(hsluvToLch(tuple))));
}

function to255(value: number): number {
  const result = Math.round(255 * value);
  if (result < 0) return 0;
  if (result > 255) return 255;
  return result;
}

/**
 * `ColorUtils#reverseHsluv` exactly, including its `/256.0` (not `/255.0`)
 * normalization on the way in -- an upstream asymmetry preserved verbatim
 * per this port's don't-refactor-while-porting discipline, not a typo here.
 * @see ~/git/plantuml/.../klimt/color/ColorUtils.java#reverseHsluv
 */
export function reverseHsluv(c: RgbColor): RgbColor {
  const hsluv = rgbUnitToHsluv([c.r / 256.0, c.g / 256.0, c.b / 256.0]);
  const h = hsluv[0];
  const s = hsluv[1];
  let l = (hsluv[2] + 50) % 100;
  l += 0.25 * (50 - l);

  const rgb = hsluvToRgbUnit([h, s, l]);
  return { r: to255(rgb[0]), g: to255(rgb[1]), b: to255(rgb[2]), a: c.a };
}
