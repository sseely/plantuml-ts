/**
 * `%nor(x, y, ...)` -- negated `%or`.
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/builtin/LogicalNor.java
 */

import { TValue } from '../expression/TValue.js';
import { TFunctionSignature } from '../TFunctionSignature.js';
import { SimpleReturnFunction } from './SimpleReturnFunction.js';

const SIGNATURE = new TFunctionSignature('%nor', 2);

export class LogicalNor extends SimpleReturnFunction {
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
    return TValue.fromBoolean(!values.some((v) => v.toBoolean()));
  }
}
