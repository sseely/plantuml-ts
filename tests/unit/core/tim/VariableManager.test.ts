import { describe, expect, it, vi } from 'vitest';
import { VariableManager } from '../../../../src/core/tim/VariableManager.js';
import { TMemoryGlobal } from '../../../../src/core/tim/TMemoryGlobal.js';
import { TVariableScope } from '../../../../src/core/tim/TVariableScope.js';
import { StringLocated } from '../../../../src/core/tim/StringLocated.js';
import { EaterException } from '../../../../src/core/tim/EaterException.js';
import { TValue } from '../../../../src/core/tim/expression/TValue.js';
import type { TContext } from '../../../../src/core/tim/TFunction.js';

const LOC = new StringLocated('!$x = 1', undefined);

/** Echoes the bracket-index text back verbatim -- sufficient for exercising
 * `replaceJson`'s bracket-access branch without a real interpreter. */
function identityContext(): TContext {
  return {
    asKnowledge: vi.fn(),
    executeLines: vi.fn(),
    applyFunctionsAndVariables: vi.fn((_memory, located: StringLocated) => located.getString()),
    doesFunctionExist: vi.fn().mockReturnValue(false),
    getPreprocessingArtifact: vi.fn().mockReturnValue({
      addWarning: vi.fn(),
      getOption: vi.fn().mockReturnValue({ define: vi.fn() }),
    }),
  };
}

describe('VariableManager#getVarnameAt', () => {
  it('finds a declared variable at the given position', () => {
    const memory = new TMemoryGlobal();
    memory.putVariable('$foo', TValue.fromInt(1), TVariableScope.GLOBAL, LOC);
    const vm = new VariableManager(identityContext(), memory, LOC);
    expect(vm.getVarnameAt('$foo bar', 0)).toBe('$foo');
  });

  it('returns undefined when no variable starts at the position', () => {
    const memory = new TMemoryGlobal();
    const vm = new VariableManager(identityContext(), memory, LOC);
    expect(vm.getVarnameAt('$unknown', 0)).toBeUndefined();
  });

  it('rejects a partial trie match not followed by a name boundary', () => {
    const memory = new TMemoryGlobal();
    memory.putVariable('$foo', TValue.fromInt(1), TVariableScope.GLOBAL, LOC);
    const vm = new VariableManager(identityContext(), memory, LOC);
    // Only "$foo" is declared, not "$foobar" -- the trie's longest match is
    // "$foo", but the next char ('b') continues an identifier, so this must
    // NOT be treated as a variable reference.
    expect(vm.getVarnameAt('$foobar', 0)).toBeUndefined();
  });

  it('matches when the trie match is immediately followed by a non-identifier character', () => {
    const memory = new TMemoryGlobal();
    memory.putVariable('$foo', TValue.fromInt(1), TVariableScope.GLOBAL, LOC);
    const vm = new VariableManager(identityContext(), memory, LOC);
    expect(vm.getVarnameAt('$foo!bar', 0)).toBe('$foo');
  });

  it('matches at end of string', () => {
    const memory = new TMemoryGlobal();
    memory.putVariable('$foo', TValue.fromInt(1), TVariableScope.GLOBAL, LOC);
    const vm = new VariableManager(identityContext(), memory, LOC);
    expect(vm.getVarnameAt('$foo', 0)).toBe('$foo');
  });

  it('allows a $-led match immediately after a letter (the $ itself is not a letter)', () => {
    const memory = new TMemoryGlobal();
    memory.putVariable('$foo', TValue.fromInt(1), TVariableScope.GLOBAL, LOC);
    const vm = new VariableManager(identityContext(), memory, LOC);
    expect(vm.getVarnameAt('a$foo', 1)).toBe('$foo');
  });
});

describe('VariableManager.justAfterBackslashN', () => {
  it('is true exactly two positions after a literal \\n', () => {
    expect(VariableManager.justAfterBackslashN('\\n$x', 2)).toBe(true);
    expect(VariableManager.justAfterBackslashN('$x', 1)).toBe(false);
  });
});

describe('VariableManager#replaceVariables', () => {
  it('substitutes a plain (non-JSON) value and returns the new cursor position', () => {
    const memory = new TMemoryGlobal();
    memory.putVariable('$x', TValue.fromInt(5), TVariableScope.GLOBAL, LOC);
    const vm = new VariableManager(identityContext(), memory, LOC);
    const result = { value: 'before ' };
    const str = 'before $x after';
    const newPos = vm.replaceVariables(str, 7, result);
    expect(result.value).toBe('before 5');
    expect(newPos).toBe(8);
  });

  it('strips a trailing "##" disambiguation marker already in the accumulated result', () => {
    const memory = new TMemoryGlobal();
    memory.putVariable('$x', TValue.fromInt(1), TVariableScope.GLOBAL, LOC);
    const vm = new VariableManager(identityContext(), memory, LOC);
    const result = { value: 'prefix##' };
    vm.replaceVariables('$x', 0, result);
    expect(result.value).toBe('prefix1');
  });

  it('consumes a trailing "##" marker following the variable in the source text', () => {
    const memory = new TMemoryGlobal();
    memory.putVariable('$x', TValue.fromInt(1), TVariableScope.GLOBAL, LOC);
    const vm = new VariableManager(identityContext(), memory, LOC);
    const result = { value: '' };
    const newPos = vm.replaceVariables('$x##rest', 0, result);
    expect(result.value).toBe('1');
    expect(newPos).toBe(3);
  });

  it('throws if the variable at the position is not present in memory', () => {
    const memory = new TMemoryGlobal();
    const vm = new VariableManager(identityContext(), memory, LOC);
    // getVarnameAt won't even find "$x" (never declared), so exercise the
    // "declared name but memory lookup fails" branch is not directly
    // reachable from getVarnameAt's own guard; assert the documented
    // contract instead: replaceVariables requires a variable at `i`.
    expect(() => vm.replaceVariables('$x', 0, { value: '' })).toThrow();
  });

  it('substitutes a top-level JSON string value verbatim', () => {
    const memory = new TMemoryGlobal();
    memory.putVariable('$s', TValue.fromJson('hi'), TVariableScope.GLOBAL, LOC);
    const vm = new VariableManager(identityContext(), memory, LOC);
    const result = { value: '' };
    vm.replaceVariables('$s', 0, result);
    expect(result.value).toBe('hi');
  });

  it('substitutes a top-level JSON number value via its string form', () => {
    const memory = new TMemoryGlobal();
    memory.putVariable('$n', TValue.fromJson(42), TVariableScope.GLOBAL, LOC);
    const vm = new VariableManager(identityContext(), memory, LOC);
    const result = { value: '' };
    vm.replaceVariables('$n', 0, result);
    expect(result.value).toBe('42');
  });
});

describe('VariableManager#replaceVariables JSON field/index access', () => {
  it('resolves a dot-access field on a JSON object variable', () => {
    const memory = new TMemoryGlobal();
    memory.putVariable('$obj', TValue.fromJson({ a: 1, b: { c: 2 } }), TVariableScope.GLOBAL, LOC);
    const vm = new VariableManager(identityContext(), memory, LOC);
    const result = { value: '' };
    vm.replaceVariables('$obj.a', 0, result);
    expect(result.value).toBe('1');
  });

  it('dot-accessing a non-object (e.g. an array) resolves to nothing, appending nothing', () => {
    const memory = new TMemoryGlobal();
    memory.putVariable('$arr', TValue.fromJson([1, 2]), TVariableScope.GLOBAL, LOC);
    const vm = new VariableManager(identityContext(), memory, LOC);
    const result = { value: '' };
    vm.replaceVariables('$arr.foo', 0, result);
    expect(result.value).toBe('');
  });

  it('resolves a nested dot-access field', () => {
    const memory = new TMemoryGlobal();
    memory.putVariable('$obj', TValue.fromJson({ a: 1, b: { c: 2 } }), TVariableScope.GLOBAL, LOC);
    const vm = new VariableManager(identityContext(), memory, LOC);
    const result = { value: '' };
    vm.replaceVariables('$obj.b.c', 0, result);
    expect(result.value).toBe('2');
  });

  it('resolves a bracket-access array index, delegating the index expression to the context', () => {
    const memory = new TMemoryGlobal();
    memory.putVariable('$arr', TValue.fromJson([10, 20, 30]), TVariableScope.GLOBAL, LOC);
    const vm = new VariableManager(identityContext(), memory, LOC);
    const result = { value: '' };
    vm.replaceVariables('$arr[1]', 0, result);
    expect(result.value).toBe('20');
  });

  it('resolves a bracket-access object key', () => {
    const memory = new TMemoryGlobal();
    memory.putVariable('$obj', TValue.fromJson({ b: 'hello' }), TVariableScope.GLOBAL, LOC);
    const vm = new VariableManager(identityContext(), memory, LOC);
    const result = { value: '' };
    vm.replaceVariables('$obj[b]', 0, result);
    expect(result.value).toBe('hello');
  });

  it('throws "Major parsing error" when bracket-indexing into a nested non-object/array JSON value', () => {
    const memory = new TMemoryGlobal();
    // A top-level JSON *number* short-circuits before ever reaching
    // replaceJson (see VariableManager#replaceVariables' isNumber branch),
    // so "Major parsing error" is only reachable via a nested access: dot
    // into a number field, then try to bracket-index that number.
    memory.putVariable('$obj', TValue.fromJson({ a: 5 }), TVariableScope.GLOBAL, LOC);
    const vm = new VariableManager(identityContext(), memory, LOC);
    expect(() => vm.replaceVariables('$obj.a[0]', 0, { value: '' })).toThrow(EaterException);
    expect(() => vm.replaceVariables('$obj.a[0]', 0, { value: '' })).toThrow('Major parsing error');
  });

  it('throws "Data parsing error" when the resolved key/index does not exist', () => {
    const memory = new TMemoryGlobal();
    memory.putVariable('$arr', TValue.fromJson([1, 2]), TVariableScope.GLOBAL, LOC);
    const vm = new VariableManager(identityContext(), memory, LOC);
    expect(() => vm.replaceVariables('$arr[5]', 0, { value: '' })).toThrow('Data parsing error');
  });

  it('tracks nested bracket depth while capturing the index expression text', () => {
    const memory = new TMemoryGlobal();
    memory.putVariable('$arr', TValue.fromJson([100, 200]), TVariableScope.GLOBAL, LOC);
    // A context that ignores the captured index text and always resolves
    // to "0" -- isolates the nested-bracket depth counter (level++/level--)
    // in the capture loop from real index evaluation.
    const constContext: TContext = {
      asKnowledge: vi.fn(),
      executeLines: vi.fn(),
      applyFunctionsAndVariables: vi.fn().mockReturnValue('0'),
      doesFunctionExist: vi.fn().mockReturnValue(false),
      getPreprocessingArtifact: vi.fn().mockReturnValue({
        addWarning: vi.fn(),
        getOption: vi.fn().mockReturnValue({ define: vi.fn() }),
      }),
    };
    const vm = new VariableManager(constContext, memory, LOC);
    const result = { value: '' };
    vm.replaceVariables('$arr[[0]]', 0, result);
    expect(result.value).toBe('100');
  });

  it('stops the field/index access chain at the first non "." / "[" character', () => {
    const memory = new TMemoryGlobal();
    memory.putVariable('$obj', TValue.fromJson({ a: 1 }), TVariableScope.GLOBAL, LOC);
    const vm = new VariableManager(identityContext(), memory, LOC);
    const result = { value: '' };
    vm.replaceVariables('$obj.a extra', 0, result);
    expect(result.value).toBe('1');
  });
});
