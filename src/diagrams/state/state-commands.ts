/**
 * Command-dispatch table for the state parser: an array of
 * `{ pattern, passes, execute }` entries tested against each trimmed line in
 * priority order. First match wins; `passes` then gates whether `execute`
 * actually runs — mirrors upstream's `Command#isEligibleFor(ParserPass)`
 * check, which happens AFTER a command's pattern already claimed the line
 * (a non-eligible match still "owns" the line — it just no-ops — rather
 * than falling through to a later, less-specific rule).
 *
 * Order mirrors `StateDiagramFactory#initCommandsList` where it matters
 * (structural symbols before declarations before notes before the generic
 * `CODE : text` body-line command) — see each rule's comment for its
 * upstream citation. See `state-parse-state.ts`'s `Pass` doc for the
 * two-pass architecture (mission A4/Phase L, ParserPass ONE/TWO/THREE port).
 * @see ~/git/plantuml/.../statediagram/StateDiagramFactory.java
 */

import type { Transition, StateKind } from './ast.js';
import {
  type ParseState,
  type Pass,
  currentScope,
  emitTransition,
  makeState,
  addDescriptionLine,
  popScope,
  pushScope,
  stereotypeToKind,
} from './state-parse-state.js';
import { declareState, ensureState, resolveDescriptionTarget } from './state-parse-resolve.js';
import { extractDisplayAndId, parseLabel } from './state-parse-helpers.js';
import { parseTransitionLine } from './state-transitions.js';
import { NOTE_COMMANDS } from './state-commands-notes.js';

export interface Command {
  pattern: RegExp;
  /**
   * Which pass(es) `execute`'s side effects actually apply on. The pattern
   * is tested (and can match) on EVERY pass regardless of this list —
   * eligibility is checked only after a match is found (`parser.ts`'s
   * `dispatchCommand`), matching upstream's `isEligibleFor` semantics.
   *
   * The two multi-line note openers (attached/freestanding) are the one
   * deliberate exception: they list BOTH passes so the block is always
   * opened/swallowed regardless of pass — their real single-pass side
   * effect (pushing into `ast.notes`) is instead gated at the CLOSER, in
   * `parser.ts`'s `handlePendingNoteLine`/`noteFinalizePass`. Doing it
   * there (not here) is what stops a bracket-closed attached note's `}`
   * from being misread as a composite-close (rule 5, ALL-pass-eligible) on
   * whichever pass the note "isn't really" eligible for.
   */
  passes: readonly Pass[];
  execute(ps: ParseState, match: RegExpExecArray, pass: Pass): void;
}

// ---------------------------------------------------------------------------
// Shared regex fragments (declaration id/decoration grammar)
// ---------------------------------------------------------------------------

/** `'Quoted' as Id | "Quoted" as Id | BareId` — CommandCreateState's CODE
 *  alternation. The alias/bareName charset is `[\w.]+`, mirroring upstream's
 *  `[%pLN_.]+` (unicode letter/digit/underscore/dot -> ASCII `\w.` here; see
 *  state-transitions.ts's ENT doc for why the ASCII-only charset is an
 *  acknowledged divergence). This must NOT be `\S+`: with everything after
 *  the id optional (STEREO_OPT/URL_OPT/COLOR_OPT), a greedy `\S+` swallows
 *  an immediately-adjacent `<<stereotype>>` whole (no backtrack is ever
 *  forced) — `state "a_1" as a<<comp>> {` captured alias `a<<comp>>` instead
 *  of `a`, so the composite never opened. `[\w.]+` stops at `<` on its own.
 *  3 groups: quotedDisplay, alias, bareName — feeds `extractDisplayAndId`
 *  directly.
 * @see ~/git/plantuml/.../statediagram/command/CommandCreateState.java:86,96-98 (CODE1-4, `[%pLN_.]+`) */
const ID_ALT = String.raw`(?:(?:'|")([^'"]+)(?:'|")\s+as\s+([\w.]+)|([\w.]+))`;

/** Optional `<<stereotype>>` — upstream allows `*` inside (`history*`), so
 *  this is NOT `\w+`. */
const STEREO_OPT = String.raw`(?:<<([\w*]+)>>)?`;
/** Optional `[[url]]` / `[[{tooltip}]]` / `[[url{tooltip}label]]` —
 *  matched and discarded; `State` carries no url field, same
 *  matching-and-discarding precedent as class-object-commands.ts's `URL`
 *  fragment. Upstream's real grammar (`UrlBuilder.getRegexp()`) has several
 *  quoted/tooltip/label permutations; since the value is thrown away either
 *  way, a single "swallow anything but `]`" form suffices. Sits between the
 *  stereotype and color slots in every state/frame declaration rule, per
 *  `UrlBuilder.OPTIONAL`'s position in `CommandCreateState`/
 *  `CommandCreatePackageState`/`CommandCreatePackage2`'s regex concat.
 * @see ~/git/plantuml/.../url/UrlBuilder.java:48-49 (MANDATORY/OPTIONAL) */
const URL_OPT = String.raw`(?:\s*\[\[[^\]]*\]\])?`;
const COLOR_OPT = String.raw`(?:(#\w+))?`;
/** `state X { ... }` closes with `}`/`end state`; the opener accepts either
 *  a trailing `{` (zero-or-more leading space) or ` begin` (one-or-more
 *  leading space) — @see CommandCreatePackageState.java:108-109 */
const BRACE_OR_BEGIN = String.raw`(?:\s*\{|\s+begin)\s*$`;

// ---------------------------------------------------------------------------
// Order matters: patterns are tested top-to-bottom; first match wins.
// ---------------------------------------------------------------------------

export const COMMANDS: readonly Command[] = [
  // -------------------------------------------------------------------------
  // 1. hide|show empty description — CommandHideEmptyDescription. Tried
  //    before the generic hide/show ignore rule below. No `isEligibleFor`
  //    override upstream -> base-class default ParserPass.ONE only.
  // @see ~/git/plantuml/.../statediagram/command/CommandHideEmptyDescription.java
  // @see ~/git/plantuml/.../command/SingleLineCommand2.java#isEligibleFor
  // -------------------------------------------------------------------------
  {
    pattern: /^(hide|show)\s+empty\s+description\s*$/i,
    passes: ['one'],
    execute(ps, match) {
      ps.ast.hideEmptyDescription = match[1]!.toLowerCase() === 'hide';
    },
  },

  // -------------------------------------------------------------------------
  // 2. left to right direction | top to bottom direction — CommandRankDir.
  //    No `isEligibleFor` override -> base-class default PASS ONE only.
  // @see ~/git/plantuml/.../command/CommandRankDir.java
  // -------------------------------------------------------------------------
  {
    pattern: /^(left\s+to\s+right|top\s+to\s+bottom)\s+direction\s*$/i,
    passes: ['one'],
    execute(ps, match) {
      ps.ast.rankdir = match[1]!.toLowerCase().startsWith('left') ? 'left-to-right' : 'top-to-bottom';
    },
  },

  // -------------------------------------------------------------------------
  // 3. Ignore lines: skinparam, title, scale, hide, show, comment (').
  //    'note' is intentionally NOT in this list — see the note commands
  //    below (rules 10-14); a generic ignore here would shadow them. No-op
  //    bodies, so the pass choice has no observable effect — PASS ONE
  //    picked for consistency with the other simple/single commands above.
  // -------------------------------------------------------------------------
  {
    pattern: /^(?:skinparam|title|scale|hide|show)\b/i,
    passes: ['one'],
    execute() {
      /* ignored */
    },
  },
  {
    pattern: /^'/,
    passes: ['one'],
    execute() {
      /* comment */
    },
  },

  // -------------------------------------------------------------------------
  // 4. Concurrent region separator `--`/`||` (one or more repeats).
  //    Must come before transition patterns (which also use `-`/`>`).
  //    CommandConcurrentState#isEligibleFor -> ONE/TWO/THREE (structural;
  //    must replay identically on every pass so nesting stays correct).
  //    Pass ONE allocates a new region; pass TWO (revisiting the SAME
  //    persistent scope) just advances the cursor to the region pass ONE
  //    already allocated at this same textual position -- see
  //    `Scope.regionCursor`'s doc for why a plain re-push would duplicate
  //    regions.
  // @see ~/git/plantuml/.../statediagram/command/CommandConcurrentState.java
  // -------------------------------------------------------------------------
  {
    pattern: /^(?:--+|\|\|+)\s*$/,
    passes: ['one', 'two'],
    execute(ps, match, pass) {
      const scope = currentScope(ps);
      scope.hasConcurrency = true;
      if (pass === 'one') scope.regions.push([]);
      scope.regionCursor++;
    },
  },

  // -------------------------------------------------------------------------
  // 5. Close composite state/frame block: `}` or `end state` (optional
  //    single space) — CommandEndState closes whatever group is open,
  //    regardless of whether it was opened by `state {`/`state begin` or
  //    `frame {`/`frame begin`. CommandEndState#isEligibleFor -> ONE/TWO/
  //    THREE (structural; must replay every pass).
  // @see ~/git/plantuml/.../statediagram/command/CommandEndState.java
  // -------------------------------------------------------------------------
  {
    pattern: /^(?:\}|end\s?state)\s*$/i,
    passes: ['one', 'two'],
    execute(ps) {
      popScope(ps);
    },
  },

  // -------------------------------------------------------------------------
  // 6. State declaration with open brace/begin — composite state.
  //    state Foo { | state Foo begin | state 'Display' as Foo { |
  //    state Foo #color { | state Foo <<stereotype>> { |
  //    state Foo [[{tooltip}]] {
  //    CommandCreatePackageState#isEligibleFor -> ONE/TWO/THREE (structural;
  //    `declareState`'s `pass` arg gates the ONE-only content mutation).
  // @see ~/git/plantuml/.../statediagram/command/CommandCreatePackageState.java
  // -------------------------------------------------------------------------
  {
    pattern: new RegExp(
      `^state\\s+${ID_ALT}\\s*${STEREO_OPT}${URL_OPT}\\s*${COLOR_OPT}${BRACE_OR_BEGIN}`,
      'i',
    ),
    passes: ['one', 'two'],
    execute(ps, match, pass) {
      const { display, id } = extractDisplayAndId(match, 1, 2, 3);
      const stereotypeRaw = match[4];
      const colorRaw = match[5];
      const kind: StateKind = stereotypeRaw !== undefined ? stereotypeToKind(stereotypeRaw) : 'normal';

      const s = makeState(id, display, kind, {
        ...(colorRaw !== undefined ? { color: colorRaw } : {}),
        ...(stereotypeRaw !== undefined ? { stereotype: stereotypeRaw } : {}),
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
  // 7. Frame declaration with open brace/begin — composite "frame"
  //    container. frame Foo { | frame Foo begin | frame 'Display' as Foo {
  //    CommandCreatePackage2#isEligibleFor -> ONE/TWO/THREE (structural).
  // @see ~/git/plantuml/.../statediagram/command/CommandCreatePackage2.java
  // -------------------------------------------------------------------------
  {
    pattern: new RegExp(
      `^frame\\s+${ID_ALT}\\s*${STEREO_OPT}${URL_OPT}\\s*${COLOR_OPT}${BRACE_OR_BEGIN}`,
      'i',
    ),
    passes: ['one', 'two'],
    execute(ps, match, pass) {
      const { display, id } = extractDisplayAndId(match, 1, 2, 3);
      const colorRaw = match[5];

      const s = makeState(id, display, 'normal', {
        ...(colorRaw !== undefined ? { color: colorRaw } : {}),
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
  //    state F <<start>> | state F<<start>>[[{tooltip}]]
  //    CommandCreateState#isEligibleFor -> ONE/TWO/THREE (structural).
  // @see ~/git/plantuml/.../statediagram/command/CommandCreateState.java
  // -------------------------------------------------------------------------
  {
    pattern: new RegExp(`^state\\s+${ID_ALT}\\s*<<([\\w*]+)>>${URL_OPT}\\s*${COLOR_OPT}\\s*$`, 'i'),
    passes: ['one', 'two'],
    execute(ps, match, pass) {
      const { display, id } = extractDisplayAndId(match, 1, 2, 3);
      const stereotypeRaw = match[4]!;
      const colorRaw = match[5];
      const kind = stereotypeToKind(stereotypeRaw);

      const s = makeState(id, display, kind, {
        stereotype: stereotypeRaw,
        ...(colorRaw !== undefined ? { color: colorRaw } : {}),
      });
      declareState(ps, s, pass);
    },
  },

  // -------------------------------------------------------------------------
  // 9. Plain state declaration, with optional inline description line.
  //    state Active | state 'My State' as MS | state Active #pink
  //    state Active : some description text | state Active [[{tooltip}]]
  //    CommandCreateState#isEligibleFor -> ONE/TWO/THREE (structural); the
  //    inline ADDFIELD description text is set only inside upstream's
  //    `currentPass == ParserPass.ONE` guard, mirrored below. No stereotype
  //    slot here — a stereotyped, brace-less declaration always matches
  //    rule 8 above first (mandatory `<<...>>` there vs. none here).
  // @see ~/git/plantuml/.../statediagram/command/CommandCreateState.java (ADDFIELD group)
  // -------------------------------------------------------------------------
  {
    pattern: new RegExp(`^state\\s+${ID_ALT}${URL_OPT}\\s*${COLOR_OPT}\\s*(?::\\s*(.*))?$`, 'i'),
    passes: ['one', 'two'],
    execute(ps, match, pass) {
      const { display, id } = extractDisplayAndId(match, 1, 2, 3);
      const colorRaw = match[4];
      const addField = match[5];

      const s = makeState(id, display, 'normal', {
        ...(colorRaw !== undefined ? { color: colorRaw } : {}),
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

  ...NOTE_COMMANDS,

  // -------------------------------------------------------------------------
  // 15. Standalone description line: CODE : text (no `state` keyword) —
  //     CommandAddField. Auto-creates the target state if absent, or
  //     self-references the enclosing composite when CODE names it.
  //     CommandAddField#isEligibleFor -> ParserPass.ONE only.
  // @see ~/git/plantuml/.../statediagram/command/CommandAddField.java
  // -------------------------------------------------------------------------
  {
    pattern: /^(\w+(?:\.\w+)*|"[^"]+")\s*:\s*(.*)$/,
    passes: ['one'],
    execute(ps, match) {
      const raw = match[1]!;
      const code = raw.startsWith('"') ? raw.slice(1, -1) : raw;
      const target = resolveDescriptionTarget(ps, code);
      if (target !== undefined) addDescriptionLine(target, match[2]!.trim());
    },
  },

  // -------------------------------------------------------------------------
  // 16. Transition (forward `-->` and reverse `<--`), with decorations —
  //     see state-transitions.ts for the full grammar. This entry is a
  //     cheap pre-filter (any '<' or '>' — direction-abbreviated arrows
  //     like `-right->` never have two ADJACENT dashes, so a literal
  //     `-->`/`<--` substring test would miss them); `parseTransitionLine`
  //     does the real (anchored) parse against the full trimmed line
  //     (`match.input`) and safely returns `null` for any false-positive
  //     gate match (e.g. a line that merely contains '>' for some other
  //     reason but isn't a transition).
  //     CommandLinkStateCommon#isEligibleFor -> ParserPass.TWO only -- this
  //     is what makes global by-name reuse (state-parse-state.ts's
  //     `resolveExistingState`) safe: every declaration in the WHOLE
  //     document has already been created (pass ONE) by the time ANY
  //     transition resolves an endpoint here.
  // @see ~/git/plantuml/.../statediagram/command/CommandLinkState.java
  // @see ~/git/plantuml/.../statediagram/command/CommandLinkStateReverse.java
  // @see ~/git/plantuml/.../statediagram/command/CommandLinkStateCommon.java#isEligibleFor
  // -------------------------------------------------------------------------
  {
    pattern: /[<>]/,
    passes: ['two'],
    execute(ps, match) {
      const parsed = parseTransitionLine(match.input);
      if (parsed === null) return;
      const { rawLabel, ...rest } = parsed;

      // A dotted endpoint's RESOLVED canonical id (the LEAF segment's own
      // local name, e.g. "I" for "S.I") can differ from the raw written
      // text -- `Transition.from`/`.to` must carry the id that actually
      // matches a real `State.id` in the tree (downstream FlatLink/
      // isAutarkic/DOT-endpoint resolution matches by exact id string), not
      // the as-written text. `ensureState` returns `undefined` only for the
      // `'[*]'` sentinel, which stays literal (mission A4 Phase L iter 10).
      const fromState = ensureState(ps, rest.from);
      const toState = ensureState(ps, rest.to);

      const labelParts = parseLabel(rawLabel);
      const t: Transition = {
        ...rest,
        from: fromState?.id ?? rest.from,
        to: toState?.id ?? rest.to,
        ...labelParts,
      };
      emitTransition(ps, t);
    },
  },

  // -------------------------------------------------------------------------
  // 17. set separator <value> | set namespaceseparator <value> —
  //     CommandNamespaceSeparator. `none`/`null` (case-insensitive) disables
  //     dotted-id splitting entirely (`ParseState.separator = null`); any
  //     other bare token becomes the new separator (state diagrams default
  //     to `.` -- StateDiagram.java:62). No `isEligibleFor` override
  //     upstream -> base-class default ParserPass.ONE only; every corpus
  //     fixture writes this pragma before any declaration, so pass ONE's
  //     own declarations already see the final value (`ParseState.separator`
  //     doc, state-parse-state.ts).
  // @see ~/git/plantuml/.../classdiagram/command/CommandNamespaceSeparator.java
  // -------------------------------------------------------------------------
  {
    pattern: /^set\s+(?:separator|namespaceseparator)\s+(\S+)\s*$/i,
    passes: ['one'],
    execute(ps, match) {
      const raw = match[1]!;
      ps.separator = /^(?:none|null)$/i.test(raw) ? null : raw;
    },
  },
];
