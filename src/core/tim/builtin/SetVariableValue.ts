/**
 * `%set_variable_value(name, value)` -- sets `$name` globally, returns `""`.
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/builtin/SetVariableValue.java
 */

import { TValue } from '../expression/TValue.js';
import type { StringLocated } from '../StringLocated.js';
import type { TMemory } from '../TMemory.js';
import { TFunctionSignature } from '../TFunctionSignature.js';
import { TVariableScope } from '../TVariableScope.js';
import { SimpleReturnFunction } from './SimpleReturnFunction.js';

const SIGNATURE = new TFunctionSignature('%set_variable_value', 2);

export class SetVariableValue extends SimpleReturnFunction {
  getSignature(): TFunctionSignature {
    return SIGNATURE;
  }

  canCover(nbArg: number, _namedArguments: ReadonlySet<string>): boolean {
    return nbArg === 2;
  }

  /** @throws EaterException (thrown, not returned) if the assignment target is invalid. */
  executeReturnFunction(
    _context: unknown,
    memory: TMemory,
    location: StringLocated,
    values: readonly TValue[],
    _named: ReadonlyMap<string, TValue>,
  ): TValue {
    const name = values[0]!.toString();
    const value = values[1]!;
    memory.putVariable(name, value, TVariableScope.GLOBAL, location);
    return TValue.fromString('');
  }
}
