/**
 * `%or(x, y, ...)` -- variadic logical OR (`>= 2` args).
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/builtin/LogicalOr.java
 */

import { TValue } from '../expression/TValue.js';
import { TFunctionSignature } from '../TFunctionSignature.js';
import { SimpleReturnFunction } from './SimpleReturnFunction.js';

const SIGNATURE = new TFunctionSignature('%or', 2);

export class LogicalOr extends SimpleReturnFunction {
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
    return TValue.fromBoolean(values.some((v) => v.toBoolean()));
  }
}
