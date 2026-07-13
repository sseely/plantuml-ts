/**
 * `!includedef <path>`.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/EaterIncludeDef.java
 */

import { Eater } from './Eater.js';
import { StringLocated } from './StringLocated.js';
import type { TContext } from './TFunction.js';
import type { TMemory } from './TMemory.js';

/**
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/EaterIncludeDef.java
 */
export class EaterIncludeDef extends Eater {
  private location = '';

  constructor(s: StringLocated) {
    super(s);
  }

  /** @throws EaterException (thrown, not returned) on a malformed directive. */
  analyze(context: TContext, memory: TMemory): void {
    this.skipSpaces();
    this.checkAndEatChar('!includedef');
    this.skipSpaces();
    this.location = context.applyFunctionsAndVariables(
      memory,
      new StringLocated(this.eatAllToEnd(), this.getLineLocation()),
    );
  }

  getLocation(): string {
    return this.location;
  }
}
