/**
 * Interprets single-line `!define` / opens multi-line `!definelong`
 * (delegating to `FunctionsSet#executeLegacyDefine[Long]`, which internally
 * runs the corresponding `Eater*` and registers the resulting function).
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/iterator/CodeIteratorLegacyDefine.java
 */

import type { StringLocated } from '../StringLocated.js';
import type { TMemory } from '../TMemory.js';
import type { TContext } from '../TFunction.js';
import { AbstractCodeIterator } from './AbstractCodeIterator.js';
import type { CodeIterator } from './CodeIterator.js';
import type { FunctionsSet } from '../FunctionsSet.js';

/**
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/iterator/CodeIteratorLegacyDefine.java
 */
export class CodeIteratorLegacyDefine extends AbstractCodeIterator {
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

      if (result.getType() === 'LEGACY_DEFINE') {
        this.logs.push(result);
        this.functionsSet.executeLegacyDefine(this.context, this.memory, result);
        this.next();
        continue;
      } else if (result.getType() === 'LEGACY_DEFINELONG') {
        this.logs.push(result);
        this.functionsSet.executeLegacyDefineLong(this.context, this.memory, result);
        this.next();
        continue;
      }

      return result;
    }
  }
}
