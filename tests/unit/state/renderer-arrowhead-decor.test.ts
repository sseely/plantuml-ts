/**
 * Feature: `buildCircleEndMarkup`/`buildCrossStartMarkup` (mission G4 S15,
 * `-->o`/`x-->` arrow decorations, `LinkDecor.ARROW_AND_CIRCLE`/
 * `CIRCLE_CROSS`).
 *
 * Jar-verified byte-exact against `xexika-61-fedu273`'s own two decorated
 * edges (`[*] -->o foo`, `foo x--> foo`):
 *   - `-->o` (`circleEnd`): `<ellipse cx="32" cy="85.52" rx="5" ry="5"
 *     fill="#808080" style="stroke:#181818;stroke-width:1.5;"/>` — centered
 *     at the transition's RAW (pre-trim) head endpoint (`points[last]`,
 *     the SAME point `buildTransitionArrowhead`'s own polygon tip anchors
 *     on), radius 5, fill = diagram background, stroke = arrow color.
 *   - `x-->` (`crossStart`): `<ellipse cx="57.28" cy="94.93" rx="7" ry="7"
 *     .../><line x1="62.2297" y1="99.8797" x2="52.3303" y2="89.9803" .../>
 *     <line x1="62.2297" y1="89.9803" x2="52.3303" y2="99.8797" .../>` —
 *     centered at `points[0]` (the RAW tail endpoint), radius 7, plus two
 *     diagonal lines at literal ±45deg (axis-aligned, NOT rotated to the
 *     edge's own tangent — `ExtremityFactoryCircleCross#createUDrawable`
 *     drops the `angle` parameter entirely).
 *
 * @see plans/g4-state-svg/ledger.md (S15)
 */
import { describe, it, expect } from 'vitest';
import {
  buildCircleEndMarkup,
  buildCrossStartMarkup,
} from '../../../src/diagrams/state/renderer-arrowhead.js';
import type { TransitionGeo } from '../../../src/diagrams/state/state-geo-types.js';

const ARROW_COLOR = '#181818';
const BACKGROUND = '#808080';

function transition(points: ReadonlyArray<{ x: number; y: number }>): TransitionGeo {
  return { from: 'a', to: 'b', points: [...points] };
}

describe('buildCircleEndMarkup', () => {
  it('draws a background-filled ellipse at the RAW head endpoint', () => {
    const t = transition([
      { x: 32, y: 61.070988313804264 },
      { x: 32, y: 85.51594541319542 },
    ]);
    const svg = buildCircleEndMarkup(t, ARROW_COLOR, BACKGROUND);
    expect(svg).toContain('cx="32"');
    expect(svg).toContain('cy="85.51594541319542"');
    expect(svg).toContain('rx="5"');
    expect(svg).toContain('ry="5"');
    expect(svg).toContain(`fill="${BACKGROUND}"`);
    expect(svg).toContain(`stroke="${ARROW_COLOR}"`);
    expect(svg).toContain('stroke-width="1.5"');
  });

  it('returns empty markup when the transition has no points', () => {
    expect(buildCircleEndMarkup(transition([]), ARROW_COLOR, BACKGROUND)).toBe('');
  });
});

describe('buildCrossStartMarkup', () => {
  it('draws a background-filled ellipse plus two axis-aligned diagonal lines at the RAW tail endpoint', () => {
    const t = transition([
      { x: 57.2777099609375, y: 94.927001953125 },
      { x: 74.7734375, y: 90.056396484375 },
    ]);
    const svg = buildCrossStartMarkup(t, ARROW_COLOR, BACKGROUND);
    expect(svg).toContain('cx="57.2777099609375"');
    expect(svg).toContain('cy="94.927001953125"');
    expect(svg).toContain('rx="7"');
    expect(svg).toContain('ry="7"');
    expect(svg).toContain(`fill="${BACKGROUND}"`);
    // Two diagonal lines, stroke-width 1 (NOT the ellipse's own 1.5).
    expect((svg.match(/<line /g) ?? []).length).toBe(2);
    expect(svg).toContain('x1="62.22745742924333"');
    expect(svg).toContain('y1="99.87674942143083"');
    expect(svg).toContain('x2="52.32796249263167"');
    expect(svg).toContain('y2="89.97725448481917"');
    expect(svg).toContain('stroke-width="1"');
  });

  it('is unaffected by the edge tangent angle -- same cross shape regardless of direction', () => {
    const horizontal = transition([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ]);
    const vertical = transition([
      { x: 0, y: 0 },
      { x: 0, y: 10 },
    ]);
    // Both anchor at (0,0) -- the cross geometry (radius, ±45deg lines) does
    // not depend on the second point at all, only on `points[0]`.
    const a = buildCrossStartMarkup(horizontal, ARROW_COLOR, BACKGROUND);
    const b = buildCrossStartMarkup(vertical, ARROW_COLOR, BACKGROUND);
    expect(a).toBe(b);
  });

  it('returns empty markup when the transition has no points', () => {
    expect(buildCrossStartMarkup(transition([]), ARROW_COLOR, BACKGROUND)).toBe('');
  });
});
