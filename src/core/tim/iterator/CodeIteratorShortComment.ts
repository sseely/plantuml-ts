/**
 * Consumes single-line `'` comments: a `COMMENT_SIMPLE` line is logged and
 * skipped without being emitted.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/iterator/CodeIteratorShortComment.java
 */

import type { StringLocated } from '../StringLocated.js';
import { AbstractCodeIterator } from './AbstractCodeIterator.js';
import type { CodeIterator } from './CodeIterator.js';

/**
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/iterator/CodeIteratorShortComment.java
 */
export class CodeIteratorShortComment extends AbstractCodeIterator {
  private readonly logs: StringLocated[];

  constructor(source: CodeIterator, logs: StringLocated[]) {
    super(source);
    this.logs = logs;
  }

  /** @throws EaterException (thrown, not returned) on a malformed directive. */
  peek(): StringLocated | null {
    while (true) {
      const result = this.source.peek();
      if (result === null) return null;

      if (result.getType() === 'COMMENT_SIMPLE') {
        this.logs.push(result);
        this.next();
        continue;
      }
      return result;
    }
  }
}
