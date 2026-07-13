import { describe, expect, it } from 'vitest';
import { CodeIteratorImpl } from '../../../../../src/core/tim/iterator/CodeIteratorImpl.js';
import { EaterException } from '../../../../../src/core/tim/EaterException.js';
import { line } from '../../../../helpers/tim-iterator-context.js';

describe('CodeIteratorImpl', () => {
  it('peek returns the current line without consuming it', () => {
    const it = new CodeIteratorImpl([line('a'), line('b')]);
    expect(it.peek()?.getString()).toBe('a');
    expect(it.peek()?.getString()).toBe('a');
  });

  it('next advances the cursor', () => {
    const it = new CodeIteratorImpl([line('a'), line('b')]);
    it.next();
    expect(it.peek()?.getString()).toBe('b');
  });

  it('peek returns null past the end of the list', () => {
    const it = new CodeIteratorImpl([line('a')]);
    it.next();
    expect(it.peek()).toBeNull();
  });

  it('next throws once already at the end', () => {
    const it = new CodeIteratorImpl([line('a')]);
    it.next();
    expect(() => it.next()).toThrow('IllegalStateException');
  });

  it('getCodePosition + jumpToCodePosition round-trip back to an earlier line', () => {
    const it = new CodeIteratorImpl([line('a'), line('b'), line('c')]);
    const start = it.getCodePosition();
    it.next();
    it.next();
    expect(it.peek()?.getString()).toBe('c');
    it.jumpToCodePosition(start, line('irrelevant'));
    expect(it.peek()?.getString()).toBe('a');
  });

  it('jumpToCodePosition throws EaterException after 999 jumps ("Infinite loop?")', () => {
    const it = new CodeIteratorImpl([line('a')]);
    const start = it.getCodePosition();
    expect(() => {
      for (let i = 0; i < 1000; i++) it.jumpToCodePosition(start, line('x'));
    }).toThrow(EaterException);
    expect(() => it.jumpToCodePosition(start, line('x'))).toThrow('Infinite loop?');
  });
});
