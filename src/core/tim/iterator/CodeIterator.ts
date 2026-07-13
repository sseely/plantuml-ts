/**
 * Pull-based line iterator over TIM source. Every directive family
 * (`!if`, `!foreach`, `!while`, `!procedure`, `!function`, `!startsub`,
 * legacy `!define`, comments, ...) is a decorator implementing this
 * interface and wrapping a `source: CodeIterator` -- `peek()` transparently
 * consumes and interprets its own directive lines before delegating to the
 * wrapped source for anything else. `CodeIteratorImpl` is the base of every
 * chain: a flat list of pre-split `StringLocated` lines.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/iterator/CodeIterator.java
 */

import type { StringLocated } from '../StringLocated.js';
import type { CodePosition } from './CodePosition.js';

export interface CodeIterator {
  /** @throws EaterException (thrown, not returned) on a malformed directive. */
  peek(): StringLocated | null;

  /** @throws EaterException (thrown, not returned) on a malformed directive. */
  next(): void;

  getCodePosition(): CodePosition;

  /** @throws EaterException (thrown, not returned) on a malformed directive. */
  jumpToCodePosition(newPosition: CodePosition, location: StringLocated): void;
}
