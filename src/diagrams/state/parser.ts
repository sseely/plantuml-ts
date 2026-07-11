/**
 * Parser for PlantUML state diagrams.
 *
 * Uses a command-dispatch table (`state-commands.ts`): an array of
 * { pattern, execute } objects tested against each trimmed line in
 * priority order. First match wins.
 *
 * Composite states (state Foo { ... } / frame Foo { ... }) and concurrent
 * regions (separated by `--`/`||` inside a composite block) are handled via
 * a scope stack (`state-parse-state.ts`). Multi-line note bodies are
 * accumulated here, before dispatch, the same way the class parser handles
 * them (`class/parser.ts`'s `handlePendingNoteLine`).
 */

import type { UmlSource } from '../../core/block-extractor.js';
import type { StateDiagramAST } from './ast.js';
import { COMMANDS } from './state-commands.js';
import { finalizePendingNote, isNoteCloser } from './state-notes.js';
import { type ParseState, makeScope, popScope } from './state-parse-state.js';

/**
 * Consume a line while inside a multi-line note block, accumulating text
 * until the closer (`end note`, or `}` for a bracket-opened note). Returns
 * true when the line was consumed (i.e. a note was open).
 */
function handlePendingNoteLine(ps: ParseState, line: string): boolean {
  if (ps.pendingNote === null) return false;
  if (isNoteCloser(ps.pendingNote, line)) {
    const id = finalizePendingNote(ps.ast, ps.pendingNote);
    if (id !== undefined) ps.lastEntity = id;
    ps.pendingNote = null;
  } else {
    ps.pendingNote.textLines.push(line);
  }
  return true;
}

/** Dispatch a line to the first matching command. */
function dispatchCommand(ps: ParseState, line: string): void {
  for (const cmd of COMMANDS) {
    const match = cmd.pattern.exec(line);
    if (match !== null) {
      cmd.execute(ps, match);
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// Main parser entry point
// ---------------------------------------------------------------------------

/**
 * Parse a PlantUML state diagram block into a StateDiagramAST.
 */
export function parseState(block: UmlSource): StateDiagramAST {
  const topScope = makeScope(null);
  const ast: StateDiagramAST = {
    states: topScope.states,
    transitions: topScope.transitions,
    notes: [],
  };
  const ps: ParseState = {
    scopeStack: [topScope],
    ast,
    pendingNote: null,
    lastEntity: null,
  };

  for (const rawLine of block.lines) {
    const line = rawLine.trim();
    if (line === '') continue;
    if (handlePendingNoteLine(ps, line)) continue;
    dispatchCommand(ps, line);
  }

  // Close any unclosed composite scopes (mirrors the pre-existing
  // best-effort recovery for a missing `}`/`end state`).
  while (ps.scopeStack.length > 1) {
    popScope(ps);
  }

  return ast;
}
