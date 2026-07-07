/**
 * Note-block accumulation + note AST construction for the class parser.
 *
 * Split out of `parser.ts` to keep it within the module line budget. These
 * helpers operate only on the public `ClassDiagramAST` (no parse state).
 */

import type { ClassDiagramAST, NotePosition } from './ast.js';
import { stripQuotes } from './class-relationship-parser.js';

/**
 * A note block being accumulated until `end note`. Two shapes:
 *  - `attached`: `note <pos> of <Entity>` — has a host + position.
 *  - `freestanding`: `note as <alias>` — no host; the alias becomes the note's
 *    id so later relationship lines (`alias .> Something`) can reference it.
 */
export type PendingNote =
  | { kind: 'attached'; target: string; position: NotePosition; textLines: string[] }
  | { kind: 'freestanding'; alias: string; textLines: string[] };

/** Append an attached (`note <pos> of <Entity>`) note with a generated id. */
export function addNote(
  ast: ClassDiagramAST,
  position: NotePosition,
  target: string,
  text: string,
): void {
  ast.notes.push({
    id: `__note_${ast.notes.length}`,
    target: stripQuotes(target),
    position,
    text,
  });
}

export function addFreestandingNote(ast: ClassDiagramAST, alias: string, text: string): void {
  ast.notes.push({ id: stripQuotes(alias), text });
}

export function finalizePendingNote(ast: ClassDiagramAST, note: PendingNote): void {
  const text = note.textLines.join('\n');
  if (note.kind === 'attached') {
    addNote(ast, note.position, note.target, text);
  } else {
    addFreestandingNote(ast, note.alias, text);
  }
}

/** True if `id` refers to an already-parsed note (attached or freestanding). */
export function isNoteId(ast: ClassDiagramAST, id: string): boolean {
  return ast.notes.some((n) => n.id === id);
}
