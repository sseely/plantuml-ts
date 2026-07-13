/**
 * A lexical token produced by `TokenType.eatOneToken` and consumed by
 * `ShuntingYard` / `ReversePolishInterpretor`.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/expression/Token.java
 */

import { TokenType } from './TokenType.js';
import { TokenOperator } from './TokenOperator.js';

/**
 * Minimal structural stand-in for `net.sourceforge.plantuml.json.JsonValue`.
 * That package (`net.sourceforge.plantuml.json`) — a full boxed JSON AST
 * library with its own parser/writer — is out of scope for this port; it is
 * not part of `tim/expression/`. Represented here as the plain JS values a
 * parsed JSON document already reduces to. `null` is a legitimate member
 * (the JSON `null` literal) and is distinct from the `undefined`
 * "this optional field is absent" sentinel used elsewhere in this package
 * (e.g. `TValue`'s internal `jsonValue` field).
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/json/JsonValue.java
 */
export type JsonValue = string | number | boolean | null | JsonValue[] | { readonly [key: string]: JsonValue };

export class Token {
  private readonly surface: string;
  private readonly json: JsonValue | undefined;
  private readonly tokenType: TokenType;

  /**
   * Upstream overloads `Token(char, TokenType, JsonValue)` and
   * `Token(String, TokenType, JsonValue)`, the `char` overload delegating
   * to the `String` one (`this("" + surface, tokenType, json)`).
   * TypeScript has no `char` type, so both collapse into this single
   * `string` constructor — a translation-table consequence (char -> string
   * unification), not a behavior change.
   */
  constructor(surface: string, tokenType: TokenType, json: JsonValue | undefined) {
    this.surface = surface;
    this.tokenType = tokenType;
    this.json = json;
  }

  toString(): string {
    return `${this.tokenType}{${this.surface}}`;
  }

  getTokenOperator(): TokenOperator | undefined {
    if (this.tokenType !== TokenType.OPERATOR) throw new Error(`Token is not an OPERATOR: ${this.tokenType}`);

    const ch2 = this.surface.length > 1 ? this.surface.charAt(1) : '';
    return TokenOperator.getTokenOperator(this.surface.charAt(0), ch2);
  }

  getSurface(): string {
    return this.surface;
  }

  getTokenType(): TokenType {
    return this.tokenType;
  }

  muteToFunction(): Token {
    if (this.tokenType !== TokenType.PLAIN_TEXT) throw new Error(`Token is not PLAIN_TEXT: ${this.tokenType}`);

    return new Token(this.surface, TokenType.FUNCTION_NAME, undefined);
  }

  getJson(): JsonValue {
    if (this.tokenType !== TokenType.JSON_DATA) throw new Error(`Token is not JSON_DATA: ${this.tokenType}`);

    // Invariant: a JSON_DATA token is always constructed with a defined
    // `json` payload (see TValue#toToken and ReversePolishInterpretor).
    return this.json as JsonValue;
  }

  getPrecedence(): number {
    if (this.tokenType === TokenType.AFFECTATION) return TokenOperator.EQUALS.getPrecedence();
    // Upstream does not null-check here either: an OPERATOR token whose
    // surface doesn't resolve to a known TokenOperator NPEs in Java: this
    // non-null assertion preserves that same unchecked-crash behavior.
    return this.getTokenOperator()!.getPrecedence();
  }

  getLeftAssociativity(): boolean {
    return true;
  }
}
