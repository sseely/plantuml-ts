/**
 * The memory-lookup contract the expression evaluator depends on:
 * resolving a bare identifier to a value, and resolving a call signature to
 * a built-in/user function.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/expression/Knowledge.java
 *
 * Boundary note: `Knowledge.java` -- and, transitively, `ShuntingYard`,
 * `ReversePolishInterpretor`, and `TokenStack#getResult` -- reference several
 * types that live outside `tim/expression/`:
 * `net.sourceforge.plantuml.tim.{EaterException, TContext, TMemory,
 * TFunction, TFunctionSignature}` and `net.sourceforge.plantuml.text.
 * StringLocated` (itself carrying a `net.sourceforge.plantuml.utils.
 * LineLocation`).
 *
 * Batch SI5a-4 (debt payment): every one of those is now a plain re-export of
 * the REAL type. Batches 1 and 2a left narrow structural stand-ins here
 * (`TContext` = `{ asKnowledge }`, `TMemory` = `unknown`, `StringLocated` =
 * `{ getLocation }`, `TFunction` = 3 members), which meant two parallel type
 * hierarchies coexisted, compatible only in the wide->narrow direction. That
 * is retired: this file declares NO local stand-in types, and there is exactly
 * one `TContext` / `TMemory` / `StringLocated` / `TFunction` in the codebase.
 * The `tim/expression/` test doubles that duck-typed the old narrow shapes now
 * construct real instances (`tests/helpers/tim-expression-{eater,knowledge}.ts`)
 * -- no adapters, no `as` bridges.
 *
 * The re-exports are kept (rather than pointing every file in this package at
 * `../StringLocated.js` etc. directly) because they mirror upstream's own
 * import surface for this package and keep `expression/index.ts` a complete
 * barrel for it.
 */
import type { TValue } from './TValue.js';

export { EaterException } from '../EaterException.js';

export type { LineLocation, StringLocated } from '../StringLocated.js';

export type { TMemory } from '../TMemory.js';

export type { TContext, TFunction } from '../TFunction.js';

export { TFunctionSignature } from '../TFunctionSignature.js';
import type { TFunctionSignature } from '../TFunctionSignature.js';
import type { TFunction } from '../TFunction.js';

/** @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/expression/Knowledge.java */
export interface Knowledge {
  getVariable(name: string): TValue;

  getFunction(signature: TFunctionSignature): TFunction | undefined;
}
