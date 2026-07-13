/**
 * `%str2json(s)` -- parses `s` as JSON. Any parse failure (matching
 * upstream's blanket `catch (Throwable t)`) yields `""`, not an error.
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/builtin/Str2Json.java
 */

import { TValue } from '../expression/TValue.js';
import type { JsonValue } from '../expression/Token.js';
import { TFunctionSignature } from '../TFunctionSignature.js';
import { SimpleReturnFunction } from './SimpleReturnFunction.js';

const SIGNATURE = new TFunctionSignature('%str2json', 1);

export class Str2Json extends SimpleReturnFunction {
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
    try {
      const value = values[0]!.toString();
      const json = JSON.parse(value) as JsonValue;
      return TValue.fromJson(json);
    } catch {
      return TValue.fromString('');
    }
  }
}
