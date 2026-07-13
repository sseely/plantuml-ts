/**
 * `%backslash()` -- returns the private-use "real backslash" sentinel,
 * decoded by the Creole/Display layer later (out of this port's scope).
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/builtin/Backslash.java
 */

import { TValue } from '../expression/TValue.js';
import { TFunctionSignature } from '../TFunctionSignature.js';
import { SimpleReturnFunction } from './SimpleReturnFunction.js';
import { BLOCK_E1_REAL_BACKSLASH } from './jaws-constants.js';

const SIGNATURE = new TFunctionSignature('%backslash', 0);

export class Backslash extends SimpleReturnFunction {
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
    return TValue.fromString(BLOCK_E1_REAL_BACKSLASH);
  }
}
