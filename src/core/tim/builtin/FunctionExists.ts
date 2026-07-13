/**
 * `%function_exists(name)` -- true iff a function/procedure named `name` is
 * registered.
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/builtin/FunctionExists.java
 */

import { TValue } from '../expression/TValue.js';
import type { TContext } from '../TFunction.js';
import { TFunctionSignature } from '../TFunctionSignature.js';
import { SimpleReturnFunction } from './SimpleReturnFunction.js';

const SIGNATURE = new TFunctionSignature('%function_exists', 1);

export class FunctionExists extends SimpleReturnFunction {
  getSignature(): TFunctionSignature {
    return SIGNATURE;
  }

  canCover(nbArg: number, _namedArguments: ReadonlySet<string>): boolean {
    return nbArg === 1;
  }

  executeReturnFunction(
    context: TContext,
    _memory: unknown,
    _location: unknown,
    values: readonly TValue[],
    _named: ReadonlyMap<string, TValue>,
  ): TValue {
    const name = values[0]!.toString();
    return TValue.fromBoolean(context.doesFunctionExist(name));
  }
}
