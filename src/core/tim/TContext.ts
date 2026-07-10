/**
 * Recursive expansion of TIM `!procedure` calls (and the
 * `%invoke_procedure` builtin) within a single source line. Mirrors the
 * PROCEDURE-only slice of `TContext#applyFunctionsAndVariables` +
 * `#addPlain` + `#executeVoid3`: no `RETURN_FUNCTION`/`!function` support
 * (out of scope — see tests/unit/core/preprocessor-procedure.test.ts).
 *
 * Recursion note: upstream has no call-depth guard for procedures (verified
 * against `TContext.java`/`TMemory.java`/`FunctionsSet.java` — the only
 * "Infinite loop?" guard in `tim/` is `CodeIteratorImpl`'s unrelated
 * no-progress check on its own line cursor). This port mirrors that
 * absence: a self-recursive procedure will exhaust the JS call stack, same
 * as it would exhaust the Java call stack upstream. No guard is added.
 *
 * @see ~/git/plantuml/.../tim/TContext.java#applyFunctionsAndVariables
 * @see ~/git/plantuml/.../tim/TContext.java#addPlain
 * @see ~/git/plantuml/.../tim/iterator/CodeIteratorProcedure.java
 */

import type { FunctionsSet, TProcedure } from './FunctionsSet.js';
import { findCallStart, parseCallArgs } from './EaterFunctionCall.js';
import { resolveArg, substituteParams } from './expression.js';
import { INVOKE_PROCEDURE_NAME, resolveInvokeProcedureTarget } from './builtin/InvokeProcedure.js';

/**
 * Expand procedure calls in `line`, recursively. A line with no matching
 * call is returned unchanged after `$param` substitution against
 * `bindings` — a no-op when `bindings` is empty — so calling this with an
 * empty `registry` (no `!procedure` declared) is a transparent passthrough
 * for every fixture that doesn't use the feature.
 *
 * Also transparent when a name-shaped call site references an
 * *undeclared* procedure: it simply won't appear in `registry.names()`, so
 * `findCallStart` never matches it and the text passes through literally —
 * the same "not expanded" behavior upstream gets from `getFunctionNameAt`
 * only recognizing registered names.
 */
export function expandProcedureCalls(
  line: string,
  registry: FunctionsSet,
  bindings: ReadonlyMap<string, string>,
): string[] {
  const names = registry.names();
  if (names.length === 0) return [substituteParams(line, bindings)];

  const match = findCallStart(line, [...names, INVOKE_PROCEDURE_NAME]);
  if (match === null) return [substituteParams(line, bindings)];

  const parsed = parseCallArgs(line, match.start, match.name);
  if (parsed === null) return [substituteParams(line, bindings)];

  const prefix = substituteParams(line.slice(0, match.start), bindings);
  const suffix = line.slice(parsed.end);
  const bodyOutput = executeCall(registry, match.name, parsed.rawArgs, bindings);

  return stitch(prefix, bodyOutput, suffix);
}

/** Prepend `prefix` to the first emitted line and append `suffix` to the
 * last — mirrors `pendingAdd` (prepended by the next `addPlain`) and
 * `appendToLastResult` (raw append to the last resultList entry) both
 * anchoring onto the called procedure's own output.
 * @see ~/git/plantuml/.../tim/TContext.java#applyFunctionsAndVariables */
function stitch(prefix: string, bodyOutput: readonly string[], suffix: string): string[] {
  if (bodyOutput.length === 0) return [prefix + suffix];
  const result = [...bodyOutput];
  result[0] = prefix + result[0];
  result[result.length - 1] = result[result.length - 1] + suffix;
  return result;
}

function executeCall(
  registry: FunctionsSet,
  name: string,
  rawArgs: readonly string[],
  callerBindings: ReadonlyMap<string, string>,
): string[] {
  if (name === INVOKE_PROCEDURE_NAME) {
    const target = resolveInvokeProcedureTarget(registry, rawArgs, callerBindings);
    return expandBody(registry, target.proc.body, target.bindings);
  }

  const proc = registry.getFunctionSmart(name, rawArgs.length);
  if (proc === undefined) return [];

  const bindings = bindParams(proc, rawArgs, callerBindings);
  return expandBody(registry, proc.body, bindings);
}

/** Bind a call's raw argument text to the declared procedure's parameter
 * names, resolving each per the procedure's own `unquoted` flag.
 * @see ~/git/plantuml/.../tim/TFunctionImpl.java#getNewMemory */
function bindParams(
  proc: TProcedure,
  rawArgs: readonly string[],
  callerBindings: ReadonlyMap<string, string>,
): Map<string, string> {
  const bindings = new Map<string, string>();
  proc.params.forEach((param, i) => {
    const raw = rawArgs[i];
    bindings.set(
      param.name,
      raw !== undefined ? resolveArg(raw, callerBindings, proc.unquoted) : (param.defaultValue ?? ''),
    );
  });
  return bindings;
}

/** Expand every body line (each may itself expand to 0..N lines — e.g. a
 * nested procedure call) and flatten. Body lines see only their own
 * procedure's fresh `bindings`, never the caller's — matching upstream
 * forking a new `TMemory` from global rather than inheriting the caller's. */
function expandBody(
  registry: FunctionsSet,
  body: readonly string[],
  bindings: ReadonlyMap<string, string>,
): string[] {
  const output: string[] = [];
  for (const bodyLine of body) {
    output.push(...expandProcedureCalls(bodyLine, registry, bindings));
  }
  return output;
}
