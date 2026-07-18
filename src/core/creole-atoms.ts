/**
 * Creole `<img>` / `<$sprite>` / `<&openiconic>` inline atoms.
 *
 * A sibling of `src/core/creole.ts` (kept in a separate module: creole.ts is
 * already 749 lines, over this repo's 500-line-per-file cap, so any edit to
 * it -- even an unrelated addition -- trips the complexity hook; see
 * `~/.claude/hooks/check-complexity.py`. This file is additive and
 * self-contained; creole.ts is untouched).
 *
 * Faithful ports (mission SI5b+E2r, T6):
 * - `Splitter.imgPatternNoSrcColon` (Splitter.java:58) -- `<img ...>` /
 *   `<img:...>` markup, `src=`-prefix and quote stripping
 *   (CommandCreoleImg.java:79-84).
 * - `Splitter.spritePattern` (Splitter.java:74) -- `<$name>`,
 *   `<$name{scale=N}>`, `<#RRGGBB$name>` forced-color markup
 *   (CommandCreoleSprite.java:81-86).
 * - `StripeSimple.addSprite` (java :228-236): an unknown sprite name
 *   contributes NOTHING -- the atom is silently not added.
 * - `AtomImg`/`AtomSprite` `calculateDimensionSlow` (java AtomImg.java:239,
 *   AtomSprite.java:66): both atoms' dimensions are their SCALED pixel
 *   dims -- `image.getWidth() * scale`, `sprite.width * scale`.
 *
 * G2 N41: `Splitter.openiconPattern` (Splitter.java:72) -- `<&name>`,
 * `<&name{scale=N,color=X}>`, `<#RRGGBB&name>` OpenIconic glyph markup
 * (`CommandCreoleOpenIcon.java`) -- the SAME `scaleOrColor` block shape as
 * `<$sprite>`, just `&` instead of `$` and a narrower `[-\w]+` name charset
 * (no `SpriteUtils.SPRITE_NAME`'s `/`/unicode-letter allowance). Dimension
 * formula (`AtomOpenIconic`) lives in `core/openiconic-glyphs.ts` (its own
 * file -- the path-parsing machinery is unrelated to this file's regex-scan
 * concern and would push it over the 500-line cap); this file only carries
 * the token model + regex recognizer, matching the img/sprite split above.
 *
 * D9 (plans/si5b-stdlib/decisions.md): these atoms contribute their scaled
 * pixel dims to label measurement -- width ADDS to the line's text width,
 * height MAXES with the line's text height -- while their raw markup text
 * stops contributing text width, the same precedent as I5's
 * `resolveInlineLinks` (parse-helpers.ts) for `[[url label]]`.
 */

import type { FontSpec, StringMeasurer } from './measurer.js';
import { parsePngIhdrFromDataUri } from './klimt/sprite/png-ihdr.js';
import { openIconicDims, openIconicFactor } from './openiconic-glyphs.js';
import { scanOpenIconSpans, matchOpenIconAt } from './creole-atoms-openicon.js';

// ---------------------------------------------------------------------------
// Token model
// ---------------------------------------------------------------------------

/** `width`/`height` are the NATIVE (unscaled) PNG pixel dims read from the
 *  IHDR chunk; `scale` is the markup's `{scale=N}` factor -- multiply at
 *  measurement/render time (AtomImg.calculateDimensionSlow). */
export interface ImgAtomToken {
  kind: 'img';
  dataUri: string;
  scale: number;
  width: number;
  height: number;
}

/** `name` resolves against a per-diagram sprite registry (T4/D8) at
 *  measurement/render time -- this token carries no dims of its own. */
export interface SpriteAtomToken {
  kind: 'sprite';
  name: string;
  scale: number;
  forcedColor?: string;
}

/** G2 N41: an OpenIconic glyph token -- `name` resolves against the fixed
 *  6-glyph table in `openiconic-glyphs.ts` (an unrecognized name contributes
 *  nothing, matching `SpriteAtomToken`'s own "unknown name" precedent).
 *  `forcedColor` is the markup's own `color=`/`#RRGGBB` prefix override;
 *  `undefined` means "use the ambient font color at this position" --
 *  resolved by the CALLER (this file's own whole-line scan has no font
 *  context), mirroring `AtomOpenIconic`'s ctor: `newColor == null ?
 *  fontConfiguration.getColor() : newColor`. */
export interface OpenIconicAtomToken {
  kind: 'openiconic';
  name: string;
  scale: number;
  forcedColor?: string;
}

export type InlineAtomToken = ImgAtomToken | SpriteAtomToken | OpenIconicAtomToken;

/** One ordered piece of a Creole line, for RENDER-time reconstruction (T7):
 *  unlike `textWithoutAtoms` (which concatenates every text run into one
 *  string, discarding position -- fine for measurement, where only the
 *  width SUM/height MAX matter, per `measureLineWithAtoms`), a renderer
 *  needs the interleaved order to draw "text, image, text, image, ..."
 *  left to right with the correct x-advance. */
export type RenderSegment = { kind: 'text'; text: string } | { kind: 'atom'; atom: InlineAtomToken };

/** Result of scanning one Creole line for embedded img/sprite atoms. */
export interface LineAtomScan {
  /** `line` with every recognised atom's raw markup removed, in source
   *  order -- has no on-diagram width of its own (see file doc). Malformed
   *  `<img>` markup is represented here as literal `(Cannot decode)` text
   *  rather than dropped -- see `buildImgSpan`. */
  textWithoutAtoms: string;
  /** Every recognised img/sprite atom, in source order. */
  atoms: InlineAtomToken[];
  /** `line`'s content as ordered text/atom segments (T7 render seam) --
   *  interleaving `textWithoutAtoms`'s text runs with `atoms` in their
   *  original source order; empty text runs are omitted. */
  segments: RenderSegment[];
}

/**
 * Resolves one atom to its drawable image geometry at RENDER time (T7):
 * `href` is the `<image>` element's `xlink:href` (verbatim `dataUri` for an
 * `img` atom per D7; a tinted PNG data URI for a `sprite` atom, built via
 * `sprite-raster.ts#spriteToPngDataUri`); `width`/`height` are the SAME
 * scaled pixel dims `measureInlineAtom` already contributes to label
 * measurement (D9) -- so drawing and measuring agree by construction (this
 * task's own charter). Returns `undefined` to mean "render nothing" --
 * matches `StripeSimple.addSprite`'s unknown-sprite-name behavior (java
 * :228-236): the atom never becomes a drawable element at all, not a
 * zero-size one. See `src/diagrams/description/render-atoms.ts` for the
 * concrete builder.
 */
export type AtomImageResolver = (
  atom: InlineAtomToken,
) => { readonly href: string; readonly width: number; readonly height: number } | undefined;

/**
 * Minimal structural view of T4's per-diagram sprite registry (batch-2
 * write-set: `src/core/klimt/sprite/Sprite.ts` exposes `{width, height}`;
 * the registry itself -- `src/core/sprite-commands.ts` -- had not landed
 * when this file was written, per the mission prompt's concurrent-write-set
 * note). Only width/height are needed for D9 measurement; T4's `Sprite`
 * additionally carries tint/pixel-level accessors (`SpriteMonochrome
 * .grayLevel`/`getGray`) that T7's renderer will consume separately.
 * FLAG for orchestrator reconciliation: confirm the real registry's
 * `get()` return type is structurally assignable here once T4 lands (it
 * should be -- `Sprite` is exactly `{width, height}` today).
 */
export interface SpriteDimsLookup {
  get(name: string): { width: number; height: number } | undefined;
}

// ---------------------------------------------------------------------------
// Regex sources (string-built, never `/regex/` literals: `<`/`>`/`{`/`}` in
// a regex literal desyncs lizard's brace-depth tracker and inflates
// unrelated functions' reported complexity -- see complexity-hook
// workarounds; same precedent as parse-helpers.ts#RE_TOOLTIP_BRACES).
// ---------------------------------------------------------------------------

/** Splitter.imgPatternNoSrcColon, java Splitter.java:58. Group 1: raw src
 *  content (may carry a `src=` prefix and/or quotes -- stripped by
 *  `stripImgSrc`). Group 2: the optional `{scale=N}` block. */
const IMG_PATTERN_SOURCE = '<img[\\s:]+([^>{}]+)(\\{scale=[0-9.]+\\})?>';

/** Splitter.spritePattern, java Splitter.java:74 (`SpriteUtils.SPRITE_NAME`
 *  = `[-\p{L}0-9_/]+`). Group 1: forced-color prefix `#RRGGBB` (incl. the
 *  `#`), or undefined. Group 2: sprite name. Group 3: the optional
 *  `{scale=N,color=X}`-shaped block. */
const SPRITE_PATTERN_SOURCE =
  '<(#[A-Za-z0-9_]+)?\\$([-\\p{L}0-9_/]+)' +
  '((?:[{,]?(?:(?:scale=|\\*)[0-9.]+)?(?:,?color[= :](?:#[0-9a-fA-F]{1,8}|[A-Za-z0-9_]+))?\\}?)?)>';

/** Parser.getScale's SCALE pattern, java Parser.java:67. */
const SCALE_BLOCK_SOURCE = '(?:scale=|\\*)([0-9.]+)';

/** Parser.getColor's COLOR pattern, java Parser.java:80. */
const COLOR_BLOCK_SOURCE = 'color[= :](#[0-9a-fA-F]{1,6}|[A-Za-z0-9_]+)';

/** StringUtils.isDoubleQuote: straight, curly, and guillemet double-quote
 *  glyphs. `\x22` is the straight double-quote hex escape -- this file
 *  avoids the raw `"` glyph per the lizard quote-desync workaround. */
const DOUBLE_QUOTE_CHARS: ReadonlySet<string> = new Set(['\x22', '“', '”', '«', '»']);

const SRC_PREFIX = 'src=';

/** Text substituted for a `<img>` atom whose bytes fail to decode --
 *  AtomImg.buildRasterFromData's fallback is `AtomTextUtils.createLegacy
 *  ('(Cannot decode: ' + source + ')', fc)`; this port uses the fixed
 *  string (per this task's scope -- the full upstream message embeds the
 *  entire, potentially megabyte-long, data URI, which is not useful
 *  rendered text). Divergence, documented per this task's instructions. */
const CANNOT_DECODE_TEXT = '(Cannot decode)';

// ---------------------------------------------------------------------------
// Scale / color extraction (Parser.java ports)
// ---------------------------------------------------------------------------

export function parseScale(block: string | undefined, fallback: number): number {
  if (block === undefined) return fallback;
  const m = new RegExp(SCALE_BLOCK_SOURCE).exec(block);
  return m === null ? fallback : Number(m[1]!);
}

export function parseColorFromBlock(block: string | undefined): string | undefined {
  if (block === undefined) return undefined;
  const m = new RegExp(COLOR_BLOCK_SOURCE).exec(block);
  return m === null ? undefined : m[1];
}

function stripDoubleQuotes(s: string): string {
  const first = s.charAt(0);
  const last = s.charAt(s.length - 1);
  const isWrapped = s.length > 1 && DOUBLE_QUOTE_CHARS.has(first) && DOUBLE_QUOTE_CHARS.has(last);
  return isWrapped ? s.slice(1, -1) : s;
}

/** CommandCreoleImg.executeAndAdvance, java :79-84: strip a leading
 *  (case-insensitive) `src=`, then strip surrounding double quotes. */
function stripImgSrc(raw: string): string {
  const trimmed = raw.trim();
  const hasSrcPrefix = trimmed.slice(0, SRC_PREFIX.length).toLowerCase() === SRC_PREFIX;
  const withoutPrefix = hasSrcPrefix ? trimmed.slice(SRC_PREFIX.length) : trimmed;
  return stripDoubleQuotes(withoutPrefix);
}

// ---------------------------------------------------------------------------
// Line scanning
// ---------------------------------------------------------------------------

export interface AtomSpan {
  start: number;
  end: number;
  atom?: InlineAtomToken;
  fallbackText?: string;
}

/** AtomImg.create's `data:image/png;base64,` branch only (java :123-131) --
 *  http/file/svg/other src forms are out of scope (D7/mission scope) and
 *  fall back to the same `(Cannot decode)` text as a malformed PNG,
 *  matching upstream's shape (an unresolvable image degrades to a text
 *  atom) without requiring the file/network I/O this browser-safe,
 *  synchronous renderer cannot perform (project CLAUDE.md Architecture
 *  Notes: no blocking I/O in `src/`). */
function buildImgSpan(m: RegExpExecArray): AtomSpan {
  const start = m.index;
  const end = m.index + m[0].length;
  const src = stripImgSrc(m[1]!);
  const scale = parseScale(m[2], 1);
  const ihdr = parsePngIhdrFromDataUri(src);
  if (ihdr === undefined) return { start, end, fallbackText: CANNOT_DECODE_TEXT };
  return { start, end, atom: { kind: 'img', dataUri: src, scale, width: ihdr.width, height: ihdr.height } };
}

function scanImgSpans(line: string): AtomSpan[] {
  const spans: AtomSpan[] = [];
  const re = new RegExp(IMG_PATTERN_SOURCE, 'g');
  let m = re.exec(line);
  while (m !== null) {
    spans.push(buildImgSpan(m));
    if (m[0].length === 0) re.lastIndex += 1;
    m = re.exec(line);
  }
  return spans;
}

/** CommandCreoleSprite.executeAndAdvance, java :81-86: the forced-color
 *  prefix (`<#RRGGBB$name>`) wins over an in-block `color=` when both are
 *  present; scale multiplies against the caller's font-size ratio at
 *  render time (T7's concern), not here. */
function buildSpriteSpan(m: RegExpExecArray): AtomSpan {
  const start = m.index;
  const end = m.index + m[0].length;
  const forcedPrefix = m[1];
  const name = m[2]!;
  const scale = parseScale(m[3], 1);
  const forcedColor = forcedPrefix !== undefined ? forcedPrefix.slice(1) : parseColorFromBlock(m[3]);
  const atom: SpriteAtomToken =
    forcedColor === undefined ? { kind: 'sprite', name, scale } : { kind: 'sprite', name, scale, forcedColor };
  return { start, end, atom };
}

function scanSpriteSpans(line: string): AtomSpan[] {
  const spans: AtomSpan[] = [];
  const re = new RegExp(SPRITE_PATTERN_SOURCE, 'gu');
  let m = re.exec(line);
  while (m !== null) {
    spans.push(buildSpriteSpan(m));
    if (m[0].length === 0) re.lastIndex += 1;
    m = re.exec(line);
  }
  return spans;
}

/**
 * Scan a single Creole line for `<img ...>`, `<$sprite ...>`, and
 * `<&openiconic ...>` atoms.
 *
 * Non-atom text is preserved in source order in `textWithoutAtoms` (a
 * malformed `<img>` atom's markup is replaced by literal `(Cannot decode)`
 * text rather than removed -- see `buildImgSpan`; an unrecognized `<&name>`
 * glyph's markup is removed with NO fallback text -- see `buildOpenIconSpan`);
 * atom markup itself is removed, matching the `resolveInlineLinks`/I5
 * precedent that raw markup has no on-diagram width, only the resolved
 * content does.
 */
export function scanLineForAtoms(line: string): LineAtomScan {
  const spans = [...scanImgSpans(line), ...scanSpriteSpans(line), ...scanOpenIconSpans(line)].sort(
    (a, b) => a.start - b.start,
  );
  let cursor = 0;
  const textParts: string[] = [];
  const atoms: InlineAtomToken[] = [];
  const segments: RenderSegment[] = [];
  for (const span of spans) {
    const before = line.slice(cursor, span.start);
    textParts.push(before);
    if (before.length > 0) segments.push({ kind: 'text', text: before });
    if (span.atom !== undefined) {
      atoms.push(span.atom);
      segments.push({ kind: 'atom', atom: span.atom });
    } else if (span.fallbackText !== undefined) {
      textParts.push(span.fallbackText);
      segments.push({ kind: 'text', text: span.fallbackText });
    }
    cursor = span.end;
  }
  const tail = line.slice(cursor);
  textParts.push(tail);
  if (tail.length > 0) segments.push({ kind: 'text', text: tail });
  return { textWithoutAtoms: textParts.join(''), atoms, segments };
}

/**
 * Result of trying to match ONE `<img>`/`<$sprite>`/`<&openiconic>` atom
 * starting EXACTLY at `pos` (sticky-anchored, upstream: `Command
 * #matchingSize`/`executeAndAdvance` called at a fixed scan position) -- the
 * per-position counterpart to {@link scanLineForAtoms}'s whole-line scan,
 * needed by E2r/L2's unified creole command dispatch (`klimt/creole/legacy/
 * StripeSimple.ts#modifyStripe`): upstream registers `CommandCreoleImg`/
 * `CommandCreoleSprite`/`CommandCreoleOpenIcon` in the SAME `searchCommand`
 * starter map as the style/size/color commands (`<i`/`<#`/`<$`/`<&`,
 * `CommandCreoleBuilder.java:106,114,...`), so an atom can appear INSIDE a
 * style/color/size command's captured inner text (`<color:red><$Batch>
 * </color>`, `usecase/nenedo-78-fiva569` -- jar-verified 2026-07-15: the
 * jar tints the sprite AND treats the whole span as one recognized unit, not
 * three independent segments) -- reusing this file's existing regex sources
 * rather than re-deriving them, per this project's "don't duplicate an
 * already-tested primitive" rule.
 */
export interface AtomMatchAt {
  readonly length: number;
  readonly atom?: InlineAtomToken;
  readonly fallbackText?: string;
}

export function spanToMatch(span: AtomSpan): AtomMatchAt {
  const length = span.end - span.start;
  if (span.atom !== undefined) return { length, atom: span.atom };
  if (span.fallbackText !== undefined) return { length, fallbackText: span.fallbackText };
  return { length };
}

function matchImgAt(line: string, pos: number): AtomMatchAt | null {
  const re = new RegExp(IMG_PATTERN_SOURCE, 'y');
  re.lastIndex = pos;
  const m = re.exec(line);
  return m === null ? null : spanToMatch(buildImgSpan(m));
}

function matchSpriteAt(line: string, pos: number): AtomMatchAt | null {
  const re = new RegExp(SPRITE_PATTERN_SOURCE, 'yu');
  re.lastIndex = pos;
  const m = re.exec(line);
  return m === null ? null : spanToMatch(buildSpriteSpan(m));
}

/** Upstream: `searchCommand`'s per-position dispatch, restricted to the
 *  three atom commands (`CommandCreoleImg`'s `<i` starter is tried by the
 *  CALLER before this -- see `StripeSimple.ts#searchCommand`'s own doc
 *  comment -- since it collides with ITALIC's legacy `<i`/`<I` starter and
 *  upstream's own registration order tries style commands first). Img,
 *  sprite, then openicon, matching `CommandCreoleBuilder.java`'s own
 *  registration order (:106 img, :114 sprite, openicon registered in
 *  `klimt/creole/command`'s own builder set) -- immaterial here since their
 *  starters never collide (`<i` vs `<$` vs `<&`), but ported for parity. */
export function matchAtomAt(line: string, pos: number): AtomMatchAt | null {
  return matchImgAt(line, pos) ?? matchSpriteAt(line, pos) ?? matchOpenIconAt(line, pos);
}

// ---------------------------------------------------------------------------
// Measurement (D9)
// ---------------------------------------------------------------------------

/**
 * The scaled pixel dims a single atom contributes to label measurement.
 * `img`: `{width, height} * scale` (IHDR dims, AtomImg.calculateDimensionSlow).
 * `sprite`: registry dims * scale when the name resolves; `{0, 0}` (i.e.
 * contributes NOTHING) for an unknown name -- StripeSimple.addSprite
 * (java :228-236) never adds an atom for a sprite the skinparam doesn't know.
 * `openiconic` (G2 N41): `openIconicDims(openIconicFactor(atom.scale,
 * ambientFontSize))` -- `ambientFontSize` defaults to 12 (the OpenIconic
 * "native" font-size reference, `AtomOpenIconic`'s own `/12.0` divisor) when
 * the caller has no ambient font in scope, matching "no ambient context"
 * degrading to `factor === scale` rather than an arbitrary guess.
 */
export function measureInlineAtom(
  atom: InlineAtomToken,
  sprites?: SpriteDimsLookup,
  ambientFontSize?: number,
): { width: number; height: number } {
  if (atom.kind === 'img') {
    return { width: atom.width * atom.scale, height: atom.height * atom.scale };
  }
  if (atom.kind === 'openiconic') {
    return openIconicDims(openIconicFactor(atom.scale, ambientFontSize ?? 12));
  }
  const dims = sprites?.get(atom.name);
  if (dims === undefined) return { width: 0, height: 0 };
  return { width: dims.width * atom.scale, height: dims.height * atom.scale };
}

/**
 * Measure one line's width/height, atom-aware. Atom-free lines take the
 * exact same code path as before this task (`measurer.measure(line,
 * fontSpec)`), so this is a zero-diff drop-in everywhere it replaces a bare
 * `measurer.measure` call. Atom-bearing lines: text width comes from the
 * markup-stripped text (`scanLineForAtoms`); each atom's scaled width ADDS
 * to the total; each atom's scaled height MAXES against the running height
 * (D9) -- mirrors StripeSimple's ArithmeticStrategySum (width) /
 * ArithmeticStrategyMax (height) composition of one line's atoms.
 */
export function measureLineWithAtoms(
  line: string,
  fontSpec: FontSpec,
  measurer: StringMeasurer,
  sprites?: SpriteDimsLookup,
): { width: number; height: number } {
  const scan = scanLineForAtoms(line);
  if (scan.atoms.length === 0) return measurer.measure(line, fontSpec);
  const textDim = measurer.measure(scan.textWithoutAtoms, fontSpec);
  let width = textDim.width;
  let height = textDim.height;
  for (const atom of scan.atoms) {
    const dims = measureInlineAtom(atom, sprites, fontSpec.size);
    width += dims.width;
    if (dims.height > height) height = dims.height;
  }
  return { width, height };
}

/**
 * The additional height a line's atoms need beyond a plain text line
 * (`fontSpec.size`) -- 0 for an atom-free line. Callers that build a
 * uniform `lineCount * lineHeight` multi-line total (e.g. leaf-sizing.ts)
 * add this per line to preserve that formula exactly for atom-free
 * displays while still growing the box for a line with a tall atom.
 */
export function lineAtomHeightExcess(line: string, fontSpec: FontSpec, sprites?: SpriteDimsLookup): number {
  const { atoms } = scanLineForAtoms(line);
  let maxAtomHeight = 0;
  for (const atom of atoms) {
    const h = measureInlineAtom(atom, sprites, fontSpec.size).height;
    if (h > maxAtomHeight) maxAtomHeight = h;
  }
  return maxAtomHeight > fontSpec.size ? maxAtomHeight - fontSpec.size : 0;
}
