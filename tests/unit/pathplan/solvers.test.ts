import { describe, it, expect } from 'vitest';
import { solve3 } from '../../../src/core/pathplan/index.js';

describe('solve3', () => {
  it('cubic with 3 distinct real roots (negative discriminant path)', () => {
    // x^3 - 6x^2 + 11x - 6 = 0 => roots 1, 2, 3
    // coeff[0]=d, coeff[1]=c, coeff[2]=b, coeff[3]=a  =>  a=1, b=-6, c=11, d=-6
    const coeff = [-6, 11, -6, 1];
    const roots = [0, 0, 0];
    const n = solve3(coeff, roots);
    expect(n).toBe(3);
    const sorted = roots.slice(0, 3).sort((a, b) => a - b);
    expect(sorted[0]).toBeCloseTo(1, 5);
    expect(sorted[1]).toBeCloseTo(2, 5);
    expect(sorted[2]).toBeCloseTo(3, 5);
  });

  it('cubic with 1 real root (positive discriminant path)', () => {
    // x^3 + x + 2 = 0 => coeff[d,c,b,a] = [2,1,0,1], real root = -1
    const coeff = [2, 1, 0, 1];
    const roots = [0, 0, 0];
    const n = solve3(coeff, roots);
    expect(n).toBe(1);
    expect(roots[0]).toBeCloseTo(-1, 5);
  });

  it('cubic with triple root (zero discriminant path)', () => {
    // (x-2)^3 = x^3 - 6x^2 + 12x - 8 => a=1, b=-6, c=12, d=-8
    const coeff = [-8, 12, -6, 1];
    const roots = [0, 0, 0];
    const n = solve3(coeff, roots);
    expect(n).toBe(3);
    for (let i = 0; i < 3; i++) {
      expect(roots[i]).toBeCloseTo(2, 4);
    }
  });

  it('falls through to solve2 when a≈0 — quadratic with 2 roots', () => {
    // 0*x^3 + x^2 - 5x + 6 = 0 => roots 2, 3
    const coeff = [6, -5, 1, 0];
    const roots = [0, 0, 0];
    const n = solve3(coeff, roots);
    expect(n).toBe(2);
    const sorted = roots.slice(0, 2).sort((a, b) => a - b);
    expect(sorted[0]).toBeCloseTo(2, 5);
    expect(sorted[1]).toBeCloseTo(3, 5);
  });

  it('falls through to solve2 when a≈0 — quadratic with 1 root (disc=0)', () => {
    // x^2 - 4x + 4 = 0 => root 2
    const coeff = [4, -4, 1, 0];
    const roots = [0, 0];
    const n = solve3(coeff, roots);
    expect(n).toBe(1);
    expect(roots[0]).toBeCloseTo(2, 5);
  });

  it('falls through to solve2, then solve1 when a≈0 and b≈0 — linear root', () => {
    // 0*x^2 + 3x - 6 = 0 => root 2
    const coeff = [-6, 3, 0, 0];
    const roots = [0];
    const n = solve3(coeff, roots);
    expect(n).toBe(1);
    expect(roots[0]).toBeCloseTo(2, 5);
  });

  it('falls all the way to solve1 — both a≈0 and b≈0 and c≈0 — returns 4 (identity)', () => {
    // 0*x^3 + 0*x^2 + 0*x + 0 = 0 => all x satisfy
    const coeff = [0, 0, 0, 0];
    const roots: number[] = [];
    const n = solve3(coeff, roots);
    expect(n).toBe(4);
  });

  it('falls to solve1 — a≈0, b≈0, c≈0, non-zero d — returns 0 (no roots)', () => {
    // 0=5, inconsistent
    const coeff = [5, 0, 0, 0];
    const roots: number[] = [];
    const n = solve3(coeff, roots);
    expect(n).toBe(0);
  });

  it('quadratic no real roots (negative discriminant) returns 0', () => {
    // x^2 + x + 1 = 0 — no real roots
    const coeff = [1, 1, 1, 0];
    const roots: number[] = [];
    const n = solve3(coeff, roots);
    expect(n).toBe(0);
  });
});
