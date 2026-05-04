import { describe, it, expect } from 'vitest';
import { routesplines, makePolyline } from '../../../src/core/common/routespl.js';

type Point = { x: number; y: number };

function approxEqual(a: number, b: number, eps = 1e-6): boolean {
  return Math.abs(a - b) <= eps;
}

describe('makePolyline', () => {
  it('converts [A, B] to [A,A, B,B]', () => {
    const pts: Point[] = [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
    ];
    const result = makePolyline(pts);
    expect(result).toHaveLength(4);
    expect(result[0]).toEqual({ x: 0, y: 0 });
    expect(result[1]).toEqual({ x: 0, y: 0 });
    expect(result[2]).toEqual({ x: 10, y: 10 });
    expect(result[3]).toEqual({ x: 10, y: 10 });
  });

  it('converts [A, B, C] to [A,A, B,B,B, C,C]', () => {
    const pts: Point[] = [
      { x: 0, y: 0 },
      { x: 5, y: 5 },
      { x: 10, y: 0 },
    ];
    const result = makePolyline(pts);
    expect(result).toHaveLength(7);
    expect(result[0]).toEqual({ x: 0, y: 0 });
    expect(result[1]).toEqual({ x: 0, y: 0 });
    expect(result[2]).toEqual({ x: 5, y: 5 });
    expect(result[3]).toEqual({ x: 5, y: 5 });
    expect(result[4]).toEqual({ x: 5, y: 5 });
    expect(result[5]).toEqual({ x: 10, y: 0 });
    expect(result[6]).toEqual({ x: 10, y: 0 });
  });

  it('single point returns [A, A]', () => {
    const pts: Point[] = [{ x: 3, y: 7 }];
    const result = makePolyline(pts);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ x: 3, y: 7 });
    expect(result[1]).toEqual({ x: 3, y: 7 });
  });

  it('4-point polyline returns 10 control points', () => {
    const pts: Point[] = [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
      { x: 20, y: 10 },
      { x: 30, y: 0 },
    ];
    const result = makePolyline(pts);
    expect(result).toHaveLength(10);
  });
});

describe('routesplines', () => {
  it('AC2: 3 collinear points [(0,0),(50,50),(100,100)] produces spline approximating a straight line', () => {
    const pts: Point[] = [
      { x: 0, y: 0 },
      { x: 50, y: 50 },
      { x: 100, y: 100 },
    ];
    const result = routesplines(pts);
    expect(result.length).toBeGreaterThanOrEqual(4);
    expect(result[0]).toEqual({ x: 0, y: 0 });
    const last = result[result.length - 1]!;
    expect(approxEqual(last.x, 100, 1)).toBe(true);
    expect(approxEqual(last.y, 100, 1)).toBe(true);
    for (const p of result) {
      expect(Math.abs(p.x - p.y)).toBeLessThan(5);
    }
  });

  it('AC3: 4 points with 90° turn produces control points interpolating through endpoints', () => {
    const pts: Point[] = [
      { x: 0, y: 0 },
      { x: 0, y: 50 },
      { x: 50, y: 50 },
      { x: 100, y: 50 },
    ];
    const result = routesplines(pts);
    expect(result.length).toBeGreaterThanOrEqual(4);
    expect(result[0]).toEqual({ x: 0, y: 0 });
    const last = result[result.length - 1]!;
    expect(approxEqual(last.x, 100, 1)).toBe(true);
    expect(approxEqual(last.y, 50, 1)).toBe(true);
  });

  it('2 points returns a straight 4-point cubic bezier (degenerate)', () => {
    const pts: Point[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ];
    const result = routesplines(pts);
    expect(result.length).toBe(4);
    expect(result[0]).toEqual({ x: 0, y: 0 });
    expect(result[3]).toEqual({ x: 100, y: 0 });
  });

  it('single point returns that single point unchanged', () => {
    const pts: Point[] = [{ x: 5, y: 10 }];
    const result = routesplines(pts);
    expect(result).toEqual([{ x: 5, y: 10 }]);
  });

  it('empty input returns empty output', () => {
    const result = routesplines([]);
    expect(result).toEqual([]);
  });

  it('start tangent influences first control point direction for non-collinear path', () => {
    const pts: Point[] = [
      { x: 0, y: 0 },
      { x: 50, y: 50 },
      { x: 100, y: 0 },
    ];
    const resultNoTangent = routesplines(pts);
    const resultWithTangent = routesplines(pts, { x: 0, y: 1 });
    expect(resultWithTangent).not.toEqual(resultNoTangent);
  });

  it('end tangent influences last control point direction for non-collinear path', () => {
    const pts: Point[] = [
      { x: 0, y: 0 },
      { x: 50, y: 50 },
      { x: 100, y: 0 },
    ];
    const resultNoTangent = routesplines(pts);
    const resultWithEndTangent = routesplines(pts, undefined, { x: 0, y: 1 });
    expect(resultWithEndTangent).not.toEqual(resultNoTangent);
  });

  it('output length satisfies cubic bezier invariant: (length - 1) mod 3 == 0', () => {
    const pts3: Point[] = [
      { x: 0, y: 0 },
      { x: 50, y: 50 },
      { x: 100, y: 0 },
    ];
    const result3 = routesplines(pts3);
    expect(result3.length).toBeGreaterThanOrEqual(4);
    expect((result3.length - 1) % 3).toBe(0);

    const pts4: Point[] = [
      { x: 0, y: 0 },
      { x: 33, y: 33 },
      { x: 66, y: 33 },
      { x: 100, y: 0 },
    ];
    const result4 = routesplines(pts4);
    expect(result4.length).toBeGreaterThanOrEqual(4);
    expect((result4.length - 1) % 3).toBe(0);
  });

  it('preserves start point exactly', () => {
    const pts: Point[] = [
      { x: 12.5, y: 34.7 },
      { x: 50, y: 80 },
      { x: 100, y: 34.7 },
    ];
    const result = routesplines(pts);
    expect(result[0]).toEqual({ x: 12.5, y: 34.7 });
  });

  it('preserves end point exactly', () => {
    const pts: Point[] = [
      { x: 0, y: 0 },
      { x: 50, y: 80 },
      { x: 99.9, y: 1.1 },
    ];
    const result = routesplines(pts);
    expect(result[result.length - 1]).toEqual({ x: 99.9, y: 1.1 });
  });
});
