/**
 * `!undef <varname>`.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/EaterUndef.java
 */

import { Eater } from './Eater.js';
import type { StringLocated } from './StringLocated.js';
import type { TContext } from './TFunction.js';
import type { TMemory } from './TMemory.js';

/**
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/EaterUndef.java
 */
export class EaterUndef extends Eater {
  constructor(s: StringLocated) {
    super(s.getTrimmed());
  }

  /** @throws EaterException (thrown, not returned) on a malformed directive. */
  analyze(_context: TContext, memory: TMemory): void {
    this.skipSpaces();
    this.checkAndEatChar('!undef');
    this.skipSpaces();
    const varname = this.eatAndGetVarname();
    memory.removeVariable(varname);
  }
}
