/**
 * `%invoke_procedure(nameExpr, arg1, arg2, ...)` — computes a procedure name
 * at runtime (e.g. `%invoke_procedure("_"+$x)`) and dispatches to it. Used
 * by salt-diagram-style TIM idioms where a procedure name is built from a
 * parameter (`SALT($x)` invoking `_<x>`).
 *
 * This module only *resolves* the target (name lookup + argument binding);
 * it does not execute the body. The caller (`TContext#expandProcedureCalls`)
 * recursively expands `target.proc.body` with `target.bindings` — matching
 * upstream's `InvokeProcedure#executeProcedureInternal`, which resolves the
 * target function and delegates to `func.executeProcedureInternal(...)`
 * rather than expanding it inline.
 *
 * @see ~/git/plantuml/.../tim/builtin/InvokeProcedure.java
 */

import type { FunctionsSet, TProcedure } from '../FunctionsSet.js';
import { resolveArg } from '../expression.js';

export const INVOKE_PROCEDURE_NAME = '%invoke_procedure';

export interface InvokeProcedureTarget {
  readonly proc: TProcedure;
  readonly bindings: ReadonlyMap<string, string>;
}

/**
 * Resolve the target procedure and its bound parameters for an
 * `%invoke_procedure(...)` call.
 *
 * `rawArgs[0]` is the name expression (upstream: `args.get(0)`); any
 * further args (`rawArgs[1..]`) are the invoked procedure's own positional
 * arguments (upstream: `args.subList(1, args.size())`). Both are evaluated
 * in normal (non-`unquoted`) mode — `%invoke_procedure` is not itself
 * `unquoted`, and it hands already-evaluated values to the target
 * (`isUnquoted()` returns `false` on `InvokeProcedure`), so the *target's*
 * own `unquoted` flag plays no role here.
 */
export function resolveInvokeProcedureTarget(
  registry: FunctionsSet,
  rawArgs: readonly string[],
  callerBindings: ReadonlyMap<string, string>,
): InvokeProcedureTarget {
  if (rawArgs.length === 0) {
    throw new Error('%invoke_procedure requires at least one argument (the procedure name)');
  }

  const computedName = resolveArg(rawArgs[0]!, callerBindings, false);
  const extraArgs = rawArgs.slice(1);
  const proc = registry.getFunctionSmart(computedName, extraArgs.length);
  if (proc === undefined) {
    throw new Error(`Cannot find void function ${computedName}`);
  }

  const bindings = new Map<string, string>();
  proc.params.forEach((param, i) => {
    const raw = extraArgs[i];
    bindings.set(
      param.name,
      raw !== undefined ? resolveArg(raw, callerBindings, false) : (param.defaultValue ?? ''),
    );
  });
  return { proc, bindings };
}
