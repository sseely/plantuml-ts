/**
 * `%now()` -- current Unix time in whole seconds. Sourced from the injected
 * {@link TimEnvironment} clock, never `Date.now()` (CLAUDE.md: no ambient
 * clock reads in rendering paths).
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/builtin/Now.java
 */

import { TValue } from '../expression/TValue.js';
import { TFunctionSignature } from '../TFunctionSignature.js';
import { SimpleReturnFunction } from './SimpleReturnFunction.js';
import type { TimEnvironment } from './TimEnvironment.js';

const SIGNATURE = new TFunctionSignature('%now', 0);

export class Now extends SimpleReturnFunction {
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
    return TValue.fromInt(Math.trunc(this.env.clock.nowMillis() / 1000));
  }
}
