/**
 * Note-block accumulation + note AST construction for the state parser.
 *
 * Mirrors `src/diagrams/class/class-notes.ts` (same upstream commands, same
 * grammar) with two simplifications: state notes have no namespace concept
 * and no `$tag` capture (no fixture in the corpus exercises tags on a state
 * note, and D5 does not list them as a gap).
 * @see ~/git/plantuml/.../statediagram/StateDiagramFactory.java:97-112
 *      (registers CommandFactoryNoteOnEntity/NoteOnLink/Note for "state")
 */

import type { StateDiagramAST, NotePosition, Transition } from './ast.js';

/**
 * Optional note decoration segments shared by every note command shape.
 * Non-capturing so they don't shift downstream capture-group indices.
 * Mirrors class-notes.ts's NOTE_STEREO/NOTE_COLOR/NOTE_URL.
 * @see ~/git/plantuml/.../command/note/CommandFactoryNoteOnEntity.java:96-109
 */
export const NOTE_STEREO = '(?:\\s*<<[^<>]+>>)?';
export const NOTE_COLOR = '(?:\\s*#[-\\w./|\\\\;:]+)?';
export const NOTE_URL = '(?:\\s*\\[\\[[^\\]]*\\]\\])?';

/**
 * `note <pos> of <State>` target: a bare id (`[%pLN_.]+` upstream) or a
 * quoted display string — `StateDiagramFactory.java:98-99`.
 */
export const NOTE_TARGET = '(\\w+(?:\\.\\w+)*|"[^"]+")';

/**
 * A note block being accumulated until `end note`. Three shapes:
 *  - `attached`: `note <pos> of <State>` — has a host + position.
 *  - `freestanding`: `note as <alias>` — no host; the alias becomes the
 *    note's id.
 *  - `link`: `note [pos] on|of link` — attaches to the last transition
 *    parsed in the scope open when the note started.
 */
export type PendingNote =
  | {
      kind: 'attached';
      target: string | undefined;
      /** True when `target` fell back to `lastEntity` (no `of <State>`
       *  clause) rather than an explicit `of` reference. */
      implicitTarget: boolean;
      position: NotePosition;
      textLines: string[];
      /**
       * `'brace'` for the `note <pos> [of X] {` opener, closed by a bare
       * `}` instead of `end note`.
       * @see ~/git/plantuml/.../command/note/CommandFactoryNoteOnEntity.java:120-146
       */
      closer?: 'brace';
    }
  | { kind: 'freestanding'; alias: string; textLines: string[] }
  | { kind: 'link'; transitions: readonly Transition[]; position: NotePosition; textLines: string[] };

/** True if `line` is the closer for `note` (`}` for a brace note, else `end note`). */
export function isNoteCloser(note: PendingNote, line: string): boolean {
  if (note.kind === 'attached' && note.closer === 'brace') return /^\}\s*$/.test(line);
  return /^end\s*note\s*$/i.test(line);
}

function stripQuotes(s: string): string {
  if (s.length >= 2 && s.startsWith('"') && s.endsWith('"')) return s.slice(1, -1);
  return s;
}

/**
 * Notes accumulate on the ROOT `StateDiagramAST.notes` array regardless of
 * which composite-state scope is active when parsed — unlike transitions
 * (scoped per composite so DOT/layout can place them inside the right
 * cluster), a `StateNote`'s `target` id is enough on its own for T3/T4 to
 * resolve the host and its enclosing scope. This mirrors the flat id-space
 * `ensureState`/`declareState` already assume (see parser.ts).
 *
 * Append an attached (`note <pos> [of <State>]`) note with a generated id.
 * Returns the generated id so the caller can update `lastEntity` — upstream
 * unconditionally sets `lastEntity` to every leaf it creates, notes included.
 * @see ~/git/plantuml/.../net/atmp/CucaDiagram.java:218-228
 */
export function addNote(
  ast: StateDiagramAST,
  position: NotePosition,
  target: string,
  text: string,
  opts: { implicitTarget: boolean },
): string {
  const notes = (ast.notes ??= []);
  const id = `__note_${notes.length}`;
  notes.push({
    id,
    target: stripQuotes(target),
    ...(opts.implicitTarget ? { implicitTarget: true } : {}),
    position,
    text,
  });
  return id;
}

export function addFreestandingNote(ast: StateDiagramAST, alias: string, text: string): string {
  const id = stripQuotes(alias);
  (ast.notes ??= []).push({ id, text });
  return id;
}

/**
 * Returns the created note's id (to become the new `lastEntity`), or
 * `undefined` if the note was dropped — an `attached` note whose target
 * could not be resolved (no explicit `of <State>` and no `lastEntity` to
 * fall back to) mirrors upstream's
 * `CommandExecutionResult.error("Nothing to note to")` — here, a silent
 * no-op instead of a thrown error. A `link` note never has an id (it
 * attaches to a transition, not a leaf) and never updates `lastEntity` —
 * mirrors `CommandFactoryNoteOnLink#executeInternal`, which only calls
 * `link.addNote(...)`, never `diagram.setLastEntity(...)`.
 * @see ~/git/plantuml/.../command/note/CommandFactoryNoteOnEntity.java:298-301
 */
export function finalizePendingNote(ast: StateDiagramAST, note: PendingNote): string | undefined {
  const text = note.textLines.join('\n');
  if (note.kind === 'attached') {
    if (note.target === undefined) return undefined;
    return addNote(ast, note.position, note.target, text, {
      implicitTarget: note.implicitTarget,
    });
  }
  if (note.kind === 'link') {
    applyNoteOnLink(note.transitions, text, note.position);
    return undefined;
  }
  return addFreestandingNote(ast, note.alias, text);
}


/**
 * `note [pos] on|of link [#color] : text` (CommandFactoryNoteOnLink,
 * single-line form) — a note attached to the LAST transition parsed, not to
 * a state. Matched BEFORE the attached-note commands (which require an
 * explicit `left|right|top|bottom` position and would otherwise treat a
 * position-less `note on link:` as a bare `note <pos>` targeting
 * `lastEntity`, or read `link` as a literal state id). Position is
 * OPTIONAL (default BOTTOM, applied by the caller) — mirrors upstream's
 * `(right|left|top|bottom)?` regex leaf, unlike the attached-note commands'
 * mandatory position.
 * @see ~/git/plantuml/.../command/note/CommandFactoryNoteOnLink.java:76-91
 */
export const NOTE_ON_LINK_RE = new RegExp(
  String.raw`^note\s+(left|right|top|bottom)?\s*(?:on|of)\s+link` + NOTE_COLOR + String.raw`\s*:\s*(.+)$`,
  'i',
);

/**
 * `note [pos] on|of link [#color]` (CommandFactoryNoteOnLink, multi-line
 * form) — same target/position rule as `NOTE_ON_LINK_RE`, opens a block
 * closed by `end note` (no bracket variant upstream). Anchored at `$` with
 * no colon so it never overlaps the single-line form.
 * @see ~/git/plantuml/.../command/note/CommandFactoryNoteOnLink.java:93-102
 */
export const NOTE_ON_LINK_MULTI_RE = new RegExp(
  String.raw`^note\s+(left|right|top|bottom)?\s*(?:on|of)\s+link` + NOTE_COLOR + String.raw`\s*$`,
  'i',
);

/**
 * Attach `text` as the `linkNote` (+ `linkNotePosition`) of the last
 * transition — mirrors `Link#addNote`/`diagram.getLastLink()`. Silent
 * no-op with no prior transition (upstream:
 * `CommandExecutionResult.error("No link defined")`).
 *
 * Takes the LIVE transitions array of whichever scope is currently open
 * (the caller passes `currentScope(ps).transitions`) rather than the root
 * AST — a `note on link` line inside a composite state must attach to the
 * last transition parsed WITHIN that composite's scope, not a top-level one.
 */
export function applyNoteOnLink(transitions: readonly Transition[], text: string, position: NotePosition): void {
  const last = transitions.at(-1);
  if (last === undefined) return;
  last.linkNote = text.trim();
  last.linkNotePosition = position;
}
