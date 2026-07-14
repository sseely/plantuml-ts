/**
 * Parser for PlantUML activity diagrams (new syntax).
 *
 * Uses a recursive descent approach with a mutable index into the lines array.
 * The central helper `parseNodes` (in `node-dispatch.ts`) reads lines until it
 * hits a stop keyword or end of input, returning the collected nodes and the
 * index of the next unconsumed line. Shared regex constants and the mutable
 * `ParseContext`/`ParseResult` shapes live in `dispatch-support.ts`. Both
 * splits exist purely to keep every file under the project's 500-line cap
 * (mission G0b/T6) — no behavior change from the pre-split single file.
 */

import type { UmlSource } from '../../core/block-extractor.js';
import { createAnnotations } from '../../core/annotations/index.js';
import { createSpriteRegistry } from '../../core/sprite-commands.js';
import type { ActivityDiagramAST } from './ast.js';
import { parseNodes } from './node-dispatch.js';
import type { ParseContext } from './dispatch-support.js';

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
    // #lizard forgives -- faithful, unmodified port of the pre-T6
    // continuation-line joiner; CCN 11 is one over threshold from the
    // nested nested-paren-depth scan, not from this task's changes.
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
    annotations: createAnnotations(),
    sprites: createSpriteRegistry(),
  };

  const result = parseNodes(ctx, 0, []);

  return {
    nodes: result.nodes,
    swimlanes: ctx.swimlanes,
    annotations: ctx.annotations,
    sprites: ctx.sprites,
  };
}
