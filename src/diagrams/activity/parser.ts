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
const RE_ACTION = /^:(.+?);\s*(?:<<([^>]*)>>)?\s*(?:(#\w+))?\s*$/;

/** Closing line of a multi-line action: content; optionally followed by <<stereo>> */
const RE_ACTION_CLOSE = /^(.*?);\s*(?:<<([^>]*)>>)?\s*$/;

/** if (condition?) then (label?) */
const RE_IF = /^if\s*\(([^)]*)\)\s*(?:then\s*(?:\(([^)]*)\))?)?\s*$/i;

/** elseif (condition?) then (label?) — accepts `elseif` and `else if` */
const RE_ELSEIF = /^else\s*if\s*\(([^)]*)\)\s*(?:then\s*(?:\(([^)]*)\))?)?\s*$/i;

/** else (label?) */
const RE_ELSE = /^else\s*(?:\(([^)]*)\))?\s*$/i;

/** while (condition) [is|equals (yesLabel)] */
const RE_WHILE = /^while\s*\(([^)]*)\)\s*(?:(?:is|equals?)\s*\(([^)]*)\))?\s*$/i;

/** endwhile (exitLabel?) */
const RE_ENDWHILE = /^endwhile\s*(?:\(([^)]*)\))?\s*$/i;

/** repeatwhile / repeat while (condition?) [is (yesLabel)] [not (noLabel)] */
const RE_REPEATWHILE =
  /^repeat\s*while(?:\s*\(([^)]*)\))?(?:\s*(?:is|equals?)\s*\(([^)]*)\))?(?:\s*not\s*\(([^)]*)\))?\s*$/i;

/**
 * Single-line note: "note (left|right)? : text"  — the direction is
 * optional. When omitted the note defaults to floating to the right of
 * the previous activity (matches upstream PlantUML behaviour).
 */
const RE_NOTE_SINGLE = /^note(?:\s+(left|right))?\s*:\s*(.+)$/i;

/** note (left|right)? (multi-line) — direction defaults to right when absent */
const RE_NOTE_MULTI = /^note(?:\s+(left|right))?\s*$/i;

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
    let line = raw.trim();

    if (line === '') {
      idx++;
      continue;
    }

    // PlantUML accepts a trailing `;` on most control-flow keywords
    // (`start;`, `endif;`, `else (yes);`, etc.). Strip it for
    // non-action lines so the rest of the parser can match them as
    // bare keywords. Action lines themselves use `:label;` syntax —
    // we must not touch those, so this only applies to lines that
    // do not start with `:`.
    if (!line.startsWith(':') && line.endsWith(';')) {
      line = line.slice(0, -1).trimEnd();
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
      const label = actionMatch[1]!.trim().replace(/\\n/g, '\n');
      const stereoRaw = actionMatch[2];
      const colorRaw = actionMatch[3];
      const node: ActivityAction = {
        kind: 'action',
        label,
        ...(stereoRaw !== undefined ? { stereotype: stereoRaw.trim().toLowerCase() } : {}),
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
      let multiStereo: string | undefined;
      while (idx < lines.length) {
        const raw = lines[idx]!;
        const inner = raw.trim();
        const closeMatch = RE_ACTION_CLOSE.exec(inner);
        if (closeMatch !== null) {
          const withoutSemi = closeMatch[1]!.trim();
          if (withoutSemi !== '') labelParts.push(withoutSemi);
          const sc = closeMatch[2];
          if (sc !== undefined) multiStereo = sc.trim().toLowerCase();
          idx++;
          break;
        }
        if (inner !== '') labelParts.push(raw);
        idx++;
      }
      const node: ActivityAction = {
        kind: 'action',
        label: labelParts.join('\n'),
        ...(multiStereo !== undefined ? { stereotype: multiStereo } : {}),
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
      let elseLabel: string | undefined;

      // Consume the sequence of elseif / else / endif clauses.
      while (idx < lines.length) {
        let clauseLine = lines[idx]!.trim();
        // Match the same trailing-`;` strip the main loop applies, so
        // `else (no);` and `endif;` are recognised here too.
        if (!clauseLine.startsWith(':') && clauseLine.endsWith(';')) {
          clauseLine = clauseLine.slice(0, -1).trimEnd();
        }
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
          elseLabel = elseMatch[1]?.trim();
          idx++;
          const ELSE_STOPS: StopKeywords = ['endif'];
          const elseResult = parseNodes(ctx, idx, ELSE_STOPS);
          elseBranch = elseResult.nodes;
          idx = elseResult.nextIdx;
          // consume endif (also tolerate a trailing `;`)
          if (idx < lines.length) {
            let endLine = lines[idx]!.trim();
            if (!endLine.startsWith(':') && endLine.endsWith(';')) {
              endLine = endLine.slice(0, -1).trimEnd();
            }
            if (endLine.toLowerCase() === 'endif') {
              idx++;
            }
          }
          break;
        }

        // Unexpected line inside if block; treat as unknown
        idx++;
      }

      // Always push exactly one if node per `if (...)` opener
      const ifNode: ActivityIf = {
        kind: 'if',
        condition,
        ...(thenLabel !== undefined && thenLabel !== '' ? { thenLabel } : {}),
        ...(elseLabel !== undefined && elseLabel !== '' ? { elseLabel } : {}),
        thenBranch,
        elseBranch,
        elseIfBranches,
        ...swimlaneSpread(ctx),
      };
      nodes.push(ifNode);
      continue;
    }

    // -----------------------------------------------------------------------
    // while / endwhile
    // -----------------------------------------------------------------------
    const whileMatch = RE_WHILE.exec(line);
    if (whileMatch !== null) {
      const condition = whileMatch[1]!.trim();
      const yesLabel = whileMatch[2]?.trim();
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
        ...(yesLabel !== undefined && yesLabel !== '' ? { yesLabel } : {}),
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
    // `repeat` may stand alone or be followed by an inline action:
    //   repeat :foo;  <<stereo>>
    // The action becomes the first body element.
    const repeatHeadMatch = /^repeat(?:\s+(.*))?$/i.exec(line);
    if (repeatHeadMatch !== null && lc.startsWith('repeat')) {
      idx++;
      const inlineRest = repeatHeadMatch[1]?.trim();
      const inlineNodes: ActivityNode[] = [];
      if (inlineRest !== undefined && inlineRest !== '') {
        // Parse the inline content as a virtual line — most commonly
        // an action :label; with optional <<stereotype>>. The action
        // regex requires a `;` followed by optional stereotype/color
        // suffixes, so leave the line as-is when it already terminates
        // properly and only synthesize a `;` for bare `:label`.
        const restLine = /;\s*(?:<<[^>]*>>)?\s*(?:#\w+)?\s*$/.test(inlineRest)
          ? inlineRest
          : inlineRest + ';';
        const actionM = RE_ACTION.exec(restLine);
        if (actionM !== null) {
          const label = actionM[1]!.trim().replace(/\\n/g, '\n');
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
        body: [...inlineNodes, ...bodyResult.nodes],
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
      const direction = noteSingleMatch[1]?.toLowerCase();
      const position: 'left' | 'right' =
        direction === 'left' ? 'left' : 'right';
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
      const direction = noteMultiMatch[1]?.toLowerCase();
      const position: 'left' | 'right' =
        direction === 'left' ? 'left' : 'right';
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

/**
 * Joins continuation lines for control-flow openers (if / elseif / while)
 * whose parentheses spill over onto the next line. PlantUML upstream allows
 * labels like `then (yes on\nseveral line)` — the parser only matches lines
 * with balanced parentheses, so unbalanced openers must be folded together
 * with subsequent lines until paren depth returns to zero.
 *
 * Lines that already balance or that are not control-flow openers are
 * returned unchanged. Newlines inside the joined text become spaces; this
 * matches upstream's behaviour where multi-line labels are flattened.
 */
function joinUnbalancedLines(lines: readonly string[]): string[] {
  const RE_OPENER = /^\s*(?:if|elseif|while|else|repeatwhile|repeat\s+while|endwhile)\b/i;
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (!RE_OPENER.test(line)) {
      out.push(line);
      i++;
      continue;
    }
    let combined = line;
    let depth = countParenDepth(combined);
    let j = i + 1;
    while (depth > 0 && j < lines.length) {
      combined += ' ' + lines[j]!.trim();
      depth = countParenDepth(combined);
      j++;
    }
    out.push(combined);
    i = j > i + 1 ? j : i + 1;
  }
  return out;
}

function countParenDepth(s: string): number {
  let depth = 0;
  for (const ch of s) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
  }
  return depth;
}

export function parseActivity(block: UmlSource): ActivityDiagramAST {
  const joinedLines = joinUnbalancedLines(block.lines);
  const ctx: ParseContext = {
    lines: joinedLines,
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
