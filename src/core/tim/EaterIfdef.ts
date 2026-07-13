/**
 * `!ifdef <boolean expr over variable/function names>`.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/EaterIfdef.java
 */

import { Eater } from './Eater.js';
import type { StringLocated } from './StringLocated.js';
import type { TContext } from './TFunction.js';
import type { TMemory } from './TMemory.js';

/**
 * Minimal port of `net.sourceforge.plantuml.preproc.EvalBoolean` (a small,
 * self-contained recursive-descent `&&`/`||`/`!`/`()` boolean-expression
 * parser over bare identifiers) plus its `Truth` callback interface.
 * Neither belongs to `tim/` upstream (they live in `preproc/`, out of this
 * mission's write-set), but `EaterIfdef` is their only caller anywhere in
 * this batch's scope, so this port keeps them local here rather than
 * introducing an unrequested `preproc/` package for a ~60-line parser used
 * by exactly one file.
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/preproc/EvalBoolean.java
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/preproc/Truth.java
 */
class EvalBoolean {
  private readonly str: string;
  private pos = -1;
  private ch = '\0';
  private readonly truth: (name: string) => boolean;

  constructor(str: string, truth: (name: string) => boolean) {
    this.str = str;
    this.truth = truth;
  }

  private nextChar(): void {
    this.pos++;
    this.ch = this.pos < this.str.length ? this.str.charAt(this.pos) : '\0';
  }

  private eat(charToEat: string): boolean {
    while (this.ch === ' ') this.nextChar();
    if (this.ch === charToEat) {
      this.nextChar();
      return true;
    }
    return false;
  }

  private parseExpression(): boolean {
    let x = this.parseTerm();
    while (true) {
      if (this.eat('|')) {
        this.eat('|');
        // Upstream uses Java's non-short-circuiting bitwise `|` here
        // (`x = x | parseTerm()`), not logical `||` -- `parseTerm()` must
        // run (and consume its tokens) unconditionally, even when `x` is
        // already `true`. JS `||` short-circuits and would silently skip
        // parsing the right-hand side, leaving it unconsumed and tripping
        // `eval()`'s trailing-garbage check on well-formed input like
        // `a || b`. Splitting the call out of the `||` expression
        // preserves both the parse-always semantics and the boolean
        // result.
        const rhs = this.parseTerm();
        x = x || rhs;
      } else {
        return x;
      }
    }
  }

  private parseTerm(): boolean {
    let x = this.parseFactor();
    while (true) {
      if (this.eat('&')) {
        this.eat('&');
        // Same non-short-circuit rationale as `parseExpression`'s `|`
        // above, mirroring upstream's `x = x & parseFactor()`.
        const rhs = this.parseFactor();
        x = x && rhs;
      } else {
        return x;
      }
    }
  }

  private parseFactor(): boolean {
    if (this.eat('!')) return !this.parseFactor();

    let x: boolean;
    const startPos = this.pos;
    if (this.eat('(')) {
      x = this.parseExpression();
      this.eat(')');
    } else if (this.isIdentifier()) {
      while (this.isIdentifier()) this.nextChar();

      const func = this.str.slice(startPos, this.pos);
      x = this.truth(func);
    } else {
      throw new Error(`IllegalArgumentException: Unexpected: ${this.ch}`);
    }

    return x;
  }

  private isIdentifier(): boolean {
    return this.ch === '_' || this.ch === '$' || /[\p{L}\p{N}]/u.test(this.ch);
  }

  eval(): boolean {
    this.nextChar();
    const x = this.parseExpression();
    if (this.pos < this.str.length) throw new Error(`IllegalArgumentException: Unexpected: ${this.ch}`);

    return x;
  }
}

/**
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/EaterIfdef.java
 */
export class EaterIfdef extends Eater {
  private expression = '';

  constructor(s: StringLocated) {
    super(s);
  }

  /** @throws EaterException (thrown, not returned) on a malformed directive. */
  analyze(_context: TContext, _memory: TMemory): void {
    this.skipSpaces();
    this.checkAndEatChar('!ifdef');
    this.skipSpaces();
    this.expression = this.eatAllToEnd();
  }

  isTrue(context: TContext, memory: TMemory): boolean {
    const evaluator = new EvalBoolean(this.expression, (varname: string): boolean => {
      const currentValue = memory.getVariable(varname);
      return currentValue !== undefined || context.doesFunctionExist(varname);
    });

    return evaluator.eval();
  }
}
