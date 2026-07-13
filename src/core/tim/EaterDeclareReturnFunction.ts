/**
 * `!function` / `!unquoted function` / `!final function` declaration
 * header line (optionally with the `return <expr>` single-line shorthand).
 * Multi-line body collection (buffering lines until `!endfunction`) is
 * `CodeIteratorReturnFunction`'s job.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/EaterDeclareReturnFunction.java
 */

import { Eater } from './Eater.js';
import type { StringLocated } from './StringLocated.js';
import type { TContext } from './TFunction.js';
import type { TFunctionImpl } from './TFunctionImpl.js';
import type { TMemory } from './TMemory.js';

/**
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/EaterDeclareReturnFunction.java
 */
export class EaterDeclareReturnFunction extends Eater {
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
    this.checkAndEatChar('function');
    this.skipSpaces();
    this.function = this.eatDeclareReturnFunctionWithOptionalReturn(context, memory, unquoted, this.location);
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
