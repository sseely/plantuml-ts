import { describe, expect, it } from 'vitest';
import { line, runBody } from '../../../../helpers/tim-iterator-context.js';

describe('CodeIteratorLegacyDefine', () => {
  it('declares a single-line legacy !define and it is callable inline', () => {
    const { context } = runBody([line('!define GREETING(name) hi name', 'LEGACY_DEFINE')]);
    expect(context.functionsSet.doesFunctionExist('GREETING')).toBe(true);
  });

  it('collects a multi-line !definelong body and finalizes it to LEGACY_DEFINE on a single-line body', () => {
    const { context } = runBody([
      line('!definelong GREETLONG(name)', 'LEGACY_DEFINELONG'),
      line('hi name'),
      line('!enddefinelong', 'END_FUNCTION'),
    ]);
    expect(context.functionsSet.doesFunctionExist('GREETLONG')).toBe(true);
    const fn = [...context.functionsSet.getFunctionsByName('GREETLONG')][0]!;
    // TFunctionImpl#finalizeEnddefinelong collapses a single-line
    // !definelong body down to LEGACY_DEFINE.
    expect(fn.getFunctionType()).toBe('LEGACY_DEFINE');
  });
});
