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
    // SI6: ported faithfully -- upstream dereferences the lookup with NO null
    // check, so `%retrieve_procedure("nope")` is an NPE. This port used to add a
    // guard (a typed `EaterException`) upstream does not have, justified by the
    // absence of an error-diagram path: an unguarded deref would have escaped
    // `renderSync` as a raw TypeError. It no longer can -- `preprocessOrError`
    // captures whatever is thrown and `renderSync` draws the error diagram,
    // which is precisely what upstream does with an NPE here (`PSystemBuilder`
    // catches `Throwable` and reports it AS a diagram). The invented guard is
    // therefore removed rather than kept with a better excuse.
    const n1 = ctx.getResultList().length;
    func!.executeProcedureInternal(context, memory, location, args, NO_NAMED_ARGUMENTS);
    const extracted = ctx.extractFromResultList(n1);
    return TValue.fromString(extracted);
  }
}
