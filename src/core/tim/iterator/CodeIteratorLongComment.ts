/**
 * Consumes a `/' ... '/`-fenced long comment block: once a
 * `COMMENT_LONG_START` line is seen, every following line (including the
 * closing `'/` line) is consumed and logged without being emitted, until a
 * trimmed line ending in `'/` is found.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/iterator/CodeIteratorLongComment.java
 */

import type { StringLocated } from '../StringLocated.js';
import { AbstractCodeIterator } from './AbstractCodeIterator.js';
import type { CodeIterator } from './CodeIterator.js';

/**
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/iterator/CodeIteratorLongComment.java
 */
export class CodeIteratorLongComment extends AbstractCodeIterator {
  private readonly logs: StringLocated[];

  constructor(source: CodeIterator, logs: StringLocated[]) {
    super(source);
    this.logs = logs;
  }

  /** @throws EaterException (thrown, not returned) on a malformed directive. */
  peek(): StringLocated | null {
    while (true) {
      const first = this.source.peek();
      if (first === null) return null;

      if (first.getType() !== 'COMMENT_LONG_START') return first;

      let s: StringLocated | null;
      while ((s = this.source.peek()) !== null && !s.getTrimmed().getString().endsWith("'/")) {
        this.logs.push(s);
        this.source.next();
      }
      if (this.source.peek() !== null) {
        this.logs.push(this.source.peek()!);
        this.source.next();
      }
    }
  }
}
