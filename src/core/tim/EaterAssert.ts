/**
 * `!assert <expr>` (optionally `: <message>`).
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/EaterAssert.java
 */

import { Eater } from './Eater.js';
import type { StringLocated } from './StringLocated.js';
import { EaterException } from './EaterException.js';
import type { TContext } from './TFunction.js';
import type { TMemory } from './TMemory.js';

/**
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/EaterAssert.java
 */
export class EaterAssert extends Eater {
  constructor(s: StringLocated) {
    super(s);
  }

  /** @throws EaterException (thrown, not returned) on a malformed directive, or a failed assertion. */
  analyze(context: TContext, memory: TMemory): void {
    this.skipSpaces();
    this.checkAndEatChar('!assert');
    this.skipSpaces();
    const value = this.eatExpressionStopAtColon(context, memory);
    this.skipSpaces();
    if (!value.toBoolean()) {
      const ch = this.peekChar();
      if (ch === ':') {
        this.checkAndEatChar(':');
        const message = this.eatExpression(context, memory);
        throw new EaterException(`Assertion error : ${message.toString()}`, this.getStringLocated());
      }
      throw new EaterException('Assertion error', this.getStringLocated());
    }
  }
}
