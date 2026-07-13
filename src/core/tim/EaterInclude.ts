/**
 * `!include` / `!include_once` / `!include_many` / `!includeurl <path>`.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/EaterInclude.java
 */

import { Eater } from './Eater.js';
import { StringLocated } from './StringLocated.js';
import type { TContext } from './TFunction.js';
import type { TMemory } from './TMemory.js';

/**
 * Minimal port of `net.sourceforge.plantuml.preproc2.PreprocessorIncludeStrategy`
 * -- a 3-value enum with no other members. Not part of `tim/` upstream
 * (lives in `preproc2/`, out of this mission's write-set); kept local here
 * since `EaterInclude` is its only caller in this batch's scope.
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/preproc2/PreprocessorIncludeStrategy.java
 */
export enum PreprocessorIncludeStrategy {
  ONCE = 'ONCE',
  MANY = 'MANY',
  DEFAULT = 'DEFAULT',
}

/**
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/EaterInclude.java
 */
export class EaterInclude extends Eater {
  private what = '';
  private strategy: PreprocessorIncludeStrategy = PreprocessorIncludeStrategy.DEFAULT;

  constructor(s: StringLocated) {
    super(s);
  }

  /** @throws EaterException (thrown, not returned) on a malformed directive. */
  analyze(context: TContext, memory: TMemory): void {
    this.skipSpaces();
    this.checkAndEatChar('!include');
    const peekChar = this.peekChar();
    if (peekChar === 'u') {
      this.checkAndEatChar('url');
    } else if (peekChar === '_') {
      this.checkAndEatChar('_');
      const peekChar2 = this.peekChar();
      if (peekChar2 === 'm') {
        this.checkAndEatChar('many');
        this.strategy = PreprocessorIncludeStrategy.MANY;
      } else {
        this.checkAndEatChar('once');
        this.strategy = PreprocessorIncludeStrategy.ONCE;
      }
    }
    this.skipSpaces();
    this.what = context.applyFunctionsAndVariables(
      memory,
      new StringLocated(this.eatAllToEnd(), this.getLineLocation()),
    );
  }

  getWhat(): string {
    return this.what;
  }

  getPreprocessorIncludeStrategy(): PreprocessorIncludeStrategy {
    return this.strategy;
  }
}
