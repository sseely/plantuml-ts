/**
 * A throwaway `Eater` used only to feed a bare string through the shared
 * `Eater` character-cursor primitives (`eatAndGetQuotedString`, etc.)
 * without a real source-line context. `analyze` is intentionally
 * unimplemented -- callers only use the inherited cursor methods.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/StringEater.java
 */

import { Eater } from './Eater.js';
import { StringLocated } from './StringLocated.js';
import type { TMemory } from './TMemory.js';
import type { TContext } from './TFunction.js';

export class StringEater extends Eater {
  constructor(s: string) {
    super(new StringLocated(s, undefined));
  }

  analyze(_context: TContext, _memory: TMemory): void {
    throw new Error('UnsupportedOperationException');
  }
}
