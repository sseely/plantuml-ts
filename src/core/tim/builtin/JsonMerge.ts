/**
 * `%json_merge(x, y)` -- concatenates two JSON arrays, or shallow-merges two
 * JSON objects (`y`'s keys overwrite `x`'s on collision). Mismatched shapes
 * (one array, one object) or a shape neither array nor object return `x`
 * unchanged.
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/builtin/JsonMerge.java
 */

import { TValue } from '../expression/TValue.js';
import type { StringLocated } from '../StringLocated.js';
import { TFunctionSignature } from '../TFunctionSignature.js';
import { EaterException } from '../EaterException.js';
import { SimpleReturnFunction } from './SimpleReturnFunction.js';
import { deepCloneJson, isJsonArray, isJsonObject, shallowMergeObjects } from './json-utils.js';

const SIGNATURE = new TFunctionSignature('%json_merge', 2);

export class JsonMerge extends SimpleReturnFunction {
  getSignature(): TFunctionSignature {
    return SIGNATURE;
  }

  canCover(nbArg: number, _namedArguments: ReadonlySet<string>): boolean {
    return nbArg === 2;
  }

  /** @throws EaterException if either argument is not JSON, or (post-clone) is an unsupported shape. */
  executeReturnFunction(
    _context: unknown,
    _memory: unknown,
    location: StringLocated,
    values: readonly TValue[],
    _named: ReadonlyMap<string, TValue>,
  ): TValue {
    const data0 = values[0]!;
    if (!data0.isJson()) throw new EaterException('Not JSON data', location);
    const data1 = values[1]!;
    if (!data1.isJson()) throw new EaterException('Not JSON data', location);

    const json0 = deepCloneJson(data0.toJson()!);
    const json1 = data1.toJson()!;

    const neitherIsCollection =
      !isJsonArray(json0) && !isJsonObject(json0) && !isJsonArray(json1) && !isJsonObject(json1);
    const shapesMismatch = (isJsonArray(json0) && isJsonObject(json1)) || (isJsonObject(json0) && isJsonArray(json1));
    if (neitherIsCollection || shapesMismatch) return data0;

    if (isJsonArray(json0) && isJsonArray(json1)) {
      json0.push(...json1);
      return TValue.fromJson(json0);
    }
    if (isJsonObject(json0) && isJsonObject(json1)) {
      return TValue.fromJson(shallowMergeObjects(json0, json1));
    }

    /* v8 ignore start -- unreachable: the preceding guards already
     * return for "neither is a collection" and "mismatched shapes", so
     * by this point json0/json1 are guaranteed to be the same collection
     * kind (both array or both object), and one of the two `if`s above
     * always returns first. Mirrors upstream's own equally-unreachable
     * defensive throw. */
    throw new EaterException('Bad JSON type', location);
    /* v8 ignore stop */
  }
}
