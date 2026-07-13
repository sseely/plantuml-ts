/**
 * Parser for PlantUML descriptive diagrams (component / use-case / deployment).
 *
 * Merges the component and use-case parsers into one upstream-faithful engine
 * keyed by KEYWORD_TO_SYMBOL (mirrors CommandCreateElementFull.ALL_TYPES in
 * net.sourceforge.plantuml.descdiagram.command). Uses a command-dispatch table
 * tested against each trimmed line in priority order — first match wins.
 *
 * The command dispatch table (COMMANDS) and the mutable-state helpers
 * (ParseState, emitNode, note handling, …) live in `command-table.ts` /
 * `parse-state.ts` respectively — split out of this file (mission G0b/T6)
 * purely to stay under the project's 500-line file cap; this file owns only
 * the top-level line loop and its dispatch priority.
 */

import type { UmlSource } from '../../core/block-extractor.js';
import { matchAnnotationCommand } from '../../core/annotations/index.js';
import { KEYWORD_TO_SYMBOL } from '../../core/descriptive-keywords.js';
import type { DescriptionDiagramAST } from './ast.js';
import { ELEMENT_MULTILINE_OPEN_RE, makeNode } from './parse-helpers.js';
import { classifyNoteOpen, isNoteTerminator } from './note-grammar.js';
import {
  closePendingNote,
  emitNode,
  executeNoteOpen,
  makeDefaultAST,
  resolveStillUnknown,
  type ParseState,
} from './parse-state.js';
import { COMMANDS } from './command-table.js';

export { CONTAINER_SYMBOLS } from './parse-helpers.js';

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

function makeInitialState(): ParseState {
  return {
    inSpriteBlock: false,
    inElementBlock: false,
    ast: makeDefaultAST(),
    containerStack: [],
    nodesById: new Map(),
    parentArrayById: new Map(),
    lastEntityId: undefined,
    noteCounter: 0,
    pendingNote: undefined,
    pages: [],
  };
}

const RE_SPRITE_BLOCK_OPEN = new RegExp('^sprite\\s+\\$?[\\w]+.*\\{\\s*$', 'i');
const RE_SPRITE_SINGLE = new RegExp('^sprite\\s+\\$?[\\w]+\\b(?!.*\\{)', 'i');

/** `1` when the phase consumed the line, `null` when it doesn't apply and
 *  the next dispatch phase should be tried. No phase in `processLine` ever
 *  consumes more than one line except the annotation matcher, handled
 *  separately in `processLine` itself. */
type LineOutcome = 1 | null;

/** `sprite $name [dims] { base64… }` blocks (LanguageDescriptor sprite
 *  commands) are pixel data, not diagram content — consume them whole. */
function trySpriteBlock(state: ParseState, line: string): LineOutcome {
  if (state.inSpriteBlock) {
    if (/^\}\s*$/.test(line)) state.inSpriteBlock = false;
    return 1;
  }
  if (RE_SPRITE_BLOCK_OPEN.test(line)) {
    state.inSpriteBlock = true;
    return 1;
  }
  if (RE_SPRITE_SINGLE.test(line)) return 1;
  return null;
}

/** `<keyword> <code> [ … ]` multi-line element description
 *  (CommandCreateElementMultilines TYPE1) — body lines are label content;
 *  consume until a line ends with `]`. */
function tryElementBlock(state: ParseState, line: string): LineOutcome {
  if (state.inElementBlock) {
    if (/\]\s*$/.test(line)) state.inElementBlock = false;
    return 1;
  }
  const elemOpen = ELEMENT_MULTILINE_OPEN_RE.exec(line);
  if (elemOpen === null) return null;
  const kw = elemOpen[1]!.toLowerCase();
  const symbol = KEYWORD_TO_SYMBOL.get(kw);
  if (symbol === undefined) return null;
  const code = elemOpen[2]!;
  emitNode(state, makeNode(code, code, symbol));
  // A one-line form (`component c [ desc ]`) closes on the same line.
  if (!/\]\s*$/.test(line)) state.inElementBlock = true;
  return 1;
}

/** A note-command multi-line body owns every line until its terminator
 *  (CommandMultilines2) — never re-dispatched through COMMANDS, so a body
 *  line that happens to look like another command (e.g. razefo-71-pice114's
 *  embedded `{{ skinparam note { ... } }}`) is never misparsed as one. */
function tryNoteHandling(state: ParseState, line: string): LineOutcome {
  if (state.pendingNote !== undefined) {
    if (isNoteTerminator(line, state.pendingNote.terminator)) {
      closePendingNote(state);
    } else {
      state.pendingNote.lines.push(line);
    }
    return 1;
  }
  const noteOpen = classifyNoteOpen(line);
  if (noteOpen !== undefined) {
    executeNoteOpen(state, noteOpen);
    return 1;
  }
  return null;
}

/**
 * title/caption/legend/header/footer/mainframe (mission G0b/T6,
 * decisions.md D3), then the ordinary COMMANDS table. The annotation
 * matcher is tried FIRST — mirroring upstream CommonCommands
 * .addTitleCommands being registered before any diagram-specific command —
 * so those directives are never misread as entity declarations. Operates on
 * the raw (untrimmed) `lines` array/index so a matched multiline block's
 * body keeps its original indentation for `removeEmptyColumns`.
 */
function dispatchCommand(
  state: ParseState,
  lines: readonly string[],
  i: number,
  line: string,
): number {
  const annotationMatch = matchAnnotationCommand(lines, i, state.ast.annotations!);
  if (annotationMatch !== null) return annotationMatch.consumed;

  for (const cmd of COMMANDS) {
    const match = cmd.pattern.exec(line);
    if (match !== null) {
      cmd.execute(state, match);
      break;
    }
  }
  return 1;
}

/**
 * Dispatch one non-blank line at index `i` of the raw (untrimmed) `lines`
 * array. Returns `false` when the line was `!exit` (net.sourceforge
 * .plantuml.preproc) — the preprocessor directive that halts all further
 * line processing (confirmed against the pinned oracle golden for
 * jesibe-85-sozu187: a link past `!exit` referring to an undeclared
 * endpoint must NOT spuriously auto-create that endpoint). Otherwise
 * returns the number of lines consumed (>= 1) — greater than 1 only when
 * the shared annotation matcher consumed a multi-line block (see
 * `dispatchCommand`). Phases run in upstream-priority order: sprite block,
 * element block, pending/open note, then title/caption/legend/… and the
 * ordinary command table.
 */
function processLine(state: ParseState, lines: readonly string[], i: number): number | false {
  const line = lines[i]!.trim();
  if (/^!exit\b/i.test(line)) return false;

  const spriteResult = trySpriteBlock(state, line);
  if (spriteResult !== null) return spriteResult;

  const elementResult = tryElementBlock(state, line);
  if (elementResult !== null) return elementResult;

  const noteResult = tryNoteHandling(state, line);
  if (noteResult !== null) return noteResult;

  return dispatchCommand(state, lines, i, line);
}

/**
 * Parse a UmlSource block for a descriptive diagram (component / use-case /
 * deployment) into a DescriptionDiagramAST.
 */
export function parseDescription(block: UmlSource): DescriptionDiagramAST {
  const state = makeInitialState();
  const lines = block.lines;

  for (let i = 0; i < lines.length; ) {
    if (lines[i]!.trim() === '') {
      i++;
      continue;
    }
    const result = processLine(state, lines, i);
    if (result === false) break;
    i += result;
  }

  resolveStillUnknown(state.ast.nodes);

  if (state.pages.length === 0) {
    return state.ast;
  }

  // Multi-page: the first page carries `pages` (itself included), per the
  // ast.ts `DescriptionDiagramAST.pages` interface contract consumed by
  // `layoutDescription` (layout.ts). Mirrors class/parser.ts#parseClass.
  state.pages.push(state.ast);
  state.pages[0]!.pages = state.pages;
  return state.pages[0]!;
}
