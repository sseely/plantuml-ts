/**
 * `%substr(s, pos[, len])` -- substring from `pos` (0-based), optionally
 * clamped to `len` characters.
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/builtin/Substr.java
 */

import { TValue } from '../expression/TValue.js';
import { TFunctionSignature } from '../TFunctionSignature.js';
import { SimpleReturnFunction } from './SimpleReturnFunction.js';

const SIGNATURE = new TFunctionSignature('%substr', 3);

export class Substr extends SimpleReturnFunction {
  getSignature(): TFunctionSignature {
    return SIGNATURE;
  }

  canCover(nbArg: number, _namedArguments: ReadonlySet<string>): boolean {
    return nbArg === 2 || nbArg === 3;
  }

  executeReturnFunction(
    _context: unknown,
    _memory: unknown,
    _location: unknown,
    values: readonly TValue[],
    _named: ReadonlyMap<string, TValue>,
  ): TValue {
    const full = values[0]!.toString();
    const pos = values[1]!.toInt();
    if (pos >= full.length) return TValue.fromString('');

    let result = full.substring(pos);
    if (values.length === 3) {
      const len = values[2]!.toInt();
      if (len < result.length) result = result.substring(0, len);
    }
    return TValue.fromString(result);
  }
}
