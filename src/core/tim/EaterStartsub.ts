/**
 * `!startsub <name>`.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/EaterStartsub.java
 */

import { Eater } from './Eater.js';
import type { StringLocated } from './StringLocated.js';
import { EaterException } from './EaterException.js';
import type { TContext } from './TFunction.js';
import type { TMemory } from './TMemory.js';

const WORD_ONLY = /^\w+$/u;

/**
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/EaterStartsub.java
 */
export class EaterStartsub extends Eater {
  private subname = '';

  constructor(s: StringLocated) {
    super(s);
  }

  /** @throws EaterException (thrown, not returned) on a malformed directive, or a bad sub name. */
  analyze(_context: TContext, _memory: TMemory): void {
    this.skipSpaces();
    this.checkAndEatChar('!startsub');
    this.skipSpaces();
    this.subname = this.eatAllToEnd();
    if (!WORD_ONLY.test(this.subname)) throw new EaterException('Bad sub name', this.getStringLocated());
  }

  getSubname(): string {
    return this.subname;
  }
}
