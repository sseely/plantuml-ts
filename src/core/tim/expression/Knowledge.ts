/**
 * The memory-lookup contract the expression evaluator depends on:
 * resolving a bare identifier to a value, and resolving a call signature to
 * a built-in/user function.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/expression/Knowledge.java
 *
 * Boundary note: `Knowledge.java` — and, transitively, `ShuntingYard`,
 * `ReversePolishInterpretor`, and `TokenStack#getResult` — reference several
 * types that live outside `tim/expression/`:
 * `net.sourceforge.plantuml.tim.{EaterException, TContext, TMemory,
 * TFunction, TFunctionSignature}` and `net.sourceforge.plantuml.text.
 * StringLocated` (itself carrying a `net.sourceforge.plantuml.utils.
 * LineLocation`).
 *
 * Batch SI5a-2a update: `EaterException` and `TFunctionSignature` are now
 * real ports (`../EaterException.ts`, `../TFunctionSignature.ts`) and are
 * re-exported from here rather than declared locally -- both are
 * constructed via `new X(...)` at every call site in this package (never
 * duck-typed), so retiring them to the real classes is a zero-adapter
 * swap.
 *
 * `StringLocated`, `TMemory`, `TContext`, and `TFunction` are NOT retired,
 * deliberately: this package's own 139-test suite (and its
 * `tests/helpers/tim-expression-{eater,knowledge}.ts` doubles) duck-types
 * against these names -- e.g. `{ getLocation: () => undefined }` as a
 * `StringLocated`, a bare `undefined` as a `TMemory`, `{ asKnowledge: () =>
 * knowledge }` as a `TContext`, and a 3-method object literal as a
 * `TFunction`. The REAL `net.sourceforge.plantuml.tim.{StringLocated (via
 * ../StringLocated.ts), TMemory, TContext, TFunction}` all carry
 * significantly more required members (private fields on the real
 * `StringLocated` class in particular, which TypeScript will not structurally
 * satisfy from a plain object literal at all). Investigated per this
 * mission's stand-in-mismatch protocol: swapping in the wider real types
 * here breaks ~20 existing assertions across `Knowledge.test.ts`,
 * `ShuntingYard.test.ts`, `ReversePolishInterpretor.test.ts`, and
 * `TokenStack.test.ts` for zero functional gain -- nothing in
 * `tim/expression/` calls the additional members the wider types add. The
 * narrow stand-ins declared below ARE the correct minimal structural
 * contract for this package's boundary (this package's own
 * don't-invent-unused-surface discipline, not a gap); a real
 * `StringLocated`/`TMemory`/`TContext`/`TFunction` instance still satisfies
 * them one-directionally (wide instance -> narrow parameter always
 * type-checks), so production callers are unaffected. `tim/`'s OWN files
 * needing the wider real `TContext` (`executeLines`, `applyFunctionsAndVariables`)
 * declare that separately in `../TFunction.ts`, not here.
 */
import type { TValue } from './TValue.js';

export { EaterException } from '../EaterException.js';

export type LineLocation = unknown;

/**
 * Stand-in for `net.sourceforge.plantuml.text.StringLocated` — only the
 * member this package calls (`getLocation`) is declared.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/text/StringLocated.java
 */
export interface StringLocated {
  getLocation(): LineLocation;
}

/**
 * Stand-in for `net.sourceforge.plantuml.tim.TMemory` — opaque to this
 * package. Every call site here only forwards the reference (to
 * `TContext#asKnowledge` and `TFunction#executeReturnFunction`); nothing in
 * `tim/expression/` calls a `TMemory` method directly.
 */
export type TMemory = unknown;

/**
 * Stand-in for `net.sourceforge.plantuml.tim.TContext` — only the member
 * `TokenStack#getResult` calls (`asKnowledge`) is declared.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/TContext.java#asKnowledge
 */
export interface TContext {
  asKnowledge(memory: TMemory, location: LineLocation): Knowledge;
}

export { TFunctionSignature } from '../TFunctionSignature.js';
import type { TFunctionSignature } from '../TFunctionSignature.js';

/**
 * Stand-in for `net.sourceforge.plantuml.tim.TFunction` — declares only the
 * members `ReversePolishInterpretor` calls (`getSignature`, `canCover`,
 * `executeReturnFunction`). The real interface also has `getFunctionType`,
 * `executeProcedureInternal`, and `isUnquoted`; none of those are called
 * from `tim/expression/`, so they are omitted here rather than stubbed, per
 * this package's don't-invent-unused-surface discipline. A real
 * `TFunction` implementation satisfies this narrower interface
 * structurally.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/TFunction.java
 */
export interface TFunction {
  getSignature(): TFunctionSignature;

  canCover(nbArg: number, namedArguments: ReadonlySet<string>): boolean;

  executeReturnFunction(
    context: TContext,
    memory: TMemory,
    location: StringLocated,
    args: readonly TValue[],
    named: ReadonlyMap<string, TValue>,
  ): TValue;
}

/** @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/expression/Knowledge.java */
export interface Knowledge {
  getVariable(name: string): TValue;

  getFunction(signature: TFunctionSignature): TFunction | undefined;
}
