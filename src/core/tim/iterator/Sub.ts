/**
 * A named `!startsub` / `!endsub` block: the lines captured between the two
 * markers, replayable later via `!includesub`. Ported here (rather than a
 * top-level `preproc/` package, out of scope) since `CodeIteratorSub` --
 * this batch's only consumer -- is its sole reason to exist; upstream's
 * `Sub#fromFile` (file-based construction) is NOT ported: it takes a
 * `ReadLine` reader and does blocking I/O, out of scope per this project's
 * browser-safe-`src/` constraint, and no in-scope call site needs it
 * (`CodeIteratorSub#peek` builds a `Sub` purely from already-in-memory
 * `StringLocated` lines it's iterating).
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/preproc/Sub.java
 */

import type { StringLocated } from '../StringLocated.js';

export class Sub {
  private readonly name: string;
  private readonly linesList: StringLocated[] = [];

  constructor(name: string) {
    this.name = name;
  }

  toString(): string {
    return `Sub ${this.name}`;
  }

  add(s: StringLocated): void {
    this.linesList.push(s);
  }

  lines(): readonly StringLocated[] {
    return this.linesList;
  }
}
