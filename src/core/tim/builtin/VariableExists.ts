/**
 * `%variable_exists(name)` -- true iff `$name` is currently bound.
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/builtin/VariableExists.java
 */

import { TValue } from '../expression/TValue.js';
import type { TMemory } from '../TMemory.js';
import { TFunctionSignature } from '../TFunctionSignature.js';
import { SimpleReturnFunction } from './SimpleReturnFunction.js';

const SIGNATURE = new TFunctionSignature('%variable_exists', 1);

export class VariableExists extends SimpleReturnFunction {
  getSignature(): TFunctionSignature {
    return SIGNATURE;
  }

  canCover(nbArg: number, _namedArguments: ReadonlySet<string>): boolean {
    return nbArg === 1;
  }

  executeReturnFunction(
    _context: unknown,
    memory: TMemory,
    _location: unknown,
    values: readonly TValue[],
    _named: ReadonlyMap<string, TValue>,
  ): TValue {
    const name = values[0]!.toString();
    return TValue.fromBoolean(memory.getVariable(name) !== undefined);
  }
}
