/**
 * `%reverse_hsluv_color(color)` -- HSLuv-space reversal (perceptually more
 * balanced than `%reverse_color`'s flat RGB complement).
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/builtin/ReverseHsluvColor.java
 */

import { TValue } from '../expression/TValue.js';
import type { StringLocated } from '../StringLocated.js';
import { TFunctionSignature } from '../TFunctionSignature.js';
import { EaterException } from '../EaterException.js';
import { SimpleReturnFunction } from './SimpleReturnFunction.js';
import { NoSuchColorError, colorToString, parseColorString, reverseHsluv } from './color-utils.js';

const SIGNATURE = new TFunctionSignature('%reverse_hsluv_color', 1);

export class ReverseHsluvColor extends SimpleReturnFunction {
  getSignature(): TFunctionSignature {
    return SIGNATURE;
  }

  canCover(nbArg: number, _namedArguments: ReadonlySet<string>): boolean {
    return nbArg === 1;
  }

  /** @throws EaterException if `color` does not resolve. */
  executeReturnFunction(
    _context: unknown,
    _memory: unknown,
    location: StringLocated,
    values: readonly TValue[],
    _named: ReadonlyMap<string, TValue>,
  ): TValue {
    const colorString = values[0]!.toString();
    const color = parseColorString(colorString);
    if (color === undefined) throw new EaterException(new NoSuchColorError().message, location);

    return TValue.fromString(colorToString(reverseHsluv(color)));
  }
}
