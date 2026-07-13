/**
 * `%hex2dec(s)` -- hex string to decimal. Any conversion failure (matching
 * upstream's blanket `catch (Throwable t)`) yields `0`, not an error.
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/builtin/Hex2dec.java
 */

import { TValue } from '../expression/TValue.js';
import { TFunctionSignature } from '../TFunctionSignature.js';
import { SimpleReturnFunction } from './SimpleReturnFunction.js';

const SIGNATURE = new TFunctionSignature('%hex2dec', 1);

export class Hex2dec extends SimpleReturnFunction {
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
    const s = values[0]!.toString();
    // Integer.parseInt(s, 16) requires the whole string to be valid hex (an
    // optional leading '-' then hex digits) or throws; Number.parseInt is
    // lenient about trailing garbage, so validate the full surface first.
    if (!/^-?[0-9a-fA-F]+$/.test(s)) return TValue.fromInt(0);

    return TValue.fromInt(Number.parseInt(s, 16));
  }
}
