/**
 * `%get_variable_value(name)` -- returns `$name`'s value, or `""` if unbound.
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/builtin/GetVariableValue.java
 */

import { TValue } from '../expression/TValue.js';
import type { TMemory } from '../TMemory.js';
import { TFunctionSignature } from '../TFunctionSignature.js';
import { SimpleReturnFunction } from './SimpleReturnFunction.js';

const SIGNATURE = new TFunctionSignature('%get_variable_value', 1);

export class GetVariableValue extends SimpleReturnFunction {
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
    const variable = memory.getVariable(name);
    return variable ?? TValue.fromString('');
  }
}
