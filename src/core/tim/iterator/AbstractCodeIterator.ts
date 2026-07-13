/**
 * Base for every directive-decorator `CodeIterator`: forwards `next()`,
 * `getCodePosition()`, and `jumpToCodePosition()` straight through to the
 * wrapped `source`, leaving only `peek()` for subclasses to override.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/iterator/AbstractCodeIterator.java
 */

import type { StringLocated } from '../StringLocated.js';
import type { CodeIterator } from './CodeIterator.js';
import type { CodePosition } from './CodePosition.js';

export abstract class AbstractCodeIterator implements CodeIterator {
  protected readonly source: CodeIterator;

  constructor(source: CodeIterator) {
    this.source = source;
  }

  abstract peek(): StringLocated | null;

  /** @throws EaterException (thrown, not returned) on a malformed directive. */
  next(): void {
    this.source.next();
  }

  getCodePosition(): CodePosition {
    return this.source.getCodePosition();
  }

  /** @throws EaterException (thrown, not returned) on a malformed directive. */
  jumpToCodePosition(newPosition: CodePosition, location: StringLocated): void {
    this.source.jumpToCodePosition(newPosition, location);
  }
}
