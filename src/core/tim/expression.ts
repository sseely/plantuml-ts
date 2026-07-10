/**
 * Argument resolution for TIM procedure calls.
 *
 * Scope note: upstream's non-`unquoted` call path (`EaterFunctionCall`'s
 * `else` branch) tokenizes the full TIM expression grammar via
 * `TokenStack` — arithmetic, JSON, nested function calls, `guessFunctions`,
 * etc. None of this port's corpus fixtures need that; the only
 * non-`unquoted` expression in scope is `%invoke_procedure("_"+$x)`, a
 * string-literal + `$variable` concatenation. This module implements only
 * that reduced grammar: quoted-string literals, `$variable` references,
 * and `+` concatenation. A full expression engine is deferred (would
 * belong in a `tim/expression/TokenStack.ts` port if `!function`/`!return`
 * or richer expressions ever enter scope).
 *
 * @see ~/git/plantuml/.../tim/EaterFunctionCall.java#analyze
 * @see ~/git/plantuml/.../tim/expression/TokenStack.java
 */

import { dequote, isQuoted, splitTopLevel } from './split-top-level.js';

/**
 * Replace every `$name` token in `text` with its bound value. Word-boundary
 * matching only (no full TIM variable-name/emoji charset) — sufficient for
 * this port's `$param` substitution use.
 */
export function substituteParams(text: string, bindings: ReadonlyMap<string, string>): string {
  let result = text;
  for (const [name, value] of bindings) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(`${escaped}(?![A-Za-z0-9_])`, 'g'), value);
  }
  return result;
}

/**
 * Resolve one already-extracted raw call argument to its final string
 * value.
 *
 * - `unquoted` (the calling procedure was declared `!unquoted procedure`):
 *   the argument is literal text — quote-stripped if quoted, else taken
 *   verbatim — with only `$variable` substitution applied. No expressions
 *   (`+`, nested calls) are permitted here upstream either.
 * - normal (quoted): the argument is evaluated as the reduced `+`
 *   concatenation grammar described above.
 *
 * @see ~/git/plantuml/.../tim/EaterFunctionCall.java#analyze
 */
export function resolveArg(
  raw: string,
  bindings: ReadonlyMap<string, string>,
  unquoted: boolean,
): string {
  const trimmed = raw.trim();
  if (unquoted) {
    const literal = isQuoted(trimmed) ? dequote(trimmed) : trimmed;
    return substituteParams(literal, bindings);
  }
  return splitTopLevel(trimmed, '+')
    .map((term) => resolveTerm(term.trim(), bindings))
    .join('');
}

function resolveTerm(term: string, bindings: ReadonlyMap<string, string>): string {
  if (isQuoted(term)) return dequote(term);
  if (term.startsWith('$')) return bindings.get(term) ?? '';
  return term;
}
