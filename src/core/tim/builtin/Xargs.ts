/**
 * `%xargs()` -- returns the `-xarg` command-line-equivalent string bound to
 * this render, or `""` if none was supplied.
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/builtin/Xargs.java
 */

import { TValue } from '../expression/TValue.js';
import type { TContext } from '../TFunction.js';
import { TFunctionSignature } from '../TFunctionSignature.js';
import { SimpleReturnFunction } from './SimpleReturnFunction.js';
import type { WithXargs } from './context-ext.js';

const SIGNATURE = new TFunctionSignature('%xargs', 0);

export class Xargs extends SimpleReturnFunction {
  getSignature(): TFunctionSignature {
    return SIGNATURE;
  }

  canCover(nbArg: number, _namedArguments: ReadonlySet<string>): boolean {
    return nbArg === 1;
  }

  executeReturnFunction(
    context: TContext,
    _memory: unknown,
    _location: unknown,
    _values: readonly TValue[],
    _named: ReadonlyMap<string, TValue>,
  ): TValue {
    const xargs = (context as WithXargs).getXargs();
    return TValue.fromString(xargs ?? '');
  }
}
