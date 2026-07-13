import { describe, expect, it } from 'vitest';
import { CodeIteratorImpl } from '../../../../../src/core/tim/iterator/CodeIteratorImpl.js';
import { CodeIteratorInnerComment } from '../../../../../src/core/tim/iterator/CodeIteratorInnerComment.js';
import { CodeIteratorLongComment } from '../../../../../src/core/tim/iterator/CodeIteratorLongComment.js';
import { CodeIteratorShortComment } from '../../../../../src/core/tim/iterator/CodeIteratorShortComment.js';
import type { StringLocated } from '../../../../../src/core/tim/StringLocated.js';
import { line } from '../../../../helpers/tim-iterator-context.js';

function drain(it: { peek(): StringLocated | null; next(): void }): string[] {
  const out: string[] = [];
  let s;
  while ((s = it.peek()) !== null) {
    out.push(s.getString());
    it.next();
  }
  return out;
}

describe('CodeIteratorInnerComment', () => {
  it('strips a leading /\'...\'/ inline comment', () => {
    const base = new CodeIteratorImpl([line("/' hidden '/ visible text")]);
    const it = new CodeIteratorInnerComment(base);
    expect(it.peek()?.getString()).toBe(' visible text');
  });

  it('strips a trailing /\'...\'/ inline comment', () => {
    const base = new CodeIteratorImpl([line("visible text /' hidden '/")]);
    const it = new CodeIteratorInnerComment(base);
    expect(it.peek()?.getString()).toBe('visible text ');
  });

  it('passes through a line with no inner comment unchanged', () => {
    const base = new CodeIteratorImpl([line('plain text')]);
    const it = new CodeIteratorInnerComment(base);
    expect(it.peek()?.getString()).toBe('plain text');
  });

  it('returns null past the end', () => {
    const base = new CodeIteratorImpl([]);
    const it = new CodeIteratorInnerComment(base);
    expect(it.peek()).toBeNull();
  });
});

describe('CodeIteratorShortComment', () => {
  it('skips COMMENT_SIMPLE lines and logs them', () => {
    const logs: StringLocated[] = [];
    const base = new CodeIteratorImpl([line("' a comment", 'COMMENT_SIMPLE'), line('real content')]);
    const it = new CodeIteratorShortComment(base, logs);
    expect(drain(it)).toEqual(['real content']);
    expect(logs.map((l) => l.getString())).toEqual(["' a comment"]);
  });
});

describe('CodeIteratorLongComment', () => {
  it('consumes everything between /\' and a line ending in \'/, logging both', () => {
    const logs: StringLocated[] = [];
    const base = new CodeIteratorImpl([
      line("/'", 'COMMENT_LONG_START'),
      line('block comment line 1'),
      line("end '/"),
      line('real content'),
    ]);
    const it = new CodeIteratorLongComment(base, logs);
    expect(drain(it)).toEqual(['real content']);
    // The COMMENT_LONG_START line itself is logged too -- upstream's own
    // inner while loop re-peeks the same line and, since it doesn't end
    // with "'/", logs and consumes it before the dedicated closing-line
    // check below runs.
    expect(logs.map((l) => l.getString())).toEqual(["/'", 'block comment line 1', "end '/"]);
  });

  it('passes through content with no long-comment start', () => {
    const logs: StringLocated[] = [];
    const base = new CodeIteratorImpl([line('plain')]);
    const it = new CodeIteratorLongComment(base, logs);
    expect(drain(it)).toEqual(['plain']);
  });
});
