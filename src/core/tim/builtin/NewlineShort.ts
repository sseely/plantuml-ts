/**
 * `%n()` -- short alias for `%newline()`.
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/builtin/NewlineShort.java
 */

import { TValue } from '../expression/TValue.js';
import { TFunctionSignature } from '../TFunctionSignature.js';
import { SimpleReturnFunction } from './SimpleReturnFunction.js';
import { BLOCK_E1_NEWLINE, USE_BLOCK_E1_IN_NEWLINE_FUNCTION } from './jaws-constants.js';

const SIGNATURE = new TFunctionSignature('%n', 0);

export class NewlineShort extends SimpleReturnFunction {
  getSignature(): TFunctionSignature {
    return SIGNATURE;
  }

  canCover(nbArg: number, _namedArguments: ReadonlySet<string>): boolean {
    return nbArg === 0;
  }

  executeReturnFunction(
    _context: unknown,
    _memory: unknown,
    _location: unknown,
    _values: readonly TValue[],
    _named: ReadonlyMap<string, TValue>,
  ): TValue {
    if (USE_BLOCK_E1_IN_NEWLINE_FUNCTION) return TValue.fromString(BLOCK_E1_NEWLINE);

    return TValue.fromString('\n');
  }
}
