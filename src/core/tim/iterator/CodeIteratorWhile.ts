/**
 * Interprets `!while <expr>` / `!endwhile`: on `!while`, evaluates the
 * condition and stashes an `ExecutionContextWhile`, marking it skip-me if
 * false from the start; on `!endwhile`, re-evaluates the condition and
 * either jumps back to the top or falls through. Mirrors
 * `CodeIteratorForeach`'s nested-skip `level` tracking exactly.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/iterator/CodeIteratorWhile.java
 */

import type { StringLocated } from '../StringLocated.js';
import { EaterException } from '../EaterException.js';
import { EaterWhile } from '../EaterWhile.js';
import { ExecutionContextWhile } from '../TMemory.js';
import type { TMemory } from '../TMemory.js';
import type { TContext } from '../TFunction.js';
import { AbstractCodeIterator } from './AbstractCodeIterator.js';
import type { CodeIterator } from './CodeIterator.js';

/**
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/iterator/CodeIteratorWhile.java
 */
export class CodeIteratorWhile extends AbstractCodeIterator {
  private readonly context: TContext;
  private readonly memory: TMemory;
  private readonly logs: StringLocated[];

  constructor(source: CodeIterator, context: TContext, memory: TMemory, logs: StringLocated[]) {
    super(source);
    this.context = context;
    this.memory = memory;
    this.logs = logs;
  }

  /** @throws EaterException (thrown, not returned) on a malformed directive. */
  peek(): StringLocated | null {
    let level = 0;
    while (true) {
      const result = this.source.peek();
      if (result === null) return null;

      const currentWhile = this.memory.peekWhile();
      if (currentWhile !== undefined && currentWhile.isSkipMe()) {
        if (result.getType() === 'WHILE') {
          level++;
        } else if (result.getType() === 'ENDWHILE') {
          level--;
          if (level === -1) {
            this.memory.pollWhile();
            level = 0;
          }
        }
        this.next();
        continue;
      }

      if (result.getType() === 'WHILE') {
        this.logs.push(result);
        this.executeWhile(this.memory, result.getTrimmed());
        this.next();
        continue;
      } else if (result.getType() === 'ENDWHILE') {
        this.logs.push(result);
        if (currentWhile === undefined) throw new EaterException('No while related to this endwhile', result);

        const value = currentWhile.conditionValue(result, this.context, this.memory);
        if (value.toBoolean()) this.source.jumpToCodePosition(currentWhile.getStartWhile(), result);
        else this.memory.pollWhile();

        this.next();
        continue;
      }

      return result;
      // #lizard forgives -- faithful port of CodeIteratorWhile#peek's
      // skip-level-tracking / while-execute / endwhile-jump dispatch loop,
      // mirroring upstream verbatim.
    }
  }

  private executeWhile(memory: TMemory, s: StringLocated): void {
    const condition = new EaterWhile(s);
    condition.analyze(this.context, memory);
    const whileExpression = condition.getWhileExpression();
    const theWhile = ExecutionContextWhile.fromValue(whileExpression, this.source.getCodePosition());
    const value = theWhile.conditionValue(s, this.context, memory);
    if (!value.toBoolean()) theWhile.skipMe();

    memory.addWhile(theWhile);
  }
}
