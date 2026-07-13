import { describe, expect, it } from 'vitest';
import { CodeIteratorImpl } from '../../../../../src/core/tim/iterator/CodeIteratorImpl.js';
import { CodeIteratorSub } from '../../../../../src/core/tim/iterator/CodeIteratorSub.js';
import { EaterException } from '../../../../../src/core/tim/EaterException.js';
import { TMemoryGlobal } from '../../../../../src/core/tim/TMemoryGlobal.js';
import { fakeContext, line } from '../../../../helpers/tim-iterator-context.js';
import type { Sub } from '../../../../../src/core/tim/iterator/index.js';

describe('CodeIteratorSub', () => {
  it('captures lines between !startsub and !endsub, and replays them in place', () => {
    const base = new CodeIteratorImpl([
      line('before'),
      line('!startsub BLOCK', 'STARTSUB'),
      line('captured line 1'),
      line('captured line 2'),
      line('!endsub', 'ENDSUB'),
      line('after'),
    ]);
    const subs = new Map<string, Sub>();
    const it = new CodeIteratorSub(base, subs, fakeContext(), new TMemoryGlobal());

    expect(it.peek()?.getString()).toBe('before');
    it.next();
    // The !startsub block's lines are replayed in place, not skipped.
    expect(it.peek()?.getString()).toBe('captured line 1');
    it.next();
    expect(it.peek()?.getString()).toBe('captured line 2');
    it.next();
    expect(it.peek()?.getString()).toBe('after');

    expect([...it.getSubs().keys()]).toEqual(['BLOCK']);
    expect(it.getSubs().get('BLOCK')!.lines().map((l) => l.getString())).toEqual([
      'captured line 1',
      'captured line 2',
    ]);
  });

  it('throws EaterException on a nested !startsub', () => {
    function freshIterator(): CodeIteratorSub {
      const base = new CodeIteratorImpl([
        line('!startsub OUTER', 'STARTSUB'),
        line('!startsub INNER', 'STARTSUB'),
        line('!endsub', 'ENDSUB'),
      ]);
      return new CodeIteratorSub(base, new Map(), fakeContext(), new TMemoryGlobal());
    }
    expect(() => freshIterator().peek()).toThrow(EaterException);
    expect(() => freshIterator().peek()).toThrow('Cannot nest sub');
  });

  it('returns null past the end with no sub blocks', () => {
    const base = new CodeIteratorImpl([]);
    const it = new CodeIteratorSub(base, new Map(), fakeContext(), new TMemoryGlobal());
    expect(it.peek()).toBeNull();
  });

  it('a captured Sub has a readable toString', () => {
    const base = new CodeIteratorImpl([
      line('!startsub NAMED', 'STARTSUB'),
      line('!endsub', 'ENDSUB'),
    ]);
    const it = new CodeIteratorSub(base, new Map<string, Sub>(), fakeContext(), new TMemoryGlobal());
    it.peek();
    expect(it.getSubs().get('NAMED')!.toString()).toBe('Sub NAMED');
  });
});
