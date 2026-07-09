/**
 * coordinate-change.test.ts — T8 (re-run): unit coverage for
 * `CoordinateChange`, a direct prerequisite of `USymbolCloud` (see
 * `USymbolCloud.ts`'s module doc comment) added to `src/core/klimt/
 * geom/` alongside this task's write-set — not previously ported by
 * any landed T3b base task. Kept minimal: full behavioral coverage
 * lives in `symbols-paths.test.ts`'s jar-conformance fixtures (which
 * exercise `getTrueCoordinate`/`getLength` transitively through every
 * `USymbolCloud` bump); this file only adds what those fixtures don't
 * reach — the zero-length-segment guard.
 */
import { describe, expect, test } from 'vitest';
import { CoordinateChange } from '../../../../src/core/klimt/geom/CoordinateChange.js';
import { XPoint2D } from '../../../../src/core/klimt/geom/XPoint2D.js';

describe('CoordinateChange', () => {
  test('getTrueCoordinate maps (a, b) along/perpendicular to the p1->p2 axis', () => {
    const cc = CoordinateChange.create(new XPoint2D(0, 0), new XPoint2D(10, 0));
    expect(cc.getLength()).toBe(10);
    // Along the axis (b=0): halfway is (5,0).
    const along = cc.getTrueCoordinate(5, 0);
    expect(along.getX()).toBeCloseTo(5, 6);
    expect(along.getY()).toBeCloseTo(0, 6);
    // Perpendicular (a=0, b=3): the "v" axis is u rotated 90 degrees,
    // i.e. (0,1) for a horizontal p1->p2 axis.
    const perp = cc.getTrueCoordinate(0, 3);
    expect(perp.getX()).toBeCloseTo(0, 6);
    expect(perp.getY()).toBeCloseTo(3, 6);
  });

  test('throws on a zero-length segment (matching upstream\'s IllegalArgumentException)', () => {
    expect(() => new CoordinateChange(1, 1, 1, 1)).toThrow(/zero-length/);
    expect(() => CoordinateChange.create(new XPoint2D(2, 2), new XPoint2D(2, 2))).toThrow(/zero-length/);
  });
});
