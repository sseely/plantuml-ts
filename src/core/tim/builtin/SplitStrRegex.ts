/**
 * `%splitstr_regex(s, regex)` -- `String#split(regex)` equivalent, returning
 * a JSON array of the parts.
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/builtin/SplitStrRegex.java
 */

import { TValue } from '../expression/TValue.js';
import type { JsonValue } from '../expression/Token.js';
import { TFunctionSignature } from '../TFunctionSignature.js';
import { SimpleReturnFunction } from './SimpleReturnFunction.js';

const SIGNATURE = new TFunctionSignature('%splitstr_regex', 2);

export class SplitStrRegex extends SimpleReturnFunction {
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
    const result: JsonValue[] = str.split(new RegExp(separator));
    return TValue.fromJson(result);
  }
}
