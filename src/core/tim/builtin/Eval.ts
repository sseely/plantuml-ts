/**
 * `%eval(expr)` -- evaluates `expr` as a TIM expression and coerces the
 * result to an integer.
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/builtin/Eval.java
 */

import { TValue } from '../expression/TValue.js';
import type { StringLocated } from '../StringLocated.js';
import type { TMemory } from '../TMemory.js';
import type { TContext } from '../TFunction.js';
import { TFunctionSignature } from '../TFunctionSignature.js';
import { StringEater } from '../StringEater.js';
import { SimpleReturnFunction } from './SimpleReturnFunction.js';

const SIGNATURE = new TFunctionSignature('%eval', 1);

export class Eval extends SimpleReturnFunction {
  getSignature(): TFunctionSignature {
    return SIGNATURE;
  }

  canCover(nbArg: number, _namedArguments: ReadonlySet<string>): boolean {
    return nbArg === 1;
  }

  /** @throws EaterException (thrown, not returned) on evaluation failure. */
  executeReturnFunction(
    context: TContext,
    memory: TMemory,
    _location: StringLocated,
    values: readonly TValue[],
    _named: ReadonlyMap<string, TValue>,
  ): TValue {
    const exp = values[0]!.toString();
    const eater = new StringEater(exp);
    const value = eater.eatExpression(context, memory);
    return TValue.fromInt(value.toInt());
  }
}
