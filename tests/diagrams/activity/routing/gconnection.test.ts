import { describe, it, expect } from 'vitest';
import type { GConnection } from '../../../../src/diagrams/activity/routing/gconnection.js';
import { GConnectionVerticalDown } from '../../../../src/diagrams/activity/routing/gconnection-vertical-down.js';
import { GConnectionHorizontal } from '../../../../src/diagrams/activity/routing/gconnection-horizontal.js';

describe('GConnectionVerticalDown', () => {
  it('implements GConnection', () => {
    const conn: GConnection = new GConnectionVerticalDown();
    expect(conn).toBeDefined();
  });

  it('returns exactly 2 points from/to', () => {
    const conn = new GConnectionVerticalDown();
    const result = conn.getPoints({ x: 10, y: 0 }, { x: 10, y: 50 });
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ x: 10, y: 0 });
    expect(result[1]).toEqual({ x: 10, y: 50 });
  });
});

describe('GConnectionHorizontal', () => {
  it('implements GConnection', () => {
    const conn: GConnection = new GConnectionHorizontal();
    expect(conn).toBeDefined();
  });

  it('returns 3 points when y values differ', () => {
    const conn = new GConnectionHorizontal();
    const result = conn.getPoints({ x: 0, y: 20 }, { x: 80, y: 40 });
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ x: 0, y: 20 });
    expect(result[1]).toEqual({ x: 80, y: 20 });
    expect(result[2]).toEqual({ x: 80, y: 40 });
  });

  it('returns exactly 2 points when y values are the same', () => {
    const conn = new GConnectionHorizontal();
    const result = conn.getPoints({ x: 0, y: 20 }, { x: 80, y: 20 });
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ x: 0, y: 20 });
    expect(result[1]).toEqual({ x: 80, y: 20 });
  });
});
