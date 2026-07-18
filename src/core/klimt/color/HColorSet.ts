/**
 * HColorSet — resolves a single color token (a `#RRGGBB`/`#RGB`/`#RRGGBBAA`
 * hex form, or a named color from {@link ColorTrieNode}) to a canonical
 * SVG-ready hex string, mirroring `HColorSet#parseSimpleColor` and
 * `XColor#toSvg`.
 *
 * Ported subset: this module covers `parseSimpleColor` (the single-token
 * hex/name resolver every SVG fill/stroke/stop-color value ultimately
 * needs) plus the `"transparent"`/`"background"` collapse from the front
 * of `parseColor`. G2 N48 additionally ports the `#?light:dark[:transparent]`
 * conditional-color ternary ({@link resolveConditionalColor}, `HColorScheme
 * #getAppropriateColor` -- item 29, `plans/g2-class-svg/ledger.md` N48).
 * Still NOT ported here (out of scope, no fixture exercises it):
 *  - `"automatic"` (`HColorAutomagic`) -- a context-dependent color chosen
 *    at draw time from the current background, not a static hex value.
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

/**
 * `#?colorLight:colorDark[:colorTransparent]` -- `HColorScheme`'s
 * conditional-ternary color grammar (G2 N48, item 29). `undefined` for any
 * token that is not `#?`-shaped, so callers can use this as a cheap "is
 * this a conditional spec at all" probe before falling back to their own
 * plain-color resolution.
 * @see ~/git/plantuml/.../klimt/color/HColorScheme.java (the 2/3-arg
 *   constructor this ternary's grammar maps onto)
 */
export interface ConditionalColorSpec {
  readonly light: string;
  readonly dark: string;
  readonly transparent?: string;
}

export function parseConditionalColor(raw: string): ConditionalColorSpec | undefined {
  if (!raw.startsWith('#?')) return undefined;
  const parts = raw.slice(2).split(':');
  if (parts.length < 2 || parts.length > 3) return undefined;
  const [light, dark, transparent] = parts;
  if (light === undefined || light === '' || dark === undefined || dark === '') return undefined;
  return transparent !== undefined && transparent !== ''
    ? { light, dark, transparent }
    : { light, dark };
}

/**
 * YIQ grayscale darkness test, matching `tim/builtin/color-utils.ts#isDark`'s
 * own formula exactly (`HColorSimple#isDark` -- both port the SAME upstream
 * method, kept as two small local copies rather than a shared import across
 * the `core/tim/` <-> `core/klimt/` module boundary, mirroring this file's
 * OWN "no cross-boundary dependency for a 2-line pure function" precedent
 * elsewhere in this codebase).
 */
function isDarkResolved(c: ResolvedColor): boolean {
  return Math.trunc((c.r * 299 + c.g * 587 + c.b * 114) / 1000) < 128;
}

/**
 * `HColorScheme#getAppropriateColor(HColor back)`, `back` given as an
 * already-SVG-resolved hex string (`resolveColorToSvgHex`'s own output
 * shape: `#RRGGBB`/`#RRGGBBAA`/`#00000000`, or the literal `"transparent"`
 * keyword). `#00000000` (full alpha-transparent) and the literal
 * `"transparent"` string are the SAME "isTransparent" case upstream's own
 * `HColor#isTransparent` collapses them to.
 *
 * The no-3rd-color transparent branch (`colorLight.withDark(colorDark)`,
 * upstream `HColorScheme.java:55`) defers to whatever ACTUALLY paints the
 * text -- jar-verified (`lelabe-72-zate295`/`vekime-22-buru589`, a
 * `document { BackGroundColor transparent }` diagram with `!assume
 * transparent dark`/`light` respectively) that this further resolution
 * lands on `colorLight` in BOTH directions: `!assume transparent dark/light`
 * is a confirmed, deliberate jar no-op for this path (`CommandAssumeTransparent
 * .java`, already jar-verified N47) -- there is no OTHER ambient surface
 * this port's compute-then-emit renderers could plausibly thread in, so
 * `colorLight` is the correct terminal value here, not a partial
 * approximation.
 *
 * Returns `undefined` when `raw` is not a `#?`-shaped conditional spec at
 * all (mirrors {@link parseConditionalColor}'s own passthrough contract).
 */
export function resolveConditionalColor(raw: string, localBackgroundHex: string): string | undefined {
  const spec = parseConditionalColor(raw);
  if (spec === undefined) return undefined;

  const isTransparent =
    localBackgroundHex.toLowerCase() === 'transparent' || localBackgroundHex === '#00000000';
  if (isTransparent) return resolveColorToSvgHex(spec.transparent ?? spec.light);

  const bg = parseSimpleColor(localBackgroundHex);
  const dark = bg !== undefined && isDarkResolved(bg);
  return resolveColorToSvgHex(dark ? spec.dark : spec.light);
}
