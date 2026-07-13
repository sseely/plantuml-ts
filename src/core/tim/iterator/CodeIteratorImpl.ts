/**
 * Base of every `CodeIterator` chain: a flat, pre-split list of
 * `StringLocated` lines with a cursor. `jumpToCodePosition` is how
 * `!while`/`!foreach` re-run their body -- it carries its own infinite-loop
 * guard (999 jumps), the only such guard anywhere in the TIM interpreter
 * (see `preprocessor-procedure.ts`'s header for the sibling note about
 * `!procedure` recursion having no such guard).
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/iterator/CodeIteratorImpl.java
 */

import type { StringLocated } from '../StringLocated.js';
import { EaterException } from '../EaterException.js';
import type { CodeIterator } from './CodeIterator.js';
import type { CodePosition } from './CodePosition.js';

/**
 * `CodeIteratorImpl.Position` -- upstream's private static nested class.
 * TS has no nested-class privacy at this granularity, so this is a
 * module-private class instead; `jumpToCodePosition` below does the same
 * unchecked downcast upstream does (`(Position) newPosition`), which is
 * only ever safe because every `CodePosition` passed back in was minted by
 * THIS class's own `getCodePosition()`.
 */
class Position {
  readonly pos: number;

  constructor(pos: number) {
    this.pos = pos;
  }
}

/**
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/iterator/CodeIteratorImpl.java
 */
export class CodeIteratorImpl implements CodeIterator {
  private readonly list: readonly StringLocated[];
  private current = 0;
  private countJump = 0;

  constructor(list: readonly StringLocated[]) {
    this.list = list;
  }

  peek(): StringLocated | null {
    if (this.current === this.list.length) return null;

    if (this.current > this.list.length) throw new Error('IllegalStateException');

    return this.list[this.current]!;
  }

  next(): void {
    if (this.current >= this.list.length) throw new Error('IllegalStateException');

    this.current++;
  }

  getCodePosition(): CodePosition {
    return new Position(this.current);
  }

  /** @throws EaterException (thrown, not returned) after 999 jumps ("Infinite loop?"). */
  jumpToCodePosition(newPosition: CodePosition, location: StringLocated): void {
    this.countJump++;
    if (this.countJump > 999) throw new EaterException('Infinite loop?', location);

    const pos = newPosition as Position;
    this.current = pos.pos;
  }
}
