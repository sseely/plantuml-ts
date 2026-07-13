/**
 * `!procedure` / `!unquoted procedure` / `!final procedure` declaration
 * header line. Multi-line body collection (buffering lines until
 * `!endprocedure`) is `CodeIteratorProcedure`'s job.
 *
 * Batch SI5a-4 REPLACEMENT (debt payment): this file previously held
 * `parseDeclareProcedureHeader`, a single regex returning a plain header
 * record, written for the pre-TIM flat-line-loop `preprocessor.ts` (which had
 * no `Eater`, no `TFunctionImpl` and no expression evaluator, so it could not
 * evaluate a parameter's default-value expression at all). It is replaced by
 * the real upstream class: an `Eater` subclass producing a `TFunctionImpl` via
 * `Eater#eatDeclareProcedure`, which `FunctionsSet#executeDeclareProcedure`
 * requires. The old regex is deleted rather than kept alongside -- it has no
 * remaining callers.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/EaterDeclareProcedure.java
 */

import { Eater } from './Eater.js';
import type { StringLocated } from './StringLocated.js';
import type { TContext } from './TFunction.js';
import type { TFunctionImpl } from './TFunctionImpl.js';
import type { TMemory } from './TMemory.js';

/**
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/EaterDeclareProcedure.java
 */
export class EaterDeclareProcedure extends Eater {
  private function: TFunctionImpl | undefined;
  private readonly location: StringLocated;
  private finalFlag = false;

  constructor(s: StringLocated) {
    super(s.getTrimmed());
    this.location = s;
  }

  /** @throws EaterException (thrown, not returned) on a malformed directive. */
  analyze(context: TContext, memory: TMemory): void {
    this.skipSpaces();
    this.checkAndEatChar('!');
    let unquoted = false;
    while (this.peekUnquoted() || this.peekFinal()) {
      if (this.peekUnquoted()) {
        this.checkAndEatChar('unquoted');
        this.skipSpaces();
        unquoted = true;
      } else if (this.peekFinal()) {
        this.checkAndEatChar('final');
        this.skipSpaces();
        this.finalFlag = true;
      }
    }
    this.checkAndEatChar('procedure');
    this.skipSpaces();
    this.function = this.eatDeclareProcedure(context, memory, unquoted, this.location);
  }

  private peekUnquoted(): boolean {
    return this.peekChar() === 'u';
  }

  private peekFinal(): boolean {
    return this.peekChar() === 'f' && this.peekCharN2() === 'i';
  }

  /** Non-null after `analyze` has run successfully. */
  getFunction(): TFunctionImpl {
    return this.function as TFunctionImpl;
  }

  getFinalFlag(): boolean {
    return this.finalFlag;
  }
}
