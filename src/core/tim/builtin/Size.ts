/**
 * `%size(x)` -- `0` for a number, string length for a string, element/key
 * count for a JSON array/object.
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/builtin/Size.java
 */

import { TValue } from '../expression/TValue.js';
import { TFunctionSignature } from '../TFunctionSignature.js';
import { SimpleReturnFunction } from './SimpleReturnFunction.js';

const SIGNATURE = new TFunctionSignature('%size', 1);

export class Size extends SimpleReturnFunction {
  getSignature(): TFunctionSignature {
    return SIGNATURE;
  }

  canCover(nbArg: number, _namedArguments: ReadonlySet<string>): boolean {
    return nbArg === 1;
  }

  executeReturnFunction(
    _context: unknown,
    _memory: unknown,
    _location: unknown,
    values: readonly TValue[],
    _named: ReadonlyMap<string, TValue>,
  ): TValue {
    const value = values[0]!;
    if (value.isNumber()) return TValue.fromInt(0);
    if (value.isString()) return TValue.fromInt(value.toString().length);

    const json = value.toJson();
    if (Array.isArray(json)) return TValue.fromInt(json.length);
    if (json !== null && typeof json === 'object') return TValue.fromInt(Object.keys(json).length);

    return TValue.fromInt(0);
  }
}
