/**
 * The sync include seam's data types: the store itself, the `<bundle/thing>`
 * helpers, and the two typed errors that replaced the old silent skip.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/TContext.java#executeInclude
 */
import { describe, expect, it } from 'vitest';
import {
  EMPTY_INCLUDE_STORE,
  IncludeNotFoundError,
  MapIncludeStore,
  StdlibNotBundledError,
  stdlibBundleOf,
  stdlibPathOf,
} from '../../../../src/core/tim/IncludeStore.js';

describe('MapIncludeStore', () => {
  it('is empty when constructed with no entries', () => {
    const store = new MapIncludeStore();
    expect(store.size).toBe(0);
    expect(store.get('a')).toBeUndefined();
    expect(store.has('a')).toBe(false);
  });

  it('accepts a record of entries', () => {
    const store = new MapIncludeStore({ 'a.puml': 'A', 'b.puml': 'B' });
    expect(store.get('a.puml')).toBe('A');
    expect(store.get('b.puml')).toBe('B');
    expect(store.size).toBe(2);
    expect(store.keys()).toEqual(['a.puml', 'b.puml']);
  });

  it('accepts an iterable of pairs', () => {
    const store = new MapIncludeStore([['a', 'A'] as const]);
    expect(store.get('a')).toBe('A');
  });

  it('accepts a Map', () => {
    const store = new MapIncludeStore(new Map([['a', 'A']]));
    expect(store.get('a')).toBe('A');
  });

  it('set() adds an entry after construction', () => {
    const store = new MapIncludeStore();
    store.set('late.puml', 'LATE');
    expect(store.get('late.puml')).toBe('LATE');
    expect(store.has('late.puml')).toBe(true);
  });

  it('serves an angle-bracket target from a de-bracketed key', () => {
    const store = new MapIncludeStore({ 'c4/C4.puml': 'C4' });
    expect(store.get('<c4/C4.puml>')).toBe('C4');
    expect(store.has('<c4/C4.puml>')).toBe(true);
  });

  it('prefers an exact angle-bracket key over the de-bracketed one', () => {
    const store = new MapIncludeStore({ '<c4/C4.puml>': 'BRACKETED', 'c4/C4.puml': 'BARE' });
    expect(store.get('<c4/C4.puml>')).toBe('BRACKETED');
  });

  it('does not serve a bare key from an angle-bracket entry', () => {
    const store = new MapIncludeStore({ '<c4/C4.puml>': 'C4' });
    expect(store.get('c4/C4.puml')).toBeUndefined();
  });
});

describe('EMPTY_INCLUDE_STORE', () => {
  it('resolves nothing', () => {
    expect(EMPTY_INCLUDE_STORE.get('anything')).toBeUndefined();
    expect(EMPTY_INCLUDE_STORE.has('anything')).toBe(false);
  });
});

describe('stdlibPathOf', () => {
  it('unwraps the <bundle/path> form', () => {
    expect(stdlibPathOf('<tupadr3/common>')).toBe('tupadr3/common');
  });

  it('returns undefined for a plain path', () => {
    expect(stdlibPathOf('common.puml')).toBeUndefined();
  });

  it('returns undefined for a URL', () => {
    expect(stdlibPathOf('https://example.com/a.puml')).toBeUndefined();
  });

  it('returns undefined for the degenerate <>', () => {
    expect(stdlibPathOf('<>')).toBeUndefined();
  });
});

describe('stdlibBundleOf', () => {
  it('takes the first path segment', () => {
    expect(stdlibBundleOf('awslib14/Storage/SimpleStorageService')).toBe('awslib14');
  });

  it('returns the whole path when there is no separator', () => {
    expect(stdlibBundleOf('bootstrap')).toBe('bootstrap');
  });
});

describe('IncludeNotFoundError', () => {
  it('names the path and the store', () => {
    const err = new IncludeNotFoundError('missing.puml');
    expect(err.name).toBe('IncludeNotFoundError');
    expect(err.path).toBe('missing.puml');
    expect(err.message).toContain('missing.puml');
    expect(err.message).toContain('includeStore');
  });

  it('names the directive it came from', () => {
    expect(new IncludeNotFoundError('x', '!includesub').message).toContain('!includesub');
  });
});

describe('StdlibNotBundledError', () => {
  it('names the bundle a host must supply', () => {
    const err = new StdlibNotBundledError('<tupadr3/font-awesome/star>', 'tupadr3/font-awesome/star');
    expect(err.name).toBe('StdlibNotBundledError');
    expect(err.bundle).toBe('tupadr3');
    expect(err.path).toBe('tupadr3/font-awesome/star');
    expect(err.message).toContain('tupadr3');
    expect(err.message).toContain('includeStore');
  });
});
