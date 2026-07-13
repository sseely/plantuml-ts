/**
 * Local, widened structural extensions of `TContext` (`../TFunction.js`)
 * for the handful of builtins that need one additional lookup upstream's
 * real (36KB) `net.sourceforge.plantuml.tim.TContext` carries but the
 * shared narrow stand-in omits per its own don't-invent-unused-surface
 * discipline (see `TFunction.ts`'s file header). Each interface here
 * `extends TContext`, so a real `TContext` (Batch 4) satisfies it
 * structurally with zero adapter code; callers receive the plain `TContext`
 * per the `TFunction` interface and narrow with `as` internally, matching
 * this package's established stand-in pattern (`expression/Knowledge.ts`,
 * `TFunction.ts`).
 *
 * Note: `TFunction.ts`'s `TContext` already declares `doesFunctionExist`
 * (added by the concurrent iterator-chain batch for `EaterIfdef`/
 * `EaterIfndef`), so `FunctionExists` uses the base `TContext` directly and
 * needs no extension here.
 */

import type { TContext, TFunction } from '../TFunction.js';
import type { TFunctionSignature } from '../TFunctionSignature.js';

/** @see ~/git/plantuml/.../tim/TContext.java#getFunctionSmart */
export interface WithGetFunctionSmart extends TContext {
  getFunctionSmart(signature: TFunctionSignature): TFunction | undefined;
}

/** @see ~/git/plantuml/.../tim/TContext.java#getXargs */
export interface WithXargs extends TContext {
  getXargs(): string | undefined;
}
