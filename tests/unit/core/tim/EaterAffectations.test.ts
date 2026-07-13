import { describe, expect, it } from 'vitest';
import { EaterAffectation } from '../../../../src/core/tim/EaterAffectation.js';
import { EaterAffectationDefine } from '../../../../src/core/tim/EaterAffectationDefine.js';
import { EaterAssert } from '../../../../src/core/tim/EaterAssert.js';
import { EaterUndef } from '../../../../src/core/tim/EaterUndef.js';
import { EaterException } from '../../../../src/core/tim/EaterException.js';
import { StringLocated } from '../../../../src/core/tim/StringLocated.js';
import { TMemoryGlobal } from '../../../../src/core/tim/TMemoryGlobal.js';
import { TValue } from '../../../../src/core/tim/expression/TValue.js';
import { TVariableScope } from '../../../../src/core/tim/TVariableScope.js';
import { fakeContext } from '../../../helpers/tim-context.js';

const LOC = undefined;

describe('EaterAffectation', () => {
  it('assigns an unscoped variable', () => {
    const memory = new TMemoryGlobal();
    new EaterAffectation(new StringLocated('!$x = 42', LOC)).analyze(fakeContext(), memory);
    expect(memory.getVariable('$x')?.toInt()).toBe(42);
  });

  it('a !local-scoped write at the TMemoryGlobal level is rejected', () => {
    // Matches TMemoryGlobal#putVariable's own guard -- LOCAL only makes
    // sense inside a forked TMemoryLocal call frame.
    const memory = new TMemoryGlobal();
    expect(() =>
      new EaterAffectation(new StringLocated('!local $x = 1', LOC)).analyze(fakeContext(), memory),
    ).toThrow('Cannot use local variable here');
  });

  it('assigns a !global-scoped variable', () => {
    const memory = new TMemoryGlobal();
    new EaterAffectation(new StringLocated('!global $x = 7', LOC)).analyze(fakeContext(), memory);
    expect(memory.getVariable('$x')?.toInt()).toBe(7);
  });

  it('honors conditional assignment (?=): skips when already set', () => {
    const memory = new TMemoryGlobal();
    memory.putVariable('$x', TValue.fromInt(1), undefined, new StringLocated('', LOC));
    new EaterAffectation(new StringLocated('!$x ?= 99', LOC)).analyze(fakeContext(), memory);
    expect(memory.getVariable('$x')?.toInt()).toBe(1);
  });

  it('honors conditional assignment (?=): assigns when unset', () => {
    const memory = new TMemoryGlobal();
    new EaterAffectation(new StringLocated('!$x ?= 99', LOC)).analyze(fakeContext(), memory);
    expect(memory.getVariable('$x')?.toInt()).toBe(99);
  });

  it('treats a variable literally named "local"/"global" as unscoped when followed by = or ?', () => {
    // `local` (bare, no leading $) is both a valid scope keyword AND a
    // valid variable name; upstream disambiguates by checking whether the
    // NEXT token is `=`/`?` (meaning "local" itself is the variable being
    // assigned) rather than a second varname (the normal `!local $x = ..`
    // scoped-assignment form).
    const memory = new TMemoryGlobal();
    new EaterAffectation(new StringLocated('!local = 5', LOC)).analyze(fakeContext(), memory);
    expect(memory.getVariable('local')?.toInt()).toBe(5);
  });

  it('a variable literally named "global" followed by ?= is also treated as unscoped', () => {
    const memory = new TMemoryGlobal();
    new EaterAffectation(new StringLocated('!global ?= 9', LOC)).analyze(fakeContext(), memory);
    expect(memory.getVariable('global')?.toInt()).toBe(9);
  });
});

describe('EaterAffectationDefine', () => {
  it('assigns the rest of the line, functions/variables applied, as a GLOBAL string', () => {
    const memory = new TMemoryGlobal();
    const ctx = fakeContext({ applyFunctionsAndVariables: () => 'resolved text' });
    new EaterAffectationDefine(new StringLocated('!define $x some raw text', LOC)).analyze(ctx, memory);
    expect(memory.getVariable('$x')?.toString()).toBe('resolved text');
  });
});

describe('EaterAssert', () => {
  it('passes silently when the expression is true', () => {
    const memory = new TMemoryGlobal();
    expect(() => new EaterAssert(new StringLocated('!assert 1', LOC)).analyze(fakeContext(), memory)).not.toThrow();
  });

  it('throws EaterException with a default message when false', () => {
    const memory = new TMemoryGlobal();
    expect(() => new EaterAssert(new StringLocated('!assert 0', LOC)).analyze(fakeContext(), memory)).toThrow(
      EaterException,
    );
    expect(() => new EaterAssert(new StringLocated('!assert 0', LOC)).analyze(fakeContext(), memory)).toThrow(
      'Assertion error',
    );
  });

  it('throws EaterException with the custom message after the colon when false', () => {
    const memory = new TMemoryGlobal();
    expect(() =>
      new EaterAssert(new StringLocated('!assert 0 : "custom failure"', LOC)).analyze(fakeContext(), memory),
    ).toThrow('Assertion error : custom failure');
  });
});

describe('EaterUndef', () => {
  it('removes a previously set variable', () => {
    const memory = new TMemoryGlobal();
    memory.putVariable('$x', TValue.fromInt(1), TVariableScope.GLOBAL, new StringLocated('', LOC));
    new EaterUndef(new StringLocated('!undef $x', LOC)).analyze(fakeContext(), memory);
    expect(memory.getVariable('$x')).toBeUndefined();
  });
});
