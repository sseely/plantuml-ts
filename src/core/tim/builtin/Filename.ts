/**
 * `%filename()` -- the source file's name, resolved once at construction
 * from the injected {@link TimEnvironment}.
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/builtin/Filename.java
 */

import { TValue } from '../expression/TValue.js';
import { TFunctionSignature } from '../TFunctionSignature.js';
import { SimpleReturnFunction } from './SimpleReturnFunction.js';
import type { TimEnvironment } from './TimEnvironment.js';

const SIGNATURE = new TFunctionSignature('%filename', 0);

export class Filename extends SimpleReturnFunction {
  private readonly value: string | undefined;

  constructor(env: TimEnvironment) {
    super();
    this.value = env.getEnvironmentValue('filename');
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
    return TValue.fromString(this.value ?? '');
  }
}
