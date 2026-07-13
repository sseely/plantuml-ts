/**
 * `%invoke_procedure(nameExpr, arg1, arg2, ...)` -- computes a procedure name
 * at runtime (e.g. `%invoke_procedure("_"+$x)`) and dispatches to it. Used by
 * salt-diagram-style TIM idioms where a procedure name is built from a
 * parameter (`SALT($x)` invoking `_<x>`).
 *
 * Batch SI5a-4 REPLACEMENT (debt payment): this file previously exported a
 * `resolveInvokeProcedureTarget` resolver function consumed by the pre-TIM
 * flat-loop expander, instead of implementing `TFunction` like the other 73
 * builtins. It now implements `TFunction` -- a PROCEDURE-typed one, so
 * `executeReturnFunction` throws and `executeProcedureInternal` does the work
 * -- exactly as upstream does, and is registered in
 * `TContext#addStandardFunctions` alongside every other builtin.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/builtin/InvokeProcedure.java
 */

import type { TValue } from '../expression/TValue.js';
import { EaterException } from '../EaterException.js';
import type { StringLocated } from '../StringLocated.js';
import type { TContext, TFunction } from '../TFunction.js';
import { TFunctionSignature } from '../TFunctionSignature.js';
import { TFunctionType } from '../TFunctionType.js';
import type { TMemory } from '../TMemory.js';
import type { WithGetFunctionSmart } from './context-ext.js';

const SIGNATURE = new TFunctionSignature('%invoke_procedure', 1);

/**
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/builtin/InvokeProcedure.java
 */
export class InvokeProcedure implements TFunction {
  getSignature(): TFunctionSignature {
    return SIGNATURE;
  }

  canCover(nbArg: number, _namedArguments: ReadonlySet<string>): boolean {
    return nbArg > 0;
  }

  getFunctionType(): TFunctionType {
    return TFunctionType.PROCEDURE;
  }

  /** @throws EaterException (thrown, not returned) when the computed name resolves to nothing. */
  executeProcedureInternal(
    context: TContext,
    memory: TMemory,
    location: StringLocated,
    args: readonly TValue[],
    named: ReadonlyMap<string, TValue>,
  ): void {
    const ctx = context as WithGetFunctionSmart;
    const fname = args[0]!.toString();
    const sublist = args.slice(1);
    const signature = new TFunctionSignature(fname, sublist.length);
    const func = ctx.getFunctionSmart(signature);
    if (func === undefined) throw new EaterException(`Cannot find void function ${fname}`, location);

    func.executeProcedureInternal(context, memory, location, sublist, named);
  }

  /** @throws Error (`UnsupportedOperationException`) always -- this is a procedure. */
  executeReturnFunction(
    _context: TContext,
    _memory: TMemory,
    _location: StringLocated,
    _values: readonly TValue[],
    _named: ReadonlyMap<string, TValue>,
  ): TValue {
    throw new Error('UnsupportedOperationException');
  }

  isUnquoted(): boolean {
    return false;
  }
}
