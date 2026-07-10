/**
 * `%retrieve_procedure(nameExpr, arg1, arg2, ...)` — same call signature as
 * `%invoke_procedure` (first arg is the target procedure name expression,
 * the rest are its positional arguments), but a RETURN function: upstream
 * runs the target through `getResultList()`/`extractFromResultList` to
 * CAPTURE its output as a string value (joined with a newline between
 * result lines) instead of splicing it into the surrounding output as new
 * source lines. Used to pass a procedure's output as an argument to another
 * call, e.g. `addNote(%retrieve_procedure("$OBJ"), note1)` (xadado-92-lazo250).
 *
 * Target resolution (name lookup + positional-argument binding) is
 * identical to `%invoke_procedure`, so it is reused verbatim; only the
 * caller (`TContext#expandRetrieveProcedureCallsIn`) differs in what it does
 * with the resolved target — expand-and-join into a quoted string spliced
 * back into the enclosing call's argument text, rather than expand-and-emit
 * as new lines.
 *
 * @see ~/git/plantuml/.../tim/builtin/RetrieveProcedure.java
 */

import type { FunctionsSet } from '../FunctionsSet.js';
import {
  resolveInvokeProcedureTarget,
  type InvokeProcedureTarget,
} from './InvokeProcedure.js';

export const RETRIEVE_PROCEDURE_NAME = '%retrieve_procedure';

/**
 * Resolve `%retrieve_procedure`'s target procedure + bound parameters — same
 * logic as `resolveInvokeProcedureTarget` (upstream's `RetrieveProcedure`
 * and `InvokeProcedure` both take `(name, ...args)` and dispatch via
 * `context.getFunctionSmart`).
 */
export function resolveRetrieveProcedureTarget(
  registry: FunctionsSet,
  rawArgs: readonly string[],
  callerBindings: ReadonlyMap<string, string>,
): InvokeProcedureTarget {
  return resolveInvokeProcedureTarget(registry, rawArgs, callerBindings);
}
