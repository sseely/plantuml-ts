/**
 * `%hsl_color(h, s, l[, aPercent])` -- builds a color from HSL(+alpha)
 * components and returns its `#RRGGBB`/`#AARRGGBB` string form.
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/builtin/HslColor.java
 */

import { TValue } from '../expression/TValue.js';
import { TFunctionSignature } from '../TFunctionSignature.js';
import { SimpleReturnFunction } from './SimpleReturnFunction.js';
import { colorToString, hslToRgb } from './color-utils.js';

const SIGNATURE = new TFunctionSignature('%hsl_color', 3);

export class HslColor extends SimpleReturnFunction {
  getSignature(): TFunctionSignature {
    return SIGNATURE;
  }

  canCover(nbArg: number, _namedArguments: ReadonlySet<string>): boolean {
    return nbArg === 3 || nbArg === 4;
  }

  executeReturnFunction(
    _context: unknown,
    _memory: unknown,
    _location: unknown,
    values: readonly TValue[],
    _named: ReadonlyMap<string, TValue>,
  ): TValue {
    const h = values[0]!.toInt();
    const s = values[1]!.toInt();
    const l = values[2]!.toInt();
    const alpha255 = values.length === 4 ? Math.round((values[3]!.toInt() / 100) * 255) : 255;
    return TValue.fromString(colorToString(hslToRgb([h, s, l], alpha255)));
  }
}
