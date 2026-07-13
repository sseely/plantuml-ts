/**
 * The typed value that flows through the TIM expression evaluator: a
 * mutually-exclusive union of int / string / JSON, mirroring upstream's
 * three-field-but-only-one-set representation.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/expression/TValue.java
 */

import { Token, type JsonValue } from './Token.js';
import { TokenType } from './TokenType.js';

function jsonValueToDisplayString(v: JsonValue): string {
  return JSON.stringify(v);
}

export class TValue {
  private readonly intValue: number;
  // `undefined` here means "this TValue does not carry a string" — distinct
  // from a legitimate empty string `''`, and distinct from `JsonValue`'s own
  // `null` (the JSON null literal). Prefers `undefined` per this port's
  // null/undefined convention (Java `null` fields -> TS `undefined`).
  private readonly stringValue: string | undefined;
  private readonly jsonValue: JsonValue | undefined;

  /**
   * Upstream has three overloaded constructors — `TValue(int)` and
   * `TValue(String)` (both private, used only internally) and
   * `TValue(JsonValue)` (public, but in practice only ever called via the
   * `fromJson` factory — no other file in the Java codebase calls
   * `new TValue(...)` directly). TypeScript has no constructor overloading,
   * so all construction is consolidated behind this single private
   * constructor plus the `from*` static factories below, matching how
   * upstream is actually used.
   */
  private constructor(intValue: number, stringValue: string | undefined, jsonValue: JsonValue | undefined) {
    this.intValue = intValue;
    this.stringValue = stringValue;
    this.jsonValue = jsonValue;
  }

  static fromInt(v: number): TValue {
    return new TValue(v, undefined, undefined);
  }

  static fromBoolean(b: boolean): TValue {
    return new TValue(b ? 1 : 0, undefined, undefined);
  }

  static fromJson(json: JsonValue): TValue {
    return new TValue(0, undefined, json);
  }

  toString(): string {
    if (this.jsonValue !== undefined && typeof this.jsonValue === 'string') return this.jsonValue;
    if (this.jsonValue !== undefined) return jsonValueToDisplayString(this.jsonValue);
    if (this.stringValue === undefined) return String(this.intValue);
    return this.stringValue;
  }

  static fromString(token: Token): TValue;
  static fromString(s: string): TValue;
  static fromString(tokenOrString: Token | string): TValue {
    if (tokenOrString instanceof Token) {
      if (tokenOrString.getTokenType() !== TokenType.QUOTED_STRING)
        throw new Error('Illegal argument: token is not QUOTED_STRING');
      return new TValue(0, tokenOrString.getSurface(), undefined);
    }
    return new TValue(0, tokenOrString, undefined);
  }

  static fromNumber(token: Token): TValue {
    if (token.getTokenType() !== TokenType.NUMBER) throw new Error('Illegal argument: token is not NUMBER');

    const surface = token.getSurface();
    // Integer.parseInt requires the ENTIRE string to be a valid integer (an
    // optional leading '-' then one or more ASCII digits) or throws
    // NumberFormatException. Number.parseInt is lenient — it parses a
    // leading numeric prefix and silently ignores trailing garbage (e.g.
    // Number.parseInt("12x", 10) === 12, not NaN) — so a bare NaN check is
    // not sufficient to preserve Java's throw-on-malformed-input behavior;
    // validate the full surface first.
    if (!/^-?\d+$/.test(surface)) throw new Error(`For input string: "${surface}"`);
    return new TValue(Number.parseInt(surface, 10), undefined, undefined);
  }

  add(v2: TValue): TValue {
    if (this.isNumber() && v2.isNumber()) return new TValue(this.intValue + v2.intValue, undefined, undefined);
    return new TValue(0, this.toString() + v2.toString(), undefined);
  }

  minus(v2: TValue): TValue {
    if (this.isNumber() && v2.isNumber()) return new TValue(this.intValue - v2.intValue, undefined, undefined);
    return new TValue(0, this.toString() + v2.toString(), undefined);
  }

  multiply(v2: TValue): TValue {
    if (this.isNumber() && v2.isNumber()) return new TValue(this.intValue * v2.intValue, undefined, undefined);
    return new TValue(0, `${this.toString()}*${v2.toString()}`, undefined);
  }

  dividedBy(v2: TValue): TValue {
    if (this.isNumber() && v2.isNumber()) {
      // int/0 throws ArithmeticException in Java; Math.trunc(x/0) would
      // silently yield Infinity/NaN in JS instead — preserve the throw.
      if (v2.intValue === 0) throw new Error('/ by zero');
      return new TValue(Math.trunc(this.intValue / v2.intValue), undefined, undefined);
    }
    return new TValue(0, `${this.toString()}/${v2.toString()}`, undefined);
  }

  isNumber(): boolean {
    return this.jsonValue === undefined && this.stringValue === undefined;
  }

  isJson(): boolean {
    return this.jsonValue !== undefined;
  }

  isString(): boolean {
    return this.stringValue !== undefined;
  }

  toToken(): Token {
    if (this.isNumber()) return new Token(this.toString(), TokenType.NUMBER, undefined);
    if (this.isJson()) return new Token(this.toString(), TokenType.JSON_DATA, this.jsonValue);
    return new Token(this.toString(), TokenType.QUOTED_STRING, undefined);
  }

  greaterThanOrEquals(v2: TValue): TValue {
    if (this.isNumber() && v2.isNumber()) return TValue.fromBoolean(this.intValue >= v2.intValue);
    return TValue.fromBoolean(this.toString() >= v2.toString());
  }

  greaterThan(v2: TValue): TValue {
    if (this.isNumber() && v2.isNumber()) return TValue.fromBoolean(this.intValue > v2.intValue);
    return TValue.fromBoolean(this.toString() > v2.toString());
  }

  lessThanOrEquals(v2: TValue): TValue {
    if (this.isNumber() && v2.isNumber()) return TValue.fromBoolean(this.intValue <= v2.intValue);
    return TValue.fromBoolean(this.toString() <= v2.toString());
  }

  lessThan(v2: TValue): TValue {
    if (this.isNumber() && v2.isNumber()) return TValue.fromBoolean(this.intValue < v2.intValue);
    return TValue.fromBoolean(this.toString() < v2.toString());
  }

  equalsOperation(v2: TValue): TValue {
    if (this.isNumber() && v2.isNumber()) return TValue.fromBoolean(this.intValue === v2.intValue);
    return TValue.fromBoolean(this.toString() === v2.toString());
  }

  notEquals(v2: TValue): TValue {
    if (this.isNumber() && v2.isNumber()) return TValue.fromBoolean(this.intValue !== v2.intValue);
    return TValue.fromBoolean(this.toString() !== v2.toString());
  }

  toBoolean(): boolean {
    if (this.isNumber()) return this.intValue !== 0;
    return this.toString().length > 0;
  }

  toInt(): number {
    return this.intValue;
  }

  logicalAnd(v2: TValue): TValue {
    return TValue.fromBoolean(this.toBoolean() && v2.toBoolean());
  }

  logicalOr(v2: TValue): TValue {
    return TValue.fromBoolean(this.toBoolean() || v2.toBoolean());
  }

  toJson(): JsonValue | undefined {
    return this.jsonValue;
  }

  toJsonValue(): JsonValue {
    if (this.isNumber()) return this.intValue;
    if (this.isString()) return this.stringValue as string;
    return this.jsonValue as JsonValue;
  }
}
