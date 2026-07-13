/**
 * `%feature(name)` -- feature-flag probe. Only `"style"` and `"theme"` are
 * recognized (both always on in this port); everything else is `0`.
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/builtin/Feature.java
 */

import { TValue } from '../expression/TValue.js';
import { TFunctionSignature } from '../TFunctionSignature.js';
import { SimpleReturnFunction } from './SimpleReturnFunction.js';

const SIGNATURE = new TFunctionSignature('%feature', 1);

export class Feature extends SimpleReturnFunction {
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
    const arg = values[0]!.toString().toLowerCase();
    if (arg === 'style' || arg === 'theme') return TValue.fromInt(1);

    return TValue.fromInt(0);
  }
}
