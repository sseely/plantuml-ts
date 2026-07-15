/**
 * HColorSet — resolves a single color token (a `#RRGGBB`/`#RGB`/`#RRGGBBAA`
 * hex form, or a named color from {@link ColorTrieNode}) to a canonical
 * SVG-ready hex string, mirroring `HColorSet#parseSimpleColor` and
 * `XColor#toSvg`.
 *
 * Ported subset: this module covers `parseSimpleColor` (the single-token
 * hex/name resolver every SVG fill/stroke/stop-color value ultimately
 * needs) plus the `"transparent"`/`"background"` collapse from the front
 * of `parseColor`. NOT ported here (out of this iteration's scope, no
 * fixture in the K1 accounting exercises them -- see
 * `plans/g1c-hcolorset/ledger.md`):
 *  - `"automatic"` (`HColorAutomagic`) -- a context-dependent color chosen
 *    at draw time from the current background, not a static hex value.
 *  - the `?back:fore[:extra]` dual-color scheme form (`HColorScheme`).
 *  - the top-level gradient-separator scan (`-`/`\`/`|`/`/`) -- already
 *    ported, independently, as `paint.ts#parseColor`/`isPlainColor`; a
 *    gradient's two color HALVES are each a single token, resolved via
 *    this module's {@link parseSimpleColor}.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/klimt/color/HColorSet.java
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/klimt/awt/XColor.java
 */

import { getColor } from './ColorTrieNode.js';
import type { RgbTriple } from './ColorTrieNode.js';

/** Stand-in for `net.sourceforge.plantuml.klimt.awt.XColor` (RGBA, 8-bit channels). */
export interface ResolvedColor extends RgbTriple {
  /** 0-255, matching `XColor#getAlpha`; 255 = fully opaque. */
  readonly a: number;
}

function hexNibble(c: string): number {
  if (c >= '0' && c <= '9') return c.charCodeAt(0) - 48;
  if (c >= 'a' && c <= 'f') return c.charCodeAt(0) - 87;
  if (c >= 'A' && c <= 'F') return c.charCodeAt(0) - 55;
  return -1;
}

function parseHexByte(s: string, off: number): number {
  const hi = hexNibble(s.charAt(off));
  const lo = hexNibble(s.charAt(off + 1));
  return hi < 0 || lo < 0 ? -1 : (hi << 4) | lo;
}

/** 1-hex-digit form (`F` -> `#FFFFFF`). @see HColorSet#parseSimpleColor:127-133 */
function parseHex1(s: string): ResolvedColor | undefined {
  const d = hexNibble(s.charAt(0));
  if (d < 0) return undefined;
  const v = (d << 4) | d;
  return { r: v, g: v, b: v, a: 255 };
}

/** 3-hex-digit form (`RGB`). @see HColorSet#parseSimpleColor:134-143 */
function parseHex3(s: string): ResolvedColor | undefined {
  const r = hexNibble(s.charAt(0));
  const g = hexNibble(s.charAt(1));
  const b = hexNibble(s.charAt(2));
  if (r < 0 || g < 0 || b < 0) return undefined;
  return { r: (r << 4) | r, g: (g << 4) | g, b: (b << 4) | b, a: 255 };
}

/** 6-hex-digit form (`RRGGBB`). @see HColorSet#parseSimpleColor:144-147 */
function parseHex6(s: string): ResolvedColor | undefined {
  const r = parseHexByte(s, 0);
  const g = parseHexByte(s, 2);
  const b = parseHexByte(s, 4);
  if (r < 0 || g < 0 || b < 0) return undefined;
  return { r, g, b, a: 255 };
}

/** 8-hex-digit form (`RRGGBBAA`, full-opacity alpha compositing).
 * @see HColorSet#parseSimpleColor:148-156 */
function parseHex8(s: string): ResolvedColor | undefined {
  const r = parseHexByte(s, 0);
  const g = parseHexByte(s, 2);
  const b = parseHexByte(s, 4);
  const a = parseHexByte(s, 6);
  if (r < 0 || g < 0 || b < 0 || a < 0) return undefined;
  return { r, g, b, a };
}

const HEX_PARSERS_BY_LENGTH: ReadonlyMap<number, (s: string) => ResolvedColor | undefined> = new Map([
  [1, parseHex1],
  [3, parseHex3],
  [6, parseHex6],
  [8, parseHex8],
]);

/**
 * `HColorSet#parseSimpleColor`: strip an optional leading `#`, try the hex
 * forms by exact length (1/3/6/8 digits), then fall back to the named-color
 * table -- for ANY length, including 1/3/6/8 when the hex parse itself
 * fails (e.g. `"red"` is 3 characters but not valid hex; upstream's
 * if/else-if chain only returns early on a SUCCESSFUL hex parse, so it
 * still falls through to `ColorTrieNode.INSTANCE.getColor(s)` afterward --
 * java:122-157). `undefined` where upstream returns `null`.
 */
export function parseSimpleColor(sIn: string): ResolvedColor | undefined {
  const s = sIn.startsWith('#') ? sIn.slice(1) : sIn;
  const hexResult = HEX_PARSERS_BY_LENGTH.get(s.length)?.(s);
  if (hexResult !== undefined) return hexResult;
  const named = getColor(s);
  return named === undefined ? undefined : { ...named, a: 255 };
}

/**
 * `XColor#toSvg()`: the canonical SVG hex serialization -- `#RRGGBB`
 * uppercase when fully opaque, `#00000000` for full transparency (alpha 0,
 * collapsing red/green/blue to avoid a meaningless-but-distinct id per
 * fully-transparent color), else `#RRGGBBAA` uppercase (alpha LAST, unlike
 * `HColorSimple#asString`'s `#AARRGGBB` -- a different upstream method for
 * a different purpose, ported separately in `tim/builtin/color-utils.ts`).
 */
export function toSvgHex(c: ResolvedColor): string {
  if (c.a === 0) return '#00000000';
  const hex2 = (n: number): string => n.toString(16).padStart(2, '0').toUpperCase();
  if (c.a === 255) return `#${hex2(c.r)}${hex2(c.g)}${hex2(c.b)}`;
  return `#${hex2(c.r)}${hex2(c.g)}${hex2(c.b)}${hex2(c.a)}`;
}

/**
 * Resolve one raw color token to its canonical SVG-ready hex string --
 * the single choke point every fill/stroke/stop-color/background value in
 * this port's SVG-emission layer runs through (`paint.ts#paintToSvg`,
 * `svg-graphics-core.ts`'s `fixColor`/`createSvgGradient`/`setupBackcolor`).
 *
 * Mirrors `HColor#toSvg`'s own two-step shape: the `"transparent"`/
 * `"background"` keyword collapse from the front of `HColorSet#parseColor`
 * (java:82-83, case-insensitive) happens BEFORE hex/name resolution, then
 * {@link parseSimpleColor} + {@link toSvgHex}. A token that resolves to
 * neither -- not a recognized keyword, not valid hex, not a registered
 * name -- is returned UNCHANGED rather than falling back to a default
 * color: unlike upstream (whose `getColorOrWhite`/`getColorOrNull` run at
 * the SkinParam/ColorParser parse boundary, well before an `HColor`
 * reaches `SvgGraphics`), this port defers color resolution to the final
 * SVG-emission layer (`paint.ts`'s own "stored verbatim, interpreted late"
 * design), so a WHITE fallback HERE would risk clobbering any
 * not-yet-audited non-color string (a `url(#id)` gradient reference, an
 * `HColorSimple`-adjacent literal) with no way to distinguish "truly
 * unresolvable" from "not actually meant to be resolved at this layer" --
 * see `plans/g1c-hcolorset/decision-journal.md`.
 */
export function resolveColorToSvgHex(raw: string): string {
  if (raw.toLowerCase() === 'transparent' || raw.toLowerCase() === 'background') return '#00000000';
  const parsed = parseSimpleColor(raw);
  return parsed === undefined ? raw : toSvgHex(parsed);
}
