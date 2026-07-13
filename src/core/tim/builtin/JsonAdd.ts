/**
 * `%json_add(x, ...)` -- appends to a JSON array (`json_add(arr, value)`) or
 * adds a member to a JSON object (`json_add(obj, name, value)`), returning
 * the mutated clone. A non-array/object `x` is returned unchanged.
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/builtin/JsonAdd.java
 */

import { TValue } from '../expression/TValue.js';
import type { StringLocated } from '../StringLocated.js';
import { TFunctionSignature } from '../TFunctionSignature.js';
import { EaterException } from '../EaterException.js';
import { SimpleReturnFunction } from './SimpleReturnFunction.js';
import { deepCloneJson, isJsonArray, isJsonObject } from './json-utils.js';

const SIGNATURE = new TFunctionSignature('%json_add', 3);

export class JsonAdd extends SimpleReturnFunction {
  getSignature(): TFunctionSignature {
    return SIGNATURE;
  }

  canCover(nbArg: number, _namedArguments: ReadonlySet<string>): boolean {
    return nbArg === 2 || nbArg === 3;
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
      json.push(values[1]!.toJsonValue());
      return TValue.fromJson(json);
    }
    if (isJsonObject(json)) {
      const name = values[1]!.toString();
      const value = values[2]!.toJsonValue();
      return TValue.fromJson({ ...json, [name]: value });
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
