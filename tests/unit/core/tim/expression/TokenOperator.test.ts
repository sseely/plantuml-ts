import { describe, expect, it } from 'vitest';
import { TValue, TokenOperator } from '../../../../../src/core/tim/expression/index.js';

describe('TokenOperator.getTokenOperator', () => {
  it.each([
    ['*', '', TokenOperator.MULTIPLICATION],
    ['/', '', TokenOperator.DIVISION],
    ['+', '', TokenOperator.ADDITION],
    ['<', '', TokenOperator.LESS_THAN],
    ['<', '=', TokenOperator.LESS_THAN_OR_EQUALS],
    ['>', '', TokenOperator.GREATER_THAN],
    ['>', '=', TokenOperator.GREATER_THAN_OR_EQUALS],
    ['=', '=', TokenOperator.EQUALS],
    ['!', '=', TokenOperator.NOT_EQUALS],
    ['&', '&', TokenOperator.LOGICAL_AND],
    ['|', '|', TokenOperator.LOGICAL_OR],
  ] as const)('resolves %s%s', (ch, ch2, expected) => {
    expect(TokenOperator.getTokenOperator(ch, ch2)).toBe(expected);
  });

  it.each([
    ['=', ''],
    ['!', ''],
    ['&', ''],
    ['|', ''],
    ['%', ''],
  ] as const)('returns undefined for unresolved %s%s', (ch, ch2) => {
    expect(TokenOperator.getTokenOperator(ch, ch2)).toBeUndefined();
  });

  it('resolves the COMMERCIAL_MINUS_SIGN sentinel to SUBSTRACTION', () => {
    expect(TokenOperator.getTokenOperator('⁒', '')).toBe(TokenOperator.SUBSTRACTION);
  });
});

describe('TokenOperator precedence ordering', () => {
  it('multiplication/division bind tighter than addition/subtraction', () => {
    expect(TokenOperator.MULTIPLICATION.getPrecedence()).toBeGreaterThan(TokenOperator.ADDITION.getPrecedence());
    expect(TokenOperator.DIVISION.getPrecedence()).toBeGreaterThan(TokenOperator.SUBSTRACTION.getPrecedence());
  });

  it('additive binds tighter than relational', () => {
    expect(TokenOperator.ADDITION.getPrecedence()).toBeGreaterThan(TokenOperator.LESS_THAN.getPrecedence());
  });

  it('relational binds tighter than equality', () => {
    expect(TokenOperator.LESS_THAN.getPrecedence()).toBeGreaterThan(TokenOperator.EQUALS.getPrecedence());
  });

  it('equality binds tighter than logical AND, which binds tighter than logical OR', () => {
    expect(TokenOperator.EQUALS.getPrecedence()).toBeGreaterThan(TokenOperator.LOGICAL_AND.getPrecedence());
    expect(TokenOperator.LOGICAL_AND.getPrecedence()).toBeGreaterThan(TokenOperator.LOGICAL_OR.getPrecedence());
  });
});

describe('TokenOperator.getDisplay', () => {
  it('returns the operator surface text', () => {
    expect(TokenOperator.MULTIPLICATION.getDisplay()).toBe('*');
    expect(TokenOperator.LESS_THAN_OR_EQUALS.getDisplay()).toBe('<=');
    expect(TokenOperator.SUBSTRACTION.getDisplay()).toBe('⁒');
  });
});

describe('TokenOperator.operate', () => {
  it('delegates each operator to the matching TValue method', () => {
    const three = TValue.fromInt(3);
    const two = TValue.fromInt(2);
    expect(TokenOperator.MULTIPLICATION.operate(three, two).toInt()).toBe(6);
    expect(TokenOperator.DIVISION.operate(three, two).toInt()).toBe(1);
    expect(TokenOperator.ADDITION.operate(three, two).toInt()).toBe(5);
    expect(TokenOperator.SUBSTRACTION.operate(three, two).toInt()).toBe(1);
    expect(TokenOperator.LESS_THAN.operate(three, two).toBoolean()).toBe(false);
    expect(TokenOperator.GREATER_THAN.operate(three, two).toBoolean()).toBe(true);
    expect(TokenOperator.LESS_THAN_OR_EQUALS.operate(two, two).toBoolean()).toBe(true);
    expect(TokenOperator.GREATER_THAN_OR_EQUALS.operate(two, three).toBoolean()).toBe(false);
    expect(TokenOperator.EQUALS.operate(two, two).toBoolean()).toBe(true);
    expect(TokenOperator.NOT_EQUALS.operate(two, three).toBoolean()).toBe(true);
    expect(TokenOperator.LOGICAL_AND.operate(three, two).toBoolean()).toBe(true);
    expect(TokenOperator.LOGICAL_OR.operate(TValue.fromInt(0), TValue.fromInt(0)).toBoolean()).toBe(false);
  });
});
