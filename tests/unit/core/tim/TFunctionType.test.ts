import { describe, expect, it } from 'vitest';
import { TFunctionType, isLegacyTFunctionType } from '../../../../src/core/tim/TFunctionType.js';

describe('isLegacyTFunctionType', () => {
  it('is true for LEGACY_DEFINE and LEGACY_DEFINELONG', () => {
    expect(isLegacyTFunctionType(TFunctionType.LEGACY_DEFINE)).toBe(true);
    expect(isLegacyTFunctionType(TFunctionType.LEGACY_DEFINELONG)).toBe(true);
  });

  it('is false for PROCEDURE and RETURN_FUNCTION', () => {
    expect(isLegacyTFunctionType(TFunctionType.PROCEDURE)).toBe(false);
    expect(isLegacyTFunctionType(TFunctionType.RETURN_FUNCTION)).toBe(false);
  });
});
