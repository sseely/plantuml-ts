/**
 * Shared regex constants, stop-keyword matching, and the mutable parse
 * context/result shapes for the activity diagram recursive-descent parser.
 * Split out of parser.ts (mission G0b/T6) purely to keep `node-dispatch.ts`
 * (which needs these) and `parser.ts` under the project's 500-line file cap
 * -- no behavior change; every export here is verbatim code moved from
 * parser.ts.
 */

import type { DiagramAnnotations } from '../../core/annotations/index.js';
import type { ActivityNode } from './ast.js';

// ---------------------------------------------------------------------------
// Regex constants
// ---------------------------------------------------------------------------

/** Matches a swimlane header: |name| or |[#color]name| */
export const RE_SWIMLANE = /^\|(?:\[#[^\]]*\])?([^|]+)\|\s*$/;

/** Matches an action line: :label; or :label; <<stereo>> or :label; #color */
export const RE_ACTION = /^:(.+?);\s*(?:<<([^>]*)>>)?\s*(?:(#\w+))?\s*$/;

/** Closing line of a multi-line action: content; optionally followed by <<stereo>> */
export const RE_ACTION_CLOSE = /^(.*?);\s*(?:<<([^>]*)>>)?\s*$/;

/** if (condition?) then (label?) */
export const RE_IF = /^if\s*\(([^)]*)\)\s*(?:then\s*(?:\(([^)]*)\))?)?\s*$/i;

/** elseif (condition?) then (label?) — accepts `elseif` and `else if` */
export const RE_ELSEIF = /^else\s*if\s*\(([^)]*)\)\s*(?:then\s*(?:\(([^)]*)\))?)?\s*$/i;

/** else (label?) */
export const RE_ELSE = /^else\s*(?:\(([^)]*)\))?\s*$/i;

/** while (condition) [is|equals (yesLabel)] */
export const RE_WHILE = /^while\s*\(([^)]*)\)\s*(?:(?:is|equals?)\s*\(([^)]*)\))?\s*$/i;

/** endwhile (exitLabel?) */
export const RE_ENDWHILE = /^endwhile\s*(?:\(([^)]*)\))?\s*$/i;

/** repeatwhile / repeat while (condition?) [is (yesLabel)] [not (noLabel)] */
export const RE_REPEATWHILE =
  /^repeat\s*while(?:\s*\(([^)]*)\))?(?:\s*(?:is|equals?)\s*\(([^)]*)\))?(?:\s*not\s*\(([^)]*)\))?\s*$/i;

/**
 * Single-line note: "note (left|right)? : text"  — the direction is
 * optional. When omitted the note defaults to floating to the right of
 * the previous activity (matches upstream PlantUML behaviour).
 */
export const RE_NOTE_SINGLE = /^note(?:\s+(left|right))?\s*:\s*(.+)$/i;

/** note (left|right)? (multi-line) — direction defaults to right when absent */
export const RE_NOTE_MULTI = /^note(?:\s+(left|right))?\s*$/i;

/**
 * Matches arrow-label lines:
 *   -> label ;
 *   -><back:color> label ;
 *   -><color:color> label ;
 *
 * Capture group 1: optional color value (e.g. "red", "#FF0000")
 * Capture group 2: label text
 */
export const RE_ARROW_LABEL =
  /^->(?:<(?:back|color):([^>]+)>)?\s*(.*?)\s*;?\s*$/i;

/** `repeat` head, optionally followed by an inline action on the same
 *  line (`repeat :foo;`). Built via `new RegExp` (not a `/.../ ` literal):
 *  Lizard 1.23.0 miscounts brace depth for a trailing `$` inside a /regex/
 *  literal that sits INSIDE a function body -- this constant used to live
 *  inline in `parseNodes` and silently truncated that function's CCN/NLOC
 *  measurement (and defeated `#lizard forgives`) until hoisted here. */
export const RE_REPEAT_HEAD = new RegExp('^repeat(?:\\s+(.*))?$', 'i');

/** Trailing `;` (optionally `<<stereo>>`) on a `repeat`'s inline action --
 *  same lizard brace-depth workaround as {@link RE_REPEAT_HEAD} above, and
 *  additionally contains `<`/`>`, which the project's regex-hoisting
 *  convention also requires building from a string. */
export const RE_REPEAT_INLINE_TERMINATOR = new RegExp(
  ';\\s*(?:<<[^>]*>>)?\\s*(?:#\\w+)?\\s*$',
);

/** Literal `\n` (backslash-n) escape inside an action label -> real
 *  newline. Hoisted alongside the constants above for the same lizard
 *  brace-depth workaround (empirically, this one also contributed to the
 *  false truncation even though it carries none of `$<>{}`). */
export const RE_ESCAPED_NEWLINE = /\\n/g;

// ---------------------------------------------------------------------------
// Stop-keyword matching
//
// Stop keywords are word-prefix patterns: a line matches a stop keyword if
// the trimmed lowercase line equals the keyword OR starts with the keyword
// followed by a space. This handles `endwhile (label)`, `elseif (cond) then`,
// `repeatwhile (cond)`, etc.
// ---------------------------------------------------------------------------

export type StopKeywords = readonly string[];

export function matchesStopKeyword(lineLc: string, stops: StopKeywords): boolean {
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

export interface ParseContext {
  lines: readonly string[];
  swimlanes: string[];
  swimlaneSet: Set<string>;
  currentSwimlane: string | undefined;
  /** title/caption/legend/header/footer/mainframe chrome (mission G0b/T6),
   *  mutated in place by `matchAnnotationCommand` during `parseNodes`. */
  annotations: DiagramAnnotations;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function setCurrentSwimlane(ctx: ParseContext, name: string): void {
  ctx.currentSwimlane = name;
  if (!ctx.swimlaneSet.has(name)) {
    ctx.swimlaneSet.add(name);
    ctx.swimlanes.push(name);
  }
}

export function swimlaneSpread(
  ctx: ParseContext,
): { swimlane: string } | Record<string, never> {
  return ctx.currentSwimlane !== undefined
    ? { swimlane: ctx.currentSwimlane }
    : {};
}

// ---------------------------------------------------------------------------
// Core recursive descent
// ---------------------------------------------------------------------------

export interface ParseResult {
  nodes: ActivityNode[];
  nextIdx: number;
}

// ---------------------------------------------------------------------------
// Line-dispatch shared shapes (node-dispatch.ts, if-dispatch.ts)
// ---------------------------------------------------------------------------

/** One line-shape handler's outcome: the new `idx` (always present, even
 *  on a 1-line skip) and the single node it produced, if any -- every
 *  construct in the dispatch chain (including if/while/repeat/fork/split,
 *  each of which owns a nested body) produces at most one top-level node
 *  per invocation. */
export interface DispatchResult {
  idx: number;
  node?: ActivityNode;
}

export type LineHandler = (
  ctx: ParseContext,
  idx: number,
  line: string,
  lc: string,
) => DispatchResult | null;
