import { describe, expect, it } from 'vitest';
import { TokenType } from '../../../../../src/core/tim/expression/index.js';
import { tokenizeAll } from '../../../../helpers/tim-expression-eater.js';

describe('eatOneToken', () => {
  it('tokenizes a positive number', () => {
    const tokens = tokenizeAll('42');
    expect(tokens).toHaveLength(1);
    expect(tokens[0]!.getTokenType()).toBe(TokenType.NUMBER);
    expect(tokens[0]!.getSurface()).toBe('42');
  });

  it('tokenizes a leading (unary) negative number as one NUMBER token', () => {
    const tokens = tokenizeAll('-7');
    expect(tokens).toHaveLength(1);
    expect(tokens[0]!.getTokenType()).toBe(TokenType.NUMBER);
    expect(tokens[0]!.getSurface()).toBe('-7');
  });

  it('distinguishes binary subtraction from a unary negative literal', () => {
    // "3-7" -- the '-' follows a NUMBER token, so it's binary subtraction:
    // NUMBER(3), OPERATOR(subtraction sentinel), NUMBER(7).
    const tokens = tokenizeAll('3-7');
    expect(tokens.map((t) => t.getTokenType())).toEqual([TokenType.NUMBER, TokenType.OPERATOR, TokenType.NUMBER]);
    expect(tokens[0]!.getSurface()).toBe('3');
    expect(tokens[2]!.getSurface()).toBe('7');
    // The OPERATOR token's surface is the COMMERCIAL_MINUS_SIGN sentinel,
    // not the literal '-' character -- preserved verbatim from upstream.
    expect(tokens[1]!.getSurface()).toBe('⁒');
  });

  it('a "-" after an operator is a unary sign, not binary subtraction', () => {
    // "3*-7" -- the '-' follows an OPERATOR token, so it's unary: a
    // negative number literal, not a subtraction operator.
    const tokens = tokenizeAll('3*-7');
    expect(tokens.map((t) => t.getTokenType())).toEqual([TokenType.NUMBER, TokenType.OPERATOR, TokenType.NUMBER]);
    expect(tokens[2]!.getSurface()).toBe('-7');
  });

  it('a "-" after "(" is a unary sign', () => {
    const tokens = tokenizeAll('(-7)');
    expect(tokens.map((t) => t.getTokenType())).toEqual([
      TokenType.OPEN_PAREN_MATH,
      TokenType.NUMBER,
      TokenType.CLOSE_PAREN_MATH,
    ]);
    expect(tokens[1]!.getSurface()).toBe('-7');
  });

  it('tokenizes a double-quoted string, unescaped', () => {
    const tokens = tokenizeAll('"hello world"');
    expect(tokens).toHaveLength(1);
    expect(tokens[0]!.getTokenType()).toBe(TokenType.QUOTED_STRING);
    expect(tokens[0]!.getSurface()).toBe('hello world');
  });

  it('tokenizes a single-quoted string', () => {
    const tokens = tokenizeAll("'hi'");
    expect(tokens[0]!.getTokenType()).toBe(TokenType.QUOTED_STRING);
    expect(tokens[0]!.getSurface()).toBe('hi');
  });

  it('tokenizes single-char operators', () => {
    for (const [src, surface] of [
      ['*', '*'],
      ['/', '/'],
      ['+', '+'],
      ['<', '<'],
      ['>', '>'],
    ] as const) {
      const tokens = tokenizeAll(src);
      expect(tokens[0]!.getTokenType()).toBe(TokenType.OPERATOR);
      expect(tokens[0]!.getSurface()).toBe(surface);
    }
  });

  it('tokenizes two-char operators', () => {
    for (const src of ['<=', '>=', '==', '!=', '&&', '||']) {
      const tokens = tokenizeAll(src);
      expect(tokens).toHaveLength(1);
      expect(tokens[0]!.getTokenType()).toBe(TokenType.OPERATOR);
      expect(tokens[0]!.getSurface()).toBe(src);
    }
  });

  it('tokenizes affectation "="', () => {
    const tokens = tokenizeAll('=');
    expect(tokens[0]!.getTokenType()).toBe(TokenType.AFFECTATION);
  });

  it('tokenizes parens and commas', () => {
    const tokens = tokenizeAll('(a,b)');
    expect(tokens.map((t) => t.getTokenType())).toEqual([
      TokenType.OPEN_PAREN_MATH,
      TokenType.PLAIN_TEXT,
      TokenType.COMMA,
      TokenType.PLAIN_TEXT,
      TokenType.CLOSE_PAREN_MATH,
    ]);
  });

  it('tokenizes spaces as their own SPACES token', () => {
    const tokens = tokenizeAll('1  2');
    expect(tokens.map((t) => t.getTokenType())).toEqual([TokenType.NUMBER, TokenType.SPACES, TokenType.NUMBER]);
    expect(tokens[1]!.getSurface()).toBe('  ');
  });

  it('tokenizes plain text up to the next break character', () => {
    const tokens = tokenizeAll('foo+bar');
    expect(tokens.map((t) => t.getTokenType())).toEqual([TokenType.PLAIN_TEXT, TokenType.OPERATOR, TokenType.PLAIN_TEXT]);
    expect(tokens[0]!.getSurface()).toBe('foo');
    expect(tokens[2]!.getSurface()).toBe('bar');
  });

  it('returns an empty token list at end of input', () => {
    expect(tokenizeAll('')).toEqual([]);
  });

  it('manageColon stops tokenizing at an unescaped ":"', () => {
    const tokens = tokenizeAll('1:2', true);
    expect(tokens).toHaveLength(1);
    expect(tokens[0]!.getSurface()).toBe('1');
  });
});
