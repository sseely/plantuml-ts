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

import type { Transition } from './ast.js';
import {
  type ParseState,
  type Pass,
  currentScope,
  emitTransition,
  addDescriptionLine,
  popScope,
  nextCreationIndex,
  nextConcurrentGlobalId,
  concurrentRegionScopeId,
} from './state-parse-state.js';
import { ensureState, resolveDescriptionTarget } from './state-parse-resolve.js';
import { parseLabel } from './state-parse-helpers.js';
import { parseTransitionLine } from './state-transitions.js';
import { NOTE_COMMANDS } from './state-commands-notes.js';
import { JSON_COMMANDS } from './state-json-commands.js';
import { DECLARATION_COMMANDS } from './state-commands-declarations.js';

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
  // 3. Ignore lines: skinparam, scale, hide, show, comment ('). `title` is
  //    NOT in this list -- it is claimed by the shared annotation matcher
  //    (matchAnnotationCommand, consulted before COMMANDS in parser.ts) so
  //    `title ...`/`title\n...\nend title` lands in `ps.ast.annotations.title`
  //    instead of being silently dropped. 'note' is intentionally NOT in
  //    this list — see the note commands below (rules 10-14); a generic
  //    ignore here would shadow them. No-op bodies, so the pass choice has
  //    no observable effect — PASS ONE picked for consistency with the
  //    other simple/single commands above.
  // -------------------------------------------------------------------------
  {
    pattern: /^(?:skinparam|scale|hide|show)\b/i,
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
  // 3b. remove|restore <target> — CommandRemoveRestore. This class lives in
  //     the `classdiagram.command` package, NOT `statediagram.command` --
  //     StateDiagramFactory registers it verbatim (same shared
  //     CucaDiagram#removeOrRestore/HideOrShow machinery the class engine
  //     uses). Stored raw; evaluated lazily at the layout-input boundary
  //     (layout.ts -> filterRemovedEntities, state-directives.ts), mirroring
  //     upstream's export-time isRemoved(). No `isEligibleFor` override
  //     upstream -> base-class default ParserPass.ONE only (harmless either
  //     way: directives are just accumulated into a list, not resolved
  //     until export).
  // @see ~/git/plantuml/.../classdiagram/command/CommandRemoveRestore.java:55-90
  // @see ~/git/plantuml/.../statediagram/StateDiagramFactory.java:87
  // -------------------------------------------------------------------------
  {
    pattern: /^(remove|restore)\s+(\S.*)$/i,
    passes: ['one'],
    execute(ps, match) {
      (ps.ast.removeDirectives ??= []).push({
        kind: 'removerestore',
        action: match[1]!.toLowerCase() === 'restore' ? 'restore' : 'remove',
        what: match[2]!.trim(),
      });
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
      if (pass === 'one') {
        scope.regions.push([]);
        // mission G4 S7 (mechanism 10, sub-pattern a): jar's own
        // `concurrentState()` constructs a real (ticked) `Entity` here
        // (`GroupType.CONCURRENT_STATE`, `CucaDiagram#createGroup` -> `new
        // Entity(...)`) that is NEVER individually rendered as its own box
        // -- burn the tick (discard the value) so this region's own members
        // correctly skip a slot, matching jar's real gap. Pass ONE only
        // (mirrors `registerStateInto`'s own real-creation-only discipline
        // -- pass TWO just re-navigates the already-built region tree, no
        // new jar tick fires on the replay). See `ParseState
        // .creationCounter`'s own doc comment (state-parse-state.ts).
        nextCreationIndex(ps);
        // mission G4 S14 (CONC-region bare-name global numbering): burn a
        // SEPARATE global `cpt2` tick too, mirroring jar's own
        // `concurrentState()` (`getUniqueSequence2(CONCURRENT_PREFIX)`) --
        // see `ParseState.concurrentGlobalCounter`'s own doc comment. The
        // internal (owner-local) `concurrentRegionScopeId` key is computed
        // from the region's local number, which at this exact point is
        // `scope.regions.length - 1` (the array index the just-pushed
        // region now occupies) -- identical to what `scope.regionCursor`
        // becomes one line below.
        const localRegionNumber = scope.regions.length - 1;
        const ownerId = scope.owner?.id ?? '';
        ps.concurrentGlobalIds.set(
          concurrentRegionScopeId(ownerId, localRegionNumber),
          nextConcurrentGlobalId(ps),
        );
      }
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
  // 6-9. State/frame declarations (composite state, frame, stereotyped leaf,
  //      plain leaf) -- moved to state-commands-declarations.ts (pure move,
  //      500-line file cap; mission A4 Phase L iter 13). See that file for
  //      per-rule citations and the shared ID_ALT/STEREO_OPT/TAGS_OPT/etc.
  //      grammar fragments.
  // -------------------------------------------------------------------------
  ...DECLARATION_COMMANDS,

  ...NOTE_COMMANDS,

  // -------------------------------------------------------------------------
  // 14b-14c. `json Name { ... }` / `json Name value` — CommandCreateJson /
  //          CommandCreateJsonSingleLine, moved to state-json-commands.ts
  //          (mission A4 Phase L iter 20; that file's own doc for why). Both
  //          classes live in the shared `objectdiagram.command` package,
  //          registered verbatim by StateDiagramFactory right before
  //          CommonCommands.addCommonCommands1 — placed here (after notes,
  //          before rule 15) to mirror that registration order.
  // @see ~/git/plantuml/.../statediagram/StateDiagramFactory.java:115-116
  // -------------------------------------------------------------------------
  ...JSON_COMMANDS,

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
      const fromState = ensureState(ps, rest.from, undefined, true);
      const toState = ensureState(ps, rest.to, undefined, false);

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
