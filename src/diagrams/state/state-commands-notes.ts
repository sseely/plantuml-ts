/**
 * Note-family command rules for the state parser — split out of
 * `state-commands.ts` purely for the project's 500-line file cap (the note
 * family is self-contained: no other rule in `state-commands.ts` reads
 * `NotePosition` or any `state-notes.js` export). Spread into `COMMANDS` at
 * the same priority position (between the plain-state declaration rule and
 * the standalone `CODE : text` rule) — see `state-commands.ts`'s ordering
 * doc for why order matters.
 * @see ~/git/plantuml/.../statediagram/StateDiagramFactory.java
 */

import type { NotePosition } from './ast.js';
import type { Command } from './state-commands.js';
import { currentScope } from './state-parse-state.js';
import {
  NOTE_COLOR,
  NOTE_STEREO,
  NOTE_TARGET,
  NOTE_URL,
  NOTE_ON_LINK_RE,
  NOTE_ON_LINK_MULTI_RE,
  addNote,
  addFreestandingNote,
  applyNoteOnLink,
} from './state-notes.js';

/** Parse an optional `left|right|top|bottom` capture, defaulting to BOTTOM
 *  (`CommandFactoryNoteOnLink.java:203`) — shared by rules 12/12b. */
function linkNotePosition(raw: string | undefined): NotePosition {
  return (raw?.toLowerCase() as NotePosition | undefined) ?? 'bottom';
}

export const NOTE_COMMANDS: readonly Command[] = [
  // -------------------------------------------------------------------------
  // 10. Multi-line attached note opener: note <pos> [of <State>] [<<s>>]
  //     [#color] [[[url]]] — ending in `{` (bracket form, closed by `}`)
  //     or nothing (closed by `end note`). The single-line form (rule 11)
  //     ends in a MANDATORY `: text` tail that this pattern's optional
  //     trailing `{` cannot satisfy, so there is no overlap between them.
  //     Dispatches on BOTH passes (see the `Command.passes` doc above) --
  //     upstream's real ParserPass.THREE eligibility is instead enforced
  //     at the closer (parser.ts's `noteFinalizePass`).
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
    passes: ['one', 'two'],
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
  //     Upstream CommandFactoryNoteOnEntity is ParserPass.THREE for state
  //     diagrams -- merged into our single 'two' pass (see Pass's doc).
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
    passes: ['two'],
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
  //     transition parsed WITHIN the currently open scope. Position is
  //     OPTIONAL (defaults to BOTTOM — CommandFactoryNoteOnLink.java:203).
  //     CommandFactoryNoteOnLink#isEligibleFor -> ParserPass.TWO only.
  // @see ~/git/plantuml/.../command/note/CommandFactoryNoteOnLink.java
  // -------------------------------------------------------------------------
  {
    pattern: NOTE_ON_LINK_RE,
    passes: ['two'],
    execute(ps, match) {
      applyNoteOnLink(currentScope(ps).transitions, match[2]!, linkNotePosition(match[1]));
    },
  },

  // -------------------------------------------------------------------------
  // 12b. Multi-line `note [pos] on|of link [#color]` opener — same target/
  //      position rule as rule 12, closed by `end note`. Dispatches on BOTH
  //      passes (opens/swallows the block regardless of pass, same as rules
  //      10/13); `noteFinalizePass` gates the actual `applyNoteOnLink` call
  //      to pass TWO only.
  // @see ~/git/plantuml/.../command/note/CommandFactoryNoteOnLink.java:93-102
  // -------------------------------------------------------------------------
  {
    pattern: NOTE_ON_LINK_MULTI_RE,
    passes: ['one', 'two'],
    execute(ps, match) {
      ps.pendingNote = {
        kind: 'link',
        transitions: currentScope(ps).transitions,
        position: linkNotePosition(match[1]),
        textLines: [],
      };
    },
  },

  // -------------------------------------------------------------------------
  // 13. Multi-line freestanding note opener: note as <alias> [<<s>>] [#c]
  //     (… end note). Unattached. Dispatches on BOTH passes (see the
  //     `Command.passes` doc above); real ParserPass.ONE eligibility
  //     (CommandFactoryNote's base-class default -- no override) is
  //     enforced at the closer (parser.ts's `noteFinalizePass`).
  // @see ~/git/plantuml/.../command/note/CommandFactoryNote.java:77-89
  // -------------------------------------------------------------------------
  {
    pattern: new RegExp(String.raw`^note\s+as\s+(\w+|"[^"]+")` + NOTE_STEREO + NOTE_COLOR + String.raw`\s*$`, 'i'),
    passes: ['one', 'two'],
    execute(ps, match) {
      ps.pendingNote = { kind: 'freestanding', alias: match[1]!, textLines: [] };
    },
  },

  // -------------------------------------------------------------------------
  // 14. Single-line freestanding note: note "text" as <alias> [<<s>>][#c].
  //     Creates the note leaf immediately; there is no `end note` to wait
  //     for — a distinct upstream command from 10/11/13
  //     (CommandFactoryNote's singleLine, not CommandFactoryNoteOnEntity).
  //     No `isEligibleFor` override -> base-class default PASS ONE only.
  // @see ~/git/plantuml/.../command/note/CommandFactoryNote.java:91-107
  // -------------------------------------------------------------------------
  {
    pattern: new RegExp(
      String.raw`^note\s+"([^"]+)"\s+as\s+(\w+|"[^"]+")` + NOTE_STEREO + NOTE_COLOR + String.raw`\s*$`,
      'i',
    ),
    passes: ['one'],
    execute(ps, match) {
      const id = addFreestandingNote(ps.ast, match[2]!, match[1]!);
      ps.lastEntity = id;
    },
  },
] satisfies readonly Command[];

