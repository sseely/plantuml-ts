import { describe, expect, it } from 'vitest';
import { TFunctionSignature } from '../../../../src/core/tim/TFunctionSignature.js';

describe('TFunctionSignature', () => {
  it('hashCode is stable across calls (memoized)', () => {
    const sig = new TFunctionSignature('foo', 2);
    const h1 = sig.hashCode();
    const h2 = sig.hashCode();
    expect(h1).toBe(h2);
  });

  it('hashCode depends on function name and arity, not named arguments', () => {
    const a = new TFunctionSignature('foo', 2, new Set(['x']));
    const b = new TFunctionSignature('foo', 2, new Set(['y', 'z']));
    expect(a.hashCode()).toBe(b.hashCode());
  });

  it('hashCode differs for different names or arities', () => {
    const foo2 = new TFunctionSignature('foo', 2);
    const foo3 = new TFunctionSignature('foo', 3);
    const bar2 = new TFunctionSignature('bar', 2);
    expect(foo2.hashCode()).not.toBe(foo3.hashCode());
    expect(foo2.hashCode()).not.toBe(bar2.hashCode());
  });

  it('equals compares function name and arity, ignoring named arguments', () => {
    const a = new TFunctionSignature('foo', 2, new Set(['x']));
    const b = new TFunctionSignature('foo', 2, new Set(['y']));
    const c = new TFunctionSignature('foo', 3);
    const d = new TFunctionSignature('bar', 2);
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
    expect(a.equals(d)).toBe(false);
  });
});
