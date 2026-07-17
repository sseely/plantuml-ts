/**
 * Direct unit tests for `renderer-arrowhead.ts` -- `buildEdgeArrowheads`'s
 * guard branches and `applyDecorTrim` (G2 N28's own `SvekEdge#drawU`
 * `dotPath.moveStartPoint`/`.moveEndPoint` render-side counterpart), tested
 * in isolation from the full `renderClass` pipeline (`renderer.test.ts`
 * covers the composed behavior). Per `~/.claude/rules/testability.md`:
 * both are pure functions, preferred over exercising them only indirectly.
 */
import { describe, it, expect } from 'vitest';
import { buildEdgeArrowheads, applyDecorTrim, decorName } from '../../../src/diagrams/class/renderer-arrowhead.js';
import type { EdgeGeo } from '../../../src/diagrams/class/layout.js';
import { defaultTheme } from '../../../src/core/theme.js';

function makeEdgeGeo(overrides?: Partial<EdgeGeo>): EdgeGeo {
  return {
    id: 'edge-0',
    points: [
      { x: 70, y: 70 },
      { x: 70, y: 140 },
    ],
    targetDecor: 'none',
    sourceDecor: 'none',
    dashed: false,
    from: 'A',
    to: 'B',
    ...overrides,
  };
}

describe('decorName', () => {
  it('maps every non-none LinkDecor to a LinkDecorName', () => {
    expect(decorName('triangle')).toBe('EXTENDS');
    expect(decorName('square')).toBe('SQUARE');
    expect(decorName('plus')).toBe('PLUS');
    expect(decorName('parenthesis')).toBe('PARENTHESIS');
    expect(decorName('crowfoot')).toBe('CROWFOOT');
    expect(decorName('circleCrowfoot')).toBe('CIRCLE_CROWFOOT');
    expect(decorName('circleLine')).toBe('CIRCLE_LINE');
    expect(decorName('doubleLine')).toBe('DOUBLE_LINE');
    expect(decorName('lineCrowfoot')).toBe('LINE_CROWFOOT');
  });

  it('maps none to undefined', () => {
    expect(decorName('none')).toBeUndefined();
  });
});

describe('buildEdgeArrowheads — guard branches', () => {
  it('returns empty arrowheads when neither end carries a decor', () => {
    const result = buildEdgeArrowheads(makeEdgeGeo(), defaultTheme.colors.arrow, defaultTheme.colors.background);
    expect(result).toEqual({ tail: '', head: '', extraDefs: '' });
  });

  // A decor-bearing edge with fewer than 2 points cannot anchor a direction
  // -- structurally unreachable via a real dot-layout edge (every laid-out
  // edge has >= 2 points), but a defensive guard the class engine's own
  // layout invariants do not otherwise rule out for a hand-built EdgeGeo.
  it('returns empty arrowheads when a decorated edge has fewer than 2 points', () => {
    const result = buildEdgeArrowheads(
      makeEdgeGeo({ sourceDecor: 'square', points: [{ x: 70, y: 70 }] }),
      defaultTheme.colors.arrow,
      defaultTheme.colors.background,
    );
    expect(result).toEqual({ tail: '', head: '', extraDefs: '' });
  });

  it('returns tailTrim only when just the source end is decorated', () => {
    const result = buildEdgeArrowheads(
      makeEdgeGeo({ sourceDecor: 'square' }),
      defaultTheme.colors.arrow,
      defaultTheme.colors.background,
    );
    expect(result.tailTrim).toBeDefined();
    expect(result.headTrim).toBeUndefined();
    expect(result.tail).not.toBe('');
    expect(result.head).toBe('');
  });

  it('returns headTrim only when just the target end is decorated', () => {
    const result = buildEdgeArrowheads(
      makeEdgeGeo({ targetDecor: 'plus' }),
      defaultTheme.colors.arrow,
      defaultTheme.colors.background,
    );
    expect(result.headTrim).toBeDefined();
    expect(result.tailTrim).toBeUndefined();
  });
});

describe('applyDecorTrim', () => {
  const points = [
    { x: 70, y: 70 },
    { x: 70, y: 90 },
    { x: 70, y: 120 },
    { x: 70, y: 140 },
  ];

  it('returns the input unchanged when neither trim is present', () => {
    const result = applyDecorTrim(points, undefined, undefined);
    expect(result).toEqual(points);
  });

  it('returns the input unchanged for a sub-2-point list even with a trim', () => {
    const single = [{ x: 5, y: 5 }];
    const result = applyDecorTrim(single, { x: 1, y: 1 }, undefined);
    expect(result).toEqual(single);
  });

  it('shifts the first two points by tailTrim on a 4-point (1+3n) spline', () => {
    const result = applyDecorTrim(points, { x: 0, y: 5 }, undefined);
    expect(result[0]).toEqual({ x: 70, y: 75 });
    expect(result[1]).toEqual({ x: 70, y: 95 });
    // Untouched: the far control point and the final endpoint.
    expect(result[2]).toEqual({ x: 70, y: 120 });
    expect(result[3]).toEqual({ x: 70, y: 140 });
  });

  it('shifts the last two points by headTrim on a 4-point (1+3n) spline', () => {
    const result = applyDecorTrim(points, undefined, { x: 0, y: -5 });
    expect(result[3]).toEqual({ x: 70, y: 135 });
    expect(result[2]).toEqual({ x: 70, y: 115 });
    // Untouched: the start point and its adjacent control point.
    expect(result[0]).toEqual({ x: 70, y: 70 });
    expect(result[1]).toEqual({ x: 70, y: 90 });
  });

  it('applies both trims simultaneously without mutating the input array', () => {
    const result = applyDecorTrim(points, { x: 0, y: 5 }, { x: 0, y: -5 });
    expect(result[0]).toEqual({ x: 70, y: 75 });
    expect(result[3]).toEqual({ x: 70, y: 135 });
    expect(points[0]).toEqual({ x: 70, y: 70 }); // original untouched
  });

  it('shifts only the single start/end point on a plain 2-point secant', () => {
    const secant = [{ x: 70, y: 70 }, { x: 70, y: 140 }];
    const result = applyDecorTrim(secant, { x: 0, y: 5 }, { x: 0, y: -5 });
    expect(result).toEqual([{ x: 70, y: 75 }, { x: 70, y: 135 }]);
  });
});
