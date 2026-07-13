import { describe, expect, it } from 'vitest';
import { TFunctionArgument } from '../../../../src/core/tim/TFunctionArgument.js';
import { TValue } from '../../../../src/core/tim/expression/TValue.js';

describe('TFunctionArgument', () => {
  it('exposes its name and optional default value', () => {
    const withDefault = new TFunctionArgument('x', TValue.fromInt(3));
    expect(withDefault.getName()).toBe('x');
    expect(withDefault.getOptionalDefaultValue()?.toInt()).toBe(3);
  });

  it('has an undefined default when none was declared', () => {
    const noDefault = new TFunctionArgument('y', undefined);
    expect(noDefault.getOptionalDefaultValue()).toBeUndefined();
  });

  it('toString renders the ARG: prefix', () => {
    const arg = new TFunctionArgument('z', undefined);
    expect(arg.toString()).toBe('ARG:z');
  });
});
