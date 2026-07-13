import { describe, expect, it } from 'vitest';
import { EaterForeach, size } from '../../../../src/core/tim/EaterForeach.js';
import { EaterWhile } from '../../../../src/core/tim/EaterWhile.js';
import { StringLocated } from '../../../../src/core/tim/StringLocated.js';
import { TMemoryGlobal } from '../../../../src/core/tim/TMemoryGlobal.js';
import { fakeContext } from '../../../helpers/tim-context.js';

const LOC = undefined;

describe('EaterForeach', () => {
  it('parses a JSON array literal and exposes it', () => {
    const e = new EaterForeach(new StringLocated('!foreach $x in [1,2,3]', LOC));
    e.analyze(fakeContext(), new TMemoryGlobal());
    expect(e.getVarname()).toBe('$x');
    expect(e.getJsonValue()).toEqual([1, 2, 3]);
    expect(e.isSkip()).toBe(false);
  });

  it('isSkip is true for an empty array', () => {
    const e = new EaterForeach(new StringLocated('!foreach $x in []', LOC));
    e.analyze(fakeContext(), new TMemoryGlobal());
    expect(e.isSkip()).toBe(true);
  });

  it('isSkip is true for an empty object', () => {
    const e = new EaterForeach(new StringLocated('!foreach $x in {}', LOC));
    e.analyze(fakeContext(), new TMemoryGlobal());
    expect(e.isSkip()).toBe(true);
  });

  it('accepts an object literal, iterated by key', () => {
    const e = new EaterForeach(new StringLocated('!foreach $k in {"a":1,"b":2}', LOC));
    e.analyze(fakeContext(), new TMemoryGlobal());
    expect(e.getJsonValue()).toEqual({ a: 1, b: 2 });
    expect(size(e.getJsonValue())).toBe(2);
  });

  it('size() throws for a non-container JsonValue', () => {
    expect(() => size(5)).toThrow('IllegalArgumentException');
  });
});

describe('EaterWhile', () => {
  it('captures the condition expression as a TokenStack', () => {
    const e = new EaterWhile(new StringLocated('!while $n < 3', LOC));
    e.analyze(fakeContext(), new TMemoryGlobal());
    expect(e.getWhileExpression().size()).toBeGreaterThan(0);
  });
});
