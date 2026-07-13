import { describe, expect, it } from 'vitest';
import { TValue } from '../../../../../src/core/tim/expression/TValue.js';
import { line, runBody } from '../../../../helpers/tim-iterator-context.js';

describe('CodeIteratorReturnFunction', () => {
  it('collects a !function body up to !endfunction, declaring it in FunctionsSet', () => {
    const { context } = runBody([
      line('!function $one()', 'DECLARE_RETURN_FUNCTION'),
      line('!return 1', 'RETURN'),
      line('!endfunction', 'END_FUNCTION'),
    ]);
    expect(context.functionsSet.doesFunctionExist('$one')).toBe(true);
    expect(context.functionsSet.pendingFunction()).toBeUndefined();
  });

  it('throws when !endfunction is reached with no !return anywhere in the body', () => {
    expect(() =>
      runBody([
        line('!function $noReturn()', 'DECLARE_RETURN_FUNCTION'),
        line('!$x = 1', 'AFFECTATION'),
        line('!endfunction', 'END_FUNCTION'),
      ]),
    ).toThrow('This function does not have any !return directive. Declare it as a procedure instead ?');
  });

  it('a declared function is directly callable afterward and returns the right value', () => {
    const { context, memory } = runBody([
      line('!function $double($x)', 'DECLARE_RETURN_FUNCTION'),
      line('!return $x + $x', 'RETURN'),
      line('!endfunction', 'END_FUNCTION'),
    ]);
    const fn = [...context.functionsSet.getFunctionsByName('$double')][0]!;
    const result = fn.executeReturnFunction(context, memory, line('$double(5)'), [TValue.fromInt(5)], new Map());
    expect(result.toInt()).toBe(10);
  });
});
