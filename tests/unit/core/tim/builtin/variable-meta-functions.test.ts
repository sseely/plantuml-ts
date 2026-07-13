import { describe, expect, it } from 'vitest';
import { TValue } from '../../../../../src/core/tim/expression/TValue.js';
import { TMemoryGlobal } from '../../../../../src/core/tim/TMemoryGlobal.js';
import { TVariableScope } from '../../../../../src/core/tim/TVariableScope.js';
import { FunctionExists } from '../../../../../src/core/tim/builtin/FunctionExists.js';
import { VariableExists } from '../../../../../src/core/tim/builtin/VariableExists.js';
import { GetVariableValue } from '../../../../../src/core/tim/builtin/GetVariableValue.js';
import { SetVariableValue } from '../../../../../src/core/tim/builtin/SetVariableValue.js';
import { Feature } from '../../../../../src/core/tim/builtin/Feature.js';
import { Xargs } from '../../../../../src/core/tim/builtin/Xargs.js';
import { Size } from '../../../../../src/core/tim/builtin/Size.js';
import { LOC, NO_MEMORY, NO_NAMED, fakeContext } from '../../../../helpers/tim-builtin.js';

describe('FunctionExists', () => {
  it('delegates to context.doesFunctionExist', () => {
    const ctx = fakeContext({ doesFunctionExist: (name: string) => name === '%foo' });
    const fn = new FunctionExists();
    expect(fn.executeReturnFunction(ctx, undefined, LOC, [TValue.fromString('%foo')], NO_NAMED).toBoolean()).toBe(true);
    expect(fn.executeReturnFunction(ctx, undefined, LOC, [TValue.fromString('%bar')], NO_NAMED).toBoolean()).toBe(
      false,
    );
  });
});

describe('VariableExists / GetVariableValue / SetVariableValue', () => {
  it('VariableExists reflects binding state', () => {
    const memory = new TMemoryGlobal();
    const fn = new VariableExists();
    expect(fn.executeReturnFunction(fakeContext(), memory, LOC, [TValue.fromString('x')], NO_NAMED).toBoolean()).toBe(
      false,
    );
    memory.putVariable('x', TValue.fromInt(1), TVariableScope.GLOBAL, LOC);
    expect(fn.executeReturnFunction(fakeContext(), memory, LOC, [TValue.fromString('x')], NO_NAMED).toBoolean()).toBe(
      true,
    );
  });

  it('GetVariableValue returns "" for an unbound name', () => {
    const memory = new TMemoryGlobal();
    const fn = new GetVariableValue();
    expect(
      fn.executeReturnFunction(fakeContext(), memory, LOC, [TValue.fromString('missing')], NO_NAMED).toString(),
    ).toBe('');
  });

  it('GetVariableValue returns the bound value', () => {
    const memory = new TMemoryGlobal();
    memory.putVariable('x', TValue.fromInt(7), TVariableScope.GLOBAL, LOC);
    const fn = new GetVariableValue();
    expect(fn.executeReturnFunction(fakeContext(), memory, LOC, [TValue.fromString('x')], NO_NAMED).toInt()).toBe(7);
  });

  it('SetVariableValue writes globally and returns ""', () => {
    const memory = new TMemoryGlobal();
    const fn = new SetVariableValue();
    const result = fn.executeReturnFunction(
      fakeContext(),
      memory,
      LOC,
      [TValue.fromString('y'), TValue.fromInt(99)],
      NO_NAMED,
    );
    expect(result.toString()).toBe('');
    expect(memory.getVariable('y')?.toInt()).toBe(99);
  });
});

describe('Feature', () => {
  it('recognizes "style" and "theme" (case-insensitively)', () => {
    const fn = new Feature();
    expect(
      fn.executeReturnFunction(fakeContext(), undefined, LOC, [TValue.fromString('STYLE')], NO_NAMED).toInt(),
    ).toBe(1);
    expect(
      fn.executeReturnFunction(fakeContext(), undefined, LOC, [TValue.fromString('theme')], NO_NAMED).toInt(),
    ).toBe(1);
  });
  it('returns 0 for anything else', () => {
    const fn = new Feature();
    expect(
      fn.executeReturnFunction(fakeContext(), undefined, LOC, [TValue.fromString('unknown')], NO_NAMED).toInt(),
    ).toBe(0);
  });
});

describe('Xargs', () => {
  it('returns the bound xargs string', () => {
    const ctx = fakeContext({ getXargs: () => 'a b c' });
    expect(new Xargs().executeReturnFunction(ctx, NO_MEMORY, LOC, [], NO_NAMED).toString()).toBe('a b c');
  });
  it('returns "" when no xargs is bound', () => {
    const ctx = fakeContext({ getXargs: () => undefined });
    expect(new Xargs().executeReturnFunction(ctx, NO_MEMORY, LOC, [], NO_NAMED).toString()).toBe('');
  });
});

describe('Size', () => {
  it('is 0 for a number', () => {
    expect(new Size().executeReturnFunction(fakeContext(), undefined, LOC, [TValue.fromInt(5)], NO_NAMED).toInt()).toBe(
      0,
    );
  });
  it('is the string length for a string', () => {
    expect(
      new Size().executeReturnFunction(fakeContext(), undefined, LOC, [TValue.fromString('hello')], NO_NAMED).toInt(),
    ).toBe(5);
  });
  it('is the element count for a JSON array', () => {
    expect(
      new Size().executeReturnFunction(fakeContext(), undefined, LOC, [TValue.fromJson([1, 2, 3])], NO_NAMED).toInt(),
    ).toBe(3);
  });
  it('is the key count for a JSON object', () => {
    expect(
      new Size()
        .executeReturnFunction(fakeContext(), undefined, LOC, [TValue.fromJson({ a: 1, b: 2 })], NO_NAMED)
        .toInt(),
    ).toBe(2);
  });
  it('is 0 for a JSON scalar (a JSON value that is neither array nor object)', () => {
    expect(
      new Size().executeReturnFunction(fakeContext(), undefined, LOC, [TValue.fromJson('hello')], NO_NAMED).toInt(),
    ).toBe(0);
  });
});
