import { describe, expect, it, vi } from 'vitest';
import { Eater } from '../../../../src/core/tim/Eater.js';
import { StringLocated } from '../../../../src/core/tim/StringLocated.js';
import { EaterException } from '../../../../src/core/tim/EaterException.js';
import { TFunctionType } from '../../../../src/core/tim/TFunctionType.js';
import type { TContext } from '../../../../src/core/tim/TFunction.js';
import type { TMemory } from '../../../../src/core/tim/TMemory.js';
import { TMemoryGlobal } from '../../../../src/core/tim/TMemoryGlobal.js';

/** Minimal concrete `Eater` -- `analyze` is unused by these cursor-level tests. */
class TestEater extends Eater {
  analyze(): void {
    throw new Error('not used in these tests');
  }

  // Expose protected members for direct testing.
  publicEatAllToEnd(): string {
    return this.eatAllToEnd();
  }
  publicSkipUntilChar(ch: string): void {
    this.skipUntilChar(ch);
  }
  publicHasNextChar(): boolean {
    return this.hasNextChar();
  }
  publicCheckAndEatChar(s: string): void {
    this.checkAndEatChar(s);
  }
  publicSafeCheckAndEatChar(ch: string): boolean {
    return this.safeCheckAndEatChar(ch);
  }
  publicOptionallyEatChar(ch: string): void {
    this.optionallyEatChar(ch);
  }
  publicEatAndGetVarname(): string {
    return this.eatAndGetVarname();
  }
  publicEatAndGetFunctionName(): string {
    return this.eatAndGetFunctionName();
  }
  publicEatAndGetOptionalQuotedString(): string {
    return this.eatAndGetOptionalQuotedString();
  }
  publicEatDeclareFunction(
    context: TContext,
    memory: TMemory,
    unquoted: boolean,
    location: StringLocated,
    allowNoParenthesis: boolean,
    type: TFunctionType,
  ) {
    return this.eatDeclareFunction(context, memory, unquoted, location, allowNoParenthesis, type);
  }
  publicEatDeclareProcedure(context: TContext, memory: TMemory, unquoted: boolean, location: StringLocated) {
    return this.eatDeclareProcedure(context, memory, unquoted, location);
  }
  publicEatDeclareReturnFunctionWithOptionalReturn(
    context: TContext,
    memory: TMemory,
    unquoted: boolean,
    location: StringLocated,
  ) {
    return this.eatDeclareReturnFunctionWithOptionalReturn(context, memory, unquoted, location);
  }
}

function eaterFor(s: string): TestEater {
  return new TestEater(new StringLocated(s, undefined));
}

function fakeContext(): TContext {
  return {
    asKnowledge: vi.fn().mockReturnValue({ getVariable: vi.fn(), getFunction: vi.fn() }),
    executeLines: vi.fn(),
    applyFunctionsAndVariables: vi.fn(),
  };
}

describe('Eater cursor primitives', () => {
  it('peekChar/peekCharN2/eatOneChar walk the string, returning "" at EOF', () => {
    const e = eaterFor('ab');
    expect(e.peekChar()).toBe('a');
    expect(e.peekCharN2()).toBe('b');
    expect(e.eatOneChar()).toBe('a');
    expect(e.peekChar()).toBe('b');
    expect(e.peekCharN2()).toBe('');
    expect(e.eatOneChar()).toBe('b');
    expect(e.peekChar()).toBe('');
  });

  it('getCurrentPosition tracks the cursor', () => {
    const e = eaterFor('abc');
    expect(e.getCurrentPosition()).toBe(0);
    e.eatOneChar();
    e.eatOneChar();
    expect(e.getCurrentPosition()).toBe(2);
  });

  it('skipSpaces consumes whitespace including tabs/newlines', () => {
    const e = eaterFor('  \t\nx');
    e.skipSpaces();
    expect(e.peekChar()).toBe('x');
  });

  it('eatAndGetSpaces only consumes narrow Unicode space-separator characters', () => {
    const e = eaterFor('  x');
    expect(e.eatAndGetSpaces()).toBe('  ');
    expect(e.peekChar()).toBe('x');
  });

  it('eatAndGetNumber eats an optional leading minus and digits', () => {
    expect(eaterFor('123rest').eatAndGetNumber()).toBe('123');
    expect(eaterFor('-42rest').eatAndGetNumber()).toBe('-42');
    expect(eaterFor('rest').eatAndGetNumber()).toBe('');
  });

  it('eatAndGetQuotedString reads a double- or single-quoted literal', () => {
    expect(eaterFor('"hello" rest').eatAndGetQuotedString()).toBe('hello');
    expect(eaterFor("'hi' rest").eatAndGetQuotedString()).toBe('hi');
  });

  it('eatAndGetQuotedString throws when not positioned at a quote', () => {
    expect(() => eaterFor('nope').eatAndGetQuotedString()).toThrow(EaterException);
  });

  it('eatAndGetOptionalQuotedString reads unquoted text up to , or ) at paren level 0', () => {
    const e = eaterFor('foo(bar), rest');
    expect(e.publicEatAndGetOptionalQuotedString()).toBe('foo(bar)');
  });

  it('eatAllToEnd consumes the remainder of the line', () => {
    const e = eaterFor('!return 3');
    e.publicCheckAndEatChar('!return ');
    expect(e.publicEatAllToEnd()).toBe('3');
    expect(e.peekChar()).toBe('');
  });

  it('skipUntilChar advances up to (not past) the target character', () => {
    const e = eaterFor('abc=def');
    e.publicSkipUntilChar('=');
    expect(e.peekChar()).toBe('=');
  });

  it('hasNextChar reflects remaining input', () => {
    const e = eaterFor('a');
    expect(e.publicHasNextChar()).toBe(true);
    e.eatOneChar();
    expect(e.publicHasNextChar()).toBe(false);
  });

  it('checkAndEatChar eats a matching multi-char sequence, char by char', () => {
    const e = eaterFor('return x');
    e.publicCheckAndEatChar('return');
    expect(e.peekChar()).toBe(' ');
  });

  it('checkAndEatChar throws EaterException on a mismatch', () => {
    expect(() => eaterFor('abc').publicCheckAndEatChar('x')).toThrow(EaterException);
  });

  it('safeCheckAndEatChar eats and returns true on a match, false (no-op) otherwise', () => {
    const e = eaterFor('(rest');
    expect(e.publicSafeCheckAndEatChar('(')).toBe(true);
    expect(e.peekChar()).toBe('r');
    expect(e.publicSafeCheckAndEatChar('x')).toBe(false);
    expect(e.peekChar()).toBe('r');
  });

  it('optionallyEatChar eats on a match and is a no-op otherwise', () => {
    const e = eaterFor('(rest');
    e.publicOptionallyEatChar('(');
    expect(e.peekChar()).toBe('r');
    e.publicOptionallyEatChar('x');
    expect(e.peekChar()).toBe('r');
  });

  it('matchAffectation recognizes $var = ... at the cursor', () => {
    expect(eaterFor('$x = 3').matchAffectation()).toBe(true);
    expect(eaterFor('not an affectation').matchAffectation()).toBe(false);
  });

  it('eatAndGetVarname reads a $-or-letter-led identifier', () => {
    expect(eaterFor('$foo_bar rest').publicEatAndGetVarname()).toBe('$foo_bar');
  });

  it('eatAndGetVarname throws on an invalid leading character', () => {
    expect(() => eaterFor('123').publicEatAndGetVarname()).toThrow(EaterException);
  });

  it('eatAndGetFunctionName reads a letter-led identifier', () => {
    expect(eaterFor('myFunc(').publicEatAndGetFunctionName()).toBe('myFunc');
  });

  it('getLineLocation/getStringLocated forward the wrapped StringLocated', () => {
    const sl = new StringLocated('abc', 'loc');
    const e = new TestEater(sl);
    expect(e.getStringLocated()).toBe(sl);
    expect(e.getLineLocation()).toBe('loc');
  });
});

describe('Eater#eatExpression', () => {
  it('parses a raw JSON object literal directly', () => {
    const e = eaterFor('{"a": 1}');
    const context = fakeContext();
    const memory = new TMemoryGlobal();
    const value = e.eatExpression(context, memory);
    expect(value.isJson()).toBe(true);
    expect(value.toJson()).toEqual({ a: 1 });
  });

  it('parses a raw JSON array literal directly', () => {
    const e = eaterFor('[1,2,3]');
    const value = e.eatExpression(fakeContext(), new TMemoryGlobal());
    expect(value.toJson()).toEqual([1, 2, 3]);
  });

  it('evaluates a plain numeric expression via the token pipeline', () => {
    const e = eaterFor('1+2');
    const value = e.eatExpression(fakeContext(), new TMemoryGlobal());
    expect(value.toInt()).toBe(3);
  });
});

describe('Eater#eatDeclareFunction / eatDeclareProcedure / eatDeclareReturnFunctionWithOptionalReturn', () => {
  it('parses a zero-arg declaration with parentheses', () => {
    const e = eaterFor('foo()');
    const memory = new TMemoryGlobal();
    const fn = e.publicEatDeclareFunction(fakeContext(), memory, false, e.getStringLocated(), false, TFunctionType.PROCEDURE);
    expect(fn.getSignature().getFunctionName()).toBe('foo');
    expect(fn.getSignature().getNbArg()).toBe(0);
  });

  it('parses positional parameters, including a defaulted one', () => {
    const e = eaterFor('foo($a, $b=1)');
    const memory = new TMemoryGlobal();
    const fn = e.publicEatDeclareFunction(fakeContext(), memory, false, e.getStringLocated(), false, TFunctionType.PROCEDURE);
    expect(fn.getSignature().getNbArg()).toBe(2);
    expect(fn.canCover(1, new Set())).toBe(true);
  });

  it('requires an opening parenthesis unless allowNoParenthesis is set', () => {
    const e = eaterFor('foo');
    expect(() =>
      e.publicEatDeclareFunction(fakeContext(), new TMemoryGlobal(), false, e.getStringLocated(), false, TFunctionType.PROCEDURE),
    ).toThrow('Missing opening parenthesis');
  });

  it('eatDeclareProcedure declares a PROCEDURE-typed function', () => {
    const e = eaterFor('myProc($x)');
    const proc = e.publicEatDeclareProcedure(fakeContext(), new TMemoryGlobal(), false, e.getStringLocated());
    expect(proc.getFunctionType()).toBe(TFunctionType.PROCEDURE);
  });

  it('eatDeclareReturnFunctionWithOptionalReturn captures an inline "return expr"', () => {
    const e = eaterFor('myFunc() return 1+2');
    const fn = e.publicEatDeclareReturnFunctionWithOptionalReturn(fakeContext(), new TMemoryGlobal(), false, e.getStringLocated());
    expect(fn.getFunctionType()).toBe(TFunctionType.RETURN_FUNCTION);
    expect(fn.hasBody()).toBe(true);
    expect(fn.doesContainReturn()).toBe(true);
  });

  it('eatDeclareReturnFunctionWithOptionalReturn captures an inline "!return expr"', () => {
    const e = eaterFor('myFunc() !return 1+2');
    const fn = e.publicEatDeclareReturnFunctionWithOptionalReturn(fakeContext(), new TMemoryGlobal(), false, e.getStringLocated());
    expect(fn.doesContainReturn()).toBe(true);
  });

  it('eatDeclareReturnFunctionWithOptionalReturn with no inline return leaves the body empty', () => {
    const e = eaterFor('myFunc()');
    const fn = e.publicEatDeclareReturnFunctionWithOptionalReturn(fakeContext(), new TMemoryGlobal(), false, e.getStringLocated());
    expect(fn.hasBody()).toBe(false);
  });
});
