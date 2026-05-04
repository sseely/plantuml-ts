import { describe, it, expect } from 'vitest';
import type { Ppoint, Ppolyline, Pedge_t } from '../../../src/core/pathplan/index.js';
import { Proutespline } from '../../../src/core/pathplan/index.js';

function pt(x: number, y: number): Ppoint {
  return { x, y };
}

function makeBarrier(ax: number, ay: number, bx: number, by: number): Pedge_t {
  return { a: pt(ax, ay), b: pt(bx, by) };
}

describe('Proutespline', () => {
  it('given a straight-line path with no barriers, returns a path approximating the direct line', () => {
    const start = pt(0, 0);
    const end = pt(100, 0);
    const inputRoute: Ppolyline = { ps: [start, end], pn: 2 };
    const endpointSlopes: [Ppoint, Ppoint] = [pt(1, 0), pt(-1, 0)];
    const outputRoute: Ppolyline = { ps: [], pn: 0 };

    const result = Proutespline([], 0, inputRoute, endpointSlopes, outputRoute);

    expect(result).toBe(0);
    expect(outputRoute.pn).toBeGreaterThan(0);
    const last = outputRoute.ps[outputRoute.pn - 1]!;
    expect(last.x).toBeCloseTo(end.x, 0);
    expect(last.y).toBeCloseTo(end.y, 0);
  });

  it('given a path around a vertical barrier, the spline endpoint is correct', () => {
    const start = pt(0, 50);
    const mid = pt(50, 100);
    const end = pt(100, 50);
    const inputRoute: Ppolyline = { ps: [start, mid, end], pn: 3 };
    const endpointSlopes: [Ppoint, Ppoint] = [pt(1, 0), pt(-1, 0)];
    const outputRoute: Ppolyline = { ps: [], pn: 0 };
    const barriers: Pedge_t[] = [makeBarrier(50, 0, 50, 80)];

    const result = Proutespline(barriers, barriers.length, inputRoute, endpointSlopes, outputRoute);

    expect(result).toBe(0);
    expect(outputRoute.pn).toBeGreaterThan(0);
    const last = outputRoute.ps[outputRoute.pn - 1]!;
    expect(last.x).toBeCloseTo(end.x, 0);
    expect(last.y).toBeCloseTo(end.y, 0);
  });

  it('given a single-segment path (only start/end), produces 4 output points (1 + 3 cubic bezier)', () => {
    const start = pt(0, 0);
    const end = pt(60, 0);
    const inputRoute: Ppolyline = { ps: [start, end], pn: 2 };
    const endpointSlopes: [Ppoint, Ppoint] = [pt(1, 0), pt(-1, 0)];
    const outputRoute: Ppolyline = { ps: [], pn: 0 };

    const result = Proutespline([], 0, inputRoute, endpointSlopes, outputRoute);

    expect(result).toBe(0);
    expect(outputRoute.pn).toBe(4);
  });

  it('given zero-length endpoint slope vectors, they are treated as zero and fallback scale is used', () => {
    const start = pt(0, 0);
    const end = pt(50, 0);
    const inputRoute: Ppolyline = { ps: [start, end], pn: 2 };
    const endpointSlopes: [Ppoint, Ppoint] = [pt(0, 0), pt(0, 0)];
    const outputRoute: Ppolyline = { ps: [], pn: 0 };

    const result = Proutespline([], 0, inputRoute, endpointSlopes, outputRoute);

    expect(result).toBe(0);
    expect(outputRoute.pn).toBeGreaterThan(0);
  });

  it('given a diagonal barrier (non-axis-aligned), exercises the general splineintersectsline branch', () => {
    const start = pt(0, 0);
    const end = pt(100, 0);
    const inputRoute: Ppolyline = { ps: [start, pt(50, 30), end], pn: 3 };
    const endpointSlopes: [Ppoint, Ppoint] = [pt(1, 0), pt(-1, 0)];
    const outputRoute: Ppolyline = { ps: [], pn: 0 };
    const barriers: Pedge_t[] = [makeBarrier(40, -10, 60, 10)];

    const result = Proutespline(barriers, barriers.length, inputRoute, endpointSlopes, outputRoute);

    expect(result).toBe(0);
    expect(outputRoute.pn).toBeGreaterThan(0);
    const last = outputRoute.ps[outputRoute.pn - 1]!;
    expect(last.x).toBeCloseTo(end.x, 0);
    expect(last.y).toBeCloseTo(end.y, 0);
  });

  it('given many waypoints, exercises mkspline with large det01', () => {
    const pts: Ppoint[] = [
      pt(0, 0), pt(20, 5), pt(40, 15), pt(60, 10), pt(80, 0), pt(100, 0),
    ];
    const inputRoute: Ppolyline = { ps: pts, pn: pts.length };
    const endpointSlopes: [Ppoint, Ppoint] = [pt(0.8, 0.6), pt(-0.8, -0.6)];
    const outputRoute: Ppolyline = { ps: [], pn: 0 };

    const result = Proutespline([], 0, inputRoute, endpointSlopes, outputRoute);

    expect(result).toBe(0);
    expect(outputRoute.pn).toBeGreaterThan(0);
    const last = outputRoute.ps[outputRoute.pn - 1]!;
    expect(last.x).toBeCloseTo(100, 0);
    expect(last.y).toBeCloseTo(0, 0);
  });

  it('given a 2-point path with a barrier that blocks every spline, exercises forceflag=1 path', () => {
    // A 2-pt route (forceflag=1) where the only barrier blocks every candidate spline
    // starting from a=4 down to a=0, forcing the fallback forced-straight output.
    // We use multiple overlapping horizontal barriers to ensure splineisinside always fails.
    const start = pt(0, 0);
    const end = pt(100, 0);
    const inputRoute: Ppolyline = { ps: [start, end], pn: 2 };
    // Use horizontal slope vectors so the spline stays near y=0
    const endpointSlopes: [Ppoint, Ppoint] = [pt(1, 0), pt(-1, 0)];
    const outputRoute: Ppolyline = { ps: [], pn: 0 };
    // Dense barrier that crosses the spline interior at every scale of a
    const barriers: Pedge_t[] = [
      makeBarrier(50, -50, 50, 50),  // vertical through midpoint
    ];

    const result = Proutespline(barriers, barriers.length, inputRoute, endpointSlopes, outputRoute);

    // forceflag forces output even when blocked; still returns 0 and 4 points
    expect(result).toBe(0);
    expect(outputRoute.pn).toBe(4);
  });

  it('given a point-barrier (degenerate edge: both endpoints same), exercises xcoeff[1]=0 ycoeff[1]=0 path', () => {
    // Barrier with a === b — delta_x=0, delta_y=0 — triggers degenerate point case
    const start = pt(0, 0);
    const end = pt(100, 0);
    const inputRoute: Ppolyline = { ps: [start, end], pn: 2 };
    const endpointSlopes: [Ppoint, Ppoint] = [pt(1, 0), pt(-1, 0)];
    const outputRoute: Ppolyline = { ps: [], pn: 0 };
    // Point barrier at x=50, y=0 — same start and end
    const barriers: Pedge_t[] = [makeBarrier(50, 0, 50, 0)];

    const result = Proutespline(barriers, barriers.length, inputRoute, endpointSlopes, outputRoute);

    expect(result).toBe(0);
    expect(outputRoute.pn).toBeGreaterThan(0);
  });
});
