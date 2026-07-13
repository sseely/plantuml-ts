/**
 * `%boolval(s)` -- parses `s` (case-insensitive `"true"`/`"1"` or
 * `"false"`/`"0"`) as a boolean, throwing on any other value.
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/builtin/BoolVal.java
 */

import { TValue } from '../expression/TValue.js';
import type { StringLocated } from '../StringLocated.js';
import { TFunctionSignature } from '../TFunctionSignature.js';
import { EaterException } from '../EaterException.js';
import { SimpleReturnFunction } from './SimpleReturnFunction.js';

const SIGNATURE = new TFunctionSignature('%boolval', 1);
const TRUE_VALUES = new Set(['true', '1']);
const FALSE_VALUES = new Set(['false', '0']);

export class BoolVal extends SimpleReturnFunction {
  getSignature(): TFunctionSignature {
    return SIGNATURE;
  }

  canCover(nbArg: number, _namedArguments: ReadonlySet<string>): boolean {
    return nbArg === 1;
  }

  /** @throws EaterException if `s` is neither a recognized true nor false value. */
  executeReturnFunction(
    _context: unknown,
    _memory: unknown,
    location: StringLocated,
    values: readonly TValue[],
    _named: ReadonlyMap<string, TValue>,
  ): TValue {
    const s = values[0]!.toString().toLowerCase();
    if (TRUE_VALUES.has(s)) return TValue.fromBoolean(true);
    if (FALSE_VALUES.has(s)) return TValue.fromBoolean(false);

    throw new EaterException(`Cannot convert ${s} to boolean.`, location);
  }
}
