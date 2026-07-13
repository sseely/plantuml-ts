/**
 * `if / elseif / else / endif` dispatch for the activity diagram parser.
 * Split out of node-dispatch.ts (mission G0b/T6) purely to keep both files
 * under the project's 500-line file cap -- no behavior change; every
 * export here is verbatim code moved from node-dispatch.ts.
 */

import type { ActivityElseIf, ActivityIf, ActivityNode } from './ast.js';
import {
  RE_ELSE, RE_ELSEIF, RE_IF, swimlaneSpread,
  type DispatchResult, type ParseContext, type StopKeywords,
} from './dispatch-support.js';
import { parseNodes } from './node-dispatch.js';

// ---------------------------------------------------------------------------
// if / elseif / else / endif
// ---------------------------------------------------------------------------
interface IfClauses {
  cursor: number;
  elseIfBranches: ActivityElseIf[];
  elseBranch: ActivityNode[];
  elseLabel: string | undefined;
}

/** Strips the same optional trailing `;` the main dispatch loop applies to
 *  non-action lines, so `else (no);` / `endif;` are recognised here too. */
function stripTrailingSemi(raw: string): string {
  return !raw.startsWith(':') && raw.endsWith(';') ? raw.slice(0, -1).trimEnd() : raw;
}

interface ElseifStep {
  cursor: number;
  branch: ActivityElseIf;
}

/** Consumes one `elseif (...) then (...)` clause and its body. */
function consumeElseifClause(
  ctx: ParseContext,
  cursor: number,
  clauseLine: string,
  ifInnerStops: StopKeywords,
): ElseifStep {
  const elseifMatch = RE_ELSEIF.exec(clauseLine)!;
  const eiLabel = elseifMatch[2]?.trim();
  const eiResult = parseNodes(ctx, cursor + 1, ifInnerStops);
  return {
    cursor: eiResult.nextIdx,
    branch: {
      condition: elseifMatch[1]!.trim(),
      ...(eiLabel !== undefined && eiLabel !== '' ? { label: eiLabel } : {}),
      body: eiResult.nodes,
    },
  };
}

interface ElseStep {
  cursor: number;
  branch: ActivityNode[];
  label: string | undefined;
}

/** Consumes an `else (...)` clause's body, plus its terminating `endif`. */
function consumeElseClause(ctx: ParseContext, cursor: number, clauseLine: string): ElseStep {
  const { lines } = ctx;
  const label = RE_ELSE.exec(clauseLine)![1]?.trim();
  const elseResult = parseNodes(ctx, cursor + 1, ['endif']);
  let next = elseResult.nextIdx;
  // consume endif (also tolerate a trailing `;`)
  if (next < lines.length && stripTrailingSemi(lines[next]!.trim()).toLowerCase() === 'endif') {
    next++;
  }
  return { cursor: next, branch: elseResult.nodes, label };
}

/** Consumes the sequence of `elseif` / `else` / `endif` clauses following
 *  an `if (...)`'s then-branch. */
function consumeIfClauses(ctx: ParseContext, startIdx: number, ifInnerStops: StopKeywords): IfClauses {
  const { lines } = ctx;
  let cursor = startIdx;
  const elseIfBranches: ActivityElseIf[] = [];
  let elseBranch: ActivityNode[] = [];
  let elseLabel: string | undefined;

  while (cursor < lines.length) {
    const clauseLine = stripTrailingSemi(lines[cursor]!.trim());

    if (clauseLine.toLowerCase() === 'endif') {
      cursor++;
      break;
    }

    if (RE_ELSEIF.test(clauseLine)) {
      const step = consumeElseifClause(ctx, cursor, clauseLine, ifInnerStops);
      elseIfBranches.push(step.branch);
      cursor = step.cursor;
      continue;
    }

    if (RE_ELSE.test(clauseLine)) {
      const step = consumeElseClause(ctx, cursor, clauseLine);
      elseBranch = step.branch;
      elseLabel = step.label;
      cursor = step.cursor;
      break;
    }

    // Unexpected line inside if block; treat as unknown
    cursor++;
  }

  return { cursor, elseIfBranches, elseBranch, elseLabel };
}

export function tryIf(ctx: ParseContext, idx: number, line: string): DispatchResult | null {
  const ifMatch = RE_IF.exec(line);
  if (ifMatch === null) return null;
  const condition = ifMatch[1]!.trim();
  const thenLabel = ifMatch[2]?.trim();

  // then-branch stops at elseif, else, endif
  const IF_INNER_STOPS: StopKeywords = ['elseif', 'else', 'endif'];
  const thenResult = parseNodes(ctx, idx + 1, IF_INNER_STOPS);
  const thenBranch = thenResult.nodes;

  const clauses = consumeIfClauses(ctx, thenResult.nextIdx, IF_INNER_STOPS);
  const { cursor, elseIfBranches, elseBranch, elseLabel } = clauses;

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
  return { idx: cursor, node: ifNode };
}

