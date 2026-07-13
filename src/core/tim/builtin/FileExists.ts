/**
 * `%file_exists(path)` -- filesystem probe, routed through the injected
 * {@link TimEnvironment} (never real `fs` access -- see that file's header).
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/builtin/FileExists.java
 */

import { TValue } from '../expression/TValue.js';
import { TFunctionSignature } from '../TFunctionSignature.js';
import { SimpleReturnFunction } from './SimpleReturnFunction.js';
import type { TimEnvironment } from './TimEnvironment.js';

const SIGNATURE = new TFunctionSignature('%file_exists', 1);

export class FileExists extends SimpleReturnFunction {
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
    const path = values[0]!.toString();
    return TValue.fromBoolean(this.env.fileExists(path));
  }
}
