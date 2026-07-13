/**
 * Direct unit tests for the `ExecutionContextIf` / `ExecutionContextWhile`
 * / `ExecutionContextForeach` classes widened in `TMemory.ts` (batch 2b).
 * `TMemory.test.ts` (batch 2a) already exercises them indirectly via
 * `TMemoryGlobal`'s LIFO stacks; this file targets their own getters and
 * edge cases directly.
 */
import { describe, expect, it } from 'vitest';
import { ExecutionContextForeach, ExecutionContextIf, ExecutionContextWhile } from '../../../../src/core/tim/TMemory.js';
import { TokenStack } from '../../../../src/core/tim/expression/TokenStack.js';

describe('ExecutionContextIf', () => {
  it('a true !if is already "burnt" (some branch has fired)', () => {
    const ctx = ExecutionContextIf.fromValue(true);
    expect(ctx.conditionIsOkHere()).toBe(true);
    expect(ctx.hasBeenBurn()).toBe(true);
  });

  it('a false !if has not been burnt', () => {
    const ctx = ExecutionContextIf.fromValue(false);
    expect(ctx.hasBeenBurn()).toBe(false);
  });

  it('enteringElseIf resets the condition to false pending re-evaluation', () => {
    const ctx = ExecutionContextIf.fromValue(true);
    ctx.enteringElseIf();
    expect(ctx.conditionIsOkHere()).toBe(false);
  });

  it('nowInSomeElseIf sets true and marks burnt', () => {
    const ctx = ExecutionContextIf.fromValue(false);
    ctx.nowInSomeElseIf();
    expect(ctx.conditionIsOkHere()).toBe(true);
    expect(ctx.hasBeenBurn()).toBe(true);
  });

  it('nowInElse is true only when nothing was burnt yet', () => {
    const unburnt = ExecutionContextIf.fromValue(false);
    unburnt.nowInElse();
    expect(unburnt.conditionIsOkHere()).toBe(true);

    const burnt = ExecutionContextIf.fromValue(true);
    burnt.nowInElse();
    expect(burnt.conditionIsOkHere()).toBe(false);
  });

  it('setHasBeenBurn overrides the burnt flag directly', () => {
    const ctx = ExecutionContextIf.fromValue(false);
    ctx.setHasBeenBurn(true);
    expect(ctx.hasBeenBurn()).toBe(true);
  });
});

describe('ExecutionContextWhile', () => {
  it('exposes its start position and toString', () => {
    const ctx = ExecutionContextWhile.fromValue(new TokenStack(), { pos: 3 });
    expect(ctx.getStartWhile()).toEqual({ pos: 3 });
    expect(ctx.isSkipMe()).toBe(false);
    expect(ctx.toString()).toBe('[] [object Object]');
  });

  it('skipMe marks it skipped', () => {
    const ctx = ExecutionContextWhile.fromValue(new TokenStack(), { pos: 0 });
    ctx.skipMe();
    expect(ctx.isSkipMe()).toBe(true);
  });
});

describe('ExecutionContextForeach', () => {
  it('currentValue on an array source returns the element at the current index', () => {
    const ctx = ExecutionContextForeach.fromValue('$x', [10, 20, 30], { pos: 0 });
    expect(ctx.currentValue()).toBe(10);
    ctx.inc();
    expect(ctx.currentValue()).toBe(20);
  });

  it('currentValue on an object source returns the key at the current index', () => {
    const ctx = ExecutionContextForeach.fromValue('$k', { a: 1, b: 2 }, { pos: 0 });
    expect(ctx.currentValue()).toBe('a');
    ctx.inc();
    expect(ctx.currentValue()).toBe('b');
  });

  it('currentValue throws IllegalStateException for a non-container JsonValue', () => {
    const ctx = ExecutionContextForeach.fromValue('$x', 5, { pos: 0 });
    expect(() => ctx.currentValue()).toThrow('IllegalStateException');
  });

  it('inc marks skipMe once the index reaches the end', () => {
    const ctx = ExecutionContextForeach.fromValue('$x', [1, 2], { pos: 0 });
    expect(ctx.isSkipMe()).toBe(false);
    ctx.inc();
    expect(ctx.isSkipMe()).toBe(false);
    ctx.inc();
    expect(ctx.isSkipMe()).toBe(true);
  });

  it('skipMeNow marks it skipped directly', () => {
    const ctx = ExecutionContextForeach.fromValue('$x', [], { pos: 0 });
    ctx.skipMeNow();
    expect(ctx.isSkipMe()).toBe(true);
  });

  it('exposes varname, jsonValue, and startForeach', () => {
    const ctx = ExecutionContextForeach.fromValue('$k', [1], { pos: 7 });
    expect(ctx.getVarname()).toBe('$k');
    expect(ctx.getJsonValue()).toEqual([1]);
    expect(ctx.getStartForeach()).toEqual({ pos: 7 });
  });
});
