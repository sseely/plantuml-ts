/**
 * Interprets `!$var = <expr>` (and `!local`/`!global`/`?=` variants):
 * delegates to `EaterAffectation`, with a multi-line-JSON-literal retry
 * loop -- `!$x = { ... }` spanning several source lines re-parses with each
 * additional line appended until it succeeds.
 *
 * Divergence, documented: upstream's retry loop uses
 * `net.sourceforge.plantuml.json.ParseException#getColumn()` to fail fast
 * when the parse error's column stops advancing between retries (a
 * malformed-single-line-JSON optimization). This port's `Eater#eatExpression`
 * uses native `JSON.parse` (see `Eater.ts`'s file header) for the same
 * `{`/`[`-literal branch; V8's `SyntaxError` carries no reliable position
 * for the DOMINANT real case here -- an incomplete multi-line JSON literal
 * -- which throws plain `"Unexpected end of JSON input"` with no position
 * at all (verified: `JSON.parse('{"a": 1,\n"b":')` on Node 25). A
 * column-based fast-fail is therefore not faithfully portable; this port
 * instead retries (appending each next line) until the JSON parses, the
 * source is exhausted (`source.peek() === null`), or the same `9999`-
 * iteration cap upstream uses as its own safety net is hit. Well-formed
 * multi-line JSON (the entire real corpus) parses identically either way;
 * genuinely malformed single-line JSON now fails at end-of-source/cap
 * instead of at the earliest possible line -- both are failures, just
 * diagnosed at a different point.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/iterator/CodeIteratorAffectation.java
 */

import type { StringLocated } from '../StringLocated.js';
import { EaterAffectation } from '../EaterAffectation.js';
import { EaterException } from '../EaterException.js';
import type { TMemory } from '../TMemory.js';
import type { TContext } from '../TFunction.js';
import { AbstractCodeIterator } from './AbstractCodeIterator.js';
import type { CodeIterator } from './CodeIterator.js';

const MAX_JSON_CONTINUATION_ATTEMPTS = 9999;

/**
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/iterator/CodeIteratorAffectation.java
 */
export class CodeIteratorAffectation extends AbstractCodeIterator {
  private readonly context: TContext;
  private readonly memory: TMemory;
  private readonly logs: StringLocated[];

  constructor(source: CodeIterator, context: TContext, memory: TMemory, logs: StringLocated[]) {
    super(source);
    this.context = context;
    this.memory = memory;
    this.logs = logs;
  }

  /** @throws EaterException (thrown, not returned) on a malformed directive. */
  peek(): StringLocated | null {
    while (true) {
      const result = this.source.peek();
      if (result === null) return null;

      if (result.getType() === 'AFFECTATION') {
        this.logs.push(result);
        this.doAffectation(result);
        this.next();
        continue;
      }
      return result;
    }
  }

  /** @throws EaterException (thrown, not returned) on malformed JSON, or a malformed directive. */
  private doAffectation(resultIn: StringLocated): void {
    let result = resultIn;
    for (let i = 0; i < MAX_JSON_CONTINUATION_ATTEMPTS; i++) {
      try {
        this.executeAffectation(this.context, this.memory, result);
        return;
      } catch (e) {
        if (!(e instanceof SyntaxError)) throw e;

        this.next();
        const forward = this.source.peek();
        if (forward === null) throw new EaterException('Error in JSON format', result);

        result = result.append(forward.getString());
      }
    }
  }

  private executeAffectation(context: TContext, memory: TMemory, s: StringLocated): void {
    new EaterAffectation(s).analyze(context, memory);
  }
}
