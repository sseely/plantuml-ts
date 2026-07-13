/**
 * `%right_align()` -- returns the private-use "newline, right-align" sentinel.
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/builtin/RightAlign.java
 */

import { TValue } from '../expression/TValue.js';
import { TFunctionSignature } from '../TFunctionSignature.js';
import { SimpleReturnFunction } from './SimpleReturnFunction.js';
import { BLOCK_E1_NEWLINE_RIGHT_ALIGN } from './jaws-constants.js';

const SIGNATURE = new TFunctionSignature('%right_align', 0);

export class RightAlign extends SimpleReturnFunction {
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
    return TValue.fromString(BLOCK_E1_NEWLINE_RIGHT_ALIGN);
  }
}
