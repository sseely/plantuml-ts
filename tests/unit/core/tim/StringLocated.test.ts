import { describe, expect, it } from 'vitest';
import { StringLocated } from '../../../../src/core/tim/StringLocated.js';

describe('StringLocated', () => {
  it('exposes the wrapped string and location', () => {
    const sl = new StringLocated('!return 3', 'loc-1');
    expect(sl.getString()).toBe('!return 3');
    expect(sl.getLocation()).toBe('loc-1');
  });

  it('length() and charAt() delegate to the wrapped string', () => {
    const sl = new StringLocated('abc', undefined);
    expect(sl.length()).toBe(3);
    expect(sl.charAt(1)).toBe('b');
  });

  it('getType() defaults to PLAIN when no type was supplied at construction', () => {
    const sl = new StringLocated('some line', undefined);
    expect(sl.getType()).toBe('PLAIN');
  });

  it('getType() returns the explicitly-supplied classification', () => {
    const sl = new StringLocated('!return 3', undefined, 'RETURN');
    expect(sl.getType()).toBe('RETURN');
  });
});
