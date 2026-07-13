/**
 * Interprets `!foreach $var in <expr>` / `!endforeach`: on `!foreach`,
 * evaluates the collection once and stashes an `ExecutionContextForeach`;
 * on `!endforeach`, advances the loop counter and either jumps back to the
 * top (rebinding `$var` to the next element) or falls through. Nested
 * `!foreach` loops inside a currently-skipped one are tracked via `level`
 * so the matching `!endforeach` is recognized without prematurely popping
 * an outer, still-live loop.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/iterator/CodeIteratorForeach.java
 */

import { TValue } from '../expression/TValue.js';
import type { StringLocated } from '../StringLocated.js';
import { EaterException } from '../EaterException.js';
import { EaterForeach } from '../EaterForeach.js';
import { ExecutionContextForeach } from '../TMemory.js';
import type { TMemory } from '../TMemory.js';
import type { TContext } from '../TFunction.js';
import { TVariableScope } from '../TVariableScope.js';
import { AbstractCodeIterator } from './AbstractCodeIterator.js';
import type { CodeIterator } from './CodeIterator.js';

/**
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/iterator/CodeIteratorForeach.java
 */
export class CodeIteratorForeach extends AbstractCodeIterator {
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

      const foreach = this.memory.peekForeach();
      if (foreach !== undefined && foreach.isSkipMe()) {
        if (result.getType() === 'FOREACH') {
          level++;
        } else if (result.getType() === 'ENDFOREACH') {
          level--;
          if (level === -1) {
            this.memory.pollForeach();
            level = 0;
          }
        }
        this.next();
        continue;
      }

      if (result.getType() === 'FOREACH') {
        this.logs.push(result);
        this.executeForeach(this.memory, result.getTrimmed());
        this.next();
        continue;
      } else if (result.getType() === 'ENDFOREACH') {
        this.logs.push(result);
        if (foreach === undefined) throw new EaterException('No foreach related to this endforeach', result);

        foreach.inc();
        if (foreach.isSkipMe()) {
          this.memory.pollForeach();
        } else {
          this.setLoopVariable(this.memory, foreach, result);
          this.source.jumpToCodePosition(foreach.getStartForeach(), result);
        }
        this.next();
        continue;
      }

      return result;
      // #lizard forgives -- faithful port of CodeIteratorForeach#peek's
      // skip-level-tracking / foreach-execute / endforeach-jump dispatch loop,
      // mirroring upstream verbatim.
    }
  }

  private executeForeach(memory: TMemory, s: StringLocated): void {
    const condition = new EaterForeach(s);
    condition.analyze(this.context, memory);
    const foreach = ExecutionContextForeach.fromValue(
      condition.getVarname(),
      condition.getJsonValue(),
      this.source.getCodePosition(),
    );
    if (condition.isSkip()) foreach.skipMeNow();
    else this.setLoopVariable(memory, foreach, s);

    memory.addForeach(foreach);
  }

  private setLoopVariable(memory: TMemory, foreach: ExecutionContextForeach, position: StringLocated): void {
    const first = foreach.currentValue();
    memory.putVariable(foreach.getVarname(), TValue.fromJson(first), TVariableScope.GLOBAL, position);
  }
}
