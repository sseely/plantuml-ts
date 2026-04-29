import { describe, it, expect } from 'vitest';
import { GConnectionVerticalDownThenBack } from '../../../../src/diagrams/activity/routing/gconnection-vertical-down-then-back.js';
import { GConnectionDownThenUp } from '../../../../src/diagrams/activity/routing/gconnection-down-then-up.js';
import { GConnectionSideThenVerticalThenSide } from '../../../../src/diagrams/activity/routing/gconnection-side-then-vertical-then-side.js';

describe('GConnectionVerticalDownThenBack', () => {
  it('produces 4 waypoints for a while-loop back-edge', () => {
    const conn = new GConnectionVerticalDownThenBack(20);
    const from = { x: 50, y: 100 };
    const to = { x: 50, y: 10 };

    const points = conn.getPoints(from, to);

    expect(points).toEqual([
      { x: 50, y: 100 },
      { x: 70, y: 100 },
      { x: 70, y: 10 },
      { x: 50, y: 10 },
    ]);
  });

  it('uses the default rightMargin of 20 when none is provided', () => {
    const conn = new GConnectionVerticalDownThenBack();
    const from = { x: 50, y: 100 };
    const to = { x: 50, y: 10 };

    const points = conn.getPoints(from, to);

    expect(points[1]).toEqual({ x: 70, y: 100 });
    expect(points[2]).toEqual({ x: 70, y: 10 });
  });
});

describe('GConnectionDownThenUp', () => {
  it('produces 4 waypoints for a repeat backward arrow', () => {
    const conn = new GConnectionDownThenUp(20);
    const from = { x: 50, y: 100 };
    const to = { x: 50, y: 10 };

    const points = conn.getPoints(from, to);

    expect(points).toEqual([
      { x: 50, y: 100 },
      { x: 30, y: 100 },
      { x: 30, y: 10 },
      { x: 50, y: 10 },
    ]);
  });

  it('uses the default leftMargin of 20 when none is provided', () => {
    const conn = new GConnectionDownThenUp();
    const from = { x: 50, y: 100 };
    const to = { x: 50, y: 10 };

    const points = conn.getPoints(from, to);

    expect(points[1]).toEqual({ x: 30, y: 100 });
    expect(points[2]).toEqual({ x: 30, y: 10 });
  });
});

describe('GConnectionSideThenVerticalThenSide', () => {
  it('returns 2 points when from and to share the same x', () => {
    const conn = new GConnectionSideThenVerticalThenSide();
    const from = { x: 50, y: 100 };
    const to = { x: 50, y: 10 };

    const points = conn.getPoints(from, to);

    expect(points).toHaveLength(2);
    expect(points).toEqual([from, to]);
  });

  it('returns 3 points when from and to have different x values', () => {
    const conn = new GConnectionSideThenVerticalThenSide();
    const from = { x: 50, y: 100 };
    const to = { x: 150, y: 10 };

    const points = conn.getPoints(from, to);

    expect(points).toHaveLength(3);
    expect(points).toEqual([
      { x: 50, y: 100 },
      { x: 50, y: 10 },
      { x: 150, y: 10 },
    ]);
  });
});
