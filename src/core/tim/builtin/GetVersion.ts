/**
 * `%version()` -- this build's version string. Sourced from the injected
 * {@link TimEnvironment} rather than `package.json` at runtime (browser-safe;
 * see `TimEnvironment.ts`'s file header) -- a deliberate divergence from
 * upstream's `net.sourceforge.plantuml.version.Version#versionString()`,
 * which reads a compiled-in constant.
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/builtin/GetVersion.java
 */

import { TValue } from '../expression/TValue.js';
import { TFunctionSignature } from '../TFunctionSignature.js';
import { SimpleReturnFunction } from './SimpleReturnFunction.js';
import type { TimEnvironment } from './TimEnvironment.js';

const SIGNATURE = new TFunctionSignature('%version', 0);

export class GetVersion extends SimpleReturnFunction {
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
    return TValue.fromString(this.env.getVersionString());
  }
}
