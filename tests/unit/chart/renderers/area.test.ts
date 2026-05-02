import { describe, it, expect } from 'vitest';
import { drawArea } from '../../../../src/diagrams/chart/renderers/area.js';
import type { AreaSeriesGeo, DataPoint } from '../../../../src/diagrams/chart/layout.js';
import type { Theme } from '../../../../src/core/theme.js';

// ---------------------------------------------------------------------------
// Minimal stub — drawArea only uses Theme as a parameter type; no properties
// are accessed inside the function.
// ---------------------------------------------------------------------------
const THEME = {} as Theme;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePoint(x: number, y: number, value: number): DataPoint {
  return { x, y, value };
}

function makeGeo(
  points: DataPoint[],
  baselinePoints: DataPoint[],
  overrides: Partial<Omit<AreaSeriesGeo, 'points' | 'baselinePoints' | 'type'>> = {},
): AreaSeriesGeo {
  return {
    type: 'area',
    name: 'Series A',
    color: '#8888FF',
    showLabels: false,
    points,
    baselinePoints,
    ...overrides,
  };
}

/** Flat baseline at y=300 for a set of points. */
function flatBaseline(points: DataPoint[], baselineY = 300): DataPoint[] {
  return points.map((p) => ({ x: p.x, y: baselineY, value: 0 }));
}

// ---------------------------------------------------------------------------
// AC1 — 3 points + flat baseline → <path> with d starting with M and ending Z
// ---------------------------------------------------------------------------
describe('drawArea — filled polygon', () => {
  it('AC1: 3 points + flat baseline → <path> d attribute starts with "M" and ends with "Z"', () => {
    const pts = [makePoint(50, 200, 40), makePoint(100, 150, 60), makePoint(150, 180, 50)];
    const svg = drawArea(makeGeo(pts, flatBaseline(pts)), THEME);

    const match = svg.match(/d="([^"]+)"/);
    expect(match).not.toBeNull();
    const d = match![1]!;
    expect(d.startsWith('M ')).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
  });

  it('AC1: SVG contains exactly one filled <path> element', () => {
    const pts = [makePoint(50, 200, 40), makePoint(100, 150, 60), makePoint(150, 180, 50)];
    const svg = drawArea(makeGeo(pts, flatBaseline(pts)), THEME);

    // The filled path has fill="..." (not fill="none")
    const fillPaths = svg.match(/<path [^>]*fill="(?!none)[^"]+"/g);
    expect(fillPaths).not.toBeNull();
    expect(fillPaths!.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// AC2 — fill-opacity="0.5"
// ---------------------------------------------------------------------------
describe('drawArea — fill opacity', () => {
  it('AC2: fill path carries fill-opacity="0.5"', () => {
    const pts = [makePoint(50, 200, 40), makePoint(100, 150, 60), makePoint(150, 180, 50)];
    const svg = drawArea(makeGeo(pts, flatBaseline(pts)), THEME);
    expect(svg).toContain('fill-opacity="0.5"');
  });
});

// ---------------------------------------------------------------------------
// AC3 — top-edge stroke path
// ---------------------------------------------------------------------------
describe('drawArea — top-edge stroke', () => {
  it('AC3: SVG contains a stroke path (fill="none") along the top edge', () => {
    const pts = [makePoint(50, 200, 40), makePoint(100, 150, 60), makePoint(150, 180, 50)];
    const svg = drawArea(makeGeo(pts, flatBaseline(pts)), THEME);

    // Stroke path: fill="none" with stroke attribute
    const strokePaths = svg.match(/<path [^>]*fill="none"[^>]*stroke="[^"]+"/g);
    expect(strokePaths).not.toBeNull();
    expect(strokePaths!.length).toBeGreaterThanOrEqual(1);
  });

  it('AC3: top-edge stroke uses geo.color', () => {
    const pts = [makePoint(50, 200, 40), makePoint(100, 150, 60)];
    const svg = drawArea(makeGeo(pts, flatBaseline(pts), { color: '#FF4400' }), THEME);

    expect(svg).toContain('stroke="#FF4400"');
  });

  it('AC3: top-edge stroke has stroke-width="2"', () => {
    const pts = [makePoint(50, 200, 40), makePoint(100, 150, 60)];
    const svg = drawArea(makeGeo(pts, flatBaseline(pts)), THEME);
    expect(svg).toContain('stroke-width="2"');
  });
});

// ---------------------------------------------------------------------------
// AC4 — stacked area: non-flat baseline → path traces through baseline points
// ---------------------------------------------------------------------------
describe('drawArea — stacked baseline', () => {
  it('AC4: non-flat baseline points appear in the fill path d attribute', () => {
    const pts = [makePoint(50, 200, 40), makePoint(100, 150, 60), makePoint(150, 180, 50)];
    // Non-flat baseline: x coords match but y is different from a zero line
    const baseline: DataPoint[] = [
      makePoint(50, 260, 20),
      makePoint(100, 240, 30),
      makePoint(150, 255, 25),
    ];

    const svg = drawArea(makeGeo(pts, baseline), THEME);

    // The fill path d must reference the baseline y coords in reverse order
    // Last baseline point in reverse order = baseline[2] = (150, 255)
    const match = svg.match(/d="([^"]+)"/);
    expect(match).not.toBeNull();
    const d = match![1]!;

    // Should contain the last baseline point's coordinate (first one reversed = index 2)
    expect(d).toContain('150,255');
    // Should contain the first baseline point's coordinate (last one reversed = index 0)
    expect(d).toContain('50,260');
  });
});

// ---------------------------------------------------------------------------
// AC5 — showLabels: value appears in SVG text
// ---------------------------------------------------------------------------
describe('drawArea — data labels', () => {
  it('AC5: showLabels=true, point with value 60 → SVG contains text "60"', () => {
    const pts = [makePoint(50, 200, 40), makePoint(100, 150, 60), makePoint(150, 180, 50)];
    const geo = makeGeo(pts, flatBaseline(pts), { showLabels: true });
    const svg = drawArea(geo, THEME);
    expect(svg).toContain('>60<');
  });

  it('AC5: showLabels=true renders one <text> per point', () => {
    const pts = [makePoint(50, 200, 40), makePoint(100, 150, 60), makePoint(150, 180, 50)];
    const geo = makeGeo(pts, flatBaseline(pts), { showLabels: true });
    const svg = drawArea(geo, THEME);
    const textMatches = svg.match(/<text /g);
    expect(textMatches).not.toBeNull();
    expect(textMatches!.length).toBe(3);
  });

  it('showLabels=false → no <text> elements', () => {
    const pts = [makePoint(50, 200, 40), makePoint(100, 150, 60)];
    const svg = drawArea(makeGeo(pts, flatBaseline(pts), { showLabels: false }), THEME);
    expect(svg).not.toContain('<text ');
  });
});

// ---------------------------------------------------------------------------
// AC6 — zero points → empty string
// ---------------------------------------------------------------------------
describe('drawArea — zero points', () => {
  it('AC6: empty points array → empty string', () => {
    const geo: AreaSeriesGeo = {
      type: 'area',
      name: 'Empty',
      color: '#000000',
      showLabels: false,
      points: [],
      baselinePoints: [],
    };
    expect(drawArea(geo, THEME)).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Single-point edge case
// ---------------------------------------------------------------------------
describe('drawArea — single point', () => {
  it('single point → <line> element (vertical, from baseline to point)', () => {
    const p = makePoint(100, 150, 42);
    const b = makePoint(100, 300, 0);
    const geo = makeGeo([p], [b]);
    const svg = drawArea(geo, THEME);
    expect(svg).toContain('<line ');
    expect(svg).not.toContain('<path ');
  });

  it('single point with showLabels=true → label rendered', () => {
    const p = makePoint(100, 150, 42);
    const b = makePoint(100, 300, 0);
    const geo = makeGeo([p], [b], { showLabels: true });
    const svg = drawArea(geo, THEME);
    expect(svg).toContain('>42<');
  });
});

// ---------------------------------------------------------------------------
// Fill path geometry correctness
// ---------------------------------------------------------------------------
describe('drawArea — path geometry', () => {
  it('fill path starts at the first top-edge point', () => {
    const pts = [makePoint(50, 200, 40), makePoint(100, 150, 60)];
    const svg = drawArea(makeGeo(pts, flatBaseline(pts)), THEME);

    const match = svg.match(/d="([^"]+)"/);
    expect(match).not.toBeNull();
    expect(match![1]!.startsWith('M 50,200')).toBe(true);
  });

  it('fill path includes all top-edge points', () => {
    const pts = [makePoint(50, 200, 40), makePoint(100, 150, 60), makePoint(150, 175, 50)];
    const svg = drawArea(makeGeo(pts, flatBaseline(pts)), THEME);

    const match = svg.match(/d="([^"]+)"/);
    expect(match).not.toBeNull();
    const d = match![1]!;
    expect(d).toContain('100,150');
    expect(d).toContain('150,175');
  });

  it('stroke path does not include baseline points', () => {
    const pts = [makePoint(50, 200, 40), makePoint(100, 150, 60)];
    const baseline = [makePoint(50, 350, 0), makePoint(100, 360, 0)];
    const svg = drawArea(makeGeo(pts, baseline), THEME);

    // The stroke path (fill="none") should NOT contain baseline y coords
    const strokePathMatch = svg.match(/<path [^>]*fill="none"[^>]*d="([^"]+)"/);
    if (strokePathMatch === null) {
      // Try alternate attribute order
      const alt = svg.match(/<path [^>]*d="([^"]+)"[^>]*fill="none"/);
      expect(alt).not.toBeNull();
      expect(alt![1]).not.toContain('350');
      expect(alt![1]).not.toContain('360');
    } else {
      expect(strokePathMatch[1]).not.toContain('350');
      expect(strokePathMatch[1]).not.toContain('360');
    }
  });
});
