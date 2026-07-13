import { describe, expect, it } from 'vitest';
import { EaterException } from '../../../../src/core/tim/EaterException.js';
import { StringLocated } from '../../../../src/core/tim/StringLocated.js';
import { LineLocationImpl } from '../../../../src/core/tim/LineLocationImpl.js';

describe('EaterException', () => {
  it('carries a message accessible via getMessage() and the standard Error API', () => {
    const location = new StringLocated('!bad', undefined);
    const err = new EaterException('bad token', location);
    expect(err.getMessage()).toBe('bad token');
    expect(err.message).toBe('bad token');
  });

  it('carries the originating location, accepting a real StringLocated', () => {
    const location = new StringLocated('!bad', undefined);
    const err = new EaterException('bad token', location);
    expect(err.getLocation()).toBe(location);
  });

  it('carries the originating location, accepting a duck-typed HasLocation', () => {
    const location = { getLocation: () => new LineLocationImpl('string', undefined).oneLineRead() };
    const err = new EaterException('bad token', location);
    expect(err.getLocation()).toBe(location);
  });

  it('is a real Error subclass, catchable by instanceof', () => {
    const location = new StringLocated('!bad', undefined);
    const err = new EaterException('bad token', location);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('EaterException');
  });

  it('throws TypeError when message is null/undefined (Objects.requireNonNull parity)', () => {
    const location = new StringLocated('!bad', undefined);
    // @ts-expect-error -- deliberately passing null to exercise the runtime guard
    expect(() => new EaterException(null, location)).toThrow(TypeError);
  });

  it('throws TypeError when location is null/undefined (Objects.requireNonNull parity)', () => {
    // @ts-expect-error -- deliberately passing undefined to exercise the runtime guard
    expect(() => new EaterException('msg', undefined)).toThrow(TypeError);
  });
});
