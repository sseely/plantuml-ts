/**
 * Collects a `!function` declaration's multi-line body, the RETURN_FUNCTION
 * sibling of `CodeIteratorProcedure`. Unlike a procedure, a function must
 * contain at least one `!return` before its `!endfunction` -- enforced here
 * (not in `FunctionsSet`) since only this iterator sees the END_FUNCTION
 * boundary.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/iterator/CodeIteratorReturnFunction.java
 */

import type { StringLocated } from '../StringLocated.js';
import { EaterException } from '../EaterException.js';
import { TFunctionType } from '../TFunctionType.js';
import type { TMemory } from '../TMemory.js';
import type { TContext } from '../TFunction.js';
import { AbstractCodeIterator } from './AbstractCodeIterator.js';
import type { CodeIterator } from './CodeIterator.js';
import type { FunctionsSet } from './FunctionsSet.js';

/**
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/iterator/CodeIteratorReturnFunction.java
 */
export class CodeIteratorReturnFunction extends AbstractCodeIterator {
  private readonly functionsSet: FunctionsSet;
  private readonly context: TContext;
  private readonly memory: TMemory;
  private readonly logs: StringLocated[];

  constructor(
    source: CodeIterator,
    context: TContext,
    memory: TMemory,
    functionsSet: FunctionsSet,
    logs: StringLocated[],
  ) {
    super(source);
    this.context = context;
    this.functionsSet = functionsSet;
    this.logs = logs;
    this.memory = memory;
  }

  /** @throws EaterException (thrown, not returned) on a malformed directive, or a function with no `!return`. */
  peek(): StringLocated | null {
    while (true) {
      const result = this.source.peek();
      if (result === null) return null;

      const pending = this.functionsSet.pendingFunction();
      if (pending !== undefined && pending.getFunctionType() === TFunctionType.RETURN_FUNCTION) {
        this.logs.push(result);
        if (result.getType() === 'END_FUNCTION') {
          if (!pending.doesContainReturn())
            throw new EaterException(
              'This function does not have any !return directive. Declare it as a procedure instead ?',
              result,
            );

          this.functionsSet.executeEndfunction();
        } else {
          pending.addBody(result);
        }
        this.next();
        continue;
      }

      if (result.getType() === 'DECLARE_RETURN_FUNCTION') {
        this.logs.push(result);
        this.functionsSet.executeDeclareReturnFunction(this.context, this.memory, result);
        this.next();
        continue;
      }

      return result;
    }
  }
}
