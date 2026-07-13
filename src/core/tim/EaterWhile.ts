/**
 * `!while <expr>`.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/EaterWhile.java
 */

import { Eater } from './Eater.js';
import type { StringLocated } from './StringLocated.js';
import type { TContext } from './TFunction.js';
import type { TMemory } from './TMemory.js';
import type { TokenStack } from './expression/TokenStack.js';

/**
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/EaterWhile.java
 */
export class EaterWhile extends Eater {
  private expression: TokenStack | undefined;

  constructor(s: StringLocated) {
    super(s);
  }

  /** @throws EaterException (thrown, not returned) on a malformed directive. */
  analyze(_context: TContext, _memory: TMemory): void {
    this.skipSpaces();
    this.checkAndEatChar('!while');
    this.skipSpaces();
    this.expression = this.eatTokenStack();
  }

  /** Non-null after `analyze` has run successfully. */
  getWhileExpression(): TokenStack {
    return this.expression as TokenStack;
  }
}
