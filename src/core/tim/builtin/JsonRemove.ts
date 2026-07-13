/**
 * `%json_remove(x, key)` -- removes an array index or object key from a
 * clone of `x`. A non-array/object `x` is returned unchanged; an
 * out-of-range array index or unknown object key is a silent no-op
 * (matching upstream's bounds check / `JsonObject#remove`).
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/builtin/JsonRemove.java
 */

import { TValue } from '../expression/TValue.js';
import type { StringLocated } from '../StringLocated.js';
import { TFunctionSignature } from '../TFunctionSignature.js';
import { EaterException } from '../EaterException.js';
import { SimpleReturnFunction } from './SimpleReturnFunction.js';
import { deepCloneJson, isJsonArray, isJsonObject } from './json-utils.js';

const SIGNATURE = new TFunctionSignature('%json_remove', 2);

export class JsonRemove extends SimpleReturnFunction {
  getSignature(): TFunctionSignature {
    return SIGNATURE;
  }

  canCover(nbArg: number, _namedArguments: ReadonlySet<string>): boolean {
    return nbArg === 2;
  }

  /** @throws EaterException if `x` is not JSON, or (post-clone) is JSON of an unsupported shape. */
  executeReturnFunction(
    _context: unknown,
    _memory: unknown,
    location: StringLocated,
    values: readonly TValue[],
    _named: ReadonlyMap<string, TValue>,
  ): TValue {
    const data = values[0]!;
    if (!data.isJson()) throw new EaterException('Not JSON data', location);

    const json = deepCloneJson(data.toJson()!);
    if (!isJsonArray(json) && !isJsonObject(json)) return data;

    if (isJsonArray(json)) {
      const key = values[1]!;
      if (key.isNumber()) {
        const index = key.toInt();
        if (index >= 0 && index < json.length) json.splice(index, 1);
      }
      return TValue.fromJson(json);
    }
    if (isJsonObject(json)) {
      const name = values[1]!.toString();
      const rest = Object.fromEntries(Object.entries(json).filter(([k]) => k !== name));
      return TValue.fromJson(rest);
    }

    /* v8 ignore start -- unreachable: the preceding guard already
     * returns for "neither array nor object", and the two `if`s above
     * exhaust the remaining array/object possibilities, so one of them
     * always returns first. Mirrors upstream's own equally-unreachable
     * defensive throw after the same exhaustive if-chain. */
    throw new EaterException('Bad JSON type', location);
    /* v8 ignore stop */
  }
}
