/**
 * Locates and parses a call-site `name(arg1, arg2, ...)` within a single
 * source line — the subset of `EaterFunctionCall.java` needed to find where
 * a registered procedure (or the `%invoke_procedure` builtin) is invoked
 * inline in ordinary content.
 *
 * @see ~/git/plantuml/.../tim/EaterFunctionCall.java
 * @see ~/git/plantuml/.../tim/TContext.java#getFunctionNameAt (word-boundary
 *   rule: a call name must start at position 0, right after a non-word
 *   character, or be `%`/`$`-prefixed — those two prefixes are always
 *   allowed to start mid-word since they're unambiguous markers)
 */

import { splitTopLevel } from './split-top-level.js';

export interface CallMatch {
  readonly name: string;
  readonly start: number;
}

export interface CallArgs {
  readonly rawArgs: readonly string[];
  /** Index of the first character after the call's closing `)`. */
  readonly end: number;
}

function isWordChar(ch: string | undefined): boolean {
  return ch !== undefined && /[A-Za-z0-9_]/.test(ch);
}

/**
 * Find the leftmost position in `line` where one of `names` is called
 * (i.e. immediately followed by `(`), honoring the word-boundary rule.
 * Ties at the same position prefer the longest matching name.
 */
export function findCallStart(line: string, names: readonly string[]): CallMatch | null {
  for (let i = 0; i < line.length; i++) {
    const best = bestNameAt(line, i, names);
    if (best !== null) return { name: best, start: i };
  }
  return null;
}

function bestNameAt(line: string, i: number, names: readonly string[]): string | null {
  let best: string | null = null;
  for (const name of names) {
    if (!callStartsHere(line, i, name)) continue;
    if (best === null || name.length > best.length) best = name;
  }
  return best;
}

function callStartsHere(line: string, i: number, name: string): boolean {
  if (!line.startsWith(name, i)) return false;
  if (line[i + name.length] !== '(') return false;
  return i === 0 || !isWordChar(line[i - 1]) || name.startsWith('%') || name.startsWith('$');
}

/**
 * Parse the argument list of a call already known to start at `start` with
 * `name(`. Returns `null` if the parentheses are unbalanced (malformed —
 * treated as a non-match by the caller).
 */
export function parseCallArgs(line: string, start: number, name: string): CallArgs | null {
  const openParen = start + name.length;
  if (line[openParen] !== '(') return null;

  const close = findMatchingClose(line, openParen);
  if (close === null) return null;

  return {
    rawArgs: splitTopLevel(line.slice(openParen + 1, close), ','),
    end: close + 1,
  };
}

/** Find the index of the `)` matching the `(` at `openParen`, skipping over
 * quoted strings and nested parentheses. */
function findMatchingClose(line: string, openParen: number): number | null {
  let depth = 1;
  let inQuote: string | null = null;
  for (let i = openParen + 1; i < line.length; i++) {
    const ch = line[i]!;
    if (inQuote !== null) {
      if (ch === inQuote) inQuote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inQuote = ch;
      continue;
    }
    if (ch === '(') depth++;
    else if (ch === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return null;
}
