import { describe, expect, it, vi } from 'vitest';
import { TFunctionImpl } from '../../../../src/core/tim/TFunctionImpl.js';
import { TFunctionArgument } from '../../../../src/core/tim/TFunctionArgument.js';
import { TFunctionType } from '../../../../src/core/tim/TFunctionType.js';
import { StringLocated } from '../../../../src/core/tim/StringLocated.js';
import { TValue } from '../../../../src/core/tim/expression/TValue.js';
import type { TContext } from '../../../../src/core/tim/TFunction.js';
import { TMemoryGlobal } from '../../../../src/core/tim/TMemoryGlobal.js';

const LOC = new StringLocated('!function foo()', undefined);

function fakeContext(overrides: Partial<TContext> = {}): TContext {
  return {
    asKnowledge: vi.fn(),
    executeLines: vi.fn(),
    applyFunctionsAndVariables: vi.fn(),
    doesFunctionExist: vi.fn().mockReturnValue(false),
    getPreprocessingArtifact: vi.fn().mockReturnValue({
      addWarning: vi.fn(),
      getOption: vi.fn().mockReturnValue({ define: vi.fn() }),
    }),
    ...overrides,
  };
}

describe('TFunctionImpl#canCover', () => {
  it('covers exactly the declared positional arity with no defaults', () => {
    const fn = new TFunctionImpl('f', [new TFunctionArgument('a', undefined), new TFunctionArgument('b', undefined)], false, TFunctionType.PROCEDURE);
    expect(fn.canCover(2, new Set())).toBe(true);
    expect(fn.canCover(1, new Set())).toBe(false);
    expect(fn.canCover(3, new Set())).toBe(false);
  });

  it('a defaulted argument makes it optional', () => {
    const fn = new TFunctionImpl(
      'f',
      [new TFunctionArgument('a', undefined), new TFunctionArgument('b', TValue.fromInt(0))],
      false,
      TFunctionType.PROCEDURE,
    );
    expect(fn.canCover(1, new Set())).toBe(true);
    expect(fn.canCover(2, new Set())).toBe(true);
    expect(fn.canCover(0, new Set())).toBe(false);
  });

  it('rejects a named argument the signature does not declare', () => {
    const fn = new TFunctionImpl('f', [new TFunctionArgument('a', undefined)], false, TFunctionType.PROCEDURE);
    expect(fn.canCover(0, new Set(['unknown']))).toBe(false);
  });

  it('a satisfied named argument does not also need a positional slot', () => {
    const fn = new TFunctionImpl('f', [new TFunctionArgument('a', undefined)], false, TFunctionType.PROCEDURE);
    expect(fn.canCover(0, new Set(['a']))).toBe(true);
  });
});

describe('TFunctionImpl#addBody / getters', () => {
  it('getSignature/getFunctionType/isUnquoted reflect construction', () => {
    const fn = new TFunctionImpl('f', [new TFunctionArgument('a', undefined)], true, TFunctionType.RETURN_FUNCTION);
    expect(fn.getSignature().getFunctionName()).toBe('f');
    expect(fn.getSignature().getNbArg()).toBe(1);
    expect(fn.getFunctionType()).toBe(TFunctionType.RETURN_FUNCTION);
    expect(fn.isUnquoted()).toBe(true);
  });

  it('hasBody/doesContainReturn track addBody calls', () => {
    const fn = new TFunctionImpl('f', [], false, TFunctionType.RETURN_FUNCTION);
    expect(fn.hasBody()).toBe(false);
    expect(fn.doesContainReturn()).toBe(false);

    fn.addBody(new StringLocated('$x = 1', undefined, 'PLAIN'));
    expect(fn.hasBody()).toBe(true);
    expect(fn.doesContainReturn()).toBe(false);

    fn.addBody(new StringLocated('!return $x', undefined, 'RETURN'));
    expect(fn.doesContainReturn()).toBe(true);
  });

  it('a PROCEDURE cannot declare a !return body line', () => {
    const fn = new TFunctionImpl('f', [], false, TFunctionType.PROCEDURE);
    expect(() => fn.addBody(new StringLocated('!return $x', undefined, 'RETURN'))).toThrow(
      'A procedure cannot have !return directive',
    );
  });

  it('toString renders FUNCTION plus signature and args', () => {
    const fn = new TFunctionImpl('f', [new TFunctionArgument('a', undefined)], false, TFunctionType.PROCEDURE);
    expect(fn.toString()).toContain('FUNCTION');
    expect(fn.toString()).toContain('f/1');
  });
});

describe('TFunctionImpl#executeProcedureInternal', () => {
  it('forks memory from arguments and delegates to context.executeLines', () => {
    const global = new TMemoryGlobal();
    const fn = new TFunctionImpl('f', [new TFunctionArgument('a', undefined)], false, TFunctionType.PROCEDURE);
    fn.addBody(new StringLocated('note $a', undefined, 'PLAIN'));
    const executeLines = vi.fn();
    const context = fakeContext({ executeLines });

    fn.executeProcedureInternal(context, global, LOC, [TValue.fromInt(9)], new Map());

    expect(executeLines).toHaveBeenCalledTimes(1);
    const [memoryArg, bodyArg, typeArg, wantReturnArg] = executeLines.mock.calls[0] as [
      unknown,
      StringLocated[],
      TFunctionType,
      boolean,
    ];
    expect(memoryArg).not.toBe(global);
    expect(bodyArg).toHaveLength(1);
    expect(typeArg).toBe(TFunctionType.PROCEDURE);
    expect(wantReturnArg).toBe(false);
  });

  it('throws IllegalStateException if called on a non-procedure function', () => {
    const global = new TMemoryGlobal();
    const fn = new TFunctionImpl('f', [], false, TFunctionType.RETURN_FUNCTION);
    expect(() => fn.executeProcedureInternal(fakeContext(), global, LOC, [], new Map())).toThrow(
      'IllegalStateException',
    );
  });
});

describe('TFunctionImpl#executeReturnFunction', () => {
  it('RETURN_FUNCTION delegates to context.executeLines with wantReturn=true and returns its result', () => {
    const global = new TMemoryGlobal();
    const fn = new TFunctionImpl('f', [], false, TFunctionType.RETURN_FUNCTION);
    fn.addBody(new StringLocated('!return 3', undefined, 'RETURN'));
    const result = TValue.fromInt(3);
    const executeLines = vi.fn().mockReturnValue(result);
    const context = fakeContext({ executeLines });

    const value = fn.executeReturnFunction(context, global, LOC, [], new Map());
    expect(value).toBe(result);
    expect(executeLines).toHaveBeenCalledTimes(1);
    const [, bodyArg, typeArg, wantReturnArg] = executeLines.mock.calls[0] as [
      unknown,
      StringLocated[],
      TFunctionType,
      boolean,
    ];
    expect(bodyArg).toHaveLength(1);
    expect(typeArg).toBe(TFunctionType.RETURN_FUNCTION);
    expect(wantReturnArg).toBe(true);
  });

  it('throws when the body never produced a return value', () => {
    const global = new TMemoryGlobal();
    const fn = new TFunctionImpl('f', [], false, TFunctionType.RETURN_FUNCTION);
    const context = fakeContext({ executeLines: vi.fn().mockReturnValue(undefined) });
    expect(() => fn.executeReturnFunction(context, global, LOC, [], new Map())).toThrow(
      'No return directive found in your function',
    );
  });

  it('rejects a call on a non-return-function type', () => {
    const global = new TMemoryGlobal();
    const fn = new TFunctionImpl('f', [], false, TFunctionType.PROCEDURE);
    expect(() => fn.executeReturnFunction(fakeContext(), global, LOC, [], new Map())).toThrow(
      'Is there a return directive in your function?',
    );
  });

  it('LEGACY_DEFINE delegates to applyFunctionsAndVariables and wraps the result as a string TValue', () => {
    const global = new TMemoryGlobal();
    const fn = new TFunctionImpl('f', [], false, TFunctionType.LEGACY_DEFINE);
    fn.setLegacyDefinition('hello');
    const context = fakeContext({ applyFunctionsAndVariables: vi.fn().mockReturnValue('hello world') });

    const value = fn.executeReturnFunction(context, global, LOC, [], new Map());
    expect(value.toString()).toBe('hello world');
  });

  it('LEGACY_DEFINE with no set definition throws IllegalStateException', () => {
    const global = new TMemoryGlobal();
    const fn = new TFunctionImpl('f', [], false, TFunctionType.LEGACY_DEFINE);
    expect(() => fn.executeReturnFunction(fakeContext(), global, LOC, [], new Map())).toThrow(
      'IllegalStateException',
    );
  });
});

describe('TFunctionImpl#finalizeEnddefinelong', () => {
  it('collapses a single-line LEGACY_DEFINELONG body into LEGACY_DEFINE', () => {
    const fn = new TFunctionImpl('f', [], false, TFunctionType.LEGACY_DEFINELONG);
    fn.addBody(new StringLocated('the one line', undefined, 'PLAIN'));
    fn.finalizeEnddefinelong();
    expect(fn.getFunctionType()).toBe(TFunctionType.LEGACY_DEFINE);
  });

  it('leaves a multi-line LEGACY_DEFINELONG body as LEGACY_DEFINELONG', () => {
    const fn = new TFunctionImpl('f', [], false, TFunctionType.LEGACY_DEFINELONG);
    fn.addBody(new StringLocated('line 1', undefined, 'PLAIN'));
    fn.addBody(new StringLocated('line 2', undefined, 'PLAIN'));
    fn.finalizeEnddefinelong();
    expect(fn.getFunctionType()).toBe(TFunctionType.LEGACY_DEFINELONG);
  });

  it('throws if called on a non-LEGACY_DEFINELONG function', () => {
    const fn = new TFunctionImpl('f', [], false, TFunctionType.PROCEDURE);
    expect(() => fn.finalizeEnddefinelong()).toThrow('UnsupportedOperationException');
  });
});
