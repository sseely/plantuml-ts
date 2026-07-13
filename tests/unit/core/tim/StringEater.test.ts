import { describe, expect, it } from 'vitest';
import { StringEater } from '../../../../src/core/tim/StringEater.js';
import { TMemoryGlobal } from '../../../../src/core/tim/TMemoryGlobal.js';
import type { TContext } from '../../../../src/core/tim/TFunction.js';

describe('StringEater', () => {
  it('feeds cursor primitives from a bare string with no source-line context', () => {
    const e = new StringEater('"hello"');
    expect(e.eatAndGetQuotedString()).toBe('hello');
  });

  it('getStringLocated returns a location carrying an undefined LineLocation', () => {
    const e = new StringEater('abc');
    expect(e.getStringLocated().getLocation()).toBeUndefined();
    expect(e.getStringLocated().getString()).toBe('abc');
  });

  it('analyze is intentionally unimplemented', () => {
    const e = new StringEater('abc');
    const context = {} as TContext;
    expect(() => e.analyze(context, new TMemoryGlobal())).toThrow('UnsupportedOperationException');
  });
});
