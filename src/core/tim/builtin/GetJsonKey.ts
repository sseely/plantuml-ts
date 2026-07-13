/**
 * `%get_json_keys(x)` -- for a JSON object, its key names; for a JSON array
 * of objects, the concatenated key names of every member object. Throws for
 * any other shape.
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/builtin/GetJsonKey.java
 */

import { TValue } from '../expression/TValue.js';
import type { JsonValue } from '../expression/Token.js';
import type { StringLocated } from '../StringLocated.js';
import { TFunctionSignature } from '../TFunctionSignature.js';
import { EaterException } from '../EaterException.js';
import { SimpleReturnFunction } from './SimpleReturnFunction.js';
import { isJsonArray, isJsonObject } from './json-utils.js';

const SIGNATURE = new TFunctionSignature('%get_json_keys', 1);

export class GetJsonKey extends SimpleReturnFunction {
  getSignature(): TFunctionSignature {
    return SIGNATURE;
  }

  canCover(nbArg: number, _namedArguments: ReadonlySet<string>): boolean {
    return nbArg === 1;
  }

  /** @throws EaterException if `x` is not JSON, or is JSON of an unsupported shape. */
  executeReturnFunction(
    _context: unknown,
    _memory: unknown,
    location: StringLocated,
    values: readonly TValue[],
    _named: ReadonlyMap<string, TValue>,
  ): TValue {
    const data = values[0]!;
    if (!data.isJson()) throw new EaterException('Not JSON data', location);

    const json = data.toJson()!;
    if (isJsonObject(json)) {
      const result: JsonValue[] = Object.keys(json);
      return TValue.fromJson(result);
    }
    if (isJsonArray(json)) {
      const result: JsonValue[] = [];
      for (const member of json) if (isJsonObject(member)) result.push(...Object.keys(member));

      return TValue.fromJson(result);
    }

    throw new EaterException('Bad JSON type', location);
  }
}
