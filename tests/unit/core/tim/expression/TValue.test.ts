import { describe, expect, it } from 'vitest';
import { Token, TValue, TokenType } from '../../../../../src/core/tim/expression/index.js';

describe('TValue factories', () => {
  it('fromInt / toInt round-trips', () => {
    expect(TValue.fromInt(42).toInt()).toBe(42);
  });

  it('fromBoolean maps true/false to 1/0', () => {
    expect(TValue.fromBoolean(true).toInt()).toBe(1);
    expect(TValue.fromBoolean(false).toInt()).toBe(0);
  });

  it('fromString(string) is a string TValue', () => {
    const v = TValue.fromString('hello');
    expect(v.isString()).toBe(true);
    expect(v.toString()).toBe('hello');
  });

  it('fromString(Token) requires a QUOTED_STRING token', () => {
    const token = new Token('hello', TokenType.QUOTED_STRING, undefined);
    expect(TValue.fromString(token).toString()).toBe('hello');
  });

  it('fromString(Token) throws for a non-QUOTED_STRING token', () => {
    const token = new Token('42', TokenType.NUMBER, undefined);
    expect(() => TValue.fromString(token)).toThrow('Illegal argument: token is not QUOTED_STRING');
  });

  it('fromNumber(Token) parses a NUMBER token, including negatives', () => {
    expect(TValue.fromNumber(new Token('42', TokenType.NUMBER, undefined)).toInt()).toBe(42);
    expect(TValue.fromNumber(new Token('-7', TokenType.NUMBER, undefined)).toInt()).toBe(-7);
  });

  it('fromNumber(Token) throws for a non-NUMBER token', () => {
    const token = new Token('hi', TokenType.QUOTED_STRING, undefined);
    expect(() => TValue.fromNumber(token)).toThrow('Illegal argument: token is not NUMBER');
  });

  it('fromNumber(Token) throws for malformed numeric surface', () => {
    const token = new Token('12x', TokenType.NUMBER, undefined);
    expect(() => TValue.fromNumber(token)).toThrow('For input string: "12x"');
  });

  it('fromJson wraps a JSON value', () => {
    const v = TValue.fromJson({ a: 1 });
    expect(v.isJson()).toBe(true);
    expect(v.toJson()).toEqual({ a: 1 });
  });
});

describe('TValue.isNumber / isString / isJson are mutually exclusive', () => {
  it('a number TValue', () => {
    const v = TValue.fromInt(1);
    expect(v.isNumber()).toBe(true);
    expect(v.isString()).toBe(false);
    expect(v.isJson()).toBe(false);
  });

  it('a string TValue, including the empty string', () => {
    const v = TValue.fromString('');
    expect(v.isNumber()).toBe(false);
    expect(v.isString()).toBe(true);
    expect(v.isJson()).toBe(false);
  });

  it('a JSON TValue carrying the JSON null literal', () => {
    const v = TValue.fromJson(null);
    expect(v.isNumber()).toBe(false);
    expect(v.isString()).toBe(false);
    expect(v.isJson()).toBe(true);
  });
});

describe('TValue arithmetic: number/number stays numeric', () => {
  it('add', () => {
    expect(TValue.fromInt(3).add(TValue.fromInt(4)).toInt()).toBe(7);
  });

  it('minus', () => {
    expect(TValue.fromInt(3).minus(TValue.fromInt(4)).toInt()).toBe(-1);
  });

  it('multiply', () => {
    expect(TValue.fromInt(3).multiply(TValue.fromInt(4)).toInt()).toBe(12);
  });

  it('dividedBy truncates toward zero', () => {
    expect(TValue.fromInt(7).dividedBy(TValue.fromInt(2)).toInt()).toBe(3);
    expect(TValue.fromInt(-7).dividedBy(TValue.fromInt(2)).toInt()).toBe(-3);
  });

  it('dividedBy by zero throws', () => {
    expect(() => TValue.fromInt(1).dividedBy(TValue.fromInt(0))).toThrow('/ by zero');
  });
});

describe('TValue arithmetic: any non-number operand falls back to string concatenation', () => {
  it('add concatenates', () => {
    expect(TValue.fromInt(3).add(TValue.fromString('x')).toString()).toBe('3x');
  });

  it('minus concatenates (no numeric subtraction across types)', () => {
    expect(TValue.fromString('a').minus(TValue.fromString('b')).toString()).toBe('ab');
  });

  it('multiply concatenates with a "*" separator', () => {
    expect(TValue.fromString('a').multiply(TValue.fromString('b')).toString()).toBe('a*b');
  });

  it('dividedBy concatenates with a "/" separator', () => {
    expect(TValue.fromString('a').dividedBy(TValue.fromString('b')).toString()).toBe('a/b');
  });
});

describe('TValue comparisons', () => {
  it('numeric comparisons compare intValue', () => {
    expect(TValue.fromInt(1).lessThan(TValue.fromInt(2)).toBoolean()).toBe(true);
    expect(TValue.fromInt(2).lessThanOrEquals(TValue.fromInt(2)).toBoolean()).toBe(true);
    expect(TValue.fromInt(3).greaterThan(TValue.fromInt(2)).toBoolean()).toBe(true);
    expect(TValue.fromInt(2).greaterThanOrEquals(TValue.fromInt(2)).toBoolean()).toBe(true);
    expect(TValue.fromInt(2).equalsOperation(TValue.fromInt(2)).toBoolean()).toBe(true);
    expect(TValue.fromInt(2).notEquals(TValue.fromInt(3)).toBoolean()).toBe(true);
  });

  it('string comparisons are lexicographic', () => {
    expect(TValue.fromString('apple').lessThan(TValue.fromString('banana')).toBoolean()).toBe(true);
    expect(TValue.fromString('banana').greaterThan(TValue.fromString('apple')).toBoolean()).toBe(true);
    expect(TValue.fromString('a').equalsOperation(TValue.fromString('a')).toBoolean()).toBe(true);
  });

  it('mixed number/string comparisons fall back to string comparison', () => {
    // "10" < "9" lexicographically, even though 10 > 9 numerically.
    expect(TValue.fromInt(10).lessThan(TValue.fromString('9')).toBoolean()).toBe(true);
  });
});

describe('TValue.toBoolean', () => {
  it('numbers: nonzero is true, zero is false', () => {
    expect(TValue.fromInt(1).toBoolean()).toBe(true);
    expect(TValue.fromInt(0).toBoolean()).toBe(false);
  });

  it('strings: non-empty is true, empty is false', () => {
    expect(TValue.fromString('x').toBoolean()).toBe(true);
    expect(TValue.fromString('').toBoolean()).toBe(false);
  });
});

describe('TValue logical operators', () => {
  it('logicalAnd', () => {
    expect(TValue.fromBoolean(true).logicalAnd(TValue.fromBoolean(true)).toBoolean()).toBe(true);
    expect(TValue.fromBoolean(true).logicalAnd(TValue.fromBoolean(false)).toBoolean()).toBe(false);
  });

  it('logicalOr', () => {
    expect(TValue.fromBoolean(false).logicalOr(TValue.fromBoolean(true)).toBoolean()).toBe(true);
    expect(TValue.fromBoolean(false).logicalOr(TValue.fromBoolean(false)).toBoolean()).toBe(false);
  });
});

describe('TValue.toString', () => {
  it('a number renders as its digits', () => {
    expect(TValue.fromInt(42).toString()).toBe('42');
  });

  it('a JSON string value renders unquoted', () => {
    expect(TValue.fromJson('hi').toString()).toBe('hi');
  });

  it('a JSON object value renders as compact JSON text', () => {
    expect(TValue.fromJson({ a: 1 }).toString()).toBe('{"a":1}');
  });

  it('the JSON null literal renders as "null"', () => {
    expect(TValue.fromJson(null).toString()).toBe('null');
  });
});

describe('TValue.toToken', () => {
  it('a number TValue becomes a NUMBER token', () => {
    const token = TValue.fromInt(5).toToken();
    expect(token.getTokenType()).toBe(TokenType.NUMBER);
    expect(token.getSurface()).toBe('5');
  });

  it('a JSON TValue becomes a JSON_DATA token carrying the payload', () => {
    const token = TValue.fromJson({ a: 1 }).toToken();
    expect(token.getTokenType()).toBe(TokenType.JSON_DATA);
    expect(token.getJson()).toEqual({ a: 1 });
  });

  it('a string TValue becomes a QUOTED_STRING token', () => {
    const token = TValue.fromString('hi').toToken();
    expect(token.getTokenType()).toBe(TokenType.QUOTED_STRING);
    expect(token.getSurface()).toBe('hi');
  });
});

describe('TValue.toJson / toJsonValue', () => {
  it('toJson returns undefined for a non-JSON TValue', () => {
    expect(TValue.fromInt(1).toJson()).toBeUndefined();
  });

  it('toJson returns the raw payload for a JSON TValue', () => {
    expect(TValue.fromJson([1, 2]).toJson()).toEqual([1, 2]);
  });

  it('toJsonValue boxes a number TValue as a JSON number', () => {
    expect(TValue.fromInt(7).toJsonValue()).toBe(7);
  });

  it('toJsonValue boxes a string TValue as a JSON string', () => {
    expect(TValue.fromString('hi').toJsonValue()).toBe('hi');
  });

  it('toJsonValue passes a JSON TValue through unchanged', () => {
    expect(TValue.fromJson({ a: 1 }).toJsonValue()).toEqual({ a: 1 });
  });
});
