/**
 * Interprets `!startsub <name>` / `!endsub`: captures every line between the
 * two markers into a named `Sub` (for later `!includesub` replay,
 * elsewhere) and then, instead of resuming the outer source, replays the
 * captured lines immediately in place (upstream's own behavior -- a
 * `!startsub` block's lines are BOTH captured for later reuse AND emitted
 * once, in place, right where they were declared).
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/iterator/CodeIteratorSub.java
 */

import type { StringLocated } from '../StringLocated.js';
import { EaterException } from '../EaterException.js';
import { EaterStartsub } from '../EaterStartsub.js';
import type { TMemory } from '../TMemory.js';
import type { TContext } from '../TFunction.js';
import { AbstractCodeIterator } from './AbstractCodeIterator.js';
import { CodeIteratorImpl } from './CodeIteratorImpl.js';
import type { CodeIterator } from './CodeIterator.js';
import { Sub } from './Sub.js';

/**
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/iterator/CodeIteratorSub.java
 */
export class CodeIteratorSub extends AbstractCodeIterator {
  private readonly subs: Map<string, Sub>;
  private readingInProgress: CodeIterator | undefined;
  private readonly memory: TMemory;
  private readonly context: TContext;

  constructor(source: CodeIterator, subs: Map<string, Sub>, context: TContext, memory: TMemory) {
    super(source);
    this.context = context;
    this.memory = memory;
    this.subs = subs;
  }

  getSubs(): ReadonlyMap<string, Sub> {
    return this.subs;
  }

  /** @throws EaterException (thrown, not returned) on a malformed directive, or nested `!startsub`. */
  peek(): StringLocated | null {
    if (this.readingInProgress !== undefined) return this.readingInProgress.peek();

    const result = this.source.peek();
    if (result === null) return null;

    if (result.getType() === 'STARTSUB') {
      const eater = new EaterStartsub(result.getTrimmed());
      eater.analyze(this.context, this.memory);
      const created = new Sub(eater.getSubname());
      this.subs.set(eater.getSubname(), created);
      this.source.next();
      let s: StringLocated | null;
      while ((s = this.source.peek()) !== null) {
        if (s.getType() === 'STARTSUB') {
          throw new EaterException('Cannot nest sub', result);
        } else if (s.getType() === 'ENDSUB') {
          this.source.next();
          this.readingInProgress = new CodeIteratorImpl(created.lines());
          break;
        } else {
          created.add(s);
          this.source.next();
        }
      }
    }
    if (this.readingInProgress !== undefined) return this.readingInProgress.peek();

    return result;
  }

  /** @throws EaterException (thrown, not returned) on a malformed directive. */
  override next(): void {
    if (this.readingInProgress === undefined) {
      this.source.next();
      return;
    }
    this.readingInProgress.next();
    if (this.readingInProgress.peek() === null) this.readingInProgress = undefined;
  }
}
