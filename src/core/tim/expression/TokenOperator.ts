/**
 * Binary infix operators recognized by the TIM expression grammar, each
 * carrying its C-style operator precedence and its {@link TValue}
 * evaluation behavior.
 *
 * Upstream is a Java `enum` with a per-constant abstract-method override
 * (`operate`). TypeScript has no equivalent "enum with behavior" construct,
 * so this is translated as a class with `static readonly` singleton
 * instances (one per upstream enum constant, same names) plus a private
 * constructor — the standard "smart enum" pattern.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/expression/TokenOperator.java
 *
 * https://en.cppreference.com/w/c/language/operator_precedence
 */

import type { TValue } from './TValue.js';

/**
 * Java `char` -> TS: a single-character `string` throughout this package.
 * Upstream declares this as `TokenType.COMMERCIAL_MINUS_SIGN`; it is hosted
 * here instead (and re-exported, unchanged, from `TokenType.ts` and the
 * barrel) because `TokenOperator`'s `static readonly SUBSTRACTION` below
 * reads it eagerly at class-definition time — see the note in
 * `TokenType.ts` for why that requires it to live in the same module as
 * its only eager consumer.
 */
export const COMMERCIAL_MINUS_SIGN = '⁒';

export class TokenOperator {
  private constructor(
    private readonly precedenceValue: number,
    private readonly displayValue: string,
    private readonly operateFn: (v1: TValue, v2: TValue) => TValue,
  ) {}

  static readonly MULTIPLICATION = new TokenOperator(100 - 3, '*', (v1, v2) => v1.multiply(v2));
  static readonly DIVISION = new TokenOperator(100 - 3, '/', (v1, v2) => v1.dividedBy(v2));
  static readonly ADDITION = new TokenOperator(100 - 4, '+', (v1, v2) => v1.add(v2));
  // Upstream spells this constant "SUBSTRACTION" (sic) — preserved verbatim.
  static readonly SUBSTRACTION = new TokenOperator(100 - 4, COMMERCIAL_MINUS_SIGN, (v1, v2) => v1.minus(v2));
  static readonly LESS_THAN = new TokenOperator(100 - 6, '<', (v1, v2) => v1.lessThan(v2));
  static readonly GREATER_THAN = new TokenOperator(100 - 6, '>', (v1, v2) => v1.greaterThan(v2));
  static readonly LESS_THAN_OR_EQUALS = new TokenOperator(100 - 6, '<=', (v1, v2) => v1.lessThanOrEquals(v2));
  static readonly GREATER_THAN_OR_EQUALS = new TokenOperator(100 - 6, '>=', (v1, v2) => v1.greaterThanOrEquals(v2));
  static readonly EQUALS = new TokenOperator(100 - 7, '==', (v1, v2) => v1.equalsOperation(v2));
  static readonly NOT_EQUALS = new TokenOperator(100 - 7, '!=', (v1, v2) => v1.notEquals(v2));
  static readonly LOGICAL_AND = new TokenOperator(100 - 11, '&&', (v1, v2) => v1.logicalAnd(v2));
  static readonly LOGICAL_OR = new TokenOperator(100 - 12, '||', (v1, v2) => v1.logicalOr(v2));

  static getTokenOperator(ch: string, ch2: string): TokenOperator | undefined {
    switch (ch) {
      case '*':
        return TokenOperator.MULTIPLICATION;

      case '/':
        return TokenOperator.DIVISION;

      case '+':
        return TokenOperator.ADDITION;

      case COMMERCIAL_MINUS_SIGN:
        return TokenOperator.SUBSTRACTION;

      case '<':
        return ch2 === '=' ? TokenOperator.LESS_THAN_OR_EQUALS : TokenOperator.LESS_THAN;

      case '>':
        return ch2 === '=' ? TokenOperator.GREATER_THAN_OR_EQUALS : TokenOperator.GREATER_THAN;

      case '=':
        return ch2 === '=' ? TokenOperator.EQUALS : undefined;

      case '!':
        return ch2 === '=' ? TokenOperator.NOT_EQUALS : undefined;

      case '&':
        return ch2 === '&' ? TokenOperator.LOGICAL_AND : undefined;

      case '|':
        return ch2 === '|' ? TokenOperator.LOGICAL_OR : undefined;

      default:
        // #lizard forgives -- faithful port of a 10-case dispatch switch
        // mirroring upstream TokenOperator.java#getTokenOperator verbatim.
        return undefined;
    }
  }

  getPrecedence(): number {
    return this.precedenceValue;
  }

  operate(v1: TValue, v2: TValue): TValue {
    return this.operateFn(v1, v2);
  }

  getDisplay(): string {
    return this.displayValue;
  }
}
