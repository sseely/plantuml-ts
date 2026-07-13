/**
 * `%mod(dividend, divisor)` -- integer remainder; throws on division by zero.
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/builtin/Modulo.java
 */

import { TValue } from '../expression/TValue.js';
import type { StringLocated } from '../StringLocated.js';
import { TFunctionSignature } from '../TFunctionSignature.js';
import { EaterException } from '../EaterException.js';
import { SimpleReturnFunction } from './SimpleReturnFunction.js';

const SIGNATURE = new TFunctionSignature('%mod', 2);

export class Modulo extends SimpleReturnFunction {
  getSignature(): TFunctionSignature {
    return SIGNATURE;
  }

  canCover(nbArg: number, _namedArguments: ReadonlySet<string>): boolean {
    return nbArg === 2;
  }

  /** @throws EaterException on division by zero. */
  executeReturnFunction(
    _context: unknown,
    _memory: unknown,
    location: StringLocated,
    values: readonly TValue[],
    _named: ReadonlyMap<string, TValue>,
  ): TValue {
    const dividend = values[0]!.toInt();
    const divisor = values[1]!.toInt();
    if (divisor === 0) throw new EaterException('Divide by zero', location);

    return TValue.fromInt(dividend % divisor);
  }
}
