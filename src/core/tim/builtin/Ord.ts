/**
 * `%ord(s)` -- character to code point (first character of `s`). Any
 * conversion failure (matching upstream's blanket `catch (Throwable t)`,
 * e.g. an empty string) yields `0`, not an error.
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/builtin/Ord.java
 */

import { TValue } from '../expression/TValue.js';
import { TFunctionSignature } from '../TFunctionSignature.js';
import { SimpleReturnFunction } from './SimpleReturnFunction.js';

const SIGNATURE = new TFunctionSignature('%ord', 1);

export class Ord extends SimpleReturnFunction {
  getSignature(): TFunctionSignature {
    return SIGNATURE;
  }

  canCover(nbArg: number, _namedArguments: ReadonlySet<string>): boolean {
    return nbArg === 1;
  }

  executeReturnFunction(
    _context: unknown,
    _memory: unknown,
    _location: unknown,
    values: readonly TValue[],
    _named: ReadonlyMap<string, TValue>,
  ): TValue {
    const codePoint = values[0]!.toString().codePointAt(0);
    return TValue.fromInt(codePoint ?? 0);
  }
}
