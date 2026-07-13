import { describe, expect, it } from 'vitest';
import { Expression } from '../../../../../src/core/tim/expression/index.js';

describe('Expression', () => {
  it('is an empty, instantiable placeholder class (upstream has no fields or methods)', () => {
    const instance = new Expression();
    expect(instance).toBeInstanceOf(Expression);
  });
});
