/**
 * Shared tokenizing helper for the TIM `!procedure` family: splitting a
 * comma- (or operator-) separated list at the top level, ignoring
 * separators that appear inside quoted strings or nested parentheses, plus
 * a one-layer quote stripper.
 *
 * Used by both declaration parsing (`EaterDeclareProcedure` — parameter
 * lists) and call-site parsing (`EaterFunctionCall` — argument lists,
 * `expression` — `+`-concatenation terms).
 *
 * @see ~/git/plantuml/.../tim/Eater.java#eatAndGetOptionalQuotedString
 * @see ~/git/plantuml/.../tim/expression/TokenStack.java#eatUntilCloseParenthesisOrComma
 */

/** Mutable scan state threaded through {@link consumeChar} by {@link splitTopLevel}. */
interface ScanState {
  depth: number;
  inQuote: string | null;
  current: string;
}

/**
 * Consume one character, updating `state` in place and pushing a completed
 * part onto `parts` when `ch` is a top-level `separator`. Factored out of
 * {@link splitTopLevel} to keep both functions under the complexity cap.
 */
function consumeChar(state: ScanState, ch: string, separator: string, parts: string[]): void {
  if (state.inQuote !== null) {
    state.current += ch;
    if (ch === state.inQuote) state.inQuote = null;
    return;
  }
  if (ch === '"' || ch === "'") {
    state.inQuote = ch;
    state.current += ch;
    return;
  }
  if (ch === '(' || ch === ')') {
    state.depth += ch === '(' ? 1 : -1;
    state.current += ch;
    return;
  }
  if (state.depth === 0 && ch === separator) {
    parts.push(state.current.trim());
    state.current = '';
    return;
  }
  state.current += ch;
}

/**
 * Split `text` on every top-level occurrence of `separator` (default `,`),
 * treating anything inside a matching pair of `"`/`'` quotes or `(`/`)` as
 * opaque. Each returned part is trimmed. Returns `[]` for blank input.
 */
export function splitTopLevel(text: string, separator = ','): string[] {
  if (text.trim().length === 0) return [];

  const parts: string[] = [];
  const state: ScanState = { depth: 0, inQuote: null, current: '' };
  for (const ch of text) {
    consumeChar(state, ch, separator, parts);
  }
  parts.push(state.current.trim());
  return parts;
}

/** Strip one layer of matching double- or single-quotes, if present. */
export function dequote(s: string): string {
  if (s.length >= 2) {
    const first = s[0];
    const last = s[s.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return s.slice(1, -1);
    }
  }
  return s;
}

/** True when `s` is fully wrapped in a matching pair of quotes. */
export function isQuoted(s: string): boolean {
  return (
    s.length >= 2 &&
    ((s[0] === '"' && s[s.length - 1] === '"') || (s[0] === "'" && s[s.length - 1] === "'"))
  );
}
