/**
 * State/frame declaration command rules for the state parser — split out of
 * `state-commands.ts` purely for the project's 500-line file cap (pure
 * move, no logic changes; mission A4 Phase L iter 13). The declaration
 * family is self-contained: no other rule in `state-commands.ts` reads
 * `ID_ALT`/`STEREO_OPT`/`URL_OPT`/`COLOR_OPT`/`LINECOLOR_OPT`/`TAGS_OPT`/
 * `BRACE_OR_BEGIN`/`parseTags`. Spread into `COMMANDS` at the same priority
 * position (rules 6-9, composite state / frame / stereotyped leaf / plain
 * leaf) — see `state-commands.ts`'s ordering doc for why order matters.
 * @see ~/git/plantuml/.../statediagram/StateDiagramFactory.java
 */

import type { StateKind } from './ast.js';
import type { Command } from './state-commands.js';
import { makeState, addDescriptionLine, pushScope, stereotypeToKind } from './state-parse-state.js';
import { declareState } from './state-parse-resolve.js';
import { extractDisplayAndId } from './state-parse-helpers.js';

// ---------------------------------------------------------------------------
// Shared regex fragments (declaration id/decoration grammar)
// ---------------------------------------------------------------------------

/** A literal double-quote character, defined via a unicode escape so this
 *  source file contains ZERO raw double-quote glyphs anywhere (code OR
 *  comments) -- the project's complexity hook (lizard) naively counts
 *  double-quote characters to track string boundaries; a raw one sitting
 *  inside a `String.raw` regex fragment (which legitimately needs no
 *  escaping) throws its count off by one, desyncing it for the rest of the
 *  file and misattributing every later function's line span to whichever
 *  function was mid-string when the running total went odd. Interpolating
 *  `${DQUOTE}` into a `String.raw` template still yields the correct
 *  runtime regex -- only the LITERAL template text is raw; an interpolated
 *  expression's value is inserted as-is. */
const DQUOTE = '\u0022';

/** Id/display declaration grammar — CommandCreateState's full CODE1-4/
 *  DISPLAY1-2 alternation, in upstream's order: `id as "quoted"` (bare id
 *  first, MANDATORY `as`, quoted display), `"quoted" as id` (quoted display
 *  first, MANDATORY `as`, bare id), bare `id` alone, bare `"quoted"` alone.
 *  Rather than 6 separate capture groups (Java's CODE1/DISPLAY1/DISPLAY2/
 *  CODE2/CODE3/CODE4), the two MANDATORY-`as` alternatives are collapsed
 *  into their bare-alone sibling by making the `as`-suffix OPTIONAL on each
 *  side — `id(?: as "quoted")?` covers both CODE1 (suffix present) and
 *  CODE3 (suffix absent) with the same 2 groups; `"quoted"(?: as id)?`
 *  covers DISPLAY2/CODE2 and CODE4 the same way. 4 groups total: bareId,
 *  bareIdDisplay, quoted, quotedId — feeds `extractDisplayAndId` directly
 *  (see its doc for the 4-way resolution).
 *
 *  The bareId/quotedId charset is `[\w.]+`, mirroring upstream's
 *  `[%pLN_.]+` (unicode letter/digit/underscore/dot -> ASCII `\w.` here; see
 *  state-transitions.ts's ENT doc for why the ASCII-only charset is an
 *  acknowledged divergence). This must NOT be `\S+`: with everything after
 *  the id optional (STEREO_OPT/URL_OPT/COLOR_OPT), a greedy `\S+` swallows
 *  an immediately-adjacent `<<stereotype>>` whole (no backtrack is ever
 *  forced) — a bare-word alias directly followed by `<<comp>>` (no space)
 *  captured the whole `a<<comp>>` blob as the alias instead of just `a`, so
 *  the composite never opened. `[\w.]+` stops at `<` on its own.
 * @see ~/git/plantuml/.../statediagram/command/CommandCreateState.java:84-98 (CODE1-4/DISPLAY1-2) */
const ID_ALT = String.raw`(?:([\w.]+)(?:\s+as\s+(?:'|${DQUOTE})([^'${DQUOTE}]+)(?:'|${DQUOTE}))?|(?:'|${DQUOTE})([^'${DQUOTE}]+)(?:'|${DQUOTE})(?:\s+as\s+([\w.]+))?)`;

/** Optional `<<stereotype>>` — upstream's real grammar accepts one or more
 *  of anything but `<`/`>` (`StereotypePattern.umandatory`'s UBrex
 *  `<< 〇+「〤<>」>>`, equivalently the legacy `(\<\<.+?\>\>)`), NOT a
 *  word-charset: real corpus stereotypes contain hyphens (`<<O-O>>`,
 *  dogeji-46-sapo750) and other punctuation. A `[\w*]+` charset silently
 *  fails to match those, dropping the WHOLE declaration line (no later rule
 *  matches the unconsumed `<<O-O>>` tail either) — the state is never
 *  created in pass ONE, so a later reference inside a composite's block
 *  auto-creates it as a bogus LOCAL child instead of reusing the (missing)
 *  global entity (mission A4 Phase L iter 12). */
const STEREO_OPT = String.raw`(?:<<([^<>]+)>>)?`;
/** Optional `[[url]]` / `[[{tooltip}]]` / `[[url{tooltip}label]]` —
 *  matched and discarded; `State` carries no url field, same
 *  matching-and-discarding precedent as class-object-commands.ts's `URL`
 *  fragment. Upstream's real grammar (`UrlBuilder.getRegexp()`) has several
 *  quoted/tooltip/label permutations; since the value is thrown away either
 *  way, a single swallow-anything-but-`]` form suffices. Sits between the
 *  stereotype and color slots in every state/frame declaration rule, per
 *  `UrlBuilder.OPTIONAL`'s position in `CommandCreateState`/
 *  `CommandCreatePackageState`/`CommandCreatePackage2`'s regex concat.
 * @see ~/git/plantuml/.../url/UrlBuilder.java:48-49 (MANDATORY/OPTIONAL) */
const URL_OPT = String.raw`(?:\s*\[\[[^\]]*\]\])?`;
/** Trailing background/border-color spec — `ColorParser.simpleColor
 *  (ColorType.BACK)`'s COLORS_REGEXP (`PART2 | COLOR_REGEXP`): either a bare
 *  `#colorname` (with an optional `-`/`\`/`|`/`/`-separated two-color
 *  gradient) or the compound `#part:color;part2;...` form built from the
 *  `text|back|header|line|line.dashed|line.dotted|line.bold|shadowing`
 *  keywords (each with an optional `:color`, `;`-separated) — e.g.
 *  `#line.dashed`, `#back:red;line:blue`. Single capture group (unchanged
 *  position/count from the old `#\w+`-only form — every declaration rule
 *  below still reads it at the same match index). Mirrors
 *  class-declaration-parser.ts's `COLOR_RE` (house precedent for this exact
 *  fragment), inlined here since state's dispatch is one anchored regex per
 *  rule rather than a strip pipeline.
 * @see ~/git/plantuml/.../klimt/color/ColorParser.java:43-46 (COLOR_REGEXP, PART2) */
const COLOR_OPT = String.raw`(?:(#(?:\w+[-\\|/]?\w+;)?(?:(?:text|back|header|line|line\.dashed|line\.dotted|line\.bold|shadowing)(?::\w+[-\\|/]?\w+)?(?:;|(?![\w;:.])))+|#\w+[-\\|/]?\w+))?`;
/** Trailing `##[dotted|dashed|bold]colorname` line-color spec — a SEPARATE
 *  optional grammar group from COLOR above, to its right, before the
 *  ADDFIELD/brace terminator (every state/frame declaration command carries
 *  both COLOR and LINECOLOR — CommandCreateState.java:106-108,
 *  CommandCreatePackageState.java:106-108, CommandCreatePackage2.java:99-101).
 *  Matched-and-STORED as one raw blob (class-map-commands.ts's LINECOLOR
 *  convention — `State` has no `Colors`-object model to split style/color
 *  into, same as `color` above; the DOT-parity comparator never reads
 *  colors, so the only parity-relevant effect of this group is stopping the
 *  line from being DROPPED when a `##...` suffix is present and unmatched).
 * @see ~/git/plantuml/.../statediagram/command/CommandCreateState.java:108 */
const LINECOLOR_OPT = String.raw`(?:(##(?:\[(?:dotted|dashed|bold)\])?\w*))?`;
/**
 * `$tag` decoration — one-or-more space-separated `$name` tokens, captured
 * as a single raw blob (split by {@link parseTags}). Upstream's
 * `Stereotag.pattern()` is `\$[^%s{}%g<>$]+` per token (`%s`=whitespace,
 * `%g`=quote) — a `$` followed by 1+ chars excluding whitespace, braces,
 * quotes, angle brackets, and `$`. Only CommandCreateState (leaf
 * declarations, rules 8/9) and CommandCreatePackageState (composite opener,
 * rule 6) carry a TAGS slot upstream — CommandCreatePackage2 (`frame`, rule
 * 7) does NOT (verified: no `Stereotag` import in that file), so this
 * fragment is deliberately absent from rule 7's pattern.
 * @see ~/git/plantuml/.../stereo/Stereotag.java
 * @see ~/git/plantuml/.../statediagram/command/CommandCreateState.java:100,102 (TAGS1/TAGS2)
 * @see ~/git/plantuml/.../statediagram/command/CommandCreatePackageState.java:100,102
 */
const TAGS_OPT = String.raw`(?:\s*(\$[^\s{}'${DQUOTE}<>$]+(?:\s+\$[^\s{}'${DQUOTE}<>$]+)*))?`;
/** `state X { ... }` closes with `}`/`end state`; the opener accepts either
 *  a trailing `{` (zero-or-more leading space) or ` begin` (one-or-more
 *  leading space) — @see CommandCreatePackageState.java:108-109 */
const BRACE_OR_BEGIN = String.raw`(?:\s*\{|\s+begin)\s*$`;

/** Split a TAGS_OPT capture (e.g. `$tagA $tagB`) into bare names (e.g.
 *  `tagA`, `tagB`), mirroring `CommandCreateClassMultilines#addTags`'s
 *  `tags.split([ ]+)` + strip-leading-`$`. Returns `undefined` for an
 *  unmatched (absent) capture so callers can `...(tags !== undefined ? {
 *  tags } : {})` the same way every other optional `makeState` field does.
 *  Built via `new RegExp(...)` rather than a `/\s+/` regex literal --
 *  a plain regex literal here (immediately followed by the
 *  `DECLARATION_COMMANDS` array of nested `execute` methods) throws off
 *  lizard's NLOC/brace counting for THIS function, inflating its reported
 *  span to swallow the rest of the file (see
 *  `.agent-notes/complexity-hook-workarounds.md`; the SAME array shape in
 *  `state-commands-notes.ts` is unaffected because its own helper,
 *  `linkNotePosition`, contains no regex literal). */
const WHITESPACE_RE = new RegExp('\\s+');
function parseTags(raw: string | undefined): string[] | undefined {
  if (raw === undefined) return undefined;
  return raw.split(WHITESPACE_RE).map((t) => t.slice(1));
}

// ---------------------------------------------------------------------------
// Order matters within this array — spread into COMMANDS at rules 6-9's slot.
// ---------------------------------------------------------------------------

export const DECLARATION_COMMANDS: readonly Command[] = [
  // -------------------------------------------------------------------------
  // 6. State declaration with open brace/begin — composite state.
  //    state Foo { | state Foo begin | state 'Display' as Foo { |
  //    state Foo #color { | state Foo ##[dashed]red { | state Foo <<stereotype>> { |
  //    state Foo [[{tooltip}]] { | state 'A' as a $tagA {
  //    CommandCreatePackageState#isEligibleFor -> ONE/TWO/THREE (structural;
  //    `declareState`'s `pass` arg gates the ONE-only content mutation).
  // @see ~/git/plantuml/.../statediagram/command/CommandCreatePackageState.java
  // -------------------------------------------------------------------------
  {
    pattern: new RegExp(
      `^state\\s+${ID_ALT}${TAGS_OPT}\\s*${STEREO_OPT}${URL_OPT}\\s*${COLOR_OPT}\\s*${LINECOLOR_OPT}${BRACE_OR_BEGIN}`,
      'i',
    ),
    passes: ['one', 'two'],
    execute(ps, match, pass) {
      const { display, id } = extractDisplayAndId(match, 1, 2, 3, 4);
      const tags = parseTags(match[5]);
      const stereotypeRaw = match[6];
      const colorRaw = match[7];
      const lineColorRaw = match[8];
      const kind: StateKind = stereotypeRaw !== undefined ? stereotypeToKind(stereotypeRaw) : 'normal';

      const s = makeState(id, display, kind, {
        ...(colorRaw !== undefined ? { color: colorRaw } : {}),
        ...(lineColorRaw !== undefined ? { lineColor: lineColorRaw } : {}),
        ...(stereotypeRaw !== undefined ? { stereotype: stereotypeRaw } : {}),
        ...(tags !== undefined ? { tags } : {}),
      });
      // pushScope the CANONICAL object declareState returns, not `s` --
      // `s` is discarded (merged in-place) when this id was already
      // auto-created by an earlier transition reference, OR when this is
      // pass TWO replaying a declaration pass ONE already made canonical --
      // pushing `s` would orphan the block's children (see declareState's
      // doc). `phantomAncestors: true` -- a dotted id's auto-created
      // ANCESTOR segments (`state S.I { ... }`'s phantom `S`) get upstream's
      // GroupType.PACKAGE treatment, never autonom (declareState's doc,
      // mission A4 Phase L iter 10).
      pushScope(ps, declareState(ps, s, pass, { phantomAncestors: true }));
    },
  },

  // -------------------------------------------------------------------------
  // 7. Frame declaration with open brace/begin — composite frame
  //    container. frame Foo { | frame Foo begin | frame 'Display' as Foo {
  //    CommandCreatePackage2#isEligibleFor -> ONE/TWO/THREE (structural).
  // @see ~/git/plantuml/.../statediagram/command/CommandCreatePackage2.java
  // -------------------------------------------------------------------------
  {
    pattern: new RegExp(
      `^frame\\s+${ID_ALT}\\s*${STEREO_OPT}${URL_OPT}\\s*${COLOR_OPT}\\s*${LINECOLOR_OPT}${BRACE_OR_BEGIN}`,
      'i',
    ),
    passes: ['one', 'two'],
    execute(ps, match, pass) {
      const { display, id } = extractDisplayAndId(match, 1, 2, 3, 4);
      const colorRaw = match[6];
      const lineColorRaw = match[7];

      const s = makeState(id, display, 'normal', {
        ...(colorRaw !== undefined ? { color: colorRaw } : {}),
        ...(lineColorRaw !== undefined ? { lineColor: lineColorRaw } : {}),
        container: 'frame',
      });
      // See rule 6's comment: push the CANONICAL declareState() return, not
      // `s` -- and mark auto-created ancestors phantom for the same reason.
      pushScope(ps, declareState(ps, s, pass, { phantomAncestors: true }));
    },
  },

  // -------------------------------------------------------------------------
  // 8. State declaration with stereotype (pseudostates), no braces.
  //    state choice <<choice>> | state 'My State' as MS <<choice>> |
  //    state F <<start>> | state F<<start>>[[{tooltip}]] | state F <<choice>> $tagX
  //    CommandCreateState#isEligibleFor -> ONE/TWO/THREE (structural).
  // @see ~/git/plantuml/.../statediagram/command/CommandCreateState.java
  // -------------------------------------------------------------------------
  {
    pattern: new RegExp(
      `^state\\s+${ID_ALT}\\s*<<([^<>]+)>>${TAGS_OPT}${URL_OPT}\\s*${COLOR_OPT}\\s*${LINECOLOR_OPT}\\s*$`,
      'i',
    ),
    passes: ['one', 'two'],
    execute(ps, match, pass) {
      const { display, id } = extractDisplayAndId(match, 1, 2, 3, 4);
      const stereotypeRaw = match[5]!;
      const tags = parseTags(match[6]);
      const colorRaw = match[7];
      const lineColorRaw = match[8];
      const kind = stereotypeToKind(stereotypeRaw);

      const s = makeState(id, display, kind, {
        stereotype: stereotypeRaw,
        ...(colorRaw !== undefined ? { color: colorRaw } : {}),
        ...(lineColorRaw !== undefined ? { lineColor: lineColorRaw } : {}),
        ...(tags !== undefined ? { tags } : {}),
      });
      declareState(ps, s, pass);
    },
  },

  // -------------------------------------------------------------------------
  // 9. Plain state declaration, with optional inline description line.
  //    state Active | state 'My State' as MS | state Active #pink
  //    state Active ##[dashed] | state Active #line.dashed
  //    state Active : some description text | state Active [[{tooltip}]] |
  //    state Active $tagX $tagY
  //    CommandCreateState#isEligibleFor -> ONE/TWO/THREE (structural); the
  //    inline ADDFIELD description text is set only inside upstream's
  //    `currentPass == ParserPass.ONE` guard, mirrored below. No stereotype
  //    slot here — a stereotyped, brace-less declaration always matches
  //    rule 8 above first (mandatory `<<...>>` there vs. none here).
  // @see ~/git/plantuml/.../statediagram/command/CommandCreateState.java (ADDFIELD group)
  // -------------------------------------------------------------------------
  {
    pattern: new RegExp(
      `^state\\s+${ID_ALT}${TAGS_OPT}${URL_OPT}\\s*${COLOR_OPT}\\s*${LINECOLOR_OPT}\\s*(?::\\s*(.*))?$`,
      'i',
    ),
    passes: ['one', 'two'],
    execute(ps, match, pass) {
      const { display, id } = extractDisplayAndId(match, 1, 2, 3, 4);
      const tags = parseTags(match[5]);
      const colorRaw = match[6];
      const lineColorRaw = match[7];
      const addField = match[8];

      const s = makeState(id, display, 'normal', {
        ...(colorRaw !== undefined ? { color: colorRaw } : {}),
        ...(lineColorRaw !== undefined ? { lineColor: lineColorRaw } : {}),
        ...(tags !== undefined ? { tags } : {}),
      });
      // Use the CANONICAL object (not the throwaway `s`) for the inline
      // description -- `s` is discarded whenever this id already resolved
      // to an existing entity (T4-fixed forward reference, global reuse,
      // or this same pass-ONE declaration replaying on pass TWO); writing
      // to `s` in that case would silently drop the description line.
      const canonical = declareState(ps, s, pass);
      if (pass === 'one' && addField !== undefined && addField !== '') addDescriptionLine(canonical, addField);
    },
  },
];
