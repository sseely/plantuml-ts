/**
 * Command-dispatch table for the state parser: an array of
 * `{ pattern, execute }` entries tested against each trimmed line in
 * priority order. First match wins.
 *
 * Order mirrors `StateDiagramFactory#initCommandsList` where it matters
 * (structural symbols before declarations before notes before the generic
 * `CODE : text` body-line command) — see each rule's comment for its
 * upstream citation.
 * @see ~/git/plantuml/.../statediagram/StateDiagramFactory.java
 */

import type { NotePosition, Transition, StateKind } from './ast.js';
import {
  type ParseState,
  currentScope,
  declareState,
  emitTransition,
  ensureState,
  extractDisplayAndId,
  makeState,
  parseLabel,
  addDescriptionLine,
  resolveDescriptionTarget,
  popScope,
  pushScope,
  stereotypeToKind,
} from './state-parse-state.js';
import { parseTransitionLine } from './state-transitions.js';
import {
  NOTE_COLOR,
  NOTE_STEREO,
  NOTE_TARGET,
  NOTE_URL,
  NOTE_ON_LINK_RE,
  addNote,
  addFreestandingNote,
  applyNoteOnLink,
} from './state-notes.js';

interface Command {
  pattern: RegExp;
  execute(ps: ParseState, match: RegExpExecArray): void;
}

// ---------------------------------------------------------------------------
// Shared regex fragments (declaration id/decoration grammar)
// ---------------------------------------------------------------------------

/** `'Quoted' as Id | "Quoted" as Id | BareId` — CommandCreateState's CODE
 *  alternation, minus the unicode `%pLN` charset (see state-transitions.ts's
 *  ENT doc for why the ASCII-only charset is an acknowledged divergence).
 *  3 groups: quotedDisplay, alias, bareName — feeds `extractDisplayAndId`
 *  directly. */
const ID_ALT = String.raw`(?:(?:'|")([^'"]+)(?:'|")\s+as\s+(\S+)|(\S+))`;

/** Optional `<<stereotype>>` — upstream allows `*` inside (`history*`), so
 *  this is NOT `\w+`. */
const STEREO_OPT = String.raw`(?:<<([\w*]+)>>)?`;
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
  //    before the generic hide/show ignore rule below.
  // @see ~/git/plantuml/.../statediagram/command/CommandHideEmptyDescription.java
  // -------------------------------------------------------------------------
  {
    pattern: /^(hide|show)\s+empty\s+description\s*$/i,
    execute(ps, match) {
      ps.ast.hideEmptyDescription = match[1]!.toLowerCase() === 'hide';
    },
  },

  // -------------------------------------------------------------------------
  // 2. left to right direction | top to bottom direction — CommandRankDir.
  // @see ~/git/plantuml/.../command/CommandRankDir.java
  // -------------------------------------------------------------------------
  {
    pattern: /^(left\s+to\s+right|top\s+to\s+bottom)\s+direction\s*$/i,
    execute(ps, match) {
      ps.ast.rankdir = match[1]!.toLowerCase().startsWith('left') ? 'left-to-right' : 'top-to-bottom';
    },
  },

  // -------------------------------------------------------------------------
  // 3. Ignore lines: skinparam, title, scale, hide, show, comment (').
  //    'note' is intentionally NOT in this list — see the note commands
  //    below (rules 10-14); a generic ignore here would shadow them.
  // -------------------------------------------------------------------------
  {
    pattern: /^(?:skinparam|title|scale|hide|show)\b/i,
    execute() {
      /* ignored */
    },
  },
  {
    pattern: /^'/,
    execute() {
      /* comment */
    },
  },

  // -------------------------------------------------------------------------
  // 4. Concurrent region separator `--`/`||` (one or more repeats).
  //    Must come before transition patterns (which also use `-`/`>`).
  // @see ~/git/plantuml/.../statediagram/command/CommandConcurrentState.java
  // -------------------------------------------------------------------------
  {
    pattern: /^(?:--+|\|\|+)\s*$/,
    execute(ps) {
      const scope = currentScope(ps);
      scope.hasConcurrency = true;
      scope.regions.push([]);
    },
  },

  // -------------------------------------------------------------------------
  // 5. Close composite state/frame block: `}` or `end state` (optional
  //    single space) — CommandEndState closes whatever group is open,
  //    regardless of whether it was opened by `state {`/`state begin` or
  //    `frame {`/`frame begin`.
  // @see ~/git/plantuml/.../statediagram/command/CommandEndState.java
  // -------------------------------------------------------------------------
  {
    pattern: /^(?:\}|end\s?state)\s*$/i,
    execute(ps) {
      popScope(ps);
    },
  },

  // -------------------------------------------------------------------------
  // 6. State declaration with open brace/begin — composite state.
  //    state Foo { | state Foo begin | state 'Display' as Foo { |
  //    state Foo #color { | state Foo <<stereotype>> {
  // @see ~/git/plantuml/.../statediagram/command/CommandCreatePackageState.java
  // -------------------------------------------------------------------------
  {
    pattern: new RegExp(`^state\\s+${ID_ALT}\\s*${STEREO_OPT}\\s*${COLOR_OPT}${BRACE_OR_BEGIN}`, 'i'),
    execute(ps, match) {
      const { display, id } = extractDisplayAndId(match, 1, 2, 3);
      const stereotypeRaw = match[4];
      const colorRaw = match[5];
      const kind: StateKind = stereotypeRaw !== undefined ? stereotypeToKind(stereotypeRaw) : 'normal';

      const s = makeState(id, display, kind, {
        ...(colorRaw !== undefined ? { color: colorRaw } : {}),
        ...(stereotypeRaw !== undefined ? { stereotype: stereotypeRaw } : {}),
      });
      declareState(ps, s);
      pushScope(ps, s);
    },
  },

  // -------------------------------------------------------------------------
  // 7. Frame declaration with open brace/begin — composite "frame"
  //    container. frame Foo { | frame Foo begin | frame 'Display' as Foo {
  // @see ~/git/plantuml/.../statediagram/command/CommandCreatePackage2.java
  // -------------------------------------------------------------------------
  {
    pattern: new RegExp(`^frame\\s+${ID_ALT}\\s*${STEREO_OPT}\\s*${COLOR_OPT}${BRACE_OR_BEGIN}`, 'i'),
    execute(ps, match) {
      const { display, id } = extractDisplayAndId(match, 1, 2, 3);
      const colorRaw = match[5];

      const s = makeState(id, display, 'normal', {
        ...(colorRaw !== undefined ? { color: colorRaw } : {}),
        container: 'frame',
      });
      declareState(ps, s);
      pushScope(ps, s);
    },
  },

  // -------------------------------------------------------------------------
  // 8. State declaration with stereotype (pseudostates), no braces.
  //    state choice <<choice>> | state 'My State' as MS <<choice>> |
  //    state F <<start>>
  // @see ~/git/plantuml/.../statediagram/command/CommandCreateState.java
  // -------------------------------------------------------------------------
  {
    pattern: new RegExp(`^state\\s+${ID_ALT}\\s*<<([\\w*]+)>>\\s*${COLOR_OPT}\\s*$`, 'i'),
    execute(ps, match) {
      const { display, id } = extractDisplayAndId(match, 1, 2, 3);
      const stereotypeRaw = match[4]!;
      const colorRaw = match[5];
      const kind = stereotypeToKind(stereotypeRaw);

      const s = makeState(id, display, kind, {
        stereotype: stereotypeRaw,
        ...(colorRaw !== undefined ? { color: colorRaw } : {}),
      });
      declareState(ps, s);
    },
  },

  // -------------------------------------------------------------------------
  // 9. Plain state declaration, with optional inline description line.
  //    state Active | state 'My State' as MS | state Active #pink
  //    state Active : some description text
  // @see ~/git/plantuml/.../statediagram/command/CommandCreateState.java (ADDFIELD group)
  // -------------------------------------------------------------------------
  {
    pattern: new RegExp(`^state\\s+${ID_ALT}\\s*${COLOR_OPT}\\s*(?::\\s*(.*))?$`, 'i'),
    execute(ps, match) {
      const { display, id } = extractDisplayAndId(match, 1, 2, 3);
      const colorRaw = match[4];
      const addField = match[5];

      const s = makeState(id, display, 'normal', {
        ...(colorRaw !== undefined ? { color: colorRaw } : {}),
      });
      declareState(ps, s);
      if (addField !== undefined && addField !== '') addDescriptionLine(s, addField);
    },
  },

  // -------------------------------------------------------------------------
  // 10. Multi-line attached note opener: note <pos> [of <State>] [<<s>>]
  //     [#color] [[[url]]] — ending in `{` (bracket form, closed by `}`)
  //     or nothing (closed by `end note`). The single-line form (rule 11)
  //     ends in a MANDATORY `: text` tail that this pattern's optional
  //     trailing `{` cannot satisfy, so there is no overlap between them.
  // @see ~/git/plantuml/.../command/note/CommandFactoryNoteOnEntity.java
  // -------------------------------------------------------------------------
  {
    pattern: new RegExp(
      String.raw`^note\s+(left|right|top|bottom)(?:\s+of\s+` +
        NOTE_TARGET +
        `)?` +
        NOTE_STEREO +
        NOTE_COLOR +
        NOTE_URL +
        String.raw`\s*(\{)?\s*$`,
      'i',
    ),
    execute(ps, match) {
      const position = match[1]!.toLowerCase() as NotePosition;
      const target = match[2];
      ps.pendingNote = {
        kind: 'attached',
        target: target ?? ps.lastEntity ?? undefined,
        implicitTarget: target === undefined,
        position,
        textLines: [],
        ...(match[3] !== undefined ? { closer: 'brace' } : {}),
      };
    },
  },

  // -------------------------------------------------------------------------
  // 11. Single-line attached note: note <pos> [of <State>] [<<s>>][#c][[u]] : text
  //     `of <State>` absent -> attaches to the last created entity.
  // @see ~/git/plantuml/.../command/note/CommandFactoryNoteOnEntity.java:92-116 (regex)
  //      :293-301 (idShort==null -> getLastEntity(); null -> no-op here)
  // -------------------------------------------------------------------------
  {
    pattern: new RegExp(
      String.raw`^note\s+(left|right|top|bottom)(?:\s+of\s+` +
        NOTE_TARGET +
        `)?` +
        NOTE_STEREO +
        NOTE_COLOR +
        NOTE_URL +
        String.raw`\s*:\s*(.+)$`,
      'i',
    ),
    execute(ps, match) {
      const target = match[2] ?? ps.lastEntity ?? undefined;
      if (target === undefined) return; // "Nothing to note to" — silent no-op
      const id = addNote(ps.ast, match[1]!.toLowerCase() as NotePosition, target, match[3]!.trim(), {
        implicitTarget: match[2] === undefined,
      });
      ps.lastEntity = id;
    },
  },

  // -------------------------------------------------------------------------
  // 12. `note [pos] on|of link [#color] : text` — attaches to the last
  //     transition parsed WITHIN the currently open scope.
  // @see ~/git/plantuml/.../command/note/CommandFactoryNoteOnLink.java
  // -------------------------------------------------------------------------
  {
    pattern: NOTE_ON_LINK_RE,
    execute(ps, match) {
      applyNoteOnLink(currentScope(ps).transitions, match[1]!);
    },
  },

  // -------------------------------------------------------------------------
  // 13. Multi-line freestanding note opener: note as <alias> [<<s>>] [#c]
  //     (… end note). Unattached.
  // @see ~/git/plantuml/.../command/note/CommandFactoryNote.java:77-89
  // -------------------------------------------------------------------------
  {
    pattern: new RegExp(String.raw`^note\s+as\s+(\w+|"[^"]+")` + NOTE_STEREO + NOTE_COLOR + String.raw`\s*$`, 'i'),
    execute(ps, match) {
      ps.pendingNote = { kind: 'freestanding', alias: match[1]!, textLines: [] };
    },
  },

  // -------------------------------------------------------------------------
  // 14. Single-line freestanding note: note "text" as <alias> [<<s>>][#c].
  //     Creates the note leaf immediately; there is no `end note` to wait
  //     for — a distinct upstream command from 10/11/13
  //     (CommandFactoryNote's singleLine, not CommandFactoryNoteOnEntity).
  // @see ~/git/plantuml/.../command/note/CommandFactoryNote.java:91-107
  // -------------------------------------------------------------------------
  {
    pattern: new RegExp(
      String.raw`^note\s+"([^"]+)"\s+as\s+(\w+|"[^"]+")` + NOTE_STEREO + NOTE_COLOR + String.raw`\s*$`,
      'i',
    ),
    execute(ps, match) {
      const id = addFreestandingNote(ps.ast, match[2]!, match[1]!);
      ps.lastEntity = id;
    },
  },

  // -------------------------------------------------------------------------
  // 15. Standalone description line: CODE : text (no `state` keyword) —
  //     CommandAddField. Auto-creates the target state if absent, or
  //     self-references the enclosing composite when CODE names it.
  // @see ~/git/plantuml/.../statediagram/command/CommandAddField.java
  // -------------------------------------------------------------------------
  {
    pattern: /^(\w+(?:\.\w+)*|"[^"]+")\s*:\s*(.*)$/,
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
  // @see ~/git/plantuml/.../statediagram/command/CommandLinkState.java
  // @see ~/git/plantuml/.../statediagram/command/CommandLinkStateReverse.java
  // -------------------------------------------------------------------------
  {
    pattern: /[<>]/,
    execute(ps, match) {
      const parsed = parseTransitionLine(match.input);
      if (parsed === null) return;
      const { rawLabel, ...rest } = parsed;

      ensureState(ps, rest.from);
      ensureState(ps, rest.to);

      const labelParts = parseLabel(rawLabel);
      const t: Transition = { ...rest, ...labelParts };
      emitTransition(ps, t);
    },
  },
];
