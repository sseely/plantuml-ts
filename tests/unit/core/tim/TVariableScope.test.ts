import { describe, expect, it } from 'vitest';
import { TVariableScope, lazzyParse } from '../../../../src/core/tim/TVariableScope.js';

describe('lazzyParse', () => {
  it('parses "local" (case-insensitive) to LOCAL', () => {
    expect(lazzyParse('local')).toBe(TVariableScope.LOCAL);
    expect(lazzyParse('LOCAL')).toBe(TVariableScope.LOCAL);
  });

  it('parses "global" (case-insensitive) to GLOBAL', () => {
    expect(lazzyParse('global')).toBe(TVariableScope.GLOBAL);
    expect(lazzyParse('GLOBAL')).toBe(TVariableScope.GLOBAL);
  });

  it('returns undefined for an unrecognized value', () => {
    expect(lazzyParse('nope')).toBeUndefined();
    expect(lazzyParse('')).toBeUndefined();
  });
});
