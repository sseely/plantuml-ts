import { describe, expect, it } from 'vitest';
import { EaterIf } from '../../../../src/core/tim/EaterIf.js';
import { EaterElseIf } from '../../../../src/core/tim/EaterElseIf.js';
import { EaterIfdef } from '../../../../src/core/tim/EaterIfdef.js';
import { EaterIfndef } from '../../../../src/core/tim/EaterIfndef.js';
import { StringLocated } from '../../../../src/core/tim/StringLocated.js';
import { TMemoryGlobal } from '../../../../src/core/tim/TMemoryGlobal.js';
import { TValue } from '../../../../src/core/tim/expression/TValue.js';
import { TVariableScope } from '../../../../src/core/tim/TVariableScope.js';
import { fakeContext } from '../../../helpers/tim-context.js';

const LOC = undefined;

describe('EaterIf', () => {
  it('evaluates a true numeric expression', () => {
    const e = new EaterIf(new StringLocated('!if 1', LOC));
    e.analyze(fakeContext(), new TMemoryGlobal());
    expect(e.isTrue()).toBe(true);
  });

  it('evaluates a false numeric expression', () => {
    const e = new EaterIf(new StringLocated('!if 0', LOC));
    e.analyze(fakeContext(), new TMemoryGlobal());
    expect(e.isTrue()).toBe(false);
  });
});

describe('EaterElseIf', () => {
  it('evaluates a true comparison expression', () => {
    const memory = new TMemoryGlobal();
    memory.putVariable('$x', TValue.fromInt(5), undefined, new StringLocated('', LOC));
    const e = new EaterElseIf(new StringLocated('!elseif $x > 3', LOC));
    e.analyze(fakeContext(), memory);
    expect(e.isTrue()).toBe(true);
  });

  it('evaluates a false comparison expression', () => {
    const memory = new TMemoryGlobal();
    memory.putVariable('$x', TValue.fromInt(1), undefined, new StringLocated('', LOC));
    const e = new EaterElseIf(new StringLocated('!elseif $x > 3', LOC));
    e.analyze(fakeContext(), memory);
    expect(e.isTrue()).toBe(false);
  });
});

describe('EaterIfdef', () => {
  it('is true when a plain variable name is set', () => {
    const memory = new TMemoryGlobal();
    memory.putVariable('foo', TValue.fromInt(1), undefined, new StringLocated('', LOC));
    const e = new EaterIfdef(new StringLocated('!ifdef foo', LOC));
    e.analyze(fakeContext(), memory);
    expect(e.isTrue(fakeContext(), memory)).toBe(true);
  });

  it('is false when the variable is unset and no function exists', () => {
    const memory = new TMemoryGlobal();
    const e = new EaterIfdef(new StringLocated('!ifdef bar', LOC));
    e.analyze(fakeContext(), memory);
    expect(e.isTrue(fakeContext(), memory)).toBe(false);
  });

  it('is true when a function with that name exists', () => {
    const memory = new TMemoryGlobal();
    const e = new EaterIfdef(new StringLocated('!ifdef myproc', LOC));
    e.analyze(fakeContext(), memory);
    const ctx = fakeContext({ doesFunctionExist: (name) => name === 'myproc' });
    expect(e.isTrue(ctx, memory)).toBe(true);
  });

  it('supports && / || / ! / parens over multiple names', () => {
    const memory = new TMemoryGlobal();
    memory.putVariable('a', TValue.fromInt(1), undefined, new StringLocated('', LOC));
    const e = new EaterIfdef(new StringLocated('!ifdef (a && !b) || c', LOC));
    e.analyze(fakeContext(), memory);
    expect(e.isTrue(fakeContext(), memory)).toBe(true);
  });
});

describe('EaterIfndef', () => {
  it('is true when the variable is unset', () => {
    const memory = new TMemoryGlobal();
    const e = new EaterIfndef(new StringLocated('!ifndef foo', LOC));
    e.analyze(fakeContext(), memory);
    expect(e.isTrue(fakeContext(), memory)).toBe(true);
  });

  it('is false when the variable is set', () => {
    const memory = new TMemoryGlobal();
    memory.putVariable('foo', TValue.fromInt(1), TVariableScope.GLOBAL, new StringLocated('', LOC));
    const e = new EaterIfndef(new StringLocated('!ifndef foo', LOC));
    e.analyze(fakeContext(), memory);
    expect(e.isTrue(fakeContext(), memory)).toBe(false);
  });

  it('is false when a function with that name exists', () => {
    const memory = new TMemoryGlobal();
    const e = new EaterIfndef(new StringLocated('!ifndef myproc', LOC));
    e.analyze(fakeContext(), memory);
    const ctx = fakeContext({ doesFunctionExist: (name) => name === 'myproc' });
    expect(e.isTrue(ctx, memory)).toBe(false);
  });
});
