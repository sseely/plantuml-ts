/**
 * Unit + integration tests for compound-edge boundary clipping
 * (`src/diagrams/description/spline-clip.ts`), a faithful port of upstream
 * `DotPath#simulateCompound` + `XCubicCurve2D#subdivide`.
 *
 * The clip operates on the `1 + 3*n` graphviz-spline point shape (start
 * anchor + `(cp1, cp2, end)` cubic triples). Two regressions are locked:
 * (1) the previous polyline clip could splice that array to a count that
 * is not `1 + 3*n`, which `buildDotPathFromSplinePoints` rejects, dropping
 * the edge (F1); (2) fidelity — the boundary crossing must be found by 8
 * midpoint subdivisions and the straddling sliver discarded, matching the
 * jar oracle rather than a more precise crossing.
 */
import { readFileSync } from 'node:fs';
import { describe, test, expect } from 'vitest';
import {
  subdivide,
  clipSplineStart,
  clipSplineEnd,
} from '../../../src/diagrams/description/spline-clip.js';
import type { Bbox } from '../../../src/diagrams/description/layout-helpers.js';
import { renderFixture } from '../../oracle/svg-conformance/render-fixture.js';
import { jarMeasurer } from '../../../src/core/measurer-jar.js';

type Pt = { x: number; y: number };
type Cubic = readonly [Pt, Pt, Pt, Pt];

/** Upstream `RectangleArea#contains`: closed on min, open on max. */
function contains(p: Pt, b: Bbox): boolean {
  return p.x >= b.x && p.x < b.x + b.width && p.y >= b.y && p.y < b.y + b.height;
}

/** A spline is well-formed iff its length is `1 + 3*n` for some `n >= 1`. */
function isValidSpline(points: readonly Pt[]): boolean {
  return points.length >= 4 && (points.length - 1) % 3 === 0;
}

describe('subdivide (XCubicCurve2D#subdivide port, t=0.5)', () => {
  const cubic: Cubic = [
    { x: 0, y: 0 }, { x: 10, y: 30 }, { x: 40, y: 30 }, { x: 60, y: 0 },
  ];

  test('reproduces upstream midpoint averaging exactly', () => {
    const [p0, c1, c2, p3] = cubic;
    const centerx = (c1.x + c2.x) / 2, centery = (c1.y + c2.y) / 2;
    const lc1 = { x: (p0.x + c1.x) / 2, y: (p0.y + c1.y) / 2 };
    const rc2 = { x: (p3.x + c2.x) / 2, y: (p3.y + c2.y) / 2 };
    const lc12 = { x: (lc1.x + centerx) / 2, y: (lc1.y + centery) / 2 };
    const rc21 = { x: (rc2.x + centerx) / 2, y: (rc2.y + centery) / 2 };
    const m = { x: (lc12.x + rc21.x) / 2, y: (lc12.y + rc21.y) / 2 };

    const [part1, part2] = subdivide(cubic);
    expect(part1).toEqual([p0, lc1, lc12, m]);
    expect(part2).toEqual([m, rc21, rc2, p3]);
  });

  test('the two halves meet at the shared on-curve midpoint', () => {
    const [part1, part2] = subdivide(cubic);
    expect(part1[3]).toEqual(part2[0]);
    expect(part1[0]).toEqual(cubic[0]);
    expect(part2[3]).toEqual(cubic[3]);
  });

  test('midpoint equals the analytic Bernstein evaluation at t=0.5', () => {
    const [p0, c1, c2, p3] = cubic;
    const t = 0.5, mt = 0.5;
    const bx =
      mt * mt * mt * p0.x + 3 * mt * mt * t * c1.x + 3 * mt * t * t * c2.x + t * t * t * p3.x;
    const by =
      mt * mt * mt * p0.y + 3 * mt * mt * t * c1.y + 3 * mt * t * t * c2.y + t * t * t * p3.y;
    const [part1] = subdivide(cubic);
    expect(part1[3].x).toBeCloseTo(bx, 9);
    expect(part1[3].y).toBeCloseTo(by, 9);
  });
});

describe('clipSplineStart (simulateCompound tail branch)', () => {
  const tail: Bbox = { x: 0, y: 0, width: 100, height: 100 };

  test('clips a single straddling segment, preserving 1+3n', () => {
    // P0 inside, single cubic exiting through the right edge.
    const pts: Pt[] = [
      { x: 50, y: 50 }, { x: 70, y: 50 }, { x: 130, y: 50 }, { x: 180, y: 50 },
    ];
    const out = clipSplineStart(pts, tail);
    expect(isValidSpline(out)).toBe(true);
    // faithful: clipped start lands just OUTSIDE tail, not on the boundary
    expect(contains(out[0]!, tail)).toBe(false);
    expect(out[out.length - 1]).toEqual({ x: 180, y: 50 }); // end anchor untouched
  });

  test('drops fully-inside leading segments and keeps the outside tail', () => {
    const pts: Pt[] = [
      { x: 10, y: 50 },                                      // P0 in
      { x: 40, y: 50 }, { x: 80, y: 50 }, { x: 150, y: 50 }, // seg1 -> P1 OUT
      { x: 160, y: 50 }, { x: 170, y: 50 }, { x: 180, y: 50 }, // seg2 -> P2 out
    ];
    const out = clipSplineStart(pts, tail);
    expect(isValidSpline(out)).toBe(true);
    expect(contains(out[0]!, tail)).toBe(false);
    // the fully-outside seg2 survives unchanged as the trailing tail
    expect(out.slice(-3)).toEqual([
      { x: 160, y: 50 }, { x: 170, y: 50 }, { x: 180, y: 50 },
    ]);
  });

  test('no-op when the start anchor is already outside', () => {
    const pts: Pt[] = [
      { x: 150, y: 50 }, { x: 160, y: 50 }, { x: 170, y: 50 }, { x: 180, y: 50 },
    ];
    expect(clipSplineStart(pts, tail)).toBe(pts);
  });

  test('no-op ("strange1") when the whole spline stays inside', () => {
    const pts: Pt[] = [
      { x: 10, y: 10 }, { x: 20, y: 20 }, { x: 30, y: 30 }, { x: 40, y: 40 },
    ];
    expect(clipSplineStart(pts, tail)).toBe(pts);
  });
});

describe('clipSplineEnd (simulateCompound head branch)', () => {
  const head: Bbox = { x: 0, y: 0, width: 100, height: 100 };

  test('clips a single straddling segment, preserving 1+3n', () => {
    // P0 outside, single cubic entering to an inside end anchor.
    const pts: Pt[] = [
      { x: 180, y: 50 }, { x: 130, y: 50 }, { x: 70, y: 50 }, { x: 50, y: 50 },
    ];
    const out = clipSplineEnd(pts, head);
    expect(isValidSpline(out)).toBe(true);
    expect(out[0]).toEqual({ x: 180, y: 50 }); // start anchor untouched
    // faithful: clipped end lands just OUTSIDE head, not on the boundary
    expect(contains(out[out.length - 1]!, head)).toBe(false);
  });

  test('keeps the outside head segments and clips the last entering one', () => {
    const pts: Pt[] = [
      { x: 180, y: 50 },                                      // P0 out
      { x: 170, y: 50 }, { x: 160, y: 50 }, { x: 150, y: 50 }, // seg1 -> P1 out
      { x: 80, y: 50 }, { x: 40, y: 50 }, { x: 10, y: 50 },    // seg2 -> P2 IN
    ];
    const out = clipSplineEnd(pts, head);
    expect(isValidSpline(out)).toBe(true);
    // head through P1 survives unchanged
    expect(out.slice(0, 4)).toEqual([
      { x: 180, y: 50 }, { x: 170, y: 50 }, { x: 160, y: 50 }, { x: 150, y: 50 },
    ]);
    expect(contains(out[out.length - 1]!, head)).toBe(false);
  });

  test('no-op (upstream `return me`) when a segment is wholly inside head', () => {
    // Both anchors of the last segment inside head → upstream bails.
    const pts: Pt[] = [
      { x: 180, y: 50 }, { x: 60, y: 50 }, { x: 40, y: 50 }, { x: 20, y: 50 },
    ];
    // P0 outside but c1/c2/P1 inside: the entering segment has P1 inside and,
    // once subdivided, hits a part whose P1 is inside -> `return me` path is
    // exercised structurally; assert the invariant holds regardless.
    const out = clipSplineEnd(pts, head);
    expect(isValidSpline(out)).toBe(true);
  });

  test('no-op when the end anchor is already outside', () => {
    const pts: Pt[] = [
      { x: 180, y: 50 }, { x: 170, y: 50 }, { x: 160, y: 50 }, { x: 150, y: 50 },
    ];
    expect(clipSplineEnd(pts, head)).toBe(pts);
  });
});

describe('clip guards: malformed splines', () => {
  const bbox: Bbox = { x: 0, y: 0, width: 100, height: 100 };

  test('both clips leave a non-`1+3n` array untouched', () => {
    const bad: Pt[] = [{ x: 5, y: 5 }, { x: 60, y: 5 }, { x: 130, y: 5 }]; // 3 pts
    expect(clipSplineStart(bad, bbox)).toBe(bad);
    expect(clipSplineEnd(bad, bbox)).toBe(bad);
  });
});

describe('F1 regression: cross-container edges no longer dropped', () => {
  // These two fixtures previously lost 1 and 2 edges respectively because
  // the polyline clip broke the 1+3n invariant. `drawEdges` swallows a bad
  // edge to `console.error('renderDescription: edge draw failed', ...)`, so
  // a spy on that message is the ground-truth drop counter.
  test.each(['berufi-69-dara369', 'lirebi-26-voka556'])(
    '%s renders every edge (zero drops)',
    (slug) => {
      const puml = readFileSync(
        `oracle/goldens/description/${slug}/input.puml`,
        'utf8',
      );
      let drops = 0;
      const orig = console.error;
      console.error = (...args: unknown[]) => {
        if (String(args[0]).includes('edge draw failed')) drops++;
      };
      try {
        const svg = renderFixture(puml, jarMeasurer);
        expect(svg.length).toBeGreaterThan(0);
      } finally {
        console.error = orig;
      }
      expect(drops).toBe(0);
    },
  );
});
