import { describe, expect, it } from 'vitest';
import { TMode } from '../../../../src/core/tim/TMode.js';

describe('TMode', () => {
  it('is constructible (empty marker class, ported verbatim)', () => {
    expect(new TMode()).toBeInstanceOf(TMode);
  });
});
