import { describe, expect, it } from 'vitest';
import { ShuntingYard, Token, TokenStack, TokenType, TValue } from '../../../../../src/core/tim/expression/index.js';
import { FakeKnowledge } from '../../../../helpers/tim-expression-knowledge.js';
import { StringLocated } from '../../../../../src/core/tim/StringLocated.js';

const NUM = (n: string) => new Token(n, TokenType.NUMBER, undefined);
const OP = (s: string) => new Token(s, TokenType.OPERATOR, undefined);
const TEXT = (s: string) => new Token(s, TokenType.PLAIN_TEXT, undefined);
const OPEN = () => new Token('(', TokenType.OPEN_PAREN_MATH, undefined);
const CLOSE = () => new Token(')', TokenType.CLOSE_PAREN_MATH, undefined);
const OPEN_FUNC = (n: string) => new Token(n, TokenType.OPEN_PAREN_FUNC, undefined);
const CLOSE_FUNC = () => new Token(')', TokenType.CLOSE_PAREN_FUNC, undefined);
const FUNC_NAME = (n: string) => new Token(n, TokenType.FUNCTION_NAME, undefined);
const COMMA = () => new Token(',', TokenType.COMMA, undefined);

function iteratorOf(...tokens: Token[]) {
  const stack = new TokenStack();
  for (const t of tokens) stack.add(t);
  return stack.tokenIterator();
}

function surfacesOf(sy: ShuntingYard): string[] {
  const out: string[] = [];
  for (const it = sy.getQueue().tokenIterator(); it.hasMoreTokens(); ) out.push(it.nextToken()!.getSurface());
  return out;
}

const LOC = new StringLocated('', undefined);

describe('ShuntingYard: precedence and associativity', () => {
  it('multiplication reorders before addition in the output queue', () => {
    // 1 + 2 * 3 -> RPN: 1 2 3 * +
    const sy = new ShuntingYard(iteratorOf(NUM('1'), OP('+'), NUM('2'), OP('*'), NUM('3')), new FakeKnowledge(), LOC);
    expect(surfacesOf(sy)).toEqual(['1', '2', '3', '*', '+']);
  });

  it('same-precedence operators are left-associative', () => {
    // 1 - 2 - 3 -> RPN: 1 2 - 3 -  (i.e. (1-2)-3, not 1-(2-3))
    const minus = new Token('⁒', TokenType.OPERATOR, undefined);
    const sy = new ShuntingYard(iteratorOf(NUM('1'), minus, NUM('2'), minus, NUM('3')), new FakeKnowledge(), LOC);
    expect(surfacesOf(sy)).toEqual(['1', '2', '⁒', '3', '⁒']);
  });

  it('parentheses override default precedence', () => {
    // (1 + 2) * 3 -> RPN: 1 2 + 3 *
    const sy = new ShuntingYard(
      iteratorOf(OPEN(), NUM('1'), OP('+'), NUM('2'), CLOSE(), OP('*'), NUM('3')),
      new FakeKnowledge(),
      LOC,
    );
    expect(surfacesOf(sy)).toEqual(['1', '2', '+', '3', '*']);
  });
});

describe('ShuntingYard: variable resolution', () => {
  it('a known variable is pushed as its resolved value token', () => {
    const knowledge = new FakeKnowledge();
    knowledge.setVariable('$x', TValue.fromInt(5));
    const sy = new ShuntingYard(iteratorOf(TEXT('$x')), knowledge, LOC);
    const it = sy.getQueue().tokenIterator();
    const token = it.nextToken()!;
    expect(token.getTokenType()).toBe(TokenType.NUMBER);
    expect(token.getSurface()).toBe('5');
  });

  it('an unresolved but variable-name-shaped identifier becomes a QUOTED_STRING literal', () => {
    const sy = new ShuntingYard(iteratorOf(TEXT('undeclared')), new FakeKnowledge(), LOC);
    const token = sy.getQueue().tokenIterator().nextToken()!;
    expect(token.getTokenType()).toBe(TokenType.QUOTED_STRING);
    expect(token.getSurface()).toBe('undeclared');
  });

  it('an unresolved identifier with characters outside the variable-name pattern throws', () => {
    const sy = () => new ShuntingYard(iteratorOf(TEXT('bad@name')), new FakeKnowledge(), LOC);
    expect(sy).toThrow('Parsing syntax error about bad@name');
  });
});

describe('ShuntingYard: function calls', () => {
  it('FUNCTION_NAME / OPEN_PAREN_FUNC / CLOSE_PAREN_FUNC produce a flat postfix call', () => {
    // foo(1,2) -> RPN: 1 2 OPEN_PAREN_FUNC(2) foo
    const sy = new ShuntingYard(
      iteratorOf(FUNC_NAME('foo'), OPEN_FUNC('2'), NUM('1'), COMMA(), NUM('2'), CLOSE_FUNC()),
      new FakeKnowledge(),
      LOC,
    );
    expect(surfacesOf(sy)).toEqual(['1', '2', '2', 'foo']);
  });
});

describe('ShuntingYard: unrecognized token type', () => {
  it('throws UnsupportedOperationException-equivalent for a SPACES token (never filtered out)', () => {
    const spaceToken = new Token(' ', TokenType.SPACES, undefined);
    expect(() => new ShuntingYard(iteratorOf(spaceToken), new FakeKnowledge(), LOC)).toThrow(
      'UnsupportedOperationException',
    );
  });
});
