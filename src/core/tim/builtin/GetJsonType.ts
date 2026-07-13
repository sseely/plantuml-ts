/**
 * `%get_json_type(x)` -- `"string"`/`"number"`/`"not_json"` for a plain
 * `TValue`, else the JSON kind of the wrapped value (`"array"`/`"object"`/
 * `"boolean"`/`"number"`/`"string"`), falling back to `"json"` for a bare
 * JSON `null`.
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/builtin/GetJsonType.java
 */

import { TValue } from '../expression/TValue.js';
import { TFunctionSignature } from '../TFunctionSignature.js';
import { SimpleReturnFunction } from './SimpleReturnFunction.js';
import { isJsonArray, isJsonObject } from './json-utils.js';

const SIGNATURE = new TFunctionSignature('%get_json_type', 1);

export class GetJsonType extends SimpleReturnFunction {
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
    const data = values[0]!;
    if (data.isString()) return TValue.fromString('string');
    if (data.isNumber()) return TValue.fromString('number');
    /* v8 ignore start -- unreachable: `TValue`'s three representations
     * (number/string/json) are mutually exclusive and exhaustive, so once
     * `isString()`/`isNumber()` are both false, `isJson()` is guaranteed
     * true. Mirrors upstream's own equally-unreachable defensive check
     * against the same `TValue` invariant. */
    if (!data.isJson()) return TValue.fromString('not_json');
    /* v8 ignore stop */

    const json = data.toJson()!;
    if (isJsonArray(json)) return TValue.fromString('array');
    if (isJsonObject(json)) return TValue.fromString('object');
    if (typeof json === 'boolean') return TValue.fromString('boolean');
    if (typeof json === 'number') return TValue.fromString('number');
    if (typeof json === 'string') return TValue.fromString('string');

    return TValue.fromString('json');
  }
}
