/**
 * `%xor(x, y, ...)` -- true iff exactly one argument is true.
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/builtin/LogicalXor.java
 */

import { TValue } from '../expression/TValue.js';
import { TFunctionSignature } from '../TFunctionSignature.js';
import { SimpleReturnFunction } from './SimpleReturnFunction.js';

const SIGNATURE = new TFunctionSignature('%xor', 2);

export class LogicalXor extends SimpleReturnFunction {
  getSignature(): TFunctionSignature {
    return SIGNATURE;
  }

  canCover(nbArg: number, _namedArguments: ReadonlySet<string>): boolean {
    return nbArg >= 2;
  }

  executeReturnFunction(
    _context: unknown,
    _memory: unknown,
    _location: unknown,
    values: readonly TValue[],
    _named: ReadonlyMap<string, TValue>,
  ): TValue {
    const trueCount = values.filter((v) => v.toBoolean()).length;
    return TValue.fromBoolean(trueCount === 1);
  }
}
