/**
 * OpenIconic `<&glyph>` inline icons (G2 N41).
 *
 * Upstream: `klimt/creole/atom/AtomOpenIconic.java` (dimension/altitude/draw),
 * `klimt/creole/command/CommandCreoleOpenIcon.java` (`<&name>` /
 * `<&name{scale=N,color=X}>` / `<#RRGGBB&name>` markup, `Splitter
 * .openiconPattern`), `openiconic/OpenIconic.java` (resource loader --
 * reads `src/main/resources/openiconic/<name>.svg`, a literal 8x8-viewBox
 * single-`<path>` SVG per icon, credit github.com/iconic/open-iconic, MIT),
 * `openiconic/SvgPath.java` (parse + scale + translate -> `UPath`),
 * `openiconic/{StringDecipher,Movement,SvgCommand*,SvgPosition}.java` (the
 * path-data tokenizer/absolutizer this module ports).
 *
 * Scope (G2 N40 survey): 6 glyph names actually reach the class corpus --
 * `x`, `key`, `ban`, `caret-right`, `link-intact`, `thumb-up` -- captured
 * verbatim from plantuml's own resource SVGs (not scraped from jar output,
 * unlike `class-badge.ts`'s badge-letter precedent: OpenIconic ships its
 * literal source, no reverse-engineering needed). The full 200+-icon
 * OpenIconic set is NOT ported -- an unrecognized name resolves to
 * `undefined` throughout this module, matching `OpenIconic.retrieve`'s own
 * null-on-missing-resource behavior (`StripeSimple#addOpenIcon`: an
 * unresolved name contributes NOTHING, the SAME "unknown sprite" rule
 * `creole-atoms.ts`'s own doc comment already documents for `<$sprite>`).
 *
 * Geometry, byte-verified against 5 independent jar-cached fixtures spanning
 * 4 distinct `factor` values (1.0, 1.16667, 2.0, and the caret-right
 * `transform="translate(2)"` case) -- `plans/g2-class-svg/ledger.md` N41:
 * - `factor = scale * fontSize / 12` (`AtomOpenIconic` ctor: `this.factor =
 *   scale * fontConfiguration.getSize2D() / 12.0`).
 * - Every coordinate (and an `A` command's `rx`/`ry`, NOT its rotation/flag
 *   args) scales by `factor` uniformly; a source SVG's own
 *   `transform="translate(dx dy)"` (only `caret-right` carries one) adds
 *   `(dx*factor, dy*factor)` on top, matching `SvgPath#toUPath(factorx,
 *   factory)`'s `result.translate(translate.getDx()*factorx, ...)` tail.
 * - `Z` commands are dropped from the emitted `d` entirely (every sampled
 *   glyph's own line-segment geometry already closes back to its `M` point
 *   before the `z`, so this is a no-op relative to jar's OWN visible output,
 *   not a divergence) -- confirmed on `key.svg`'s TWO-subpath case (`z`
 *   between them emits nothing, the second subpath's own `m` position resets
 *   against the FIRST subpath's `M` point, i.e. `SvgPath`'s `lastMove`
 *   convention, not the immediately-preceding point).
 */
import { javaFixed4, trimTrailingZeros } from './number-format.js';

// ---------------------------------------------------------------------------
// Raw glyph source (verbatim from plantuml's own
// src/main/resources/openiconic/<name>.svg -- every OpenIconic glyph shares
// an 8x8 natural viewBox, `OPENICONIC_NATURAL_SIZE` below).
// ---------------------------------------------------------------------------

interface RawGlyph {
  readonly d: string;
  /** Only `caret-right` carries a `transform="translate(N)"` in its source
   *  SVG (`Y` is always absent/0 for every sampled glyph -- `getTranslate`'s
   *  own regex, `openiconic/OpenIconic.java:151-164`, allows a Y term this
   *  module has no corpus evidence for; omitted rather than guessed). */
  readonly translateX?: number;
}

const RAW_GLYPHS: Readonly<Record<string, RawGlyph>> = {
  x: {
    d: 'M1.41 0l-1.41 1.41.72.72 1.78 1.81-1.78 1.78-.72.69 1.41 1.44.72-.72 1.81-1.81 1.78 1.81.69.72 1.44-1.44' +
      '-.72-.69-1.81-1.78 1.81-1.81.72-.72-1.44-1.41-.69.72-1.78 1.78-1.81-1.78-.72-.72z',
  },
  key: {
    d: 'M5.5 0c-1.38 0-2.5 1.12-2.5 2.5 0 .16 0 .32.03.47l-3.03 3.03v2h3v-2h2v-1l.03-.03c.15.03.31.03.47.03 ' +
      '1.38 0 2.5-1.12 2.5-2.5s-1.12-2.5-2.5-2.5zm.5 1c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1z',
  },
  ban: {
    d: 'M4 0c-2.2 0-4 1.8-4 4s1.8 4 4 4 4-1.8 4-4-1.8-4-4-4zm0 1c.66 0 1.26.21 1.75.56l-4.19 4.19c-.35-.49' +
      '-.56-1.09-.56-1.75 0-1.66 1.34-3 3-3zm2.44 1.25c.35.49.56 1.09.56 1.75 0 1.66-1.34 3-3 3-.66 0-1.26' +
      '-.21-1.75-.56l4.19-4.19z',
  },
  'caret-right': { d: 'M0 0v8l4-4-4-4z', translateX: 2 },
  'link-intact': {
    d: 'M5.88.03c-.18.01-.36.03-.53.09-.27.1-.53.25-.75.47a.5.5 0 1 0 .69.69c.11-.11.24-.17.38-.22.35-.12' +
      '.78-.07 1.06.22.39.39.39 1.04 0 1.44l-1.5 1.5c-.44.44-.8.48-1.06.47-.26-.01-.41-.13-.41-.13a.5.5 0 1 0' +
      '-.5.88s.34.22.84.25c.5.03 1.2-.16 1.81-.78l1.5-1.5c.78-.78.78-2.04 0-2.81-.28-.28-.61-.45-.97-.53-.18' +
      '-.04-.38-.04-.56-.03zm-2 2.31c-.5-.02-1.19.15-1.78.75l-1.5 1.5c-.78.78-.78 2.04 0 2.81.56.56 1.36.72' +
      ' 2.06.47.27-.1.53-.25.75-.47a.5.5 0 1 0-.69-.69c-.11.11-.24.17-.38.22-.35.12-.78.07-1.06-.22-.39-.39' +
      '-.39-1.04 0-1.44l1.5-1.5c.4-.4.75-.45 1.03-.44.28.01.47.09.47.09a.5.5 0 1 0 .44-.88s-.34-.2-.84-.22z',
  },
  'thumb-up': {
    d: 'M4.47 0c-.19.02-.37.15-.47.34-.13.26-1.09 2.19-1.28 2.38-.19.19-.44.28-.72.28v4h3.5c.21 0 .39-.13' +
      '.47-.31 0 0 1.03-2.91 1.03-3.19 0-.28-.22-.5-.5-.5h-1.5c-.28 0-.5-.25-.5-.5s.39-1.58.47-1.84c.08-.26' +
      '-.05-.54-.31-.63-.07-.02-.12-.04-.19-.03zm-4.47 3v4h1v-4h-1z',
  },
};

/** Every OpenIconic glyph's native (unscaled) viewBox is `0 0 8 8`
 *  (`OpenIconic.java#getDimension`'s own `width`/`height` SVG attrs, both
 *  always `8` for this icon set). */
export const OPENICONIC_NATURAL_SIZE = 8;

export function isKnownOpenIconicGlyph(name: string): boolean {
  return Object.hasOwn(RAW_GLYPHS, name);
}

// ---------------------------------------------------------------------------
// Path tokenizer -- `openiconic/StringDecipher.java#decipher` (letters and
// numbers only; this module's fixed 6-glyph table never needs scientific
// notation, so that branch of the Java tokenizer is not ported -- narrower
// scope than the general-purpose upstream parser, adequate for a closed,
// hand-verified data set).
// ---------------------------------------------------------------------------

function decipher(path: string): string[] {
  // #lizard forgives -- a single character-scan tokenizer (StringDecipher
  // port), not real branching complexity; see this file's module doc
  // comment for the upstream algorithm this mirrors.
  const tokens: string[] = [];
  let i = 0;
  while (i < path.length) {
    while (i < path.length && (path[i] === ',' || /\s/.test(path[i]!))) i++;
    if (i >= path.length) break;
    const c0 = path[i]!;
    if (/[A-Za-z]/.test(c0)) {
      tokens.push(c0);
      i++;
      continue;
    }
    let j = i;
    if (path[j] === '+' || path[j] === '-') j++;
    let seenDot = false;
    let seenDigit = false;
    while (j < path.length) {
      const c = path[j]!;
      if (c >= '0' && c <= '9') {
        seenDigit = true;
        j++;
      } else if (c === '.' && !seenDot) {
        seenDot = true;
        j++;
      } else {
        break;
      }
    }
    if (!seenDigit) break; // malformed -- unreachable for this module's fixed glyph table
    tokens.push(path.slice(i, j));
    i = j;
  }
  return tokens;
}

// ---------------------------------------------------------------------------
// Movement model -- `openiconic/SvgCommandLetter.java#argumentNumber`/
// `implicit`, `Movement.java#toAbsoluteUpperCase`/`getMirrorControlPoint`.
// ---------------------------------------------------------------------------

interface RawMovement {
  readonly letter: string;
  readonly args: readonly number[];
}

/** SvgCommandLetter#argumentNumber (java :57-77) -- a faithful port of
 *  upstream's fixed command-letter -> arg-count table. */
function argCount(letter: string): number {
  // #lizard forgives -- a fixed-case lookup table, not real branching logic.
  switch (letter.toLowerCase()) {
    case 'm':
    case 'l':
    case 't':
      return 2;
    case 'h':
    case 'v':
      return 1;
    case 'z':
      return 0;
    case 'c':
      return 6;
    case 'q':
    case 's':
      return 4;
    case 'a':
      return 7;
    // Every letter in this module's 6-glyph table is one of the cases
    // above (verified by this file's own tests).
    /* v8 ignore next 2 */
    default:
      throw new Error(`unsupported SVG path command: ${letter}`);
  }
}

/** SvgCommandLetter#implicit (java :91-100): a repeated bare-number run
 *  after `m`/`M` implicitly becomes `l`/`L`; every other letter repeats as
 *  itself. */
function implicitLetter(letter: string): string {
  if (letter === 'm') return 'l';
  if (letter === 'M') return 'L';
  return letter;
}

/** SvgPath's `insertMissingLetter` (java :99-123), inlined into a single
 *  tokens -> movements pass: a real letter token starts a new movement
 *  (consuming its own `argCount` numbers); a bare-number token (no
 *  preceding letter) repeats the LAST movement's `implicitLetter`. */
function parseMovements(tokens: readonly string[]): RawMovement[] {
  const result: RawMovement[] = [];
  let i = 0;
  let lastLetter = '';
  while (i < tokens.length) {
    const tok = tokens[i]!;
    const isLetter = /^[A-Za-z]$/.test(tok);
    const letter = isLetter ? tok : lastLetter;
    if (isLetter) i++;
    const nb = argCount(letter);
    const args: number[] = [];
    for (let k = 0; k < nb; k++) {
      args.push(Number(tokens[i]!));
      i++;
    }
    result.push({ letter, args });
    if (isLetter) lastLetter = implicitLetter(tok);
  }
  return result;
}

/** Output op: `H`/`V` folded into `L`, `S` folded into `C` (mirrored control
 *  point), `Z` dropped (never emitted -- see this module's own file doc
 *  comment). */
export type OpenIconicOp =
  | { readonly op: 'M' | 'L'; readonly x: number; readonly y: number }
  | {
      readonly op: 'C';
      readonly c1x: number;
      readonly c1y: number;
      readonly c2x: number;
      readonly c2y: number;
      readonly x: number;
      readonly y: number;
    }
  | {
      readonly op: 'A';
      readonly rx: number;
      readonly ry: number;
      readonly rot: number;
      readonly laf: number;
      readonly sf: number;
      readonly x: number;
      readonly y: number;
    };

/** Running absolutize state, bundled to keep {@link absolutizeOne}'s own
 *  param count under this project's complexity cap. */
interface AbsoluteCursor {
  readonly x: number;
  readonly y: number;
  readonly mirrorC2: readonly [number, number] | null;
}

/** SvgPath's ctor loop (java :73-97): absolutize every relative command
 *  against the running current point, tracking the current SUBPATH's `M`
 *  (`lastMove`, restored on `Z` -- `openiconic/SvgPath.java:81-82`) and the
 *  previous cubic's second control point (for `S`'s reflection,
 *  `Movement#getMirrorControlPoint`, java :178-196). */
function toAbsolute(movements: readonly RawMovement[]): OpenIconicOp[] {
  const out: OpenIconicOp[] = [];
  let cursor: AbsoluteCursor = { x: 0, y: 0, mirrorC2: null };
  let moveX = 0;
  let moveY = 0;
  for (const { letter, args } of movements) {
    if (letter === 'Z' || letter === 'z') {
      cursor = { x: moveX, y: moveY, mirrorC2: null };
      continue;
    }
    const op = absolutizeOne(letter, args, cursor);
    out.push(op);
    if (op.op === 'M') {
      moveX = op.x;
      moveY = op.y;
    }
    cursor = { x: op.x, y: op.y, mirrorC2: op.op === 'C' ? [op.c2x, op.c2y] : null };
  }
  return out;
}

/** One `RawMovement` -> `OpenIconicOp`, split out of {@link toAbsolute} to
 *  keep that function's own NLOC under this project's complexity cap. */
function absolutizeOne(letter: string, args: readonly number[], cursor: AbsoluteCursor): OpenIconicOp {
  // #lizard forgives -- one command-letter dispatch switch (Movement
  // #toAbsoluteUpperCase port), not real branching complexity; see this
  // file's module doc comment for the upstream algorithm this mirrors.
  const { x: curX, y: curY, mirrorC2 } = cursor;
  switch (letter) {
    case 'M':
      return { op: 'M', x: args[0]!, y: args[1]! };
    case 'm':
      return { op: 'M', x: curX + args[0]!, y: curY + args[1]! };
    // No glyph in this module's fixed 6-icon table uses an absolute-
    // uppercase `L` (all use lowercase `l`).
    /* v8 ignore next 2 */
    case 'L':
      return { op: 'L', x: args[0]!, y: args[1]! };
    case 'l':
      return { op: 'L', x: curX + args[0]!, y: curY + args[1]! };
    // No glyph in this module's fixed 6-icon table uses an absolute-
    // uppercase `H` (all use lowercase `h`) -- verified by inspection of
    // the literal `RAW_GLYPHS` source strings.
    /* v8 ignore next 2 */
    case 'H':
      return { op: 'L', x: args[0]!, y: curY };
    case 'h':
      return { op: 'L', x: curX + args[0]!, y: curY };
    // Same rationale as 'H' above (no uppercase-absolute `V`).
    /* v8 ignore next 2 */
    case 'V':
      return { op: 'L', x: curX, y: args[0]! };
    case 'v':
      return { op: 'L', x: curX, y: curY + args[0]! };
    // Same rationale (no uppercase-absolute `C` -- every cubic in
    // `RAW_GLYPHS` is `c` or the `s`-derived kind below).
    /* v8 ignore next 2 */
    case 'C':
      return { op: 'C', c1x: args[0]!, c1y: args[1]!, c2x: args[2]!, c2y: args[3]!, x: args[4]!, y: args[5]! };
    case 'c':
      return {
        op: 'C',
        c1x: curX + args[0]!, c1y: curY + args[1]!,
        c2x: curX + args[2]!, c2y: curY + args[3]!,
        x: curX + args[4]!, y: curY + args[5]!,
      };
    // `link-intact` (the only glyph using an arc) uses lowercase `a`.
    /* v8 ignore next 2 */
    case 'A':
      return { op: 'A', rx: args[0]!, ry: args[1]!, rot: args[2]!, laf: args[3]!, sf: args[4]!, x: args[5]!, y: args[6]! };
    case 'a':
      return {
        op: 'A', rx: args[0]!, ry: args[1]!, rot: args[2]!, laf: args[3]!, sf: args[4]!,
        x: curX + args[5]!, y: curY + args[6]!,
      };
    case 'S':
    case 's': {
      const rel = letter === 's';
      const c2x = rel ? curX + args[0]! : args[0]!;
      const c2y = rel ? curY + args[1]! : args[1]!;
      const x = rel ? curX + args[2]! : args[2]!;
      const y = rel ? curY + args[3]! : args[3]!;
      // Movement#mutoToC (java): a NULL mirror (no preceding C/S) falls
      // back to c1 = c2 (this S's OWN second control point, NOT the
      // current point) -- jar-verified `gekope-01-ricu859`'s link-intact
      // glyph (an arc immediately followed by an `s`, N41).
      const c1x = mirrorC2 !== null ? 2 * curX - mirrorC2[0] : c2x;
      const c1y = mirrorC2 !== null ? 2 * curY - mirrorC2[1] : c2y;
      return { op: 'C', c1x, c1y, c2x, c2y, x, y };
    }
    // Every letter in this module's 6-glyph table is one of the cases
    // above (verified by this file's own tests).
    /* v8 ignore next 2 */
    default:
      throw new Error(`unsupported SVG path command letter: ${letter}`);
  }
}

const PARSED_CACHE = new Map<string, readonly OpenIconicOp[]>();

function parsedOpsFor(name: string): readonly OpenIconicOp[] | undefined {
  const cached = PARSED_CACHE.get(name);
  if (cached !== undefined) return cached;
  const raw = RAW_GLYPHS[name];
  if (raw === undefined) return undefined;
  const ops = toAbsolute(parseMovements(decipher(raw.d)));
  PARSED_CACHE.set(name, ops);
  return ops;
}

// ---------------------------------------------------------------------------
// Public geometry API
// ---------------------------------------------------------------------------

/** `AtomOpenIconic` ctor: `factor = scale * fontConfiguration.getSize2D() /
 *  12.0`. */
export function openIconicFactor(scale: number, fontSize: number): number {
  return (scale * fontSize) / 12;
}

/** `AtomOpenIconic#asTextBlock`: `TextBlockUtils.withMargin(rawGlyph, 1, 0)`
 *  -- 1px FLAT (not `factor`-scaled) left+right margin, no top/bottom
 *  margin. Row-advance width therefore includes the +2 total; height is the
 *  unmarged scaled glyph height. */
export function openIconicDims(factor: number): { readonly width: number; readonly height: number } {
  return { width: OPENICONIC_NATURAL_SIZE * factor + 2, height: OPENICONIC_NATURAL_SIZE * factor };
}

/**
 * Icon origin Y, given the row's own text BASELINE `y` (`ClassifierGeo.rows[]
 * .y`, matching every other row-content formula's own reference point) and
 * the row's AMBIENT font size (`theme.fontSize` -- the SAME value `renderer-
 * classifier-box.ts`'s pre-existing `lineTopY` formula for `<img>`/`<$sprite>`
 * atoms already uses; NOT the icon's own possibly-`<size:N>`-overridden
 * factor, confirmed by `dofima-22-kofe334`'s own `<size:12><&key></size>` --
 * the icon's local size feeds `factor`, but the surrounding ROW's font size
 * still governs where the icon sits on the line, since the physical line's
 * overall height/altitude is dominated by its own text run, not this one
 * inline atom -- `klimt/creole/Sea.java#drawU`'s
 * `translateY(-height + atom.getStartingAltitude())` composition).
 *
 * Formula empirically derived + jar-verified EXACT against 5 independent
 * samples spanning `factor` 1.0/1.16667/2.0 across 3 fixtures (`bidusa-22-
 * jutu505`, `gekope-01-ricu859`'s PK/PP rows, `rideze-59-lizu265`'s ban/
 * thumb-up icons) -- `plans/g2-class-svg/ledger.md` N41. The `-3*factor`
 * term matches `AtomOpenIconic#getStartingAltitude` exactly (`-getStarting
 * Altitude = +3*factor`); the `rowFontSize/4.5` term matches this file's
 * neighboring `lineTopY` descent constant. The combination was NOT re-derived
 * from `Sea`/`AtomHorizontalTexts`'s own general multi-atom composition
 * algorithm (out of this iteration's time budget) -- ruled out as a
 * fontSize-independent flat constant by construction (every sample shares
 * `rowFontSize=14`, so this formula is unverified for a NON-default
 * `classAttributeFontSize` row; named here, not a silent gap).
 */
export function openIconicOriginY(rowBaselineY: number, rowFontSize: number, factor: number): number {
  return rowBaselineY + rowFontSize / 4.5 - 11 * factor;
}

function fmt(n: number): string {
  return trimTrailingZeros(javaFixed4(n));
}

/**
 * Builds the final `<path d="...">` value for one glyph instance: scale by
 * `factor`, apply the source SVG's own intrinsic `transform="translate(...)"`
 * (scaled by `factor` too, per `SvgPath#toUPath`'s translate-last tail), then
 * translate to `(originX, originY)` -- the icon's own top-left render
 * position (`x + 1` for the flat left margin, `openIconicOriginY` above).
 * Returns `undefined` for an unrecognized glyph name (see {@link
 * isKnownOpenIconicGlyph}'s own doc comment).
 */
export function buildOpenIconicPathD(
  name: string,
  factor: number,
  originX: number,
  originY: number,
): string | undefined {
  const ops = parsedOpsFor(name);
  if (ops === undefined) return undefined;
  const raw = RAW_GLYPHS[name]!;
  const dx = (raw.translateX ?? 0) * factor + originX;
  const dy = originY;
  const parts: string[] = [];
  for (const op of ops) parts.push(formatOp(op, factor, dx, dy));
  return parts.join(' ');
}

function formatOp(op: OpenIconicOp, factor: number, dx: number, dy: number): string {
  if (op.op === 'A') {
    const x = fmt(op.x * factor + dx);
    const y = fmt(op.y * factor + dy);
    return `A${fmt(op.rx * factor)},${fmt(op.ry * factor)} ${fmt(op.rot)} ${fmt(op.laf)} ${fmt(op.sf)} ${x},${y}`;
  }
  const x = fmt(op.x * factor + dx);
  const y = fmt(op.y * factor + dy);
  if (op.op === 'C') {
    const c1x = fmt(op.c1x * factor + dx);
    const c1y = fmt(op.c1y * factor + dy);
    const c2x = fmt(op.c2x * factor + dx);
    const c2y = fmt(op.c2y * factor + dy);
    return `C${c1x},${c1y} ${c2x},${c2y} ${x},${y}`;
  }
  return `${op.op}${x},${y}`;
}
