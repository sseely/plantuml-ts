/**
 * `%random([max])` / `%random(min, max)` -- random integer, sourced from the
 * injected {@link TimEnvironment} RNG, never `Math.random()`.
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/builtin/RandomFunction.java
 */

import { TValue } from '../expression/TValue.js';
import type { StringLocated } from '../StringLocated.js';
import { TFunctionSignature } from '../TFunctionSignature.js';
import { EaterException } from '../EaterException.js';
import { SimpleReturnFunction } from './SimpleReturnFunction.js';
import type { TimEnvironment } from './TimEnvironment.js';

const SIGNATURE = new TFunctionSignature('%random', 2);

export class RandomFunction extends SimpleReturnFunction {
  constructor(private readonly env: TimEnvironment) {
    super();
  }

  getSignature(): TFunctionSignature {
    return SIGNATURE;
  }

  canCover(nbArg: number, _namedArguments: ReadonlySet<string>): boolean {
    return nbArg === 0 || nbArg === 1 || nbArg === 2;
  }

  /** @throws EaterException if called with more than 2 arguments (unreachable given `canCover`). */
  executeReturnFunction(
    _context: unknown,
    _memory: unknown,
    location: StringLocated,
    values: readonly TValue[],
    _named: ReadonlyMap<string, TValue>,
  ): TValue {
    switch (values.length) {
      case 0:
        return TValue.fromInt(this.env.random.nextInt(2));
      case 1: {
        const mx = values[0]!.toInt();
        return TValue.fromInt(this.env.random.nextInt(mx));
      }
      case 2: {
        const min = values[0]!.toInt();
        const max = values[1]!.toInt();
        return TValue.fromInt(this.env.random.nextInt(max - min) + min);
      }
      default:
        throw new EaterException('Error on Random: Too many argument', location);
    }
  }
}
