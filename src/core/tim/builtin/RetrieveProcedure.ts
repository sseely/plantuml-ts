/**
 * `%retrieve_procedure(nameExpr, arg1, arg2, ...)` -- same call signature as
 * `%invoke_procedure` (first arg is the target procedure name expression, the
 * rest are its positional arguments), but a RETURN function: it runs the
 * target and CAPTURES the output lines the target appended to the context's
 * result list, joining them into one string value instead of splicing them
 * into the surrounding output as new source lines. Used to pass a procedure's
 * output as an argument to another call, e.g.
 * `addNote(%retrieve_procedure("$OBJ"), note1)` (xadado-92-lazo250).
 *
 * Batch SI5a-4 REPLACEMENT (debt payment): this file previously exported a
 * `resolveRetrieveProcedureTarget` resolver function consumed by the pre-TIM
 * flat-loop expander, instead of implementing `TFunction` like the other 73
 * builtins. It now extends `SimpleReturnFunction` and captures via
 * `TContext#getResultList` / `#extractFromResultList`, exactly as upstream.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/builtin/RetrieveProcedure.java
 */

import { TValue } from '../expression/TValue.js';
import { EaterException } from '../EaterException.js';
import type { StringLocated } from '../StringLocated.js';
import type { TContext } from '../TFunction.js';
import { TFunctionSignature } from '../TFunctionSignature.js';
import type { TMemory } from '../TMemory.js';
import { SimpleReturnFunction } from './SimpleReturnFunction.js';
import type { WithResultList } from './context-ext.js';

const SIGNATURE = new TFunctionSignature('%retrieve_procedure', 1);

const NO_NAMED_ARGUMENTS: ReadonlyMap<string, TValue> = new Map();

/**
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/builtin/RetrieveProcedure.java
 */
export class RetrieveProcedure extends SimpleReturnFunction {
  getSignature(): TFunctionSignature {
    return SIGNATURE;
  }

  canCover(nbArg: number, _namedArguments: ReadonlySet<string>): boolean {
    return nbArg > 0;
  }

  /** @throws EaterException (thrown, not returned) when the computed name resolves to nothing. */
  executeReturnFunction(
    context: TContext,
    memory: TMemory,
    location: StringLocated,
    values: readonly TValue[],
    _named: ReadonlyMap<string, TValue>,
  ): TValue {
    const ctx = context as WithResultList;
    const fname = values[0]!.toString();
    const args = values.slice(1);
    const signature = new TFunctionSignature(fname, args.length);
    const func = ctx.getFunctionSmart(signature);
    // Upstream dereferences `func` without a null check (an NPE if the name is
    // unknown). A typed EaterException is the faithful-in-spirit equivalent
    // here: this port has no error-diagram path, so an NPE would surface as an
    // opaque TypeError instead of a located TIM error.
    if (func === undefined) throw new EaterException(`Cannot find void function ${fname}`, location);

    const n1 = ctx.getResultList().length;
    func.executeProcedureInternal(context, memory, location, args, NO_NAMED_ARGUMENTS);
    const extracted = ctx.extractFromResultList(n1);
    return TValue.fromString(extracted);
  }
}
