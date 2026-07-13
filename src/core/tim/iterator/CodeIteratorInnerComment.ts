/**
 * Strips `/' ... '/` inline comments from every line before the rest of the
 * chain sees it -- unlike the other decorators, this one never consumes a
 * whole line (never calls `next()` on its own); it only transforms what
 * `peek()` returns.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/iterator/CodeIteratorInnerComment.java
 */

import type { StringLocated } from '../StringLocated.js';
import { AbstractCodeIterator } from './AbstractCodeIterator.js';
import type { CodeIterator } from './CodeIterator.js';

/**
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/iterator/CodeIteratorInnerComment.java
 */
export class CodeIteratorInnerComment extends AbstractCodeIterator {
  constructor(source: CodeIterator) {
    super(source);
  }

  /** @throws EaterException (thrown, not returned) on a malformed directive. */
  peek(): StringLocated | null {
    const result = this.source.peek();
    if (result === null) return null;

    return result.removeInnerComment();
  }
}
