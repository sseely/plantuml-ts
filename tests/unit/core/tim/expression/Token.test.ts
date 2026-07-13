import { describe, expect, it } from 'vitest';
import { Token, TokenOperator, TokenType } from '../../../../../src/core/tim/expression/index.js';

describe('Token', () => {
  it('stores surface, token type, and json payload', () => {
    const token = new Token('42', TokenType.NUMBER, undefined);
    expect(token.getSurface()).toBe('42');
    expect(token.getTokenType()).toBe(TokenType.NUMBER);
  });

  it('toString renders TYPE{surface}', () => {
    const token = new Token('42', TokenType.NUMBER, undefined);
    expect(token.toString()).toBe('NUMBER{42}');
  });

  it('getTokenOperator resolves a single-char operator', () => {
    const token = new Token('+', TokenType.OPERATOR, undefined);
    expect(token.getTokenOperator()).toBe(TokenOperator.ADDITION);
  });

  it('getTokenOperator resolves a two-char operator', () => {
    const token = new Token('==', TokenType.OPERATOR, undefined);
    expect(token.getTokenOperator()).toBe(TokenOperator.EQUALS);
  });

  it('getTokenOperator returns undefined for an unresolved combo', () => {
    const token = new Token('!', TokenType.OPERATOR, undefined);
    expect(token.getTokenOperator()).toBeUndefined();
  });

  it('getTokenOperator throws when the token type is not OPERATOR', () => {
    const token = new Token('42', TokenType.NUMBER, undefined);
    expect(() => token.getTokenOperator()).toThrow('Token is not an OPERATOR: NUMBER');
  });

  it('muteToFunction converts PLAIN_TEXT to FUNCTION_NAME, preserving surface', () => {
    const token = new Token('foo', TokenType.PLAIN_TEXT, undefined);
    const fn = token.muteToFunction();
    expect(fn.getTokenType()).toBe(TokenType.FUNCTION_NAME);
    expect(fn.getSurface()).toBe('foo');
  });

  it('muteToFunction throws when the token type is not PLAIN_TEXT', () => {
    const token = new Token('foo', TokenType.QUOTED_STRING, undefined);
    expect(() => token.muteToFunction()).toThrow('Token is not PLAIN_TEXT: QUOTED_STRING');
  });

  it('getJson returns the json payload for a JSON_DATA token', () => {
    const token = new Token('{"a":1}', TokenType.JSON_DATA, { a: 1 });
    expect(token.getJson()).toEqual({ a: 1 });
  });

  it('getJson throws when the token type is not JSON_DATA', () => {
    const token = new Token('42', TokenType.NUMBER, undefined);
    expect(() => token.getJson()).toThrow('Token is not JSON_DATA: NUMBER');
  });

  it('getPrecedence for AFFECTATION equals TokenOperator.EQUALS precedence', () => {
    const token = new Token('=', TokenType.AFFECTATION, undefined);
    expect(token.getPrecedence()).toBe(TokenOperator.EQUALS.getPrecedence());
  });

  it('getPrecedence for an OPERATOR token delegates to its TokenOperator', () => {
    const token = new Token('*', TokenType.OPERATOR, undefined);
    expect(token.getPrecedence()).toBe(TokenOperator.MULTIPLICATION.getPrecedence());
  });

  it('getLeftAssociativity is always true', () => {
    const token = new Token('+', TokenType.OPERATOR, undefined);
    expect(token.getLeftAssociativity()).toBe(true);
  });
});
