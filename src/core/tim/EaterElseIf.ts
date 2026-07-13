/**
 * `!elseif <expr>`.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/EaterElseIf.java
 */

import { Eater } from './Eater.js';
import type { StringLocated } from './StringLocated.js';
import type { TContext } from './TFunction.js';
import type { TMemory } from './TMemory.js';

/**
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/EaterElseIf.java
 */
export class EaterElseIf extends Eater {
  private booleanValue = false;

  constructor(s: StringLocated) {
    super(s);
  }

  /** @throws EaterException (thrown, not returned) on a malformed directive. */
  analyze(context: TContext, memory: TMemory): void {
    this.skipSpaces();
    this.checkAndEatChar('!elseif');
    this.skipSpaces();
    const value = this.eatExpression(context, memory);
    this.booleanValue = value.toBoolean();
  }

  isTrue(): boolean {
    return this.booleanValue;
  }
}
