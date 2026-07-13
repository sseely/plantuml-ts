import { describe, expect, it } from 'vitest';
import { EaterException, TFunctionSignature } from '../../../../../src/core/tim/expression/index.js';
import { LineLocationImpl } from '../../../../../src/core/tim/LineLocationImpl.js';

describe('EaterException', () => {
  const location = { getLocation: () => new LineLocationImpl('string', undefined).oneLineRead() };

  it('carries a message accessible via getMessage() and the standard Error API', () => {
    const err = new EaterException('bad token', location);
    expect(err.getMessage()).toBe('bad token');
    expect(err.message).toBe('bad token');
  });

  it('carries the originating location', () => {
    const err = new EaterException('bad token', location);
    expect(err.getLocation()).toBe(location);
  });

  it('is a real Error subclass, catchable by instanceof', () => {
    const err = new EaterException('bad token', location);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('EaterException');
  });
});

describe('TFunctionSignature', () => {
  it('exposes name, arg count, and named arguments', () => {
    const sig = new TFunctionSignature('foo', 2, new Set(['a', 'b']));
    expect(sig.getFunctionName()).toBe('foo');
    expect(sig.getNbArg()).toBe(2);
    expect(sig.getNamedArguments()).toEqual(new Set(['a', 'b']));
  });

  it('defaults named arguments to an empty set', () => {
    const sig = new TFunctionSignature('foo', 1);
    expect(sig.getNamedArguments().size).toBe(0);
  });

  it('sameFunctionNameAs compares only the function name, not arity', () => {
    const foo1 = new TFunctionSignature('foo', 1);
    const foo2 = new TFunctionSignature('foo', 2);
    const bar1 = new TFunctionSignature('bar', 1);
    expect(foo1.sameFunctionNameAs(foo2)).toBe(true);
    expect(foo1.sameFunctionNameAs(bar1)).toBe(false);
  });

  it('toString renders name/arity and named arguments', () => {
    const sig = new TFunctionSignature('foo', 2, new Set(['a']));
    expect(sig.toString()).toBe('foo/2 [a]');
  });
});
