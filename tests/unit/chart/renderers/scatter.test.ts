/**
 * Unit tests for ScatterRenderer (drawScatter).
 *
 * AC1: 5 points → 5 marker elements, NO <line> or <polyline>.
 * AC2: markerShape 'circle' → <circle> elements.
 * AC3: markerShape 'square' → <rect> elements.
 * AC4: markerShape 'triangle' → <polygon> elements.
 * AC5: coordinate-pair points (xValue set) → marker count equals point count.
 * AC6: showLabels true → <text> elements present.
 * AC7: zero points → empty string.
 */

import { describe, it, expect } from 'vitest';
import { drawScatter } from '../../../../src/diagrams/chart/renderers/scatter.js';
import type { ScatterSeriesGeo, DataPoint } from '../../../../src/diagrams/chart/layout.js';
import type { Theme } from '../../../../src/core/theme.js';

// ---------------------------------------------------------------------------
// Minimal theme stub — drawScatter does not use theme fields directly
// ---------------------------------------------------------------------------

const STUB_THEME = {} as Theme;

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

function makePoints(count: number): DataPoint[] {
  return Array.from({ length: count }, (_, i) => ({
    x: 10 + i * 20,
    y: 100 - i * 10,
    value: i + 1,
  }));
}

function makeCoordPairPoints(count: number): DataPoint[] {
  return Array.from({ length: count }, (_, i) => ({
    x: 10 + i * 20,
    y: 100 - i * 10,
    value: i + 1,
    xValue: i * 0.5,
  }));
}

function makeGeo(
  overrides: Partial<ScatterSeriesGeo> & { points: DataPoint[] },
): ScatterSeriesGeo {
  return {
    type: 'scatter',
    name: 'series',
    color: '#8888FF',
    showLabels: false,
    markerShape: 'circle',
    markerSize: 8,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// AC1: 5 points → exactly 5 marker elements, NO <line> or <polyline>
// ---------------------------------------------------------------------------

describe('drawScatter — AC1: marker count and no connecting lines', () => {
  it('produces exactly 5 marker elements for 5 points', () => {
    const geo = makeGeo({ points: makePoints(5) });
    const svg = drawScatter(geo, STUB_THEME);

    // Count <circle> markers (default shape)
    const circleMatches = svg.match(/<circle /g) ?? [];
    expect(circleMatches).toHaveLength(5);
  });

  it('contains no <line> elements', () => {
    const geo = makeGeo({ points: makePoints(5) });
    const svg = drawScatter(geo, STUB_THEME);
    expect(svg).not.toContain('<line ');
  });

  it('contains no <polyline> elements', () => {
    const geo = makeGeo({ points: makePoints(5) });
    const svg = drawScatter(geo, STUB_THEME);
    expect(svg).not.toContain('<polyline ');
  });
});

// ---------------------------------------------------------------------------
// AC2: markerShape 'circle' → <circle> elements
// ---------------------------------------------------------------------------

describe('drawScatter — AC2: circle markers', () => {
  it('renders <circle> elements for markerShape circle', () => {
    const geo = makeGeo({ points: makePoints(3), markerShape: 'circle' });
    const svg = drawScatter(geo, STUB_THEME);

    expect(svg).toContain('<circle ');
    expect(svg).not.toContain('<rect ');
    expect(svg).not.toContain('<polygon ');
  });

  it('circle has correct cx, cy, and r="4"', () => {
    const geo = makeGeo({ points: [{ x: 50, y: 75, value: 10 }], markerShape: 'circle' });
    const svg = drawScatter(geo, STUB_THEME);

    expect(svg).toContain('cx="50"');
    expect(svg).toContain('cy="75"');
    expect(svg).toContain('r="4"');
  });
});

// ---------------------------------------------------------------------------
// AC3: markerShape 'square' → <rect> elements
// ---------------------------------------------------------------------------

describe('drawScatter — AC3: square markers', () => {
  it('renders <rect> elements for markerShape square', () => {
    const geo = makeGeo({ points: makePoints(3), markerShape: 'square' });
    const svg = drawScatter(geo, STUB_THEME);

    expect(svg).toContain('<rect ');
    expect(svg).not.toContain('<circle ');
    expect(svg).not.toContain('<polygon ');
  });

  it('square is centered on the data point (offset by -4)', () => {
    const geo = makeGeo({ points: [{ x: 50, y: 75, value: 10 }], markerShape: 'square' });
    const svg = drawScatter(geo, STUB_THEME);

    // x = p.x - MARKER_RADIUS = 50 - 4 = 46
    expect(svg).toContain('x="46"');
    // y = p.y - MARKER_RADIUS = 75 - 4 = 71
    expect(svg).toContain('y="71"');
    expect(svg).toContain('width="8"');
    expect(svg).toContain('height="8"');
  });
});

// ---------------------------------------------------------------------------
// AC4: markerShape 'triangle' → <polygon> elements
// ---------------------------------------------------------------------------

describe('drawScatter — AC4: triangle markers', () => {
  it('renders <polygon> elements for markerShape triangle', () => {
    const geo = makeGeo({ points: makePoints(3), markerShape: 'triangle' });
    const svg = drawScatter(geo, STUB_THEME);

    expect(svg).toContain('<polygon ');
    expect(svg).not.toContain('<circle ');
    expect(svg).not.toContain('<rect ');
  });

  it('triangle polygon is centered on the data point', () => {
    const geo = makeGeo({ points: [{ x: 50, y: 75, value: 10 }], markerShape: 'triangle' });
    const svg = drawScatter(geo, STUB_THEME);

    // Apex: (p.x, p.y - 5) = (50, 70)
    // Bottom-left: (p.x - 4, p.y + 3) = (46, 78)
    // Bottom-right: (p.x + 4, p.y + 3) = (54, 78)
    expect(svg).toContain('points="50,70 46,78 54,78"');
  });
});

// ---------------------------------------------------------------------------
// AC5: coordinate-pair mode — xValue set, marker count equals point count
// ---------------------------------------------------------------------------

describe('drawScatter — AC5: coordinate-pair points', () => {
  it('renders one marker per point regardless of xValue presence', () => {
    const points = makeCoordPairPoints(4);
    const geo = makeGeo({ points, markerShape: 'circle' });
    const svg = drawScatter(geo, STUB_THEME);

    const circleMatches = svg.match(/<circle /g) ?? [];
    expect(circleMatches).toHaveLength(4);
  });

  it('uses pre-computed pixel x/y (not xValue) for position', () => {
    const points: DataPoint[] = [{ x: 120, y: 80, value: 5, xValue: 2.5 }];
    const geo = makeGeo({ points, markerShape: 'circle' });
    const svg = drawScatter(geo, STUB_THEME);

    expect(svg).toContain('cx="120"');
    expect(svg).toContain('cy="80"');
  });
});

// ---------------------------------------------------------------------------
// AC6: showLabels true → <text> elements present
// ---------------------------------------------------------------------------

describe('drawScatter — AC6: data labels', () => {
  it('produces <text> elements when showLabels is true', () => {
    const geo = makeGeo({ points: makePoints(3), showLabels: true });
    const svg = drawScatter(geo, STUB_THEME);

    const textMatches = svg.match(/<text /g) ?? [];
    expect(textMatches).toHaveLength(3);
  });

  it('label is positioned offset from the data point', () => {
    const geo = makeGeo({
      points: [{ x: 50, y: 75, value: 42 }],
      showLabels: true,
    });
    const svg = drawScatter(geo, STUB_THEME);

    // x = p.x + 6 = 56, y = p.y - 4 = 71
    expect(svg).toContain('x="56"');
    expect(svg).toContain('y="71"');
    expect(svg).toContain('>42<');
  });

  it('produces no <text> elements when showLabels is false', () => {
    const geo = makeGeo({ points: makePoints(3), showLabels: false });
    const svg = drawScatter(geo, STUB_THEME);

    expect(svg).not.toContain('<text ');
  });
});

// ---------------------------------------------------------------------------
// AC7: zero points → empty string
// ---------------------------------------------------------------------------

describe('drawScatter — AC7: zero points', () => {
  it('returns empty string when points array is empty', () => {
    const geo = makeGeo({ points: [] });
    const svg = drawScatter(geo, STUB_THEME);

    expect(svg).toBe('');
  });
});
