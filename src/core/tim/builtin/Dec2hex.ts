/**
 * `%dec2hex(n)` -- decimal to hex string. Any conversion failure (matching
 * upstream's blanket `catch (Throwable t)`) yields `""`, not an error.
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/builtin/Dec2hex.java
 */

import { TValue } from '../expression/TValue.js';
import { TFunctionSignature } from '../TFunctionSignature.js';
import { SimpleReturnFunction } from './SimpleReturnFunction.js';

const SIGNATURE = new TFunctionSignature('%dec2hex', 1);

export class Dec2hex extends SimpleReturnFunction {
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
      const n = values[0]!.toInt();
      // Integer#toHexString is defined for the full 32-bit range (negative
      // values print as their unsigned two's-complement hex form); `>>> 0`
      // reproduces that for JS's 32-bit bitwise coercion.
      return TValue.fromString((n >>> 0).toString(16));
      /* v8 ignore start -- unreachable: `(n >>> 0).toString(16)` cannot
       * throw for any finite `number` (ToUint32 coerces NaN/Infinity to 0
       * without throwing), mirroring upstream's own dead catch around
       * `Integer.toHexString(int)` (also incapable of throwing for a valid
       * `int`). Preserved verbatim rather than deleted -- see this port's
       * don't-refactor-while-porting discipline. */
    } catch {
      return TValue.fromString('');
    }
    /* v8 ignore stop */
  }
}
