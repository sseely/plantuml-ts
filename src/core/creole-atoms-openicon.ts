/**
 * OpenIconic `<&glyph>` span recognizer -- split out of `creole-atoms.ts`
 * purely to keep that file under this project's 500-line cap (G2 N41;
 * mirrors the existing `class-layout-helpers.ts`/`class-member-rows.ts`
 * split precedent). Owns `Splitter.openiconPattern`'s regex source plus the
 * per-line/per-position scan functions; the token TYPE (`OpenIconicAtomToken`)
 * and shared span/match plumbing (`AtomSpan`, `AtomMatchAt`, `spanToMatch`,
 * `parseScale`, `parseColorFromBlock`) stay in `creole-atoms.ts` (the single
 * canonical home for every inline-atom kind's data model) and are imported
 * back here as `import type`s (erased at compile time -- no real runtime
 * import cycle, this project's `verbatimModuleSyntax` convention makes the
 * split explicit).
 *
 * See `creole-atoms.ts`'s own module doc comment for the upstream Java
 * sources this mirrors.
 */
import type { AtomSpan, AtomMatchAt, OpenIconicAtomToken } from './creole-atoms.js';
import { parseScale, parseColorFromBlock, spanToMatch } from './creole-atoms.js';
import { isKnownOpenIconicGlyph } from './openiconic-glyphs.js';

/** Splitter.openiconPattern, java Splitter.java:72 -- SAME `scaleOrColor`
 *  block shape as `<$sprite>` (`creole-atoms.ts#SPRITE_PATTERN_SOURCE`),
 *  `&` instead of `$`, narrower `[-\w]+` name charset (java's own pattern,
 *  no unicode-letter/`/` allowance). Group 1: forced-color prefix. Group 2:
 *  glyph name. Group 3: the optional `{scale=N,color=X}`-shaped block. */
const OPENICON_PATTERN_SOURCE =
  '<(#[A-Za-z0-9_]+)?&([-A-Za-z0-9_]+)' +
  '((?:[{,]?(?:(?:scale=|\\*)[0-9.]+)?(?:,?color[= :](?:#[0-9a-fA-F]{1,8}|[A-Za-z0-9_]+))?\\}?)?)>';

/** G2 N41: `CommandCreoleOpenIcon.executeAndAdvance` -- an UNRECOGNIZED
 *  glyph name (not one of `openiconic-glyphs.ts`'s 6 captured names) is
 *  dropped entirely (no atom, no fallback text), matching `OpenIconic
 *  .retrieve`'s null-on-missing-resource -> `addOpenIcon`'s "no atom
 *  added" behavior -- the SAME "unknown name contributes nothing" rule
 *  `creole-atoms.ts#buildSpriteSpan`'s own doc comment documents for
 *  `<$sprite>` (narrower than `<img>`'s own "malformed -> visible fallback
 *  text" rule, since an unresolved sprite/glyph name is a per-diagram/
 *  per-build data question, not a malformed-markup one). */
function buildOpenIconSpan(m: RegExpExecArray): AtomSpan {
  const start = m.index;
  const end = m.index + m[0].length;
  const forcedPrefix = m[1];
  const name = m[2]!;
  if (!isKnownOpenIconicGlyph(name)) return { start, end };
  const scale = parseScale(m[3], 1);
  const forcedColor = forcedPrefix !== undefined ? forcedPrefix.slice(1) : parseColorFromBlock(m[3]);
  const atom: OpenIconicAtomToken =
    forcedColor === undefined ? { kind: 'openiconic', name, scale } : { kind: 'openiconic', name, scale, forcedColor };
  return { start, end, atom };
}

export function scanOpenIconSpans(line: string): AtomSpan[] {
  const spans: AtomSpan[] = [];
  const re = new RegExp(OPENICON_PATTERN_SOURCE, 'g');
  let m = re.exec(line);
  while (m !== null) {
    spans.push(buildOpenIconSpan(m));
    if (m[0].length === 0) re.lastIndex += 1;
    m = re.exec(line);
  }
  return spans;
}

export function matchOpenIconAt(line: string, pos: number): AtomMatchAt | null {
  const re = new RegExp(OPENICON_PATTERN_SOURCE, 'y');
  re.lastIndex = pos;
  const m = re.exec(line);
  return m === null ? null : spanToMatch(buildOpenIconSpan(m));
}
