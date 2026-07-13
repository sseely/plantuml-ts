/**
 * `%call_user_func(name, arg1, ...)` -- computes a function name at runtime
 * and dispatches to it as a RETURN function (looked up by signature via
 * `TContext#getFunctionSmart`, unlike `%invoke_procedure`'s name+arity
 * lookup through `FunctionsSet`).
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/builtin/CallUserFunction.java
 */

import type { TValue } from '../expression/TValue.js';
import type { StringLocated } from '../StringLocated.js';
import type { TMemory } from '../TMemory.js';
import type { TContext } from '../TFunction.js';
import { TFunctionSignature } from '../TFunctionSignature.js';
import { EaterException } from '../EaterException.js';
import { SimpleReturnFunction } from './SimpleReturnFunction.js';
import type { WithGetFunctionSmart } from './context-ext.js';

const SIGNATURE = new TFunctionSignature('%call_user_func', 1);

export class CallUserFunction extends SimpleReturnFunction {
  getSignature(): TFunctionSignature {
    return SIGNATURE;
  }

  canCover(nbArg: number, _namedArguments: ReadonlySet<string>): boolean {
    return nbArg > 0;
  }

  executeReturnFunction(
    context: TContext,
    memory: TMemory,
    location: StringLocated,
    values: readonly TValue[],
    named: ReadonlyMap<string, TValue>,
  ): TValue {
    const ctx = context as WithGetFunctionSmart;
    const fname = values[0]!.toString();
    const args = values.slice(1);
    const signature = new TFunctionSignature(fname, args.length);
    const func = ctx.getFunctionSmart(signature);
    if (func === undefined) throw new EaterException(`Cannot find void function ${fname}`, location);

    return func.executeReturnFunction(ctx, memory, location, args, named);
  }
}
