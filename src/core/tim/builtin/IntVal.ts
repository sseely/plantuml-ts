/**
 * `%intval(s)` -- parses `s` as a decimal integer, throwing on failure
 * (unlike `%dec2hex`/`%hex2dec`, which swallow errors).
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/builtin/IntVal.java
 */

import { TValue } from '../expression/TValue.js';
import type { StringLocated } from '../StringLocated.js';
import { TFunctionSignature } from '../TFunctionSignature.js';
import { EaterException } from '../EaterException.js';
import { SimpleReturnFunction } from './SimpleReturnFunction.js';

const SIGNATURE = new TFunctionSignature('%intval', 1);

export class IntVal extends SimpleReturnFunction {
  getSignature(): TFunctionSignature {
    return SIGNATURE;
  }

  canCover(nbArg: number, _namedArguments: ReadonlySet<string>): boolean {
    return nbArg === 1;
  }

  /** @throws EaterException if `s` is not a valid integer. */
  executeReturnFunction(
    _context: unknown,
    _memory: unknown,
    location: StringLocated,
    values: readonly TValue[],
    _named: ReadonlyMap<string, TValue>,
  ): TValue {
    const s = values[0]!.toString();
    if (!/^-?\d+$/.test(s)) throw new EaterException(`Cannot convert ${s} to integer.`, location);

    return TValue.fromInt(Number.parseInt(s, 10));
  }
}
