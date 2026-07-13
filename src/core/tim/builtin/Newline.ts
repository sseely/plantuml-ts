/**
 * `%newline()` -- line break. `JawsFlags.USE_BLOCK_E1_IN_NEWLINE_FUNCTION` is
 * hardcoded `true` upstream, so the BLOCK_E1 sentinel branch always fires;
 * the plain `"\n"` fallback is dead in upstream too and is not ported.
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/builtin/Newline.java
 */

import { TValue } from '../expression/TValue.js';
import { TFunctionSignature } from '../TFunctionSignature.js';
import { SimpleReturnFunction } from './SimpleReturnFunction.js';
import { BLOCK_E1_NEWLINE, USE_BLOCK_E1_IN_NEWLINE_FUNCTION } from './jaws-constants.js';

const SIGNATURE = new TFunctionSignature('%newline', 0);

export class Newline extends SimpleReturnFunction {
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
