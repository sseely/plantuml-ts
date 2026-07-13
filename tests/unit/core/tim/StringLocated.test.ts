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
describe('StringLocated#getTrimmed (batch 2b addition)', () => {
  it('returns the same instance when already trimmed', () => {
    const sl = new StringLocated('no-padding', undefined);
    expect(sl.getTrimmed()).toBe(sl);
  });

  it('returns the same instance for an empty string', () => {
    const sl = new StringLocated('', undefined);
    expect(sl.getTrimmed()).toBe(sl);
  });

  it('strips leading whitespace', () => {
    const sl = new StringLocated('   leading', undefined);
    expect(sl.getTrimmed().getString()).toBe('leading');
  });

  it('strips trailing whitespace', () => {
    const sl = new StringLocated('trailing   ', undefined);
    expect(sl.getTrimmed().getString()).toBe('trailing');
  });

  it('strips both leading and trailing whitespace, preserving interior spaces', () => {
    const sl = new StringLocated('  a b c  ', undefined);
    expect(sl.getTrimmed().getString()).toBe('a b c');
  });

  it('a string of only whitespace trims to empty', () => {
    const sl = new StringLocated('   ', undefined);
    expect(sl.getTrimmed().getString()).toBe('');
  });
});

describe('StringLocated#append (batch 2b addition)', () => {
  it('concatenates and preserves the location', () => {
    const sl = new StringLocated('abc', 'loc-1');
    const appended = sl.append('def');
    expect(appended.getString()).toBe('abcdef');
    expect(appended.getLocation()).toBe('loc-1');
  });
});

describe('StringLocated#removeInnerComment (batch 2b addition)', () => {
  it('strips a leading /\'...\'/ comment', () => {
    const sl = new StringLocated("/' hidden '/ rest", undefined);
    expect(sl.removeInnerComment().getString()).toBe(' rest');
  });

  it('strips a trailing /\'...\'/ comment', () => {
    const sl = new StringLocated("rest /' hidden '/", undefined);
    expect(sl.removeInnerComment().getString()).toBe('rest ');
  });

  it('strips a triple-quoted /\'\'\'...\'\'\'/ fenced comment', () => {
    const sl = new StringLocated("before /'''note'''/ after", undefined);
    expect(sl.removeInnerComment().getString()).toBe('before  after');
  });

  it('returns the same instance when there is no inner comment', () => {
    const sl = new StringLocated('plain content', undefined);
    expect(sl.removeInnerComment()).toBe(sl);
  });
});
