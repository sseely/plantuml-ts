/**
 * Paint — the color/gradient value model for the rendering layer.
 *
 * A skinparam color value is either a plain solid color (`#RRGGBB`, a named
 * color, …) or a two-color gradient written `color1<sep>color2`, where the
 * separator character encodes the gradient direction ("policy"). Upstream
 * PlantUML parses the separator in `klimt/color/HColorSet.java:109-116` and
 * emits a real `<linearGradient>` def in `svg/SvgGraphics.java:357-399`.
 *
 * Before this module, a gradient value flowed straight into `fill="..."`,
 * producing invalid SVG like `fill="#c3d8f4\#6192d1"` (renders solid black).
 *
 * This is a leaf module: it has no imports and is imported by the svg
 * primitives (T2), the theme (T3), and the skinparam parser (T4).
 *
 * See `planning/mission-render-fidelity/decisions.md` — D1 (Paint type shape)
 * and D3 (inline def placement, deterministic content-hash id).
 *
 * G1c (HColorSet port): plain colors and gradient stops are now resolved to
 * their canonical jar hex via `klimt/color/HColorSet.ts#resolveColorToSvgHex`
 * at {@link paintToSvg} -- the same table `svg-graphics-core.ts`'s
 * `fixColor`/`createSvgGradient` use, so a name/hex value resolves
 * identically no matter which renderer family draws it (one table, one
 * resolver -- see `plans/g1c-hcolorset/ledger.md`).
 */

import { parseSimpleColor, resolveColorToSvgHex } from './klimt/color/HColorSet.js';

/**
 * A two-color linear gradient.
 *
 * `policy` is the separator character found between `color1` and `color2` in
 * the source value — it selects the gradient vector at emission time (see the
 * policy→vector table in `paintToSvg`). Stored verbatim, interpreted late,
 * mirroring upstream's `HColorGradient`.
 */
export interface Gradient {
  color1: string;
  color2: string;
  policy: '-' | '\\' | '|' | '/';
}

/**
 * A paint value: a plain solid color string, or a {@link Gradient}. A bare
 * string is always a valid solid paint (D1).
 */
export type Paint = string | Gradient;

const GRADIENT_SEPARATORS = new Set(['-', '\\', '|', '/']);

/**
 * True if `s` parses as a plain (solid) color, mirroring upstream's
 * `HColorSet#parseSimpleColor` exactly (delegated to
 * `klimt/color/HColorSet.ts#parseSimpleColor`, G1c): an optional leading `#`
 * followed by 1, 3, 6, or 8 hex digits (the 8-digit form carries alpha), OR
 * a name registered in the {@link import('./klimt/color/ColorTrieNode.js')}
 * table -- NOT any alphabetic-shaped string (a pre-G1c heuristic; a stray
 * word that happens to be all letters but isn't a real color name, e.g.
 * `"banana"`, no longer counts as a plain color, matching upstream's own
 * `parseSimpleColor(s) != null` gate on `HColorSet#parseColor`'s gradient
 * branch). Used only to decide whether a separator split yields two real
 * colors.
 */
function isPlainColor(s: string): boolean {
  if (s.length === 0) return false;
  // Upstream's `HColorSet#parseSimpleColor` strips a leading `#`
  // UNCONDITIONALLY, before EITHER the hex or the named-trie attempt
  // (java:122-124) -- not just when the segment turns out to be hex. So a
  // compound gradient token that puts a NAMED color immediately after the
  // leading `#` (G1 I5h: `#red|green`, `#yellow\FFFFFF` -- the
  // description-diagram inline color-override grammar always prefixes the
  // whole compound token with one `#`, regardless of which half is hex)
  // resolves correctly here too: `parseSimpleColor` does its own
  // unconditional `#`-strip internally, so passing `s` straight through
  // (rather than pre-stripping here) matches upstream's per-segment
  // stripping exactly.
  return parseSimpleColor(s) !== undefined;
}

/**
 * Parse a skinparam color value into a {@link Paint}.
 *
 * Scans `s` character by character (position order, exactly as upstream's
 * `HColorSet` loop): at the first separator (`-`, `\`, `|`, `/`) where **both**
 * the substring before it and the substring after it parse as plain colors,
 * returns a {@link Gradient} with that separator as its policy. If no such
 * split exists, returns `s` unchanged as a plain solid paint. Never throws.
 */
export function parseColor(s: string): Paint {
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c !== undefined && GRADIENT_SEPARATORS.has(c)) {
      const left = s.slice(0, i);
      const right = s.slice(i + 1);
      if (isPlainColor(left) && isPlainColor(right)) {
        return { color1: left, color2: right, policy: c as Gradient['policy'] };
      }
    }
  }
  return s;
}

/**
 * True if `value` resolves to a FULLY transparent color -- upstream's
 * `HColorSimple#isTransparent()`, defined as `color.getAlpha() == 0`
 * (`klimt/color/HColorSimple.java:132-135`). Every jar drawing guard that
 * elides an element for a transparent color keys off this EXACT condition
 * (not merely "low alpha"): `HColor#toSvg` collapses any transparent color
 * to the canonical `"#00000000"` (`HColor.java:74-76`) BEFORE
 * `SvgGraphics#setupBackcolor`/`#finalizeRootAttributes` compare against it
 * (`svg/SvgGraphics.java:176-183,755`), and `DriverTextSvg#draw` returns
 * before emitting any `<text>` at all when the font color `isTransparent()`
 * (`klimt/drawing/svg/DriverTextSvg.java:92-94`).
 *
 * Recognizes the two CSS/PlantUML keywords `HColorSet#parseColor` maps to
 * `HColors.none()` (`"transparent"`, `"background"` -- both case-
 * insensitive, `HColorSet.java:82-83`) and an explicit 8-digit hex whose
 * trailing alpha byte is `00` (`#RRGGBB00`, including the already-canonical
 * `#00000000`). This is the SAME set of literal shapes
 * `klimt/color/HColorSet.ts#resolveColorToSvgHex` collapses to `#00000000`
 * (G1c) -- kept as a separate function since callers here need a boolean
 * gate (skip drawing), not a resolved hex string.
 */
export function isTransparentColor(value: string): boolean {
  const lower = value.toLowerCase();
  if (lower === 'transparent' || lower === 'background') return true;
  return /^#[0-9a-fA-F]{6}00$/.test(value);
}

/**
 * Gradient vector per policy, as SVG percentage coordinates. Mirrors the
 * policy→vector table in `svg/SvgGraphics.java:357-399`:
 *
 * | policy | x1  y1  → x2   y2   | direction        |
 * |--------|---------------------|------------------|
 * | `\|`   | 0%  50% → 100% 50%  | horizontal       |
 * | `\`    | 0%  100%→ 100% 0%   | diagonal BL→TR   |
 * | `-`    | 50% 0%  → 50%  100% | vertical         |
 * | `/`    | 0%  0%  → 100% 100% | diagonal TL→BR   |
 *
 * Any unrecognized policy falls through to the `/` (TL→BR) vector, matching
 * upstream's default branch.
 */
function gradientVector(policy: string): {
  x1: string;
  y1: string;
  x2: string;
  y2: string;
} {
  switch (policy) {
    case '|':
      return { x1: '0%', y1: '50%', x2: '100%', y2: '50%' };
    case '\\':
      return { x1: '0%', y1: '100%', x2: '100%', y2: '0%' };
    case '-':
      return { x1: '50%', y1: '0%', x2: '50%', y2: '100%' };
    case '/':
    default:
      return { x1: '0%', y1: '0%', x2: '100%', y2: '100%' };
  }
}

/**
 * Deterministic FNV-1a hash of `s`, rendered in base36. Identical input always
 * yields the identical string — no counters, no `Math.random`, no `Date.now` —
 * which is what lets `paintToSvg` dedup identical gradient defs by id (D3).
 */
function hashString(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    // FNV prime 16777619, kept in 32-bit unsigned range via Math.imul.
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/** Named-entity replacements for the four XML-significant attribute chars. */
const XML_ATTR_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
};
// Built from a string (not a regex literal) to keep angle brackets out of the
// source, which the complexity checker miscounts; matches the same chars.
const XML_ATTR_RE = new RegExp('[&<>"]', 'g');

/** Escape a value for use inside a double-quoted XML attribute. */
function escapeAttr(s: string): string {
  return s.replace(XML_ATTR_RE, (ch) => XML_ATTR_ENTITIES[ch] ?? ch);
}

/**
 * Resolve a {@link Paint} to an SVG `fill` value and, for gradients, the
 * `<linearGradient>` def that must be emitted for the fill's `url(#id)` to
 * resolve.
 *
 * - A plain string is resolved to its canonical jar hex via
 *   `klimt/color/HColorSet.ts#resolveColorToSvgHex` (G1c) and returned as
 *   `{ fill: p }` with no `def`.
 * - A {@link Gradient} has BOTH stops resolved the same way, then returns
 *   `{ fill: 'url(#id)', def }` where the def is a `<linearGradient>` with
 *   the policy's vector and two `<stop>`s (`color1` at `offset="0%"`,
 *   `color2` at `offset="100%"`).
 *
 * The id is a content hash of `` `${color1}|${color2}|${policy}` `` over the
 * RESOLVED stop values (D3), so two calls with an identical gradient --
 * including two differently-spelled-but-equal-color gradients, e.g.
 * `red|#FF0000` vs `#FF0000|#FF0000` -- produce the identical id and the def
 * can be deduplicated by the caller (T2). This id scheme is this port's own
 * invention (not jar-matched, see the module doc comment's D3 reference), so
 * resolving before hashing changes no oracle-compared output.
 */
export function paintToSvg(p: Paint): { fill: string; def?: string } {
  if (typeof p === 'string') {
    return { fill: resolveColorToSvgHex(p) };
  }
  const color1 = resolveColorToSvgHex(p.color1);
  const color2 = resolveColorToSvgHex(p.color2);
  const { policy } = p;
  const id = 'g' + hashString(`${color1}|${color2}|${policy}`);
  const v = gradientVector(policy);
  const def =
    `<linearGradient id="${id}" x1="${v.x1}" y1="${v.y1}"` +
    ` x2="${v.x2}" y2="${v.y2}">` +
    `<stop offset="0%" stop-color="${escapeAttr(color1)}"/>` +
    `<stop offset="100%" stop-color="${escapeAttr(color2)}"/>` +
    `</linearGradient>`;
  return { fill: `url(#${id})`, def };
}
