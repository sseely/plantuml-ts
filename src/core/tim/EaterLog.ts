/**
 * `!log <text>` diagnostic directive.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/EaterLog.java
 */

import { Eater } from './Eater.js';
import { StringLocated } from './StringLocated.js';
import type { TContext } from './TFunction.js';
import type { TMemory } from './TMemory.js';

/**
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/EaterLog.java
 */
export class EaterLog extends Eater {
  constructor(s: StringLocated) {
    super(s);
  }

  /**
   * `!log` is a user-requested, directive-triggered diagnostic (like
   * `!dump_memory` -- see `TMemoryGlobal#dumpDebug`'s doc comment for the
   * established precedent), so it is ported faithfully via `console.info`
   * rather than dropped as incidental logging noise.
   * @throws EaterException (thrown, not returned) on a malformed directive.
   */
  analyze(context: TContext, memory: TMemory): void {
    this.skipSpaces();
    this.checkAndEatChar('!log');
    this.skipSpaces();
    const logData = context.applyFunctionsAndVariables(
      memory,
      new StringLocated(this.eatAllToEnd(), this.getLineLocation()),
    ) ?? '';
    console.info(`[Log] ${logData}`);
  }
}
