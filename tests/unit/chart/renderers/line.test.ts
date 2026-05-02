import { describe, it, expect } from 'vitest';
import { drawLine } from '../../../../src/diagrams/chart/renderers/line.js';
import type { LineSeriesGeo } from '../../../../src/diagrams/chart/layout.js';
import type { Theme } from '../../../../src/core/theme.js';

// ---------------------------------------------------------------------------
// Minimal stub — drawLine only uses Theme as a parameter type; no properties
// are accessed inside the function.
// ---------------------------------------------------------------------------
const THEME = {} as Theme;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGeo(
  pointValues: number[],
  overrides: Partial<Omit<LineSeriesGeo, 'points' | 'type'>> = {},
): LineSeriesGeo {
  return {
    type: 'line',
    name: 'Series A',
    color: '#8888FF',
    showLabels: false,
    markerShape: 'circle',
    points: pointValues.map((v, i) => ({ x: i * 50 + 50, y: 200 - v, value: v })),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// AC1 — 4 points → exactly 3 <line> elements
// ---------------------------------------------------------------------------
describe('drawLine — line segments', () => {
  it('AC1: 4 points produce exactly 3 <line> elements', () => {
    const svg = drawLine(makeGeo([10, 20, 30, 40]), THEME);
    const matches = svg.match(/<line /g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// AC2 — circle markers
// ---------------------------------------------------------------------------
describe('drawLine — circle markers', () => {
  it('AC2: markerShape=circle with 4 points → 4 <circle> elements', () => {
    const svg = drawLine(makeGeo([10, 20, 30, 40], { markerShape: 'circle' }), THEME);
    const matches = svg.match(/<circle /g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// AC3 — square markers
// ---------------------------------------------------------------------------
describe('drawLine — square markers', () => {
  it('AC3: markerShape=square → <rect> marker elements present', () => {
    const svg = drawLine(makeGeo([10, 20, 30, 40], { markerShape: 'square' }), THEME);
    // The SVG should contain rect elements (one per point = 4)
    const matches = svg.match(/<rect /g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBe(4);
  });

  it('AC3: markerShape=square → no <circle> elements', () => {
    const svg = drawLine(makeGeo([10, 20], { markerShape: 'square' }), THEME);
    expect(svg).not.toContain('<circle ');
  });
});

// ---------------------------------------------------------------------------
// AC4 — triangle markers
// ---------------------------------------------------------------------------
describe('drawLine — triangle markers', () => {
  it('AC4: markerShape=triangle → <polygon> elements present', () => {
    const svg = drawLine(makeGeo([10, 20, 30, 40], { markerShape: 'triangle' }), THEME);
    const matches = svg.match(/<polygon /g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// AC5 — data labels
// ---------------------------------------------------------------------------
describe('drawLine — data labels', () => {
  it('AC5: showLabels=true, point value 75 → SVG contains text "75"', () => {
    const geo: LineSeriesGeo = {
      type: 'line',
      name: 'S',
      color: '#FF0000',
      showLabels: true,
      markerShape: 'circle',
      points: [{ x: 100, y: 125, value: 75 }],
    };
    const svg = drawLine(geo, THEME);
    expect(svg).toContain('>75<');
  });

  it('AC5: showLabels=true renders one label per point', () => {
    const svg = drawLine(
      makeGeo([10, 20, 30], { showLabels: true }),
      THEME,
    );
    const matches = svg.match(/<text /g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBe(3);
  });

  it('showLabels=false → no <text> elements', () => {
    const svg = drawLine(makeGeo([10, 20, 30], { showLabels: false }), THEME);
    expect(svg).not.toContain('<text ');
  });
});

// ---------------------------------------------------------------------------
// AC6 — single point
// ---------------------------------------------------------------------------
describe('drawLine — single point', () => {
  it('AC6: single point → no <line> elements', () => {
    const svg = drawLine(makeGeo([42]), THEME);
    expect(svg).not.toContain('<line ');
  });

  it('AC6: single point → one marker element', () => {
    const svg = drawLine(makeGeo([42], { markerShape: 'circle' }), THEME);
    const matches = svg.match(/<circle /g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// AC7 — zero points
// ---------------------------------------------------------------------------
describe('drawLine — zero points', () => {
  it('AC7: empty points array → empty string', () => {
    const geo: LineSeriesGeo = {
      type: 'line',
      name: 'Empty',
      color: '#000000',
      showLabels: false,
      markerShape: 'circle',
      points: [],
    };
    expect(drawLine(geo, THEME)).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Additional correctness checks
// ---------------------------------------------------------------------------
describe('drawLine — SVG attribute correctness', () => {
  it('line segments use geo.color for stroke', () => {
    const svg = drawLine(makeGeo([10, 20], { color: '#AABBCC' }), THEME);
    expect(svg).toContain('stroke="#AABBCC"');
  });

  it('line segments have stroke-width="2"', () => {
    const svg = drawLine(makeGeo([10, 20]), THEME);
    expect(svg).toContain('stroke-width="2"');
  });

  it('circle markers use geo.color for fill', () => {
    const svg = drawLine(makeGeo([10], { color: '#112233', markerShape: 'circle' }), THEME);
    expect(svg).toContain('fill="#112233"');
  });
});
