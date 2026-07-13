/**
 * `!dump_memory` diagnostic directive.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/EaterDumpMemory.java
 */

import { Eater } from './Eater.js';
import type { StringLocated } from './StringLocated.js';
import type { TContext } from './TFunction.js';
import type { TMemory } from './TMemory.js';

/**
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/EaterDumpMemory.java
 */
export class EaterDumpMemory extends Eater {
  constructor(s: StringLocated) {
    super(s);
  }

  /** @throws EaterException (thrown, not returned) on a malformed directive. */
  analyze(_context: TContext, memory: TMemory): void {
    this.skipSpaces();
    this.checkAndEatChar('!dump_memory');
    this.skipSpaces();
    const remain = this.eatAllToEnd();
    memory.dumpDebug(remain);
  }
}
