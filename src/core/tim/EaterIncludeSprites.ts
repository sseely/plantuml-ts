/**
 * `!include_sprites <path>`.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/EaterIncludeSprites.java
 */

import { Eater } from './Eater.js';
import { StringLocated } from './StringLocated.js';
import type { TContext } from './TFunction.js';
import type { TMemory } from './TMemory.js';

/**
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/EaterIncludeSprites.java
 */
export class EaterIncludeSprites extends Eater {
  private what = '';

  constructor(s: StringLocated) {
    super(s);
  }

  /** @throws EaterException (thrown, not returned) on a malformed directive. */
  analyze(context: TContext, memory: TMemory): void {
    this.skipSpaces();
    this.checkAndEatChar('!include_sprites');
    this.skipSpaces();
    this.what = context.applyFunctionsAndVariables(
      memory,
      new StringLocated(this.eatAllToEnd(), this.getLineLocation()),
    ) ?? '';
  }

  getWhat(): string {
    return this.what;
  }
}
