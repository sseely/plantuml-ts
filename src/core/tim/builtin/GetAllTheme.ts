/**
 * `%get_all_theme()` -- JSON array of theme names.
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/builtin/GetAllTheme.java
 */

import { TValue } from '../expression/TValue.js';
import type { JsonValue } from '../expression/Token.js';
import { TFunctionSignature } from '../TFunctionSignature.js';
import { SimpleReturnFunction } from './SimpleReturnFunction.js';
import type { TimEnvironment } from './TimEnvironment.js';

const SIGNATURE = new TFunctionSignature('%get_all_theme', 0);

export class GetAllTheme extends SimpleReturnFunction {
  constructor(private readonly env: TimEnvironment) {
    super();
  }

  getSignature(): TFunctionSignature {
    return SIGNATURE;
  }

  canCover(nbArg: number, _namedArguments: ReadonlySet<string>): boolean {
    return nbArg === 0;
  }

  executeReturnFunction(
    _context: unknown,
    _memory: unknown,
    _location: unknown,
    _values: readonly TValue[],
    _named: ReadonlyMap<string, TValue>,
  ): TValue {
    const result: JsonValue[] = [...this.env.listThemeNames()];
    return TValue.fromJson(result);
  }
}
