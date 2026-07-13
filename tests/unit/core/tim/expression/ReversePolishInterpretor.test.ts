import { describe, expect, it } from 'vitest';
import {
  ReversePolishInterpretor,
  Token,
  TokenStack,
  TokenType,
  TValue,
} from '../../../../../src/core/tim/expression/index.js';
import { FakeKnowledge, fakeContext, fakeFunction } from '../../../../helpers/tim-expression-knowledge.js';

const NUM = (n: string) => new Token(n, TokenType.NUMBER, undefined);
const STR = (s: string) => new Token(s, TokenType.QUOTED_STRING, undefined);
const OP = (s: string) => new Token(s, TokenType.OPERATOR, undefined);
const AFFECT = () => new Token('=', TokenType.AFFECTATION, undefined);
const JSON_TOKEN = (v: unknown) => new Token(JSON.stringify(v), TokenType.JSON_DATA, v as never);
const OPEN_FUNC = (n: string) => new Token(n, TokenType.OPEN_PAREN_FUNC, undefined);
const FUNC_NAME = (n: string) => new Token(n, TokenType.FUNCTION_NAME, undefined);

function queueOf(...tokens: Token[]): TokenStack {
  const stack = new TokenStack();
  for (const t of tokens) stack.add(t);
  return stack;
}

const LOC = { getLocation: () => undefined };

function evaluate(queue: TokenStack, knowledge = new FakeKnowledge()): TValue {
  const rpn = new ReversePolishInterpretor(LOC, queue, knowledge, undefined, fakeContext(knowledge));
  return rpn.getResult();
}

describe('ReversePolishInterpretor: leaf tokens', () => {
  it('NUMBER pushes a numeric TValue', () => {
    expect(evaluate(queueOf(NUM('42'))).toInt()).toBe(42);
  });

  it('QUOTED_STRING pushes a string TValue', () => {
    expect(evaluate(queueOf(STR('hi'))).toString()).toBe('hi');
  });

  it('JSON_DATA pushes a JSON TValue', () => {
    expect(evaluate(queueOf(JSON_TOKEN({ a: 1 }))).toJson()).toEqual({ a: 1 });
  });
});

describe('ReversePolishInterpretor: operators', () => {
  it('evaluates a simple postfix arithmetic expression: 1 2 3 * +', () => {
    // 1 + (2 * 3) = 7
    expect(evaluate(queueOf(NUM('1'), NUM('2'), NUM('3'), OP('*'), OP('+'))).toInt()).toBe(7);
  });

  it('throws for an OPERATOR token whose surface does not resolve to a TokenOperator', () => {
    const badOp = new Token('!', TokenType.OPERATOR, undefined);
    expect(() => evaluate(queueOf(NUM('1'), NUM('2'), badOp))).toThrow('bad op');
  });
});

describe('ReversePolishInterpretor: unsupported token type', () => {
  it('throws for a leftover SPACES token (rpn41)', () => {
    const spaceToken = new Token(' ', TokenType.SPACES, undefined);
    expect(() => evaluate(queueOf(spaceToken))).toThrow('rpn41');
  });
});

describe('ReversePolishInterpretor: function calls', () => {
  it('evaluates a zero-arg built-in call', () => {
    const knowledge = new FakeKnowledge();
    knowledge.setFunction(
      'pi',
      fakeFunction('pi', 0, () => TValue.fromInt(3)),
    );
    const queue = queueOf(OPEN_FUNC('0'), FUNC_NAME('pi'));
    expect(evaluate(queue, knowledge).toInt()).toBe(3);
  });

  it('evaluates a multi-arg call, preserving left-to-right argument order', () => {
    const knowledge = new FakeKnowledge();
    knowledge.setFunction(
      'concat',
      fakeFunction('concat', 2, (args) => TValue.fromString(`${args[0]!.toString()}-${args[1]!.toString()}`)),
    );
    const queue = queueOf(STR('a'), STR('b'), OPEN_FUNC('2'), FUNC_NAME('concat'));
    expect(evaluate(queue, knowledge).toString()).toBe('a-b');
  });

  it('subtracts named-argument count from the declared arg count before lookup', () => {
    const knowledge = new FakeKnowledge();
    knowledge.setFunction(
      'greet',
      fakeFunction('greet', 1, (args) => TValue.fromString(`hi ${args[0]!.toString()}`)),
    );
    // "name" = "bob", greet(1 positional arg) -- the AFFECTATION consumes
    // one named binding, so nb = 2 (surface) - 1 (named.size) = 1.
    const queue = queueOf(STR('name'), STR('bob'), AFFECT(), STR('x'), OPEN_FUNC('2'), FUNC_NAME('greet'));
    expect(evaluate(queue, knowledge).toString()).toBe('hi x');
  });

  it('throws for a call to an unknown function', () => {
    const queue = queueOf(OPEN_FUNC('0'), FUNC_NAME('missing'));
    expect(() => evaluate(queue)).toThrow('Unknown built-in function missing');
  });

  it('throws when the declared arg count is not coverable', () => {
    const knowledge = new FakeKnowledge();
    knowledge.setFunction(
      'needsTwo',
      fakeFunction('needsTwo', 2, () => TValue.fromInt(0)),
    );
    const queue = queueOf(NUM('1'), OPEN_FUNC('1'), FUNC_NAME('needsTwo'));
    expect(() => evaluate(queue, knowledge)).toThrow('Bad number of arguments for needsTwo');
  });

  it('throws when OPEN_PAREN_FUNC is not immediately followed by a FUNCTION_NAME', () => {
    const queue = queueOf(OPEN_FUNC('0'), NUM('1'));
    expect(() => evaluate(queue)).toThrow('rpn43');
  });
});

describe('ReversePolishInterpretor.getResult', () => {
  it('exposes the final computed value', () => {
    const rpn = new ReversePolishInterpretor(LOC, queueOf(NUM('9')), new FakeKnowledge(), undefined, fakeContext(new FakeKnowledge()));
    expect(rpn.getResult().toInt()).toBe(9);
  });
});
