import { describe, expect, it, vi } from 'vitest';
import { TMemoryGlobal } from '../../../../src/core/tim/TMemoryGlobal.js';
import { TMemoryLocal } from '../../../../src/core/tim/TMemoryLocal.js';
import { TVariableScope } from '../../../../src/core/tim/TVariableScope.js';
import { EaterException } from '../../../../src/core/tim/EaterException.js';
import { StringLocated } from '../../../../src/core/tim/StringLocated.js';
import { TValue } from '../../../../src/core/tim/expression/TValue.js';
import type { ExecutionContextIf } from '../../../../src/core/tim/TMemory.js';

const LOC = new StringLocated('!$x = 1', undefined);

describe('TMemoryGlobal', () => {
  it('stores and retrieves a plain (unscoped) variable', () => {
    const mem = new TMemoryGlobal();
    mem.putVariable('x', TValue.fromInt(3), undefined, LOC);
    expect(mem.getVariable('x')?.toInt()).toBe(3);
  });

  it('stores and retrieves a GLOBAL-scoped variable', () => {
    const mem = new TMemoryGlobal();
    mem.putVariable('x', TValue.fromInt(5), TVariableScope.GLOBAL, LOC);
    expect(mem.getVariable('x')?.toInt()).toBe(5);
  });

  it('rejects a LOCAL-scoped write at the global level', () => {
    const mem = new TMemoryGlobal();
    expect(() => mem.putVariable('x', TValue.fromInt(1), TVariableScope.LOCAL, LOC)).toThrow(EaterException);
    expect(() => mem.putVariable('x', TValue.fromInt(1), TVariableScope.LOCAL, LOC)).toThrow(
      'Cannot use local variable here',
    );
  });

  it('getVariable returns undefined for an unset name', () => {
    const mem = new TMemoryGlobal();
    expect(mem.getVariable('nope')).toBeUndefined();
  });

  it('removeVariable deletes a previously set variable', () => {
    const mem = new TMemoryGlobal();
    mem.putVariable('x', TValue.fromInt(1), undefined, LOC);
    mem.removeVariable('x');
    expect(mem.getVariable('x')).toBeUndefined();
  });

  it('isEmpty reflects whether any variable is set', () => {
    const mem = new TMemoryGlobal();
    expect(mem.isEmpty()).toBe(true);
    mem.putVariable('x', TValue.fromInt(1), undefined, LOC);
    expect(mem.isEmpty()).toBe(false);
  });

  it('variablesNames returns the set of declared names', () => {
    const mem = new TMemoryGlobal();
    mem.putVariable('a', TValue.fromInt(1), undefined, LOC);
    mem.putVariable('b', TValue.fromInt(2), undefined, LOC);
    expect(mem.variablesNames()).toEqual(new Set(['a', 'b']));
  });

  it('variablesNames3 supports longest-prefix lookup', () => {
    const mem = new TMemoryGlobal();
    mem.putVariable('$foo', TValue.fromInt(1), undefined, LOC);
    mem.putVariable('$foobar', TValue.fromInt(2), undefined, LOC);
    expect(mem.variablesNames3().getLonguestMatchStartingIn('$foobar', 0)).toBe('$foobar');
  });

  it('forkFromGlobal produces a TMemoryLocal seeded with the given bindings', () => {
    const mem = new TMemoryGlobal();
    const local = mem.forkFromGlobal(new Map([['p', TValue.fromInt(9)]]));
    expect(local).toBeInstanceOf(TMemoryLocal);
    expect(local.getVariable('p')?.toInt()).toBe(9);
  });

  it('dumpDebug logs without throwing', () => {
    const mem = new TMemoryGlobal();
    mem.putVariable('x', TValue.fromInt(1), undefined, LOC);
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    mem.dumpDebug('test');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('ExecutionContexts if-stack: add/peek/poll are LIFO', () => {
    const mem = new TMemoryGlobal();
    const ctxTrue: ExecutionContextIf = { conditionIsOkHere: () => true };
    const ctxFalse: ExecutionContextIf = { conditionIsOkHere: () => false };
    mem.addIf(ctxTrue);
    mem.addIf(ctxFalse);
    expect(mem.peekIf()).toBe(ctxFalse);
    expect(mem.pollIf()).toBe(ctxFalse);
    expect(mem.pollIf()).toBe(ctxTrue);
    expect(mem.pollIf()).toBeUndefined();
  });

  it('areAllIfOk is true only when every stacked if is currently true', () => {
    const mem = new TMemoryGlobal();
    expect(mem.areAllIfOk(undefined as never, mem)).toBe(true);
    mem.addIf({ conditionIsOkHere: () => true });
    expect(mem.areAllIfOk(undefined as never, mem)).toBe(true);
    mem.addIf({ conditionIsOkHere: () => false });
    expect(mem.areAllIfOk(undefined as never, mem)).toBe(false);
  });

  it('ExecutionContexts while/foreach stacks are also LIFO', () => {
    const mem = new TMemoryGlobal();
    mem.addWhile('w1');
    mem.addWhile('w2');
    expect(mem.peekWhile()).toBe('w2');
    expect(mem.pollWhile()).toBe('w2');
    expect(mem.pollWhile()).toBe('w1');

    mem.addForeach('f1');
    expect(mem.peekForeach()).toBe('f1');
    expect(mem.pollForeach()).toBe('f1');
  });
});

describe('TMemoryLocal', () => {
  function makeLocal(input: ReadonlyMap<string, TValue> = new Map()): { global: TMemoryGlobal; local: TMemoryLocal } {
    const global = new TMemoryGlobal();
    const local = new TMemoryLocal(global, input);
    return { global, local };
  }

  it('resolves a parameter binding passed in at fork time', () => {
    const { local } = makeLocal(new Map([['p', TValue.fromInt(7)]]));
    expect(local.getVariable('p')?.toInt()).toBe(7);
  });

  it('unscoped assignment to a name not yet global creates a local variable', () => {
    const { local, global } = makeLocal();
    local.putVariable('x', TValue.fromInt(1), undefined, LOC);
    expect(local.getVariable('x')?.toInt()).toBe(1);
    expect(global.getVariable('x')).toBeUndefined();
  });

  it('unscoped assignment to a name that already exists globally writes through to global', () => {
    const { local, global } = makeLocal();
    global.putVariable('x', TValue.fromInt(1), TVariableScope.GLOBAL, LOC);
    local.putVariable('x', TValue.fromInt(2), undefined, LOC);
    expect(global.getVariable('x')?.toInt()).toBe(2);
    expect(local.getVariable('x')?.toInt()).toBe(2);
  });

  it('GLOBAL-scoped assignment always writes through to the shared global memory', () => {
    const { local, global } = makeLocal();
    local.putVariable('x', TValue.fromInt(4), TVariableScope.GLOBAL, LOC);
    expect(global.getVariable('x')?.toInt()).toBe(4);
  });

  it('LOCAL-scoped assignment shadows a same-named global variable', () => {
    const { local, global } = makeLocal();
    global.putVariable('x', TValue.fromInt(1), TVariableScope.GLOBAL, LOC);
    local.putVariable('x', TValue.fromInt(2), TVariableScope.LOCAL, LOC);
    expect(local.getVariable('x')?.toInt()).toBe(2);
    expect(global.getVariable('x')?.toInt()).toBe(1);
  });

  it('getVariable resolution order is overridden > global > local', () => {
    const { local, global } = makeLocal(new Map([['x', TValue.fromInt(100)]]));
    global.putVariable('x', TValue.fromInt(200), TVariableScope.GLOBAL, LOC);
    // overridden (the forked-in parameter binding) wins over global.
    expect(local.getVariable('x')?.toInt()).toBe(100);
  });

  it('removeVariable removes from whichever tier currently holds the name', () => {
    const { local, global } = makeLocal(new Map([['ov', TValue.fromInt(1)]]));
    local.putVariable('loc', TValue.fromInt(2), undefined, LOC);
    global.putVariable('glob', TValue.fromInt(3), TVariableScope.GLOBAL, LOC);

    local.removeVariable('ov');
    expect(local.getVariable('ov')).toBeUndefined();

    local.removeVariable('loc');
    expect(local.getVariable('loc')).toBeUndefined();

    local.removeVariable('glob');
    expect(global.getVariable('glob')).toBeUndefined();
  });

  it('variablesNames3 combines overridden, global, and local tries by longest match', () => {
    const { local, global } = makeLocal(new Map([['$ov', TValue.fromInt(1)]]));
    global.putVariable('$globalvar', TValue.fromInt(1), TVariableScope.GLOBAL, LOC);
    local.putVariable('$localvar', TValue.fromInt(1), TVariableScope.LOCAL, LOC);

    const trie = local.variablesNames3();
    expect(trie.getLonguestMatchStartingIn('$ov rest', 0)).toBe('$ov');
    expect(trie.getLonguestMatchStartingIn('$globalvar rest', 0)).toBe('$globalvar');
    expect(trie.getLonguestMatchStartingIn('$localvar rest', 0)).toBe('$localvar');
    expect(() => trie.add('$new')).toThrow('UnsupportedOperationException');
  });

  it('isEmpty is true only when global, overridden, and local are all empty', () => {
    const { local } = makeLocal();
    expect(local.isEmpty()).toBe(true);
    local.putVariable('x', TValue.fromInt(1), undefined, LOC);
    expect(local.isEmpty()).toBe(false);
  });

  it('variablesNames is unsupported, matching upstream', () => {
    const { local } = makeLocal();
    expect(() => local.variablesNames()).toThrow('UnsupportedOperationException');
  });

  it('forkFromGlobal on a local memory forks a fresh local against the SAME global', () => {
    const { local, global } = makeLocal();
    const nested = local.forkFromGlobal(new Map([['q', TValue.fromInt(42)]]));
    expect(nested).toBeInstanceOf(TMemoryLocal);
    expect(nested.getVariable('q')?.toInt()).toBe(42);
    // Confirm it forked against the same global: a global write is visible.
    global.putVariable('shared', TValue.fromInt(1), TVariableScope.GLOBAL, LOC);
    expect(nested.getVariable('shared')?.toInt()).toBe(1);
  });

  it('dumpDebug logs without throwing', () => {
    const { local } = makeLocal(new Map([['ov', TValue.fromInt(1)]]));
    local.putVariable('loc', TValue.fromInt(2), undefined, LOC);
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    local.dumpDebug('test');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
