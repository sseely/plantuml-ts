/**
 * `%lighten(color, ratio)` -- increases `color`'s HSL luminance by `ratio`
 * percent (relative, not absolute).
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/builtin/Lighten.java
 */

import { TValue } from '../expression/TValue.js';
import type { StringLocated } from '../StringLocated.js';
import { TFunctionSignature } from '../TFunctionSignature.js';
import { EaterException } from '../EaterException.js';
import { SimpleReturnFunction } from './SimpleReturnFunction.js';
import { NoSuchColorError, colorToString, lighten, parseColorString } from './color-utils.js';

const SIGNATURE = new TFunctionSignature('%lighten', 2);

export class Lighten extends SimpleReturnFunction {
  getSignature(): TFunctionSignature {
    return SIGNATURE;
  }

  canCover(nbArg: number, _namedArguments: ReadonlySet<string>): boolean {
    return nbArg === 2;
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
    const ratio = values[1]!.toInt();
    const color = parseColorString(colorString);
    if (color === undefined) throw new EaterException(new NoSuchColorError().message, location);

    return TValue.fromString(colorToString(lighten(color, ratio)));
  }
}
