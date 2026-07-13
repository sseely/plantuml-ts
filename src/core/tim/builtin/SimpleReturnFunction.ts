/**
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/builtin/SimpleReturnFunction.java
 */

import type { TValue } from '../expression/TValue.js';
import type { StringLocated } from '../StringLocated.js';
import type { TMemory } from '../TMemory.js';
import type { TContext, TFunction } from '../TFunction.js';
import type { TFunctionSignature } from '../TFunctionSignature.js';
import { TFunctionType } from '../TFunctionType.js';

/**
 * Shared base for every built-in RETURN function: fixes `getFunctionType`
 * to `RETURN_FUNCTION`, `isUnquoted` to `false`, and `executeProcedureInternal`
 * to an unconditional throw (a RETURN function is never invoked as a
 * procedure) -- all `final` on the Java side. TS has no `final` method
 * modifier, so these are ordinary concrete methods every subclass inherits;
 * no subclass in this package overrides them, matching upstream.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/builtin/SimpleReturnFunction.java
 */
export abstract class SimpleReturnFunction implements TFunction {
  abstract getSignature(): TFunctionSignature;

  abstract canCover(nbArg: number, namedArguments: ReadonlySet<string>): boolean;

  getFunctionType(): TFunctionType {
    return TFunctionType.RETURN_FUNCTION;
  }

  /** @throws Error (`UnsupportedOperationException`) always -- a RETURN function is never a procedure. */
  executeProcedureInternal(
    _context: TContext,
    _memory: TMemory,
    _location: StringLocated,
    _args: readonly TValue[],
    _named: ReadonlyMap<string, TValue>,
  ): void {
    throw new Error('UnsupportedOperationException');
  }

  isUnquoted(): boolean {
    return false;
  }

  /** @throws EaterException (thrown, not returned) on evaluation failure. */
  abstract executeReturnFunction(
    context: TContext,
    memory: TMemory,
    location: StringLocated,
    values: readonly TValue[],
    named: ReadonlyMap<string, TValue>,
  ): TValue;
}
