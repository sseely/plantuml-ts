/**
 * `%chr(codePoint)` -- code point to character. Any conversion failure
 * (matching upstream's blanket `catch (Throwable t)`) yields a NUL string,
 * not an error.
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/builtin/Chr.java
 */

import { TValue } from '../expression/TValue.js';
import { TFunctionSignature } from '../TFunctionSignature.js';
import { SimpleReturnFunction } from './SimpleReturnFunction.js';

const SIGNATURE = new TFunctionSignature('%chr', 1);

export class Chr extends SimpleReturnFunction {
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
    try {
      return TValue.fromString(String.fromCodePoint(values[0]!.toInt()));
    } catch {
      // String.fromCodePoint throws RangeError for a negative or
      // out-of-Unicode-range code point -- upstream's Character.toChars
      // throws IllegalArgumentException for the same inputs.
      return TValue.fromString('\0');
    }
  }
}
