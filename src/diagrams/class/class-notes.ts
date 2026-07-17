/**
 * Note-block accumulation + note AST construction for the class parser.
 *
 * Split out of `parser.ts` to keep it within the module line budget. These
 * helpers operate only on the public `ClassDiagramAST` (no parse state).
 */

import type { ClassDiagramAST, NotePosition } from './ast.js';
import { registerInNamespace } from './class-namespace.js';
import { splitEndpointPort, stripQuotes } from './class-relationship-parser.js';

/**
 * Optional note decoration segments, shared by all four note command shapes
 * in class-commands.ts (attached single/multi-line, freestanding
 * single/multi-line). Mirrors upstream's optional STEREO / COLOR / URL
 * groups, in order — TAGS1, STEREO, TAGS2, COLOR, URL
 * (CommandFactoryNoteOnEntity.java:96-109; CommandFactoryNote.java:83-88 has
 * no URL group). $-prefixed Stereotag groups (TAGS1/TAGS2) are not ported —
 * no fixture in the corpus exercises them. `ClassNote` (ast.ts) has no
 * stereotype/color/url fields, so these are parsed and discarded — DOT
 * parity only cares about note existence. Non-capturing so they don't shift
 * the downstream capture-group indices each command already relies on
 * (position/target, alias, text, …).
 */
export const NOTE_STEREO = '(?:\\s*<<[^<>]+>>)?';
// `\` joins `-`/`/`/`|` as a gradient separator (upstream COLOR_REGEXP
// "#\\w+[-\\\\|/]?\\w+", ColorParser.java:43 — `#yellow\gold`, dacixi-46).
// `;`/`:` additionally cover ColorParser's PART2 multi-attribute form
// (`#color;attr:value;attr2:value2`, ColorParser.java:45 —
// `#blue;line.bold:purple;text:777`, xoxuni-96-fere626 mission A2 iteration
// 12): without them the color group stopped at the bare color name, leaving
// `;line.bold:purple;text:777` unconsumed and failing the whole note command
// match (not just dropping the extra attrs) since nothing else in the note
// grammar accounts for a stray `;`.
export const NOTE_COLOR = '(?:\\s*#[-\\w./|\\\\;:]+)?';
export const NOTE_URL = '(?:\\s*\\[\\[[^\\]]*\\]\\])?';
/**
 * `note <pos> of <Entity>` target: a bare id, a quoted string, or either
 * followed by a `::member`/`::"quoted member"` suffix (legacy UML namespace
 * separator reused to target a specific field/method —
 * CommandFactoryNoteOnEntity's entity-ref grammar). Captured whole; `addNote`
 * below splits the `::member` suffix back off via `splitEndpointPort` (same
 * helper the relationship parser uses for `Class::member` endpoints).
 */
export const NOTE_TARGET = '(\\w+(?:::(?:\\w+|"[^"]+"))?|"[^"]+")';

/**
 * A note block being accumulated until `end note`. Two shapes:
 *  - `attached`: `note <pos> of <Entity>` — has a host + position.
 *  - `freestanding`: `note as <alias>` — no host; the alias becomes the note's
 *    id so later relationship lines (`alias .> Something`) can reference it.
 *
 * `namespace` is captured at note-OPEN time (the active namespace when the
 * `note ...` line was seen), not at `end note` — mirrors upstream, where the
 * note leaf is created under `getCurrentGroup()` as soon as the command runs
 * (`CommandFactoryNote.java:197`), before any body lines are consumed.
 */
export type PendingNote =
  | {
      kind: 'attached';
      target: string | undefined;
      /**
       * True when `target` came from falling back to `lastEntity` (no
       * `of <Entity>` clause was written at all) rather than an explicit
       * `of` reference. `CommandFactoryNote` (bare `note <pos>`) and
       * `CommandFactoryNoteOnEntity` (`note <pos> of <Entity>`) are separate
       * upstream commands with separate merge behavior — verified against
       * the oracle (zepeki-75-pifo352: a bare `note left` and an explicit
       * `note left of test::member`, same host+side, do NOT merge into one
       * svek node, unlike two explicit `of` notes on the same side — see
       * note-layout.ts's `groupNotes`).
       */
      implicitTarget: boolean;
      position: NotePosition;
      textLines: string[];
      namespace: string | null;
      /**
       * `'brace'` for the `note <pos> [of X] {` opener, closed by a bare `}`
       * instead of `end note` — upstream registers this as a SEPARATE
       * `withBracket=true` grammar; only the attached-note command has a
       * bracket form, freestanding notes never do.
       * @see ~/git/plantuml/.../command/note/CommandFactoryNoteOnEntity.java:120-146
       * @see ~/git/plantuml/.../classdiagram/ClassDiagramFactory.java:150-157
       */
      closer?: 'brace';
    }
  | { kind: 'freestanding'; alias: string; textLines: string[]; namespace: string | null };

/** True if `line` is the closer for `note` (`}` for a brace note, else `end note`). */
export function isNoteCloser(note: PendingNote, line: string): boolean {
  if (note.kind === 'attached' && note.closer === 'brace') return /^\}\s*$/.test(line);
  return /^end\s*note\s*$/i.test(line);
}

/**
 * Append an attached (`note <pos> [of <Entity>]`) note with a generated id.
 * Returns the generated id so the caller (parser.ts / class-commands.ts) can
 * update `ParseState.lastEntity` — upstream's `reallyCreateLeaf` unconditionally
 * sets `lastEntity` to every leaf it creates, including notes.
 * @see ~/git/plantuml/.../net/atmp/CucaDiagram.java:218-228
 *
 * `namespace` is the active namespace at note-creation time — notes are
 * leaves in the same Quark tree as classifiers (`CucaDiagram.java:175-184
 * getCurrentGroup`), so they register into `Namespace.classifiers` the same
 * way `ensureClassifier`/`registerInNamespace` do for classifiers.
 */
/**
 * G2 N15: shared parse-time creation counter, same shape as `ParseState
 * .creationCounter` (mutable `{value}` box rather than a plain number so
 * every consumer sees the SAME running total) -- optional so hand-built
 * `ClassDiagramAST` fixtures that call `addNote`/`addFreestandingNote`
 * directly (most unit tests) keep working unchanged, same "absent when
 * built by hand" posture `Classifier.creationIndex`'s doc comment already
 * establishes.
 */
export interface NoteCreationCounter {
  value: number;
}

export function addNote(
  ast: ClassDiagramAST,
  position: NotePosition,
  target: string,
  text: string,
  opts: { namespace: string | null; implicitTarget: boolean },
  counter?: NoteCreationCounter,
): string {
  const { namespace, implicitTarget } = opts;
  const id = `__note_${ast.notes.length}`;
  // `Class::member`/`Class::"quoted member"` (NOTE_TARGET grammar above) — the
  // note anchors to the host classifier; the member suffix is metadata only
  // (targetPort), not a separate classifier (mirrors the relationship
  // parser's `Class::member` endpoint handling).
  const { id: hostId, port } = splitEndpointPort(target);
  // G2 N15 (ast.ts#ClassNote.creationIndex's doc comment): a non-tip
  // attached note (no `::member`) is `CommandFactoryNoteOnEntity`, which
  // ALWAYS burns one phantom `getUniqueSequence("GMN")` slot before its own
  // `Entity` ctor slot — consume two counter increments, keep only the
  // second. A member-tip note (`port !== undefined`) is the separate
  // `CommandFactoryTipOnEntity` command (no GMN call, and merges by
  // host+position — not modeled at parse time), so the counter is left
  // untouched and `creationIndex` stays undefined (pre-existing fallback
  // numbering, unchanged).
  let creationIndex: number | undefined;
  let phantomSlot: true | undefined;
  if (counter !== undefined && port === undefined) {
    counter.value += 1; // phantom GMN slot -- consumes a rank, never an entity
    counter.value += 1;
    creationIndex = counter.value;
    phantomSlot = true;
  }
  ast.notes.push({
    id,
    target: stripQuotes(hostId),
    ...(port !== undefined ? { targetPort: stripQuotes(port) } : {}),
    ...(implicitTarget ? { implicitTarget: true } : {}),
    position,
    text,
    ...(namespace !== null ? { namespace } : {}),
    ...(creationIndex !== undefined ? { creationIndex } : {}),
    ...(phantomSlot !== undefined ? { phantomSlot } : {}),
  });
  registerInNamespace(ast.namespaces, namespace, id);
  return id;
}

export function addFreestandingNote(
  ast: ClassDiagramAST,
  alias: string,
  text: string,
  namespace: string | null,
  counter?: NoteCreationCounter,
): string {
  const id = stripQuotes(alias);
  // G2 N15: `CommandFactoryNote` (freestanding) has no GMN call — only the
  // `Entity` ctor's own slot is consumed, one increment.
  let creationIndex: number | undefined;
  if (counter !== undefined) {
    counter.value += 1;
    creationIndex = counter.value;
  }
  ast.notes.push({
    id,
    text,
    ...(namespace !== null ? { namespace } : {}),
    ...(creationIndex !== undefined ? { creationIndex } : {}),
  });
  registerInNamespace(ast.namespaces, namespace, id);
  return id;
}

/**
 * Returns the created note's id (to become the new `lastEntity`), or
 * `undefined` if the note was dropped — an `attached` note whose target could
 * not be resolved (no explicit `of <Entity>` and no `lastEntity` to fall back
 * to) mirrors upstream's `CommandExecutionResult.error("Nothing to note to")`
 * (`CommandFactoryNoteOnEntity.java:299-301`): our parser's posture for an
 * unresolvable command is a silent no-op, not a thrown error.
 */
export function finalizePendingNote(
  ast: ClassDiagramAST,
  note: PendingNote,
  counter?: NoteCreationCounter,
): string | undefined {
  const text = note.textLines.join('\n');
  if (note.kind === 'attached') {
    if (note.target === undefined) return undefined;
    return addNote(ast, note.position, note.target, text, {
      namespace: note.namespace,
      implicitTarget: note.implicitTarget,
    }, counter);
  }
  return addFreestandingNote(ast, note.alias, text, note.namespace, counter);
}

/** True if `id` refers to an already-parsed note (attached or freestanding). */
export function isNoteId(ast: ClassDiagramAST, id: string): boolean {
  return ast.notes.some((n) => n.id === id);
}

/**
 * `note [pos] on|of link [#color] : text` (CommandFactoryNoteOnLink) — a note
 * attached to the LAST relationship parsed, not to an entity. Matched BEFORE
 * the attached-note commands (class-commands.ts rules 6b/6c), which require
 * an explicit `left|right|top|bottom` position and would otherwise treat a
 * position-less `note on link:` as a bare `note <pos>` targeting
 * `lastEntity`, or read `link` as a literal entity id.
 */
export const NOTE_ON_LINK_RE = new RegExp(
  String.raw`^note\s+(?:(?:left|right|top|bottom)\s+)?(?:on|of)\s+link` + NOTE_COLOR + String.raw`\s*:\s*(.+)$`,
  'i',
);

/**
 * Attach `text` as the `linkNote` of the last relationship — mirrors
 * `Link#addNote`/`diagram.getLastLink()`. Silent no-op with no prior
 * relationship (upstream: `CommandExecutionResult.error("No link defined")`).
 * class-assoc-couple.ts moves this text onto an association-class couple's
 * circle edges if that relationship later gets subsumed.
 */
export function applyNoteOnLink(ast: ClassDiagramAST, text: string): void {
  const last = ast.relationships.at(-1);
  if (last !== undefined) last.linkNote = text.trim();
}

/** `constraint on links [#color] : text` — upstream CommandConstraintOnLinks
 *  (command/note/CommandConstraintOnLinks.java) marks the TWO most-recent
 *  links whose endpoints are not NOTE leaves with a LinkConstraint
 *  (CucaDiagram#constraintOnLinks via getTwoLastLinks, CucaDiagram.java:660,
 *  712). svek then emits a fixed 10x10 label spot on each constrained edge
 *  carrying no note/label text (SvekEdge.java:430; CONSTRAINT_SPOT at :122)
 *  — the constraint's text/color never reach the DOT. Fewer than two links
 *  → upstream errors; here a consumed no-op. */
export const CONSTRAINT_ON_LINKS_RE = /^constraint\s*on\s+links\s*(?:#\w+\s*)?:\s*(.*)$/i;

export function applyConstraintOnLinks(ast: ClassDiagramAST): void {
  const links = ast.relationships.filter(
    (r) => !isNoteId(ast, r.from) && !isNoteId(ast, r.to),
  );
  if (links.length < 2) return;
  links[links.length - 1]!.linkConstraint = true;
  links[links.length - 2]!.linkConstraint = true;
}
