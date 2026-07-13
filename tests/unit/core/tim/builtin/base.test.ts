import { describe, expect, it } from 'vitest';
import { TValue } from '../../../../../src/core/tim/expression/TValue.js';
import { TFunctionType } from '../../../../../src/core/tim/TFunctionType.js';
import { TFunctionSignature } from '../../../../../src/core/tim/TFunctionSignature.js';
import { SimpleReturnFunction } from '../../../../../src/core/tim/builtin/SimpleReturnFunction.js';
import { CallUserFunction } from '../../../../../src/core/tim/builtin/CallUserFunction.js';
import { EaterException } from '../../../../../src/core/tim/EaterException.js';
import { LOC, NO_MEMORY, NO_NAMED, fakeContext } from '../../../../helpers/tim-builtin.js';

class Probe extends SimpleReturnFunction {
  getSignature(): TFunctionSignature {
    return new TFunctionSignature('%probe', 0);
  }
  canCover(nbArg: number): boolean {
    return nbArg === 0;
  }
  executeReturnFunction(): TValue {
    return TValue.fromInt(42);
  }
}

describe('SimpleReturnFunction', () => {
  it('fixes getFunctionType to RETURN_FUNCTION', () => {
    expect(new Probe().getFunctionType()).toBe(TFunctionType.RETURN_FUNCTION);
  });

  it('fixes isUnquoted to false', () => {
    expect(new Probe().isUnquoted()).toBe(false);
  });

  it('executeProcedureInternal always throws', () => {
    const probe = new Probe();
    expect(() => probe.executeProcedureInternal(fakeContext(), NO_MEMORY, LOC, [], NO_NAMED)).toThrow(
      'UnsupportedOperationException',
    );
  });

  it('subclass executeReturnFunction is reachable', () => {
    expect(new Probe().executeReturnFunction().toInt()).toBe(42);
  });
});

describe('CallUserFunction (%call_user_func)', () => {
  it('has signature %call_user_func/1', () => {
    const fn = new CallUserFunction();
    expect(fn.getSignature().getFunctionName()).toBe('%call_user_func');
    expect(fn.getSignature().getNbArg()).toBe(1);
  });

  it('canCover requires at least 1 argument', () => {
    const fn = new CallUserFunction();
    expect(fn.canCover(0, new Set())).toBe(false);
    expect(fn.canCover(1, new Set())).toBe(true);
    expect(fn.canCover(5, new Set())).toBe(true);
  });

  it('dispatches to the resolved function with the remaining args', () => {
    const target = {
      executeReturnFunction: () => TValue.fromString('called'),
    };
    const ctx = fakeContext({ getFunctionSmart: () => target });
    const fn = new CallUserFunction();
    const result = fn.executeReturnFunction(
      ctx,
      NO_MEMORY,
      LOC,
      [TValue.fromString('%foo'), TValue.fromInt(1), TValue.fromInt(2)],
      NO_NAMED,
    );
    expect(result.toString()).toBe('called');
  });

  it('throws when the target function cannot be found', () => {
    const ctx = fakeContext({ getFunctionSmart: () => undefined });
    const fn = new CallUserFunction();
    expect(() => fn.executeReturnFunction(ctx, NO_MEMORY, LOC, [TValue.fromString('%missing')], NO_NAMED)).toThrow(
      EaterException,
    );
  });
});
