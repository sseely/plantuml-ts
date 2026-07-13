/**
 * Contract for the real, upstream-shaped `net.sourceforge.plantuml.tim.
 * FunctionsSet` -- the pending-function state machine that
 * `CodeIteratorProcedure`, `CodeIteratorReturnFunction`, and
 * `CodeIteratorLegacyDefine` all depend on directly (constructor parameter,
 * matching upstream's constructor shape exactly).
 *
 * NAMING NOTE, read before touching either file: this is INTENTIONALLY NOT
 * the same type as the existing `src/core/tim/FunctionsSet.ts` class
 * (also named `FunctionsSet`, also `@see`ing the same upstream file). That
 * file is pre-mission-SI5a legacy code (see `plans/si5a-tim/README.md`'s
 * "Today we have a partial port" list) -- a narrow procedure-name registry
 * (`declare`/`doesFunctionExist`/`getFunctionSmart`/`names`) built for the
 * OLD flat-line-loop `preprocessor.ts`, and it is explicitly out of this
 * batch's write-set ("Do NOT touch ... FunctionsSet.ts"). Upstream's REAL
 * `FunctionsSet` is a much richer pending-function/declare/end-function
 * state machine (`pendingFunction`, `executeDeclareProcedure`,
 * `executeDeclareReturnFunction`, `executeEndfunction`,
 * `executeLegacyDefine`, `executeLegacyDefineLong`) that the `!procedure`
 * / `!function` / `!definelong` multi-line body-collection directives in
 * the `iterator/` chain need -- a fundamentally different shape from the
 * legacy registry, not a superset of it. Declaring it here (rather than
 * touching the do-not-touch file, or silently reusing its name for an
 * incompatible shape in the same directory) keeps both intact and
 * unambiguous. Batch 4 (the real `TContext` + preprocessor rewrite) owns
 * deciding whether the legacy `tim/FunctionsSet.ts` is retired in favor of
 * a real implementation of THIS interface, or whether the two are merged
 * -- flagged explicitly in this batch's report per the mission's
 * TContext-widening precedent (`TFunction.ts`'s file header).
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/FunctionsSet.java
 */

import type { StringLocated } from '../StringLocated.js';
import type { TContext, TFunction } from '../TFunction.js';
import type { TFunctionImpl } from '../TFunctionImpl.js';
import type { TMemory } from '../TMemory.js';
import type { TFunctionSignature } from '../TFunctionSignature.js';

export interface FunctionsSet {
  getFunctionSmart(searched: TFunctionSignature): TFunction | undefined;

  size(): number;

  getLonguestMatchStartingIn(s: string, pos: number): string;

  /** Java `null` (no function currently being declared) -> `undefined`. */
  pendingFunction(): TFunctionImpl | undefined;

  addFunction(func: TFunction): void;

  doesFunctionExist(functionName: string): boolean;

  getFunctionsByName(functionName: string): Iterable<TFunction>;

  executeEndfunction(): void;

  /** @throws EaterException (thrown, not returned) if a legacy define is already pending. */
  executeLegacyDefine(context: TContext, memory: TMemory, s: StringLocated): void;

  /** @throws EaterException (thrown, not returned) if a function is already pending. */
  executeLegacyDefineLong(context: TContext, memory: TMemory, s: StringLocated): void;

  /** @throws EaterException (thrown, not returned) if a function is already pending, or redeclaring a `final` function. */
  executeDeclareReturnFunction(context: TContext, memory: TMemory, s: StringLocated): void;

  /** @throws EaterException (thrown, not returned) if a function is already pending, or redeclaring a `final` procedure. */
  executeDeclareProcedure(context: TContext, memory: TMemory, s: StringLocated): void;
}
