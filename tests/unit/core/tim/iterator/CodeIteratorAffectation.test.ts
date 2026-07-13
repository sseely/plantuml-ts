import { describe, expect, it } from 'vitest';
import { CodeIteratorAffectation } from '../../../../../src/core/tim/iterator/CodeIteratorAffectation.js';
import { CodeIteratorImpl } from '../../../../../src/core/tim/iterator/CodeIteratorImpl.js';
import { EaterException } from '../../../../../src/core/tim/EaterException.js';
import { TMemoryGlobal } from '../../../../../src/core/tim/TMemoryGlobal.js';
import { fakeContext, line } from '../../../../helpers/tim-iterator-context.js';

describe('CodeIteratorAffectation', () => {
  it('passes through non-AFFECTATION lines unchanged', () => {
    const base = new CodeIteratorImpl([line('plain content')]);
    const it = new CodeIteratorAffectation(base, fakeContext(), new TMemoryGlobal(), []);
    expect(it.peek()?.getString()).toBe('plain content');
  });

  it('executes a single-line JSON affectation directly', () => {
    const memory = new TMemoryGlobal();
    const base = new CodeIteratorImpl([line('!$obj = {"a": 1}', 'AFFECTATION')]);
    const it = new CodeIteratorAffectation(base, fakeContext(), memory, []);
    expect(it.peek()).toBeNull();
    expect(memory.getVariable('$obj')?.toJson()).toEqual({ a: 1 });
  });

  it('retries across multiple lines when a JSON literal spans several source lines', () => {
    const memory = new TMemoryGlobal();
    const base = new CodeIteratorImpl([
      line('!$obj = {', 'AFFECTATION'),
      line('"a": 1,'),
      line('"b": 2', ),
      line('}'),
      line('next content'),
    ]);
    const it = new CodeIteratorAffectation(base, fakeContext(), memory, []);
    expect(it.peek()?.getString()).toBe('next content');
    expect(memory.getVariable('$obj')?.toJson()).toEqual({ a: 1, b: 2 });
  });

  it('throws EaterException when the source is exhausted before the JSON becomes valid', () => {
    function freshIterator(): CodeIteratorAffectation {
      const base = new CodeIteratorImpl([line('!$obj = {"a":', 'AFFECTATION')]);
      return new CodeIteratorAffectation(base, fakeContext(), new TMemoryGlobal(), []);
    }
    expect(() => freshIterator().peek()).toThrow(EaterException);
    expect(() => freshIterator().peek()).toThrow('Error in JSON format');
  });

  it('a genuine EaterException (not a JSON parse error) propagates without retrying', () => {
    const base = new CodeIteratorImpl([line('!$obj', 'AFFECTATION')]);
    const it = new CodeIteratorAffectation(base, fakeContext(), new TMemoryGlobal(), []);
    // Missing "=" -- checkAndEatChar('=') throws EaterException, which is
    // not a SyntaxError, so the JSON-continuation retry loop must not
    // intercept it.
    expect(() => it.peek()).toThrow(EaterException);
  });
});
