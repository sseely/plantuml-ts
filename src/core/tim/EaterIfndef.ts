/**
 * `!ifndef <varname>`.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/EaterIfndef.java
 */

import { Eater } from './Eater.js';
import type { StringLocated } from './StringLocated.js';
import type { TContext } from './TFunction.js';
import type { TMemory } from './TMemory.js';

/**
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/EaterIfndef.java
 */
export class EaterIfndef extends Eater {
  private varname = '';

  constructor(s: StringLocated) {
    super(s);
  }

  /** @throws EaterException (thrown, not returned) on a malformed directive. */
  analyze(_context: TContext, _memory: TMemory): void {
    this.skipSpaces();
    this.checkAndEatChar('!ifndef');
    this.skipSpaces();
    this.varname = this.eatAndGetVarname();
  }

  isTrue(context: TContext, memory: TMemory): boolean {
    const currentValue = memory.getVariable(this.varname);
    return currentValue === undefined && !context.doesFunctionExist(this.varname);
  }
}
