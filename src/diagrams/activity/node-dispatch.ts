/**
 * Core recursive-descent line dispatch (mission G0b/T6: split out of
 * parser.ts to stay under the 500-line file cap; behavior change limited
 * to the annotation-matcher wiring in `tryAnnotation` below).
 *
 * Each `try*` function below handles exactly one line-shape from the
 * original single-function dispatch chain, in the SAME priority order as
 * before -- a mechanical extraction (no behavior change) forced by Lizard
 * 1.23.0's TypeScript reader misattributing this function's complexity
 * regardless of `#lizard forgives` placement (its "optimistic function"
 * push/pop heuristic for `identifier(` call sites loses track of the
 * enclosing function partway through a chain this long); splitting into
 * small named functions sidesteps the tool bug instead of fighting it.
 */

import { matchAnnotationCommand } from '../../core/annotations/index.js';
import type {
  ActivityAction, ActivityArrowLabel, ActivityFork, ActivityNode, ActivityNote, ActivityRepeat,
  ActivitySplit, ActivityWhile,
} from './ast.js';
import {
  RE_ACTION, RE_ACTION_CLOSE, RE_ARROW_LABEL, RE_ENDWHILE, RE_ESCAPED_NEWLINE, RE_NOTE_MULTI,
  RE_NOTE_SINGLE, RE_REPEAT_HEAD, RE_REPEAT_INLINE_TERMINATOR, RE_REPEATWHILE, RE_SWIMLANE, RE_WHILE,
  matchesStopKeyword, setCurrentSwimlane, swimlaneSpread,
  type DispatchResult, type LineHandler, type ParseContext, type ParseResult, type StopKeywords,
} from './dispatch-support.js';
import { tryIf } from './if-dispatch.js';

// ---------------------------------------------------------------------------
// Swimlane header: |name| or |[#color]name|
// ---------------------------------------------------------------------------
function trySwimlane(ctx: ParseContext, idx: number, line: string): DispatchResult | null {
  const m = RE_SWIMLANE.exec(line);
  if (m === null) return null;
  setCurrentSwimlane(ctx, m[1]!.trim());
  return { idx: idx + 1 };
}

// ---------------------------------------------------------------------------
// start / stop / end / kill / detach / break
// ---------------------------------------------------------------------------
function trySimpleKeyword(ctx: ParseContext, idx: number, _line: string, lc: string): DispatchResult | null {
  switch (lc) {
    case 'start': return { idx: idx + 1, node: { kind: 'start', ...swimlaneSpread(ctx) } };
    case 'stop': return { idx: idx + 1, node: { kind: 'stop', ...swimlaneSpread(ctx) } };
    case 'end': return { idx: idx + 1, node: { kind: 'end', ...swimlaneSpread(ctx) } };
    case 'kill': return { idx: idx + 1, node: { kind: 'kill', ...swimlaneSpread(ctx) } };
    case 'detach': return { idx: idx + 1, node: { kind: 'detach', ...swimlaneSpread(ctx) } };
    case 'break': return { idx: idx + 1, node: { kind: 'break', ...swimlaneSpread(ctx) } };
    default: return null;
  }
}

// ---------------------------------------------------------------------------
// Action: :label; or :label; #color  or multiline :label\n...\n;
// ---------------------------------------------------------------------------
function tryAction(ctx: ParseContext, idx: number, line: string): DispatchResult | null {
  const actionMatch = RE_ACTION.exec(line);
  if (actionMatch === null) return null;
  const label = actionMatch[1]!.trim().replace(RE_ESCAPED_NEWLINE, '\n');
  const stereoRaw = actionMatch[2];
  const colorRaw = actionMatch[3];
  const node: ActivityAction = {
    kind: 'action',
    label,
    ...(stereoRaw !== undefined ? { stereotype: stereoRaw.trim().toLowerCase() } : {}),
    ...(colorRaw !== undefined ? { color: colorRaw } : {}),
    ...swimlaneSpread(ctx),
  };
  return { idx: idx + 1, node };
}

interface MultilineActionBody {
  cursor: number;
  labelParts: string[];
  multiStereo: string | undefined;
}

/** Consumes body lines of a multiline action until its closing `;`
 *  (optionally followed by `<<stereo>>`), or end-of-input. */
function readMultilineActionBody(ctx: ParseContext, startIdx: number, labelParts: string[]): MultilineActionBody {
  const { lines } = ctx;
  let cursor = startIdx;
  let multiStereo: string | undefined;
  while (cursor < lines.length) {
    const raw = lines[cursor]!;
    const inner = raw.trim();
    const closeMatch = RE_ACTION_CLOSE.exec(inner);
    if (closeMatch !== null) {
      const withoutSemi = closeMatch[1]!.trim();
      if (withoutSemi !== '') labelParts.push(withoutSemi);
      const sc = closeMatch[2];
      if (sc !== undefined) multiStereo = sc.trim().toLowerCase();
      cursor++;
      break;
    }
    if (inner !== '') labelParts.push(raw);
    cursor++;
  }
  return { cursor, labelParts, multiStereo };
}

/** Multiline action: starts with `:` but no closing `;` on the same line. */
function tryMultilineAction(ctx: ParseContext, idx: number, line: string): DispatchResult | null {
  if (!line.startsWith(':') || line.includes(';')) return null;
  const firstPart = line.slice(1).trim();
  const labelParts: string[] = [];
  if (firstPart !== '') labelParts.push(firstPart);
  const body = readMultilineActionBody(ctx, idx + 1, labelParts);
  const node: ActivityAction = {
    kind: 'action',
    label: body.labelParts.join('\n'),
    ...(body.multiStereo !== undefined ? { stereotype: body.multiStereo } : {}),
    ...swimlaneSpread(ctx),
  };
  return { idx: body.cursor, node };
}

// ---------------------------------------------------------------------------
// while / endwhile
// ---------------------------------------------------------------------------
function tryWhile(ctx: ParseContext, idx: number, line: string): DispatchResult | null {
  const whileMatch = RE_WHILE.exec(line);
  if (whileMatch === null) return null;
  const { lines } = ctx;
  const condition = whileMatch[1]!.trim();
  const yesLabel = whileMatch[2]?.trim();
  const bodyResult = parseNodes(ctx, idx + 1, ['endwhile']);
  let cursor = bodyResult.nextIdx;
  let exitLabel: string | undefined;
  if (cursor < lines.length) {
    const endLine = lines[cursor]!.trim();
    const endwhileMatch = RE_ENDWHILE.exec(endLine);
    if (endwhileMatch !== null) exitLabel = endwhileMatch[1]?.trim();
    cursor++;
  }
  const node: ActivityWhile = {
    kind: 'while',
    condition,
    ...(yesLabel !== undefined && yesLabel !== '' ? { yesLabel } : {}),
    ...(exitLabel !== undefined && exitLabel !== '' ? { exitLabel } : {}),
    body: bodyResult.nodes,
    ...swimlaneSpread(ctx),
  };
  return { idx: cursor, node };
}

// ---------------------------------------------------------------------------
// repeat / repeatwhile
// `repeat` may stand alone or be followed by an inline action:
//   repeat :foo;  <<stereo>>
// The action becomes the first body element.
// ---------------------------------------------------------------------------
function tryRepeat(ctx: ParseContext, idx: number, line: string, lc: string): DispatchResult | null {
  const repeatHeadMatch = RE_REPEAT_HEAD.exec(line);
  if (repeatHeadMatch === null || !lc.startsWith('repeat')) return null;
  const { lines } = ctx;
  let cursor = idx + 1;
  const inlineRest = repeatHeadMatch[1]?.trim();
  const inlineNodes: ActivityNode[] = [];
  if (inlineRest !== undefined && inlineRest !== '') {
    // Parse the inline content as a virtual line — most commonly an action
    // :label; with optional <<stereotype>>. The action regex requires a
    // `;` followed by optional stereotype/color suffixes, so leave the
    // line as-is when it already terminates properly and only synthesize
    // a `;` for bare `:label`.
    const restLine = RE_REPEAT_INLINE_TERMINATOR.test(inlineRest) ? inlineRest : inlineRest + ';';
    const actionM = RE_ACTION.exec(restLine);
    if (actionM !== null) {
      const label = actionM[1]!.trim().replace(RE_ESCAPED_NEWLINE, '\n');
      const stereoRaw = actionM[2];
      const colorRaw = actionM[3];
      const node: ActivityAction = {
        kind: 'action',
        label,
        ...(stereoRaw !== undefined ? { stereotype: stereoRaw.trim().toLowerCase() } : {}),
        ...(colorRaw !== undefined ? { color: colorRaw } : {}),
        ...swimlaneSpread(ctx),
      };
      inlineNodes.push(node);
    }
  }
  const bodyResult = parseNodes(ctx, cursor, ['repeatwhile', 'repeat while']);
  cursor = bodyResult.nextIdx;
  let condition = '';
  if (cursor < lines.length) {
    const endLine = lines[cursor]!.trim();
    const repeatMatch = RE_REPEATWHILE.exec(endLine);
    if (repeatMatch !== null) condition = repeatMatch[1]?.trim() ?? '';
    cursor++;
  }
  const node: ActivityRepeat = {
    kind: 'repeat',
    body: [...inlineNodes, ...bodyResult.nodes],
    condition,
    ...swimlaneSpread(ctx),
  };
  return { idx: cursor, node };
}

// ---------------------------------------------------------------------------
// fork / fork again / end fork
// ---------------------------------------------------------------------------
function tryFork(ctx: ParseContext, idx: number, _line: string, lc: string): DispatchResult | null {
  if (lc !== 'fork') return null;
  const { lines } = ctx;
  let cursor = idx + 1;
  const branches: ActivityNode[][] = [];
  const FORK_STOPS: StopKeywords = ['fork again', 'end fork'];
  let done = false;
  while (!done) {
    const branchResult = parseNodes(ctx, cursor, FORK_STOPS);
    branches.push(branchResult.nodes);
    cursor = branchResult.nextIdx;
    if (cursor >= lines.length) break;
    const sep = lines[cursor]!.trim().toLowerCase();
    if (sep === 'end fork') {
      cursor++;
      done = true;
    } else if (sep === 'fork again') {
      cursor++;
    } else {
      done = true;
    }
  }
  const node: ActivityFork = { kind: 'fork', branches, ...swimlaneSpread(ctx) };
  return { idx: cursor, node };
}

// ---------------------------------------------------------------------------
// split / split again / end split
// ---------------------------------------------------------------------------
function trySplit(ctx: ParseContext, idx: number, _line: string, lc: string): DispatchResult | null {
  if (lc !== 'split') return null;
  const { lines } = ctx;
  let cursor = idx + 1;
  const branches: ActivityNode[][] = [];
  const SPLIT_STOPS: StopKeywords = ['split again', 'end split'];
  let done = false;
  while (!done) {
    const branchResult = parseNodes(ctx, cursor, SPLIT_STOPS);
    branches.push(branchResult.nodes);
    cursor = branchResult.nextIdx;
    if (cursor >= lines.length) break;
    const sep = lines[cursor]!.trim().toLowerCase();
    if (sep === 'end split') {
      cursor++;
      done = true;
    } else if (sep === 'split again') {
      cursor++;
    } else {
      done = true;
    }
  }
  const node: ActivitySplit = { kind: 'split', branches, ...swimlaneSpread(ctx) };
  return { idx: cursor, node };
}

/** note right : text  (single-line) */
function tryNoteSingle(ctx: ParseContext, idx: number, line: string): DispatchResult | null {
  const noteSingleMatch = RE_NOTE_SINGLE.exec(line);
  if (noteSingleMatch === null) return null;
  const direction = noteSingleMatch[1]?.toLowerCase();
  const position: 'left' | 'right' = direction === 'left' ? 'left' : 'right';
  const node: ActivityNote = {
    kind: 'note',
    text: noteSingleMatch[2]!.trim(),
    position,
    ...swimlaneSpread(ctx),
  };
  return { idx: idx + 1, node };
}

/** note left/right (multi-line, ends with "end note") */
function tryNoteMulti(ctx: ParseContext, idx: number, line: string): DispatchResult | null {
  const noteMultiMatch = RE_NOTE_MULTI.exec(line);
  if (noteMultiMatch === null) return null;
  const { lines } = ctx;
  const direction = noteMultiMatch[1]?.toLowerCase();
  const position: 'left' | 'right' = direction === 'left' ? 'left' : 'right';
  let cursor = idx + 1;
  const textLines: string[] = [];
  while (cursor < lines.length) {
    const inner = lines[cursor]!.trim();
    if (inner.toLowerCase() === 'end note') {
      cursor++;
      break;
    }
    if (inner !== '') textLines.push(inner);
    cursor++;
  }
  const node: ActivityNote = { kind: 'note', text: textLines.join('\n'), position, ...swimlaneSpread(ctx) };
  return { idx: cursor, node };
}

/** Arrow label: -> label ;  or  -><back:color> label ; -- annotates the
 *  next drawn edge with a text label and optional color pill. */
function tryArrowLabel(ctx: ParseContext, idx: number, line: string): DispatchResult | null {
  if (!line.startsWith('->')) return null;
  const arrowMatch = RE_ARROW_LABEL.exec(line);
  if (arrowMatch === null) return null;
  const color = arrowMatch[1]?.trim() || undefined;
  const label = arrowMatch[2]?.trim() ?? '';
  const node: ActivityArrowLabel = {
    kind: 'arrow-label',
    label,
    ...(color !== undefined ? { color } : {}),
    ...swimlaneSpread(ctx),
  };
  return { idx: idx + 1, node };
}

/**
 * title/caption/legend/header/footer/mainframe (mission G0b/T6,
 * decisions.md D3) -- tried last, right before the unknown-line fallback
 * (spec position: former parser.ts:607-610). Activity's own multiline note
 * body (`tryNoteMulti` above) already owns its lines via a dedicated inner
 * while-loop that never falls through to this point, so a `title`-shaped
 * line inside a note body is never stolen (same top-level-only guarantee
 * as sequence's note bodies).
 */
function tryAnnotation(ctx: ParseContext, idx: number): DispatchResult | null {
  const match = matchAnnotationCommand(ctx.lines, idx, ctx.annotations);
  if (match === null) return null;
  return { idx: idx + match.consumed };
}

const LINE_HANDLERS: readonly LineHandler[] = [
  trySwimlane, trySimpleKeyword, tryAction, tryMultilineAction, tryIf, tryWhile, tryRepeat, tryFork,
  trySplit, tryNoteSingle, tryNoteMulti, tryArrowLabel, tryAnnotation,
];

/** Dispatch one non-blank, pre-stripped line: the first handler in
 *  {@link LINE_HANDLERS} that recognizes it wins (same priority order as
 *  the original single-function dispatch chain). An unrecognized line is
 *  skipped silently -- one line consumed, no node produced. */
function dispatchLine(ctx: ParseContext, idx: number, line: string, lc: string): DispatchResult {
  for (const handler of LINE_HANDLERS) {
    const result = handler(ctx, idx, line, lc);
    if (result !== null) return result;
  }
  return { idx: idx + 1 };
}

/** Read nodes from `ctx.lines` from `idx` until a trimmed lowercase line
 *  matches one of `stops`, or end-of-input; returns the collected nodes
 *  and the index of the line that triggered the stop. */
export function parseNodes(ctx: ParseContext, idx: number, stops: StopKeywords): ParseResult {
  const nodes: ActivityNode[] = [];
  const { lines } = ctx;
  let cursor = idx;

  while (cursor < lines.length) {
    const raw = lines[cursor]!;
    let line = raw.trim();

    if (line === '') {
      cursor++;
      continue;
    }

    // PlantUML accepts a trailing `;` on most control-flow keywords
    // (`start;`, `endif;`, `else (yes);`, etc.). Strip it for non-action
    // lines so the rest of the parser can match them as bare keywords.
    // Action lines themselves use `:label;` syntax — we must not touch
    // those, so this only applies to lines that do not start with `:`.
    if (!line.startsWith(':') && line.endsWith(';')) {
      line = line.slice(0, -1).trimEnd();
    }

    const lc = line.toLowerCase();

    // Check stop condition before dispatching.
    if (matchesStopKeyword(lc, stops)) break;

    const result = dispatchLine(ctx, cursor, line, lc);
    if (result.node !== undefined) nodes.push(result.node);
    cursor = result.idx;
  }

  return { nodes, nextIdx: cursor };
}
