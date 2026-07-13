/**
 * `!return <expr>`.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/EaterReturn.java
 */

import { Eater } from './Eater.js';
import type { StringLocated } from './StringLocated.js';
import type { TContext } from './TFunction.js';
import type { TMemory } from './TMemory.js';
import type { TValue } from './expression/TValue.js';

/**
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/EaterReturn.java
 */
export class EaterReturn extends Eater {
  private value: TValue | undefined;

  constructor(s: StringLocated) {
    super(s);
  }

  /** @throws EaterException (thrown, not returned) on a malformed directive. */
  analyze(context: TContext, memory: TMemory): void {
    this.skipSpaces();
    this.checkAndEatChar('!return');
    this.skipSpaces();
    this.value = this.eatExpression(context, memory);
  }

  /** Non-null after `analyze` has run successfully. Upstream's odd `getValue2`
   * name (not `getValue`) is preserved verbatim -- no rename for idiom. */
  getValue2(): TValue {
    return this.value as TValue;
  }
}
