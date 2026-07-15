/**
 * Unit tests for `frontier-calculator.ts` — a faithful port of upstream
 * `Cluster.java#manageEntryExitPoint` / `svek/FrontierCalculator.java`.
 *
 * The primary case (`manageEntryExitPoint (insides empty)`) reproduces
 * `component/gafegu-06-nito976`'s exact jar-derived numbers (both raw
 * graphviz-native (y-up) and jar's final SVG (y-down) frames — see
 * frontier-calculator.ts's own doc comment on why both must agree) —
 * `plans/g1b-ink-extent/ledger.md`'s J2 entry and the module's own doc
 * comment cite the jar source lines this reproduces.
 */
import { describe, test, expect } from 'vitest';
import {
  manageEntryExitPoint, ensureMinWidth, ENTITY_POSITION_RADIUS,
  type RectangleArea, type Point,
} from '../../../src/diagrams/description/frontier-calculator.js';

describe('manageEntryExitPoint (insides empty — port-only container)', () => {
  test('reproduces jar\'s exact 177x99 result for component/gafegu-06-nito976 (raw graphviz-native y-up frame)', () => {
    const initial: RectangleArea = { minX: 8, minY: 8, maxX: 177, maxY: 121 };
    const points: Point[] = [
      { x: 22, y: 107 }, { x: 69, y: 107 }, { x: 116, y: 107 }, { x: 163, y: 107 },
    ];
    const core = manageEntryExitPoint(initial, [], points, 'TB');
    expect(core).toEqual({ minX: 4, minY: 8, maxX: 181, maxY: 107 });
    expect(core.maxX - core.minX).toBe(177);
    expect(core.maxY - core.minY).toBe(99);
  });

  test('reproduces the SAME 177x99 result in jar\'s final SVG (y-down) frame', () => {
    // Same fixture, screen (y-down) coordinates: ports sit at the cluster's
    // TOP (screen minY), matching the native-frame maxY-touch/push-excluded
    // corner case flipping to a screen-minY touch.
    const initial: RectangleArea = { minX: 8, minY: 152.78 - 121, maxX: 177, maxY: 152.78 - 8 };
    const points: Point[] = [
      { x: 22, y: 152.78 - 107 }, { x: 69, y: 152.78 - 107 },
      { x: 116, y: 152.78 - 107 }, { x: 163, y: 152.78 - 107 },
    ];
    const core = manageEntryExitPoint(initial, [], points, 'TB');
    expect(core.maxX - core.minX).toBe(177);
    expect(core.maxY - core.minY).toBe(99);
  });

  test('touches all four edges when ports surround the seed box (no push, insides empty)', () => {
    const initial: RectangleArea = { minX: 0, minY: 0, maxX: 10, maxY: 10 };
    const points: Point[] = [
      { x: -50, y: 5 }, { x: 50, y: 5 }, { x: 5, y: -50 }, { x: 5, y: 50 },
    ];
    const core = manageEntryExitPoint(initial, [], points, 'TB');
    // Every edge is touched directly by a point -- no snap-back to `initial`,
    // and no push (each touching point sits far from the OTHER edges, so no
    // `Math.abs(...) < DELTA` push condition fires).
    expect(core).toEqual({ minX: -50, minY: -50, maxX: 50, maxY: 50 });
  });

  test('rankdir=LR excludes the push on the X axis at a corner instead of Y (touching minX)', () => {
    // Mirrors the TB corner-exclusion case (gafegu-06 above) but rotated:
    // both points sit exactly at core.minX (a corner under LR, once one of
    // core's extreme Y values is also touched) -> pushMinX is excluded
    // (java:120-122); pushMaxX/pushMinY/pushMaxY are all NOT corner cases
    // here (no point ever touches core.maxX) so they still fire.
    const initial: RectangleArea = { minX: 0, minY: 0, maxX: 10, maxY: 10 };
    const points: Point[] = [{ x: 4, y: -20 }, { x: 4, y: 20 }];
    const core = manageEntryExitPoint(initial, [], points, 'LR');
    expect(core).toEqual({ minX: 4, minY: -38, maxX: 28, maxY: 38 });
  });

  test('rankdir=LR excludes the push on the X axis at a corner instead of Y (touching maxX)', () => {
    // Same shape, mirrored to the OTHER LR corner-exclusion branch
    // (java:124-125, `p.x === core.maxX`) -- both points sit at
    // core.maxX(6) instead of minX, so pushMaxX (not pushMinX) is the one
    // excluded this time.
    const initial: RectangleArea = { minX: 0, minY: 0, maxX: 10, maxY: 10 };
    const points: Point[] = [{ x: 6, y: -20 }, { x: 6, y: 20 }];
    const core = manageEntryExitPoint(initial, [], points, 'LR');
    expect(core).toEqual({ minX: -18, minY: -38, maxX: 6, maxY: 38 });
  });

  test('the SAME point layout under TB (not LR) excludes the Y push at the corner instead', () => {
    // Same seed/points as the LR case above, but rankdir=TB: the corner
    // exclusion checks Y (java:128-132) instead of X, so pushMinY/pushMaxY
    // (not pushMinX) get excluded -- a genuinely different final rect,
    // confirming the corner-exclusion branch is rankdir-dependent, not a
    // no-op either way.
    const initial: RectangleArea = { minX: 0, minY: 0, maxX: 10, maxY: 10 };
    const points: Point[] = [{ x: 4, y: -20 }, { x: 4, y: 20 }];
    const core = manageEntryExitPoint(initial, [], points, 'TB');
    expect(core).toEqual({ minX: -14, minY: -20, maxX: 28, maxY: 20 });
  });
});

describe('manageEntryExitPoint (insides non-empty)', () => {
  test('seeds core from the merged insides rects, not the initial-center fallback', () => {
    const initial: RectangleArea = { minX: 0, minY: 0, maxX: 1000, maxY: 1000 };
    const insides: RectangleArea[] = [
      { minX: 10, minY: 10, maxX: 30, maxY: 30 },
      { minX: 40, minY: 20, maxX: 60, maxY: 40 },
    ];
    const core = manageEntryExitPoint(initial, insides, [], 'TB');
    // No points at all -> insides merge is the whole result, no touch/push,
    // and every axis snaps to `initial` since nothing ever "touches" a
    // point-derived edge (points is empty).
    expect(core).toEqual({ minX: 0, minY: 0, maxX: 1000, maxY: 1000 });
  });

  test('a port center outside the merged insides rect widens the box to include it', () => {
    const initial: RectangleArea = { minX: 0, minY: 0, maxX: 200, maxY: 200 };
    const insides: RectangleArea[] = [{ minX: 50, minY: 50, maxX: 100, maxY: 100 }];
    const points: Point[] = [{ x: 150, y: 75 }];
    const core = manageEntryExitPoint(initial, insides, points, 'TB');
    expect(core.maxX).toBeGreaterThanOrEqual(150);
    expect(core.minX).toBeLessThanOrEqual(50);
  });
});

describe('ensureMinWidth', () => {
  test('widens a too-narrow core symmetrically around its own center', () => {
    const initial: RectangleArea = { minX: 0, minY: 0, maxX: 100, maxY: 20 };
    const core: RectangleArea = { minX: 40, minY: 0, maxX: 60, maxY: 20 };
    const widened = ensureMinWidth(core, initial, 40);
    expect(widened.maxX - widened.minX).toBe(40);
    expect(widened.minX).toBe(30);
    expect(widened.maxX).toBe(70);
  });

  test('leaves an already-wide-enough core untouched', () => {
    const initial: RectangleArea = { minX: 0, minY: 0, maxX: 100, maxY: 20 };
    const core: RectangleArea = { minX: 10, minY: 0, maxX: 90, maxY: 20 };
    expect(ensureMinWidth(core, initial, 40)).toEqual(core);
  });

  test('clamps the widened minX at initial.minX when the symmetric widen would cross it (java:159-162)', () => {
    const initial: RectangleArea = { minX: 0, minY: 0, maxX: 100, maxY: 20 };
    const core: RectangleArea = { minX: 2, minY: 0, maxX: 12, maxY: 20 };
    const widened = ensureMinWidth(core, initial, 40);
    expect(widened.minX).toBe(0);
    expect(widened.maxX - widened.minX).toBe(40);
  });
});

describe('ENTITY_POSITION_RADIUS', () => {
  test('matches abel/EntityPosition.java:56 (RADIUS = 6)', () => {
    expect(ENTITY_POSITION_RADIUS).toBe(6);
  });
});
