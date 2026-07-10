/**
 * Registry of declared TIM procedures (`!procedure` / `!unquoted procedure`
 * / `!final procedure`), keyed by name.
 *
 * Scope note: this mirrors only the subset of upstream `FunctionsSet.java`
 * needed for the `!procedure` family that plantuml-ts's class-diagram
 * corpus actually exercises — `!function`/`!return` (RETURN_FUNCTION) and
 * legacy `!definelong` are out of scope (see
 * tests/unit/core/preprocessor-procedure.test.ts).
 *
 * @see ~/git/plantuml/.../tim/FunctionsSet.java
 * @see ~/git/plantuml/.../tim/TFunctionSignature.java
 */

export interface TProcedureParam {
  /** Includes the leading `$`, e.g. `"$source"` — matches how the body
   * references it (`$source --> $destination`). */
  readonly name: string;
  /** Raw (unevaluated) default-value text, if the parameter declared one. */
  readonly defaultValue?: string;
}

/** A declared procedure: raw, unexpanded body source lines. */
export interface TProcedure {
  readonly name: string;
  readonly params: readonly TProcedureParam[];
  readonly unquoted: boolean;
  readonly finalFlag: boolean;
  readonly body: readonly string[];
}

/** @see TFunctionImpl#canCover */
function canCover(proc: TProcedure, nbArg: number): boolean {
  if (nbArg > proc.params.length) return false;
  const needed = proc.params.filter((p) => p.defaultValue === undefined).length;
  return nbArg >= needed;
}

export class FunctionsSet {
  private readonly byName = new Map<string, TProcedure[]>();

  /** @see FunctionsSet#addFunction */
  declare(proc: TProcedure): void {
    const list = this.byName.get(proc.name) ?? [];
    list.push(proc);
    this.byName.set(proc.name, list);
  }

  doesFunctionExist(name: string): boolean {
    return this.byName.has(name);
  }

  /** First declared overload of `name` whose parameter list can cover
   * `nbArg` positional arguments. @see FunctionsSet#getFunctionSmart */
  getFunctionSmart(name: string, nbArg: number): TProcedure | undefined {
    const candidates = this.byName.get(name);
    if (candidates === undefined) return undefined;
    return candidates.find((proc) => canCover(proc, nbArg));
  }

  /** All declared procedure names — the call-scanner's candidate list. */
  names(): string[] {
    return [...this.byName.keys()];
  }
}
