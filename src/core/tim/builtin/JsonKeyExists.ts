/**
 * `%json_key_exists(x, key)` -- true iff `x` is a JSON object containing
 * `key`. Any non-object shape (including a non-JSON `TValue`) yields
 * `false` rather than throwing.
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/builtin/JsonKeyExists.java
 */

import { TValue } from '../expression/TValue.js';
import { TFunctionSignature } from '../TFunctionSignature.js';
import { SimpleReturnFunction } from './SimpleReturnFunction.js';
import { isJsonObject } from './json-utils.js';

const SIGNATURE = new TFunctionSignature('%json_key_exists', 1);

export class JsonKeyExists extends SimpleReturnFunction {
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
    const arg0 = values[0]!;
    if (!arg0.isJson()) return TValue.fromBoolean(false);

    const json = arg0.toJson()!;
    if (!isJsonObject(json)) return TValue.fromBoolean(false);

    const arg1 = values[1]!;
    if (arg1.isString() || (arg1.isJson() && typeof arg1.toJson() === 'string')) {
      const keyname = arg1.toString();
      if (Object.prototype.hasOwnProperty.call(json, keyname)) return TValue.fromBoolean(true);
    }
    return TValue.fromBoolean(false);
  }
}
