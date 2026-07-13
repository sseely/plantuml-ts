/**
 * Collects a `!procedure` / `!definelong` declaration's multi-line body:
 * while a PROCEDURE or LEGACY_DEFINELONG function is pending, every line up
 * to (not including) `!endprocedure`/`!enddefinelong` is buffered onto it
 * instead of being emitted.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/iterator/CodeIteratorProcedure.java
 */

import type { StringLocated } from '../StringLocated.js';
import { TFunctionType } from '../TFunctionType.js';
import type { TMemory } from '../TMemory.js';
import type { TContext } from '../TFunction.js';
import { AbstractCodeIterator } from './AbstractCodeIterator.js';
import type { CodeIterator } from './CodeIterator.js';
import type { FunctionsSet } from './FunctionsSet.js';

/**
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/iterator/CodeIteratorProcedure.java
 */
export class CodeIteratorProcedure extends AbstractCodeIterator {
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

  /** @throws EaterException (thrown, not returned) on a malformed directive. */
  peek(): StringLocated | null {
    while (true) {
      const result = this.source.peek();
      if (result === null) return null;

      const pending = this.functionsSet.pendingFunction();
      if (
        pending !== undefined &&
        (pending.getFunctionType() === TFunctionType.PROCEDURE ||
          pending.getFunctionType() === TFunctionType.LEGACY_DEFINELONG)
      ) {
        this.logs.push(result);
        if (result.getType() === 'END_FUNCTION') {
          this.functionsSet.executeEndfunction();
        } else {
          pending.addBody(result);
        }
        this.next();
        continue;
      }

      if (result.getType() === 'DECLARE_PROCEDURE') {
        this.logs.push(result);
        this.functionsSet.executeDeclareProcedure(this.context, this.memory, result);
        this.next();
        continue;
      }

      return result;
    }
  }
}
