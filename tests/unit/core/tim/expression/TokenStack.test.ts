import { describe, expect, it } from 'vitest';
import { Token, TokenStack, TokenType, TValue } from '../../../../../src/core/tim/expression/index.js';
import { StringEater, tokenizeAll } from '../../../../helpers/tim-expression-eater.js';
import { FakeKnowledge, fakeContext, fakeFunction } from '../../../../helpers/tim-expression-knowledge.js';

function stackOf(...tokens: Token[]): TokenStack {
  const stack = new TokenStack();
  for (const t of tokens) stack.add(t);
  return stack;
}

const NUM = (n: string) => new Token(n, TokenType.NUMBER, undefined);
const TEXT = (s: string) => new Token(s, TokenType.PLAIN_TEXT, undefined);
const SPACE = (s = ' ') => new Token(s, TokenType.SPACES, undefined);
const OPEN = () => new Token('(', TokenType.OPEN_PAREN_MATH, undefined);
const CLOSE = () => new Token(')', TokenType.CLOSE_PAREN_MATH, undefined);
const COMMA = () => new Token(',', TokenType.COMMA, undefined);

describe('TokenStack basic operations', () => {
  it('size / add', () => {
    const stack = stackOf(NUM('1'), NUM('2'));
    expect(stack.size()).toBe(2);
  });

  it('subTokenStack returns the suffix from index i', () => {
    const stack = stackOf(NUM('1'), NUM('2'), NUM('3'));
    expect(stack.subTokenStack(1).size()).toBe(2);
  });

  it('toString renders bracketed token list', () => {
    const stack = stackOf(NUM('1'));
    expect(stack.toString()).toBe('[NUMBER{1}]');
  });

  it('withoutSpace filters SPACES tokens', () => {
    const stack = stackOf(NUM('1'), SPACE(), NUM('2'));
    const filtered = stack.withoutSpace();
    expect(filtered.size()).toBe(2);
  });
});

describe('TokenStack.eatUntilCloseParenthesisOrComma(Eater)', () => {
  it('stops at a top-level comma, leaving it unconsumed', () => {
    const eater = new StringEater('1+2,3)');
    const result = TokenStack.eatUntilCloseParenthesisOrComma(eater);
    expect(result.size()).toBe(3);
    expect(eater.peekChar()).toBe(',');
  });

  it('stops at a top-level close-paren, leaving it unconsumed', () => {
    const eater = new StringEater('1+2)');
    const result = TokenStack.eatUntilCloseParenthesisOrComma(eater);
    expect(result.size()).toBe(3);
    expect(eater.peekChar()).toBe(')');
  });

  it('tracks nesting so a comma/paren inside a nested "(...)" does not stop early', () => {
    const eater = new StringEater('(1,2)+3,4)');
    const result = TokenStack.eatUntilCloseParenthesisOrComma(eater);
    // '(', '1', ',', '2', ')', '+', '3' -- 7 tokens up to (but not
    // including) the top-level comma.
    expect(result.size()).toBe(7);
    expect(eater.peekChar()).toBe(',');
  });

  it('throws at end of input with no closing comma/paren', () => {
    const eater = new StringEater('1+2');
    expect(() => TokenStack.eatUntilCloseParenthesisOrComma(eater)).toThrow('until001');
  });
});

describe('TokenStack.eatUntilCloseParenthesisOrComma(TokenIterator, location)', () => {
  it('advances the iterator past a nested call, stopping at the outer comma', () => {
    const stack = stackOf(NUM('1'), COMMA(), NUM('2'), COMMA(), NUM('3'));
    const it = stack.tokenIterator();
    TokenStack.eatUntilCloseParenthesisOrComma(it, { getLocation: () => undefined });
    // Consumed just "1"; the iterator now sits on the comma.
    expect(it.peekToken()!.getTokenType()).toBe(TokenType.COMMA);
  });

  it('throws when the iterator is exhausted before a stop token', () => {
    const stack = stackOf(NUM('1'));
    const it = stack.tokenIterator();
    it.nextToken();
    expect(() => TokenStack.eatUntilCloseParenthesisOrComma(it, { getLocation: () => undefined })).toThrow(
      'IndexOutOfBoundsException',
    );
  });
});

describe('TokenStack.guessFunctions', () => {
  it('rewrites name(args) into FUNCTION_NAME/OPEN_PAREN_FUNC/CLOSE_PAREN_FUNC', () => {
    const stack = stackOf(TEXT('foo'), OPEN(), NUM('1'), COMMA(), NUM('2'), CLOSE());
    stack.guessFunctions({ getLocation: () => undefined });
    const it = stack.tokenIterator();
    const nameToken = it.nextToken()!;
    expect(nameToken.getTokenType()).toBe(TokenType.FUNCTION_NAME);
    expect(nameToken.getSurface()).toBe('foo');
    const openToken = it.nextToken()!;
    expect(openToken.getTokenType()).toBe(TokenType.OPEN_PAREN_FUNC);
    expect(openToken.getSurface()).toBe('2');
  });

  it('leaves a bare "(...)" (no preceding PLAIN_TEXT) untouched', () => {
    const stack = stackOf(OPEN(), NUM('1'), CLOSE());
    stack.guessFunctions({ getLocation: () => undefined });
    const it = stack.tokenIterator();
    expect(it.nextToken()!.getTokenType()).toBe(TokenType.OPEN_PAREN_MATH);
  });

  it('resolves a zero-arg function call to arg count 0', () => {
    const stack = stackOf(TEXT('foo'), OPEN(), CLOSE());
    stack.guessFunctions({ getLocation: () => undefined });
    const it = stack.tokenIterator();
    it.nextToken();
    expect(it.nextToken()!.getSurface()).toBe('0');
  });

  it('handles nested function calls independently', () => {
    const stack = stackOf(TEXT('outer'), OPEN(), TEXT('inner'), OPEN(), NUM('1'), CLOSE(), CLOSE());
    stack.guessFunctions({ getLocation: () => undefined });
    const it = stack.tokenIterator();
    expect(it.nextToken()!.getTokenType()).toBe(TokenType.FUNCTION_NAME); // outer
    expect(it.nextToken()!.getTokenType()).toBe(TokenType.OPEN_PAREN_FUNC); // (
    expect(it.nextToken()!.getTokenType()).toBe(TokenType.FUNCTION_NAME); // inner
    expect(it.nextToken()!.getTokenType()).toBe(TokenType.OPEN_PAREN_FUNC); // (
  });
});

describe('TokenStack.tokenIterator', () => {
  it('nextToken returns null once exhausted', () => {
    const stack = stackOf(NUM('1'));
    const it = stack.tokenIterator();
    expect(it.nextToken()!.getSurface()).toBe('1');
    expect(it.nextToken()).toBeNull();
  });

  it('peekToken throws once exhausted', () => {
    const stack = stackOf(NUM('1'));
    const it = stack.tokenIterator();
    it.nextToken();
    expect(() => it.peekToken()).toThrow('IndexOutOfBoundsException');
  });

  it('hasMoreTokens reflects remaining position', () => {
    const stack = stackOf(NUM('1'));
    const it = stack.tokenIterator();
    expect(it.hasMoreTokens()).toBe(true);
    it.nextToken();
    expect(it.hasMoreTokens()).toBe(false);
  });
});

describe('TokenStack.getResult (end-to-end)', () => {
  it('evaluates a full expression from raw tokens through arithmetic + a built-in call', () => {
    const knowledge = new FakeKnowledge();
    knowledge.setVariable('$x', TValue.fromInt(10));
    knowledge.setFunction(
      'double',
      fakeFunction('double', 1, (args) => TValue.fromInt(args[0]!.toInt() * 2)),
    );
    const context = fakeContext(knowledge);

    const tokens = tokenizeAll('double($x)+1');
    const stack = stackOf(...tokens);
    const result = stack.getResult({ getLocation: () => undefined }, context, undefined);
    expect(result.toInt()).toBe(21);
  });

  it('evaluates simple operator-precedence arithmetic end-to-end', () => {
    const knowledge = new FakeKnowledge();
    const context = fakeContext(knowledge);
    const tokens = tokenizeAll('1+2*3');
    const stack = stackOf(...tokens);
    const result = stack.getResult({ getLocation: () => undefined }, context, undefined);
    expect(result.toInt()).toBe(7);
  });
});
