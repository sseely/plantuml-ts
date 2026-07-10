/**
 * Note-block accumulation + note AST construction for the class parser.
 *
 * Split out of `parser.ts` to keep it within the module line budget. These
 * helpers operate only on the public `ClassDiagramAST` (no parse state).
 */

import type { ClassDiagramAST, NotePosition } from './ast.js';
import { registerInNamespace } from './class-namespace.js';
import { stripQuotes } from './class-relationship-parser.js';

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
      position: NotePosition;
      textLines: string[];
      namespace: string | null;
    }
  | { kind: 'freestanding'; alias: string; textLines: string[]; namespace: string | null };

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
export function addNote(
  ast: ClassDiagramAST,
  position: NotePosition,
  target: string,
  text: string,
  namespace: string | null,
): string {
  const id = `__note_${ast.notes.length}`;
  ast.notes.push({
    id,
    target: stripQuotes(target),
    position,
    text,
    ...(namespace !== null ? { namespace } : {}),
  });
  registerInNamespace(ast.namespaces, namespace, id);
  return id;
}

export function addFreestandingNote(
  ast: ClassDiagramAST,
  alias: string,
  text: string,
  namespace: string | null,
): string {
  const id = stripQuotes(alias);
  ast.notes.push({ id, text, ...(namespace !== null ? { namespace } : {}) });
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
export function finalizePendingNote(ast: ClassDiagramAST, note: PendingNote): string | undefined {
  const text = note.textLines.join('\n');
  if (note.kind === 'attached') {
    if (note.target === undefined) return undefined;
    return addNote(ast, note.position, note.target, text, note.namespace);
  }
  return addFreestandingNote(ast, note.alias, text, note.namespace);
}

/** True if `id` refers to an already-parsed note (attached or freestanding). */
export function isNoteId(ast: ClassDiagramAST, id: string): boolean {
  return ast.notes.some((n) => n.id === id);
}
