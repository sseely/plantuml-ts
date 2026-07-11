/**
 * Parser for PlantUML state diagrams.
 *
 * Uses a command-dispatch table (`state-commands.ts`): an array of
 * { pattern, passes, execute } objects tested against each trimmed line in
 * priority order. First match wins; `passes` then gates whether `execute`
 * runs (see `state-commands.ts`'s `Command.passes` doc).
 *
 * TWO-PASS architecture (mission A4/Phase L, ParserPass port): the ENTIRE
 * source is walked twice, against ONE PERSISTENT `ParseState` (shared scope
 * tree, `globalByName` registry, and `lastEntity`) — mirroring upstream's
 * single entity/group tree visited three times, not rebuilt each visit
 * (`ParseState.scopeByOwner`'s doc in state-parse-state.ts). Pass ONE runs
 * only declaration-family commands (composite/frame open+close, concurrent
 * regions, plain/pseudostate declarations, standalone description lines,
 * freestanding notes) and builds the COMPLETE state/composite tree, each
 * state in its true nested scope, for the WHOLE document. Pass TWO REOPENS
 * the same scopes (rather than rebuilding them) and additionally runs
 * transitions, `note on link`, and attached notes.
 *
 * This is a PREREQUISITE for `state-parse-state.ts`'s global by-name reuse:
 * a transition on pass TWO referencing a name declared LATER in the source
 * text still finds it already correctly placed, because pass ONE already
 * walked the whole document before any transition ever ran. A single-pass
 * implementation of global reuse is unsafe for exactly this
 * forward-reference case (verified against the oracle: it regressed the
 * bajelo-54-dixe684 and tuvugi-94-gapi519 goldens when tried without this
 * restructure). Rebuilding a FRESH scope tree per pass (an earlier draft of
 * this restructure) is ALSO unsafe: it silently drops any state created
 * only during pass ONE and never touched again on pass TWO (e.g. an
 * implicit create from a standalone `CODE : text` line — `CommandAddField`
 * is ParserPass.ONE-only upstream) — hence the persistent, reopened-not-
 * rebuilt scope tree.
 *
 * Composite states (state Foo { ... } / frame Foo { ... }) and concurrent
 * regions (separated by `--`/`||` inside a composite block) are handled via
 * a scope stack (`state-parse-state.ts`). Multi-line note bodies are
 * accumulated here, before dispatch, the same way the class parser handles
 * them (`class/parser.ts`'s `handlePendingNoteLine`) — with one addition:
 * the two multi-line note openers dispatch on BOTH passes (`state-commands.ts`
 * rules 10/13) purely so the block is always opened/swallowed regardless of
 * pass; `noteFinalizePass` below gates whether the accumulated text
 * actually gets pushed into `ast.notes`.
 * @see ~/git/plantuml/.../statediagram/StateDiagram.java#getRequiredPass
 */

import type { UmlSource } from '../../core/block-extractor.js';
import type { StateDiagramAST } from './ast.js';
import { COMMANDS } from './state-commands.js';
import { finalizePendingNote, isNoteCloser, type PendingNote } from './state-notes.js';
import { type ParseState, type Pass, makeScope, popScope } from './state-parse-state.js';

/**
 * Which pass may FINALIZE (push into `ast.notes`) a given pending note
 * kind. Freestanding notes mirror upstream's `CommandFactoryNote` (default
 * `ParserPass.ONE`, no override); attached notes mirror
 * `CommandFactoryNoteOnEntity` (`ParserPass.THREE` for state diagrams,
 * merged into our single `'two'` pass alongside transitions/note-on-link —
 * see `Pass`'s doc in state-parse-state.ts for why merging THREE into TWO
 * is a safe, documented simplification for this corpus).
 */
function noteFinalizePass(kind: PendingNote['kind']): Pass {
  return kind === 'freestanding' ? 'one' : 'two';
}

/**
 * Consume a line while inside a multi-line note block, accumulating text
 * until the closer (`end note`, or `}` for a bracket-opened note). Returns
 * true when the line was consumed (i.e. a note was open). Finalization
 * (pushing into `ast.notes`) only happens when `pass` matches the note
 * kind's real eligible pass (`noteFinalizePass`) — on the OTHER pass, the
 * block is still fully swallowed (so its `}`/`end note` closer never
 * reaches `dispatchCommand`), just discarded instead of built.
 */
function handlePendingNoteLine(ps: ParseState, line: string, pass: Pass): boolean {
  if (ps.pendingNote === null) return false;
  if (isNoteCloser(ps.pendingNote, line)) {
    if (pass === noteFinalizePass(ps.pendingNote.kind)) {
      const id = finalizePendingNote(ps.ast, ps.pendingNote);
      if (id !== undefined) ps.lastEntity = id;
    }
    ps.pendingNote = null;
  } else {
    ps.pendingNote.textLines.push(line);
  }
  return true;
}

/** Dispatch a line to the first matching command, then apply it only if
 *  eligible for the current pass (see `Command.passes`'s doc). */
function dispatchCommand(ps: ParseState, line: string, pass: Pass): void {
  for (const cmd of COMMANDS) {
    const match = cmd.pattern.exec(line);
    if (match !== null) {
      if (cmd.passes.includes(pass)) cmd.execute(ps, match, pass);
      break;
    }
  }
}

/**
 * Run one full top-to-bottom walk of `block` against the SHARED `ps` for
 * the given pass. `pendingNote` resets to `null` first — it is a
 * walk-position construct (are we currently inside an unclosed block, in
 * THIS scan), not a diagram-level value, so it must not leak from one
 * pass's walk into the next's (see `ParseState.pendingNote`'s doc).
 * `scopeStack`/`lastEntity`/`globalByName` are deliberately NOT reset —
 * they are diagram-level and persist across both passes.
 */
function runPass(ps: ParseState, block: UmlSource, pass: Pass): void {
  ps.pendingNote = null;
  ps.scopeStack = [ps.scopeStack[0]];
  ps.scopeStack[0].regionCursor = 0;

  for (const rawLine of block.lines) {
    const line = rawLine.trim();
    if (line === '') continue;
    if (handlePendingNoteLine(ps, line, pass)) continue;
    dispatchCommand(ps, line, pass);
  }

  // Close any unclosed composite scopes (mirrors the pre-existing
  // best-effort recovery for a missing `}`/`end state`).
  while (ps.scopeStack.length > 1) {
    popScope(ps);
  }
}

// ---------------------------------------------------------------------------
// Main parser entry point
// ---------------------------------------------------------------------------

/**
 * Parse a PlantUML state diagram block into a StateDiagramAST.
 */
export function parseState(block: UmlSource): StateDiagramAST {
  const ast: StateDiagramAST = { states: [], transitions: [], notes: [] };
  const topScope = makeScope(null);
  const ps: ParseState = {
    scopeStack: [topScope],
    ast,
    pendingNote: null,
    lastEntity: null,
    globalByName: new Map(),
    scopeByOwner: new Map(),
  };

  // PASS ONE: declaration-family commands only — builds the complete tree.
  runPass(ps, block, 'one');

  // PASS TWO: structural commands REOPEN the same scopes (identical
  // nesting, enriched in place) plus transitions/note-on-link/attached
  // notes now fire.
  runPass(ps, block, 'two');

  ast.states = topScope.states;
  ast.transitions = topScope.transitions;
  return ast;
}
