/**
 * `%getenv(name)` -- OS/process environment access, routed through the
 * injected {@link TimEnvironment} (never real `process.env` access; also
 * skips upstream's `SecurityUtils#canWeReadThisEnvironmentVariable` gate --
 * a host-level policy concern that belongs in the seam implementation, not
 * this builtin).
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/builtin/Getenv.java
 */

import { TValue } from '../expression/TValue.js';
import { TFunctionSignature } from '../TFunctionSignature.js';
import { SimpleReturnFunction } from './SimpleReturnFunction.js';
import type { TimEnvironment } from './TimEnvironment.js';

const SIGNATURE = new TFunctionSignature('%getenv', 1);

export class Getenv extends SimpleReturnFunction {
  constructor(private readonly env: TimEnvironment) {
    super();
  }

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
    const value = this.env.getenv(values[0]!.toString());
    return TValue.fromString(value ?? '');
  }
}
