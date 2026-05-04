import { describe, it, expect } from 'vitest';
import type { Ppoint, Ppolyline, Ppoly } from '../../../src/core/pathplan/index.js';
import { Pshortestpath } from '../../../src/core/pathplan/index.js';

function pt(x: number, y: number): Ppoint {
  return { x, y };
}

describe('Pshortestpath', () => {
  it('given endpoints in the same triangle, returns a 2-point straight path', () => {
    const poly: Ppoly = {
      ps: [pt(0, 0), pt(100, 0), pt(50, 100)],
      pn: 3,
    };
    const eps: [Ppoint, Ppoint] = [pt(25, 20), pt(60, 30)];
    const output: Ppolyline = { ps: [], pn: 0 };

    const result = Pshortestpath(poly, eps, output);

    expect(result).toBe(0);
    expect(output.pn).toBe(2);
    expect(output.ps[0]!.x).toBeCloseTo(eps[0].x);
    expect(output.ps[0]!.y).toBeCloseTo(eps[0].y);
    expect(output.ps[1]!.x).toBeCloseTo(eps[1].x);
    expect(output.ps[1]!.y).toBeCloseTo(eps[1].y);
  });

  it('given endpoints in different triangles of a convex polygon, returns a valid path', () => {
    const poly: Ppoly = {
      ps: [
        pt(0, 50),
        pt(50, 0),
        pt(150, 0),
        pt(200, 50),
        pt(150, 100),
        pt(50, 100),
      ],
      pn: 6,
    };
    const eps: [Ppoint, Ppoint] = [pt(20, 50), pt(180, 50)];
    const output: Ppolyline = { ps: [], pn: 0 };

    const result = Pshortestpath(poly, eps, output);

    expect(result).toBe(0);
    expect(output.pn).toBeGreaterThanOrEqual(2);
    expect(output.ps[0]!.x).toBeCloseTo(eps[0].x);
    expect(output.ps[0]!.y).toBeCloseTo(eps[0].y);
    const last = output.ps[output.pn - 1]!;
    expect(last.x).toBeCloseTo(eps[1].x);
    expect(last.y).toBeCloseTo(eps[1].y);
  });

  it('given a rectangular polygon, returns a path that stays inside', () => {
    const poly: Ppoly = {
      ps: [pt(0, 0), pt(200, 0), pt(200, 100), pt(0, 100)],
      pn: 4,
    };
    const eps: [Ppoint, Ppoint] = [pt(10, 10), pt(190, 90)];
    const output: Ppolyline = { ps: [], pn: 0 };

    const result = Pshortestpath(poly, eps, output);

    expect(result).toBe(0);
    expect(output.pn).toBeGreaterThanOrEqual(2);
    expect(output.ps[0]!.x).toBeCloseTo(eps[0].x);
    expect(output.ps[0]!.y).toBeCloseTo(eps[0].y);
    const last = output.ps[output.pn - 1]!;
    expect(last.x).toBeCloseTo(eps[1].x);
    expect(last.y).toBeCloseTo(eps[1].y);
  });

  it('given a CW-ordered polygon, normalizes to CCW and still succeeds', () => {
    const poly: Ppoly = {
      ps: [pt(0, 0), pt(0, 100), pt(200, 100), pt(200, 0)],
      pn: 4,
    };
    const eps: [Ppoint, Ppoint] = [pt(10, 50), pt(190, 50)];
    const output: Ppolyline = { ps: [], pn: 0 };

    const result = Pshortestpath(poly, eps, output);

    expect(result).toBe(0);
    expect(output.pn).toBeGreaterThanOrEqual(2);
  });

  it('given a non-convex (L-shaped) polygon, finds path through the corridor', () => {
    const poly: Ppoly = {
      ps: [
        pt(0, 0),
        pt(100, 0),
        pt(100, 50),
        pt(50, 50),
        pt(50, 100),
        pt(0, 100),
      ],
      pn: 6,
    };
    const eps: [Ppoint, Ppoint] = [pt(20, 80), pt(80, 20)];
    const output: Ppolyline = { ps: [], pn: 0 };

    const result = Pshortestpath(poly, eps, output);

    expect(result).toBe(0);
    expect(output.pn).toBeGreaterThanOrEqual(2);
    expect(output.ps[0]!.x).toBeCloseTo(eps[0].x);
    expect(output.ps[0]!.y).toBeCloseTo(eps[0].y);
    const last = output.ps[output.pn - 1]!;
    expect(last.x).toBeCloseTo(eps[1].x);
    expect(last.y).toBeCloseTo(eps[1].y);
  });

  it('given a wide rectangle traversed from left to right, exercises the ISCCW edge-swap branch', () => {
    const poly: Ppoly = {
      ps: [pt(0, 0), pt(300, 0), pt(300, 50), pt(0, 50)],
      pn: 4,
    };
    const eps: [Ppoint, Ppoint] = [pt(10, 25), pt(290, 25)];
    const output: Ppolyline = { ps: [], pn: 0 };

    const result = Pshortestpath(poly, eps, output);

    expect(result).toBe(0);
    expect(output.pn).toBeGreaterThanOrEqual(2);
    expect(output.ps[0]!.x).toBeCloseTo(eps[0].x);
    expect(output.ps[0]!.y).toBeCloseTo(eps[0].y);
    const last = output.ps[output.pn - 1]!;
    expect(last.x).toBeCloseTo(eps[1].x);
    expect(last.y).toBeCloseTo(eps[1].y);
  });

  it('given a tall pentagon, exercises multi-triangle traversal with deque splits', () => {
    const poly: Ppoly = {
      ps: [
        pt(100, 0),
        pt(200, 80),
        pt(150, 200),
        pt(50, 200),
        pt(0, 80),
      ],
      pn: 5,
    };
    const eps: [Ppoint, Ppoint] = [pt(90, 40), pt(110, 160)];
    const output: Ppolyline = { ps: [], pn: 0 };

    const result = Pshortestpath(poly, eps, output);

    expect(result).toBe(0);
    expect(output.pn).toBeGreaterThanOrEqual(2);
    expect(output.ps[0]!.x).toBeCloseTo(eps[0].x);
    expect(output.ps[0]!.y).toBeCloseTo(eps[0].y);
    const last = output.ps[output.pn - 1]!;
    expect(last.x).toBeCloseTo(eps[1].x);
    expect(last.y).toBeCloseTo(eps[1].y);
  });

  it('given a rectangle with reversed start and end (right to left), exercises alternative traversal order', () => {
    // Start from right side, end at left — forces funnel to traverse in the reverse
    // triangle order, which can exercise the ISCCW branch depending on triangle creation order
    const poly: Ppoly = {
      ps: [pt(0, 0), pt(200, 0), pt(200, 100), pt(0, 100)],
      pn: 4,
    };
    const eps: [Ppoint, Ppoint] = [pt(180, 50), pt(20, 50)];
    const output: Ppolyline = { ps: [], pn: 0 };

    const result = Pshortestpath(poly, eps, output);

    expect(result).toBe(0);
    expect(output.pn).toBeGreaterThanOrEqual(2);
    expect(output.ps[0]!.x).toBeCloseTo(eps[0].x);
    expect(output.ps[0]!.y).toBeCloseTo(eps[0].y);
    const last = output.ps[output.pn - 1]!;
    expect(last.x).toBeCloseTo(eps[1].x);
    expect(last.y).toBeCloseTo(eps[1].y);
  });

  it('given a 7-sided polygon, exercises deeper funnel traversal across multiple triangles', () => {
    // A convex 7-gon (regular heptagon approximation) — endpoints at extremes
    const poly: Ppoly = {
      ps: [
        pt(100, 0),
        pt(200, 0),
        pt(250, 80),
        pt(200, 160),
        pt(100, 160),
        pt(50, 80),
      ],
      pn: 6,
    };
    const eps: [Ppoint, Ppoint] = [pt(110, 20), pt(190, 140)];
    const output: Ppolyline = { ps: [], pn: 0 };

    const result = Pshortestpath(poly, eps, output);

    expect(result).toBe(0);
    expect(output.pn).toBeGreaterThanOrEqual(2);
  });
});
