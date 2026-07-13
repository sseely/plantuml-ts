/**
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/TFunction.java
 */

import type { TValue } from './expression/TValue.js';
import type { StringLocated, LineLocation } from './StringLocated.js';
import type { TFunctionSignature } from './TFunctionSignature.js';
import type { TFunctionType } from './TFunctionType.js';
import type { TMemory } from './TMemory.js';
import type { Knowledge } from './expression/Knowledge.js';

/**
 * Canonical stand-in for `net.sourceforge.plantuml.tim.TContext` for this
 * batch's OWN `tim/` write-set (`Eater`, `TFunctionImpl`, `VariableManager`,
 * `TMemory`) -- declares the members those files actually call:
 * `asKnowledge` (every `Eater#eatExpression*` call, transitively, via
 * `TokenStack#getResult`), `executeLines` (a function/procedure body's
 * evaluation), and `applyFunctionsAndVariables` (inline `$var`/call
 * substitution). The real class carries dozens of other members (a 36KB
 * file); omitted per this package's don't-invent-unused-surface
 * discipline.
 *
 * This is intentionally a DIFFERENT (wider) declaration than
 * `tim/expression/Knowledge.ts`'s own `TContext` (asKnowledge only) --
 * see that file's header for why the two are not merged into one shared
 * type (that package's 139-test suite duck-types against its narrower
 * shape). A value typed as THIS `TContext` is always assignable where
 * Knowledge.ts's narrower one is expected (structural subtyping,
 * wide -> narrow); a real `TContext` implementation (a future batch)
 * satisfies both, with zero adapter code.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/TContext.java#asKnowledge
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/TContext.java#executeLines
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/TContext.java#applyFunctionsAndVariables
 */
export interface TContext {
  asKnowledge(memory: TMemory, location: LineLocation): Knowledge;

  /** @throws EaterException (thrown, not returned) on evaluation failure. */
  executeLines(
    memory: TMemory,
    body: readonly StringLocated[],
    type: TFunctionType,
    wantReturn: boolean,
  ): TValue | undefined;

  /** @throws EaterException (thrown, not returned) on evaluation failure. */
  applyFunctionsAndVariables(memory: TMemory, location: StringLocated): string;
}

/**
 * A declared or built-in TIM function/procedure.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/TFunction.java
 */
export interface TFunction {
  getSignature(): TFunctionSignature;

  canCover(nbArg: number, namedArguments: ReadonlySet<string>): boolean;

  getFunctionType(): TFunctionType;

  /** @throws EaterException (thrown, not returned) on evaluation failure. */
  executeReturnFunction(
    context: TContext,
    memory: TMemory,
    location: StringLocated,
    args: readonly TValue[],
    named: ReadonlyMap<string, TValue>,
  ): TValue;

  /** @throws EaterException (thrown, not returned) on evaluation failure. */
  executeProcedureInternal(
    context: TContext,
    memory: TMemory,
    location: StringLocated,
    args: readonly TValue[],
    named: ReadonlyMap<string, TValue>,
  ): void;

  isUnquoted(): boolean;
}
