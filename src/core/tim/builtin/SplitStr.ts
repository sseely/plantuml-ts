/**
 * `%splitstr(s, separatorChars)` -- tokenizes `s` on any character in
 * `separatorChars` (`java.util.StringTokenizer` semantics: consecutive
 * separators produce no empty tokens, leading/trailing separators are
 * dropped), returning a JSON array of the tokens.
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/builtin/SplitStr.java
 */

import { TValue } from '../expression/TValue.js';
import type { JsonValue } from '../expression/Token.js';
import { TFunctionSignature } from '../TFunctionSignature.js';
import { SimpleReturnFunction } from './SimpleReturnFunction.js';

const SIGNATURE = new TFunctionSignature('%splitstr', 3);

/**
 * `java.util.StringTokenizer(str, delimiters)` equivalent: split on any
 * character in `delimiters`, discarding empty tokens (consecutive or
 * leading/trailing delimiters never produce a `""` entry).
 */
function tokenize(str: string, delimiters: string): string[] {
  const delimSet = new Set(delimiters);
  const tokens: string[] = [];
  let current = '';
  for (const ch of str) {
    if (delimSet.has(ch)) {
      if (current.length > 0) tokens.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.length > 0) tokens.push(current);
  return tokens;
}

export class SplitStr extends SimpleReturnFunction {
  getSignature(): TFunctionSignature {
    return SIGNATURE;
  }

  canCover(nbArg: number, _namedArguments: ReadonlySet<string>): boolean {
    return nbArg === 2;
  }

  executeReturnFunction(
    _context: unknown,
    _memory: unknown,
    _location: unknown,
    values: readonly TValue[],
    _named: ReadonlyMap<string, TValue>,
  ): TValue {
    const str = values[0]!.toString();
    const separator = values[1]!.toString();
    const result: JsonValue[] = tokenize(str, separator);
    return TValue.fromJson(result);
  }
}
