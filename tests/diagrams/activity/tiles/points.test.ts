import { describe, it, expect } from 'vitest';
import {
  gpoint,
  NORTH_HOOK,
  SOUTH_HOOK,
  EAST_HOOK,
  WEST_HOOK,
  NORTH_BORDER,
  SOUTH_BORDER,
} from '../../../../src/diagrams/activity/tiles/points.js';

describe('gpoint', () => {
  it('returns an object with the given x and y', () => {
    expect(gpoint(3, 4)).toEqual({ x: 3, y: 4 });
  });
});

describe('hook name constants', () => {
  it('all six constants are distinct strings', () => {
    const hooks = [NORTH_HOOK, SOUTH_HOOK, EAST_HOOK, WEST_HOOK, NORTH_BORDER, SOUTH_BORDER];
    const unique = new Set(hooks);
    expect(unique.size).toBe(6);
  });

  it('NORTH_HOOK is a unique string value', () => {
    expect(NORTH_HOOK).toBe('NORTH_HOOK');
    expect(NORTH_HOOK).not.toBe(SOUTH_HOOK);
    expect(NORTH_HOOK).not.toBe(EAST_HOOK);
    expect(NORTH_HOOK).not.toBe(WEST_HOOK);
  });

  it('SOUTH_HOOK is a unique string value', () => {
    expect(SOUTH_HOOK).toBe('SOUTH_HOOK');
    expect(SOUTH_HOOK).not.toBe(NORTH_HOOK);
    expect(SOUTH_HOOK).not.toBe(EAST_HOOK);
    expect(SOUTH_HOOK).not.toBe(WEST_HOOK);
  });

  it('EAST_HOOK is a unique string value', () => {
    expect(EAST_HOOK).toBe('EAST_HOOK');
    expect(EAST_HOOK).not.toBe(NORTH_HOOK);
    expect(EAST_HOOK).not.toBe(SOUTH_HOOK);
    expect(EAST_HOOK).not.toBe(WEST_HOOK);
  });

  it('WEST_HOOK is a unique string value', () => {
    expect(WEST_HOOK).toBe('WEST_HOOK');
    expect(WEST_HOOK).not.toBe(NORTH_HOOK);
    expect(WEST_HOOK).not.toBe(SOUTH_HOOK);
    expect(WEST_HOOK).not.toBe(EAST_HOOK);
  });
});
