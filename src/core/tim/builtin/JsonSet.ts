/**
 * `%json_set(x, ...)` -- with 2 args, deep-merges `y` into JSON object `x`
 * (`json_set(obj, y)`); with 3 args, sets an array index or object key
 * (`json_set(x, keyOrIndex, value)`). A non-array/object `x` is returned
 * unchanged.
 *
 * Upstream's `switch (values.size())` has a documented, faithfully-ported
 * fallthrough quirk: `case 2` only returns when `json.isObject()`; a
 * 2-argument call against an ARRAY `x` falls through into `case 3`'s body,
 * which then indexes `values.get(2)` -- an argument that was never
 * supplied, throwing an out-of-bounds error in both the Java original and
 * this port. This is malformed-usage territory (not a documented API
 * shape), so the crash is preserved rather than smoothed over.
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/builtin/JsonSet.java
 */

import { TValue } from '../expression/TValue.js';
import type { StringLocated } from '../StringLocated.js';
import { TFunctionSignature } from '../TFunctionSignature.js';
import { EaterException } from '../EaterException.js';
import { SimpleReturnFunction } from './SimpleReturnFunction.js';
import { deepMergeObjects, isJsonArray, isJsonObject, type JsonObj } from './json-utils.js';
import { deepCloneJson } from './json-utils.js';
import type { JsonValue } from '../expression/Token.js';

const SIGNATURE = new TFunctionSignature('%json_set', 3);

/** `case 2` of upstream's switch: deep-merge `values[1]` into object `json`. */
function setTwoArgObjectMerge(json: JsonObj, values: readonly TValue[]): TValue {
  const value = values[1]!.toJsonValue();
  if (isJsonObject(value)) return TValue.fromJson(deepMergeObjects(json, value));
  return TValue.fromJson(json);
}

/**
 * `case 3`'s array branch. Also reached (faithful fallthrough -- see file
 * header) for a 2-argument call against an array: `values[2]` is
 * `undefined` there, and `.toJsonValue()` throws, matching upstream's
 * `IndexOutOfBoundsException`.
 */
function setArrayIndex(json: JsonValue[], values: readonly TValue[]): TValue {
  const key = values[1]!;
  if (key.isNumber()) {
    const index = key.toInt();
    const value = values[2]!.toJsonValue();
    if (index >= 0 && index < json.length) json[index] = value;
  }
  return TValue.fromJson(json);
}

/** `case 3`'s object branch: set-or-add a single key. */
function setObjectKey(json: JsonObj, values: readonly TValue[]): TValue {
  const name = values[1]!.toString();
  json[name] = values[2]!.toJsonValue();
  return TValue.fromJson(json);
}

export class JsonSet extends SimpleReturnFunction {
  getSignature(): TFunctionSignature {
    return SIGNATURE;
  }

  canCover(nbArg: number, _namedArguments: ReadonlySet<string>): boolean {
    return nbArg === 2 || nbArg === 3;
  }

  /** @throws EaterException if `x` is not JSON; see the file header for the 2-arg/array fallthrough quirk. */
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

    if (values.length === 2 && isJsonObject(json)) return setTwoArgObjectMerge(json, values);
    if (isJsonArray(json)) return setArrayIndex(json, values);
    if (isJsonObject(json)) return setObjectKey(json, values);

    /* v8 ignore start -- unreachable: the earlier guard already returns
     * for "neither array nor object", so by this point json is guaranteed
     * to be one or the other, and one of the three branches above always
     * returns first. Mirrors upstream's own equally-unreachable `default`
     * case (guarded there by `assert false`). */
    throw new EaterException('Error on json_set: Too many arguments', location);
    /* v8 ignore stop */
  }
}
