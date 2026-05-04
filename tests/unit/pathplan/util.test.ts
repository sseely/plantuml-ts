import { describe, it, expect } from 'vitest';
import type { Ppoly, Ppolyline } from '../../../src/core/pathplan/index.js';
import { Ppolybarriers, make_polyline } from '../../../src/core/pathplan/index.js';

describe('Ppolybarriers', () => {
  it('converts a triangle polygon into 3 barrier edges', () => {
    const tri: Ppoly = {
      ps: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 5, y: 10 },
      ],
      pn: 3,
    };
    const barriers = Ppolybarriers([tri], 1);
    expect(barriers).toHaveLength(3);
    // Edge 0: (0,0)-(10,0)
    expect(barriers[0]!.a).toEqual({ x: 0, y: 0 });
    expect(barriers[0]!.b).toEqual({ x: 10, y: 0 });
    // Edge 2: (5,10)-(0,0) — wraps around
    expect(barriers[2]!.a).toEqual({ x: 5, y: 10 });
    expect(barriers[2]!.b).toEqual({ x: 0, y: 0 });
  });

  it('returns empty array for zero polygons', () => {
    expect(Ppolybarriers([], 0)).toHaveLength(0);
  });

  it('converts two separate polygons into combined barrier edges', () => {
    const sq1: Ppoly = {
      ps: [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 4 },
        { x: 0, y: 4 },
      ],
      pn: 4,
    };
    const sq2: Ppoly = {
      ps: [
        { x: 10, y: 0 },
        { x: 14, y: 0 },
        { x: 14, y: 4 },
      ],
      pn: 3,
    };
    const barriers = Ppolybarriers([sq1, sq2], 2);
    expect(barriers).toHaveLength(7); // 4 + 3
  });
});

describe('make_polyline', () => {
  it('converts a 2-point polyline into 4 spline knots', () => {
    const line: Ppolyline = {
      ps: [{ x: 0, y: 0 }, { x: 10, y: 0 }],
      pn: 2,
    };
    const sline: Ppolyline = { ps: [], pn: 0 };
    make_polyline(line, sline);
    // 2 pts at start + 2 pts at end = 4
    expect(sline.pn).toBe(4);
    expect(sline.ps[0]).toEqual({ x: 0, y: 0 });
    expect(sline.ps[1]).toEqual({ x: 0, y: 0 });
    expect(sline.ps[2]).toEqual({ x: 10, y: 0 });
    expect(sline.ps[3]).toEqual({ x: 10, y: 0 });
  });

  it('converts a 3-point polyline into 7 spline knots', () => {
    const line: Ppolyline = {
      ps: [{ x: 0, y: 0 }, { x: 5, y: 5 }, { x: 10, y: 0 }],
      pn: 3,
    };
    const sline: Ppolyline = { ps: [], pn: 0 };
    make_polyline(line, sline);
    // 4 + 3*(3-2) = 7
    expect(sline.pn).toBe(7);
    // Middle point appears 3 times
    expect(sline.ps[2]).toEqual({ x: 5, y: 5 });
    expect(sline.ps[3]).toEqual({ x: 5, y: 5 });
    expect(sline.ps[4]).toEqual({ x: 5, y: 5 });
  });

  it('converts a 4-point polyline into 10 spline knots', () => {
    const line: Ppolyline = {
      ps: [
        { x: 0, y: 0 },
        { x: 3, y: 3 },
        { x: 7, y: 3 },
        { x: 10, y: 0 },
      ],
      pn: 4,
    };
    const sline: Ppolyline = { ps: [], pn: 0 };
    make_polyline(line, sline);
    // 4 + 3*(4-2) = 10
    expect(sline.pn).toBe(10);
  });
});
