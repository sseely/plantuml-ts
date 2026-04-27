/**
 * Parser for PlantUML activity diagrams (new syntax).
 *
 * Uses a recursive descent approach with a mutable index into the lines array.
 * The central helper `parseNodes` reads lines until it hits a stop keyword or
 * end of input, returning the collected nodes and the index of the next
 * unconsumed line.
 */

import type { UmlSource } from '../../core/block-extractor.js';
import type {
  ActivityDiagramAST,
  ActivityNode,
  ActivityAction,
  ActivityArrowLabel,
  ActivityStart,
  ActivityStop,
  ActivityEnd,
  ActivityKill,
  ActivityDetach,
  ActivityBreak,
  ActivityIf,
  ActivityElseIf,
  ActivityWhile,
  ActivityRepeat,
  ActivityFork,
  ActivitySplit,
  ActivityNote,
} from './ast.js';

// ---------------------------------------------------------------------------
// Regex constants
// ---------------------------------------------------------------------------

/** Matches a swimlane header: |name| or |[#color]name| */
const RE_SWIMLANE = /^\|(?:\[#[^\]]*\])?([^|]+)\|\s*$/;

/** Matches an action line: :label; or :label; <<stereo>> or :label; #color */
const RE_ACTION = /^:(.+?);\s*(?:<<[^>]*>>)?\s*(?:(#\w+))?\s*$/;

/** Closing line of a multi-line action: content; optionally followed by <<stereo>> */
const RE_ACTION_CLOSE = /^(.*?);\s*(?:<<[^>]*>>)?\s*$/;

/** if (condition?) then (label?) */
const RE_IF = /^if\s*\(([^)]*)\)\s*(?:then\s*(?:\(([^)]*)\))?)?\s*$/i;

/** elseif (condition?) then (label?) */
const RE_ELSEIF = /^elseif\s*\(([^)]*)\)\s*(?:then\s*(?:\(([^)]*)\))?)?\s*$/i;

/** else (label?) */
const RE_ELSE = /^else\s*(?:\(([^)]*)\))?\s*$/i;

/** while (condition) */
const RE_WHILE = /^while\s*\(([^)]*)\)\s*$/i;

/** endwhile (exitLabel?) */
const RE_ENDWHILE = /^endwhile\s*(?:\(([^)]*)\))?\s*$/i;

/** repeatwhile / repeat while (condition?) */
const RE_REPEATWHILE = /^repeat\s*while(?:\s*\(([^)]*)\))?\s*$/i;

/** note left or note right: single-line variant "note right : text" */
const RE_NOTE_SINGLE = /^note\s+(left|right)\s*:\s*(.+)$/i;

/** note left / note right (multi-line) */
const RE_NOTE_MULTI = /^note\s+(left|right)\s*$/i;

/**
 * Matches arrow-label lines:
 *   -> label ;
 *   -><back:color> label ;
 *   -><color:color> label ;
 *
 * Capture group 1: optional color value (e.g. "red", "#FF0000")
 * Capture group 2: label text
 */
const RE_ARROW_LABEL =
  /^->(?:<(?:back|color):([^>]+)>)?\s*(.*?)\s*;?\s*$/i;

// ---------------------------------------------------------------------------
// Stop-keyword matching
//
// Stop keywords are word-prefix patterns: a line matches a stop keyword if
// the trimmed lowercase line equals the keyword OR starts with the keyword
// followed by a space. This handles `endwhile (label)`, `elseif (cond) then`,
// `repeatwhile (cond)`, etc.
// ---------------------------------------------------------------------------

type StopKeywords = readonly string[];

function matchesStopKeyword(lineLc: string, stops: StopKeywords): boolean {
  for (const kw of stops) {
    if (lineLc === kw || lineLc.startsWith(kw + ' ') || lineLc.startsWith(kw + '(')) {
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Mutable parse context (shared across recursive calls)
// ---------------------------------------------------------------------------

interface ParseContext {
  lines: readonly string[];
  swimlanes: string[];
  swimlaneSet: Set<string>;
  currentSwimlane: string | undefined;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setCurrentSwimlane(ctx: ParseContext, name: string): void {
  ctx.currentSwimlane = name;
  if (!ctx.swimlaneSet.has(name)) {
    ctx.swimlaneSet.add(name);
    ctx.swimlanes.push(name);
  }
}

function swimlaneSpread(
  ctx: ParseContext,
): { swimlane: string } | Record<string, never> {
  return ctx.currentSwimlane !== undefined
    ? { swimlane: ctx.currentSwimlane }
    : {};
}

// ---------------------------------------------------------------------------
// Core recursive descent
// ---------------------------------------------------------------------------

interface ParseResult {
  nodes: ActivityNode[];
  nextIdx: number;
}

/**
 * Read nodes from `ctx.lines` starting at index `idx` until a trimmed
 * lowercase line matches one of the `stops` prefixes, or end-of-input.
 *
 * Returns the collected nodes and the index of the first line that triggered
 * the stop (so the caller can inspect which keyword ended the block).
 */
function parseNodes(
  ctx: ParseContext,
  idx: number,
  stops: StopKeywords,
): ParseResult {
  const nodes: ActivityNode[] = [];
  const { lines } = ctx;

  while (idx < lines.length) {
    const raw = lines[idx]!;
    const line = raw.trim();

    if (line === '') {
      idx++;
      continue;
    }

    const lc = line.toLowerCase();

    // Check stop condition before dispatching.
    if (matchesStopKeyword(lc, stops)) {
      break;
    }

    // -----------------------------------------------------------------------
    // Swimlane header: |name| or |[#color]name|
    // -----------------------------------------------------------------------
    const swimlaneMatch = RE_SWIMLANE.exec(line);
    if (swimlaneMatch !== null) {
      const name = swimlaneMatch[1]!.trim();
      setCurrentSwimlane(ctx, name);
      idx++;
      continue;
    }

    // -----------------------------------------------------------------------
    // start / stop / end / kill / detach / break
    // -----------------------------------------------------------------------
    if (lc === 'start') {
      const node: ActivityStart = { kind: 'start', ...swimlaneSpread(ctx) };
      nodes.push(node);
      idx++;
      continue;
    }

    if (lc === 'stop') {
      const node: ActivityStop = { kind: 'stop', ...swimlaneSpread(ctx) };
      nodes.push(node);
      idx++;
      continue;
    }

    if (lc === 'end') {
      const node: ActivityEnd = { kind: 'end', ...swimlaneSpread(ctx) };
      nodes.push(node);
      idx++;
      continue;
    }

    if (lc === 'kill') {
      const node: ActivityKill = { kind: 'kill', ...swimlaneSpread(ctx) };
      nodes.push(node);
      idx++;
      continue;
    }

    if (lc === 'detach') {
      const node: ActivityDetach = { kind: 'detach', ...swimlaneSpread(ctx) };
      nodes.push(node);
      idx++;
      continue;
    }

    if (lc === 'break') {
      const node: ActivityBreak = { kind: 'break', ...swimlaneSpread(ctx) };
      nodes.push(node);
      idx++;
      continue;
    }

    // -----------------------------------------------------------------------
    // Action: :label; or :label; #color  or multiline :label\n...\n;
    // -----------------------------------------------------------------------
    const actionMatch = RE_ACTION.exec(line);
    if (actionMatch !== null) {
      const label = actionMatch[1]!.trim();
      const colorRaw = actionMatch[2];
      const node: ActivityAction = {
        kind: 'action',
        label,
        ...(colorRaw !== undefined ? { color: colorRaw } : {}),
        ...swimlaneSpread(ctx),
      };
      nodes.push(node);
      idx++;
      continue;
    }

    // Multiline action: starts with `:` but no closing `;` on the same line.
    if (line.startsWith(':') && !line.includes(';')) {
      const firstPart = line.slice(1).trim();
      const labelParts: string[] = [];
      if (firstPart !== '') {
        labelParts.push(firstPart);
      }
      idx++;
      while (idx < lines.length) {
        const inner = lines[idx]!.trim();
        const closeMatch = RE_ACTION_CLOSE.exec(inner);
        if (closeMatch !== null) {
          const withoutSemi = closeMatch[1]!.trim();
          if (withoutSemi !== '') labelParts.push(withoutSemi);
          idx++;
          break;
        }
        if (inner !== '') labelParts.push(inner);
        idx++;
      }
      const node: ActivityAction = {
        kind: 'action',
        label: labelParts.join('\n'),
        ...swimlaneSpread(ctx),
      };
      nodes.push(node);
      continue;
    }

    // -----------------------------------------------------------------------
    // if / elseif / else / endif
    // -----------------------------------------------------------------------
    const ifMatch = RE_IF.exec(line);
    if (ifMatch !== null) {
      const condition = ifMatch[1]!.trim();
      const thenLabel = ifMatch[2]?.trim();
      idx++;

      // then-branch stops at elseif, else, endif
      const IF_INNER_STOPS: StopKeywords = ['elseif', 'else', 'endif'];
      const thenResult = parseNodes(ctx, idx, IF_INNER_STOPS);
      const thenBranch = thenResult.nodes;
      idx = thenResult.nextIdx;

      const elseIfBranches: ActivityElseIf[] = [];
      let elseBranch: ActivityNode[] = [];

      // Consume the sequence of elseif / else / endif clauses.
      while (idx < lines.length) {
        const clauseLine = lines[idx]!.trim();
        const clauseLc = clauseLine.toLowerCase();

        if (clauseLc === 'endif') {
          idx++;
          break;
        }

        const elseifMatch = RE_ELSEIF.exec(clauseLine);
        if (elseifMatch !== null) {
          const eiCondition = elseifMatch[1]!.trim();
          const eiLabel = elseifMatch[2]?.trim();
          idx++;
          const eiResult = parseNodes(ctx, idx, IF_INNER_STOPS);
          const eiBranch: ActivityElseIf = {
            condition: eiCondition,
            ...(eiLabel !== undefined && eiLabel !== '' ? { label: eiLabel } : {}),
            body: eiResult.nodes,
          };
          elseIfBranches.push(eiBranch);
          idx = eiResult.nextIdx;
          continue;
        }

        const elseMatch = RE_ELSE.exec(clauseLine);
        if (elseMatch !== null) {
          const elseLabel = elseMatch[1]?.trim();
          idx++;
          const ELSE_STOPS: StopKeywords = ['endif'];
          const elseResult = parseNodes(ctx, idx, ELSE_STOPS);
          elseBranch = elseResult.nodes;
          idx = elseResult.nextIdx;

          // Build the if node now so we can attach the elseLabel
          const node: ActivityIf = {
            kind: 'if',
            condition,
            ...(thenLabel !== undefined && thenLabel !== '' ? { thenLabel } : {}),
            ...(elseLabel !== undefined && elseLabel !== '' ? { elseLabel } : {}),
            thenBranch,
            elseBranch,
            elseIfBranches,
            ...swimlaneSpread(ctx),
          };
          nodes.push(node);
          // consume endif
          if (idx < lines.length && lines[idx]!.trim().toLowerCase() === 'endif') {
            idx++;
          }
          break;
        }

        // Unexpected line inside if block; treat as unknown
        idx++;
      }

      // If we exited the while without pushing (endif directly after then, no else)
      const lastPushed = nodes[nodes.length - 1];
      if (lastPushed === undefined || lastPushed.kind !== 'if') {
        const node: ActivityIf = {
          kind: 'if',
          condition,
          ...(thenLabel !== undefined && thenLabel !== '' ? { thenLabel } : {}),
          thenBranch,
          elseBranch,
          elseIfBranches,
          ...swimlaneSpread(ctx),
        };
        nodes.push(node);
      }
      continue;
    }

    // -----------------------------------------------------------------------
    // while / endwhile
    // -----------------------------------------------------------------------
    const whileMatch = RE_WHILE.exec(line);
    if (whileMatch !== null) {
      const condition = whileMatch[1]!.trim();
      idx++;
      const bodyResult = parseNodes(ctx, idx, ['endwhile']);
      idx = bodyResult.nextIdx;
      let exitLabel: string | undefined;
      if (idx < lines.length) {
        const endLine = lines[idx]!.trim();
        const endwhileMatch = RE_ENDWHILE.exec(endLine);
        if (endwhileMatch !== null) {
          exitLabel = endwhileMatch[1]?.trim();
        }
        idx++;
      }
      const node: ActivityWhile = {
        kind: 'while',
        condition,
        ...(exitLabel !== undefined && exitLabel !== '' ? { exitLabel } : {}),
        body: bodyResult.nodes,
        ...swimlaneSpread(ctx),
      };
      nodes.push(node);
      continue;
    }

    // -----------------------------------------------------------------------
    // repeat / repeatwhile
    // -----------------------------------------------------------------------
    if (lc === 'repeat') {
      idx++;
      const bodyResult = parseNodes(ctx, idx, ['repeatwhile', 'repeat while']);
      idx = bodyResult.nextIdx;
      let condition = '';
      if (idx < lines.length) {
        const endLine = lines[idx]!.trim();
        const repeatMatch = RE_REPEATWHILE.exec(endLine);
        if (repeatMatch !== null) {
          condition = repeatMatch[1]?.trim() ?? '';
        }
        idx++;
      }
      const node: ActivityRepeat = {
        kind: 'repeat',
        body: bodyResult.nodes,
        condition,
        ...swimlaneSpread(ctx),
      };
      nodes.push(node);
      continue;
    }

    // -----------------------------------------------------------------------
    // fork / fork again / end fork
    // -----------------------------------------------------------------------
    if (lc === 'fork') {
      idx++;
      const branches: ActivityNode[][] = [];
      const FORK_STOPS: StopKeywords = ['fork again', 'end fork'];
      let done = false;
      while (!done) {
        const branchResult = parseNodes(ctx, idx, FORK_STOPS);
        branches.push(branchResult.nodes);
        idx = branchResult.nextIdx;
        if (idx >= lines.length) break;
        const sep = lines[idx]!.trim().toLowerCase();
        if (sep === 'end fork') {
          idx++;
          done = true;
        } else if (sep === 'fork again') {
          idx++;
        } else {
          done = true;
        }
      }
      const node: ActivityFork = {
        kind: 'fork',
        branches,
        ...swimlaneSpread(ctx),
      };
      nodes.push(node);
      continue;
    }

    // -----------------------------------------------------------------------
    // split / split again / end split
    // -----------------------------------------------------------------------
    if (lc === 'split') {
      idx++;
      const branches: ActivityNode[][] = [];
      const SPLIT_STOPS: StopKeywords = ['split again', 'end split'];
      let done = false;
      while (!done) {
        const branchResult = parseNodes(ctx, idx, SPLIT_STOPS);
        branches.push(branchResult.nodes);
        idx = branchResult.nextIdx;
        if (idx >= lines.length) break;
        const sep = lines[idx]!.trim().toLowerCase();
        if (sep === 'end split') {
          idx++;
          done = true;
        } else if (sep === 'split again') {
          idx++;
        } else {
          done = true;
        }
      }
      const node: ActivitySplit = {
        kind: 'split',
        branches,
        ...swimlaneSpread(ctx),
      };
      nodes.push(node);
      continue;
    }

    // -----------------------------------------------------------------------
    // note right : text  (single-line)
    // -----------------------------------------------------------------------
    const noteSingleMatch = RE_NOTE_SINGLE.exec(line);
    if (noteSingleMatch !== null) {
      const position = noteSingleMatch[1]!.toLowerCase() as 'left' | 'right';
      const noteText = noteSingleMatch[2]!.trim();
      const node: ActivityNote = {
        kind: 'note',
        text: noteText,
        position,
        ...swimlaneSpread(ctx),
      };
      nodes.push(node);
      idx++;
      continue;
    }

    // -----------------------------------------------------------------------
    // note left/right (multi-line, ends with "end note")
    // -----------------------------------------------------------------------
    const noteMultiMatch = RE_NOTE_MULTI.exec(line);
    if (noteMultiMatch !== null) {
      const position = noteMultiMatch[1]!.toLowerCase() as 'left' | 'right';
      idx++;
      const textLines: string[] = [];
      while (idx < lines.length) {
        const inner = lines[idx]!.trim();
        if (inner.toLowerCase() === 'end note') {
          idx++;
          break;
        }
        if (inner !== '') textLines.push(inner);
        idx++;
      }
      const node: ActivityNote = {
        kind: 'note',
        text: textLines.join('\n'),
        position,
        ...swimlaneSpread(ctx),
      };
      nodes.push(node);
      continue;
    }

    // -----------------------------------------------------------------------
    // Arrow label: -> label ;  or  -><back:color> label ;
    // Annotates the next drawn edge with a text label and optional color pill.
    // -----------------------------------------------------------------------
    if (line.startsWith('->')) {
      const arrowMatch = RE_ARROW_LABEL.exec(line);
      if (arrowMatch !== null) {
        const color = arrowMatch[1]?.trim() || undefined;
        const label = arrowMatch[2]?.trim() ?? '';
        const node: ActivityArrowLabel = {
          kind: 'arrow-label',
          label,
          ...(color !== undefined ? { color } : {}),
          ...swimlaneSpread(ctx),
        };
        nodes.push(node);
        idx++;
        continue;
      }
    }

    // -----------------------------------------------------------------------
    // Unknown line: skip silently
    // -----------------------------------------------------------------------
    idx++;
  }

  return { nodes, nextIdx: idx };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function parseActivity(block: UmlSource): ActivityDiagramAST {
  const ctx: ParseContext = {
    lines: block.lines,
    swimlanes: [],
    swimlaneSet: new Set(),
    currentSwimlane: undefined,
  };

  const result = parseNodes(ctx, 0, []);

  return {
    nodes: result.nodes,
    swimlanes: ctx.swimlanes,
  };
}
