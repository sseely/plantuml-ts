/**
 * `%strpos(full, searched)` -- index of `searched` within `full`, or `-1`.
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/builtin/Strpos.java
 */

import { TValue } from '../expression/TValue.js';
import { TFunctionSignature } from '../TFunctionSignature.js';
import { SimpleReturnFunction } from './SimpleReturnFunction.js';

const SIGNATURE = new TFunctionSignature('%strpos', 2);

export class Strpos extends SimpleReturnFunction {
  getSignature(): TFunctionSignature {
    return SIGNATURE;
  }

  canCover(nbArg: number, _namedArguments: ReadonlySet<string>): boolean {
    return nbArg === 2;
  }

  executeReturnFunction(
    _context: unknown,
    _memory: unknown,
    _location: unknown,
    values: readonly TValue[],
    _named: ReadonlyMap<string, TValue>,
  ): TValue {
    const full = values[0]!.toString();
    const searched = values[1]!.toString();
    return TValue.fromInt(full.indexOf(searched));
  }
}
