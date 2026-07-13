/**
 * A named `!startsub` / `!endsub` block: the lines captured between the two
 * markers, replayable later via `!includesub`. Ported here (rather than a
 * top-level `preproc/` package, out of scope) since `CodeIteratorSub` --
 * its first consumer -- is its main reason to exist.
 *
 * Batch SI5a-5 addendum: {@link Sub.fromLines} ports upstream's `Sub#fromFile`,
 * which `TContext#executeIncludesub` needs for the `!includesub file!blocname`
 * form (pull one named sub OUT of another file). Upstream takes a `ReadLine`
 * and does blocking I/O; this port takes the already-in-memory lines the
 * `IncludeStore` handed back -- the async fetch happened before the interpreter
 * ran (see `../IncludeStore.ts`). The body is otherwise upstream's, statement
 * for statement.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/preproc/Sub.java
 */

import type { StringLocated } from '../StringLocated.js';
import { EaterStartsub } from '../EaterStartsub.js';
import type { TContext } from '../TFunction.js';
import type { TMemory } from '../TMemory.js';

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

  /**
   * Java `null` -> `undefined`.
   * @throws EaterException (thrown, not returned) on a malformed `!startsub`.
   * @see ~/git/plantuml/.../preproc/Sub.java#fromFile
   */
  static fromLines(
    lines: readonly StringLocated[],
    blocname: string,
    context: TContext,
    memory: TMemory,
  ): Sub | undefined {
    let result: Sub | undefined;
    let skip = false;
    for (const s of lines) {
      const type = s.getTrimmed().getType();
      if (type === 'STARTSUB') {
        const eater = new EaterStartsub(s.getTrimmed());
        eater.analyze(context, memory);
        if (eater.getSubname() === blocname) {
          skip = false;
          result ??= new Sub(blocname);
        }
        continue;
      }
      if (type === 'ENDSUB' && result !== undefined) skip = true;

      if (result !== undefined && !skip) result.add(s);
    }
    return result;
  }
}
