/**
 * Tests for drawBar() — BarRenderer SVG fragment generation.
 *
 * Acceptance criteria AC1–AC5 from the T3 task spec.
 */

import { describe, it, expect } from 'vitest';
import { drawBar } from '../../../../src/diagrams/chart/renderers/bar.js';
import type { BarSeriesGeo, BarRect } from '../../../../src/diagrams/chart/layout.js';
import type { Theme } from '../../../../src/core/theme.js';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

/** Minimal Theme for renderer tests. */
const TEST_THEME: Theme = {
  fontFamily: 'sans-serif',
  fontSize: 12,
  colors: {
    background: '#FFFFFF',
    nodeBackground: '#f1f1f1',
    border: '#AAAAAA',
    text: '#000000',
    arrow: '#000000',
    note: '#000000',
    noteBackground: '#FBFB77',
    lifeline: '#000000',
    activation: '#f1f1f1',
    frame: '#000000',
    divider: '#000000',
    error: '#FF0000',
    graph: {
      classBackground: '#f1f1f1',
      interfaceBackground: '#f1f1f1',
      enumBackground: '#f1f1f1',
      actorStroke: '#000000',
      packageBackground: '#f1f1f1',
      packageBorder: '#000000',
      edgeLabel: '#000000',
      actorFill: 'none',
      usecaseFill: '#FFFFFF',
      businessActorFill: 'none',
      businessUsecaseFill: '#FFFFFF',
    },
  },
  sequence: {
    participantPadding: 5,
    participantMinWidth: 80,
    participantGap: 10,
    messageSpacing: 25,
    activationWidth: 10,
    noteMargin: 5,
    frameHeaderHeight: 20,
    lifelineExtension: 20,
  },
};

/** Build a BarRect with sensible defaults for positive bars. */
function makeRect(
  overrides: Partial<BarRect> & { value: number },
): BarRect {
  return {
    x: 10,
    y: 50,
    width: 30,
    height: 100,
    ...overrides,
  };
}

/** Build a vertical BarSeriesGeo. */
function makeVerticalGeo(
  rects: BarRect[],
  opts: Partial<Omit<BarSeriesGeo, 'type' | 'rects'>> = {},
): BarSeriesGeo {
  return {
    type: 'bar',
    name: 'Series A',
    color: '#8888FF',
    showLabels: false,
    horizontal: false,
    rects,
    ...opts,
  };
}

// ---------------------------------------------------------------------------
// Helper: count occurrences of a tag in an SVG fragment
// ---------------------------------------------------------------------------

function countTags(svg: string, tag: string): number {
  const matches = svg.match(new RegExp(`<${tag}[\\s>]`, 'g'));
  return matches ? matches.length : 0;
}

/**
 * Extract all numeric y-attribute values from an SVG fragment in order of
 * appearance.  Used to distinguish the rect y from the text y.
 */
function extractYValues(svg: string): number[] {
  return [...svg.matchAll(/y="([^"]+)"/g)].map((m) => parseFloat(m[1]!));
}

// ---------------------------------------------------------------------------
// AC1: 3 vertical rects → exactly 3 <rect> elements
// ---------------------------------------------------------------------------

describe('drawBar — AC1: vertical bars', () => {
  it('produces exactly 3 <rect> elements for 3-rect geo', () => {
    const rects = [
      makeRect({ value: 10, x: 0 }),
      makeRect({ value: 20, x: 40 }),
      makeRect({ value: 30, x: 80 }),
    ];
    const geo = makeVerticalGeo(rects);
    const svg = drawBar(geo, TEST_THEME);

    expect(countTags(svg, 'rect')).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// AC2: horizontal: true → <rect> elements still present
// ---------------------------------------------------------------------------

describe('drawBar — AC2: horizontal bars', () => {
  it('still produces <rect> elements when horizontal is true', () => {
    const rects = [
      makeRect({ value: 10, x: 60, y: 0, width: 80, height: 30 }),
      makeRect({ value: 20, x: 60, y: 40, width: 120, height: 30 }),
    ];
    const geo = makeVerticalGeo(rects, { horizontal: true });
    const svg = drawBar(geo, TEST_THEME);

    expect(countTags(svg, 'rect')).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// AC3: showLabels: true with value 42 → SVG contains text "42"
// ---------------------------------------------------------------------------

describe('drawBar — AC3: data labels', () => {
  it('renders the value as a text label when showLabels is true', () => {
    const rects = [makeRect({ value: 42 })];
    const geo = makeVerticalGeo(rects, { showLabels: true });
    const svg = drawBar(geo, TEST_THEME);

    expect(svg).toContain('42');
    expect(countTags(svg, 'text')).toBeGreaterThanOrEqual(1);
  });

  it('does not render any text labels when showLabels is false', () => {
    const rects = [makeRect({ value: 42 })];
    const geo = makeVerticalGeo(rects, { showLabels: false });
    const svg = drawBar(geo, TEST_THEME);

    expect(countTags(svg, 'text')).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// AC4: negative value → label placed below the bar top (textY > rectY)
// ---------------------------------------------------------------------------

describe('drawBar — AC4: negative-value label placement', () => {
  it('places the label below the bar bottom for a negative value', () => {
    // For a negative bar in SVG coords: r.y is the zero-line (top of bar),
    // r.height extends downward, so the bar bottom = r.y + r.height.
    // BarRenderer.java: labelY = y + barHeight + 5
    // → our impl: r.y + r.height + 4, which is > r.y + r.height.
    const rectY = 150;
    const rectHeight = 50;
    const barBottom = rectY + rectHeight; // 200
    const rects = [makeRect({ value: -10, y: rectY, height: rectHeight })];
    const geo = makeVerticalGeo(rects, { showLabels: true });
    const svg = drawBar(geo, TEST_THEME);

    // The SVG output is: <rect y="150" …/>\n<text y="204" …>…</text>
    // extractYValues returns [150, 204] — index 0 is rect, index 1 is text.
    const yValues = extractYValues(svg);
    expect(yValues.length).toBeGreaterThanOrEqual(2);
    const textY = yValues[1]!;

    // Text must sit below the bar bottom
    expect(textY).toBeGreaterThan(barBottom);
  });

  it('places the label above the bar top for a positive value', () => {
    const rectY = 100;
    const rects = [makeRect({ value: 50, y: rectY, height: 80 })];
    const geo = makeVerticalGeo(rects, { showLabels: true });
    const svg = drawBar(geo, TEST_THEME);

    // yValues[0] = rect y, yValues[1] = text y
    const yValues = extractYValues(svg);
    expect(yValues.length).toBeGreaterThanOrEqual(2);
    const textY = yValues[1]!;

    // Text must sit above the bar top (smaller y in SVG coords)
    expect(textY).toBeLessThan(rectY);
  });
});

// ---------------------------------------------------------------------------
// AC5: color '#FF0000' → all rects have matching fill
// ---------------------------------------------------------------------------

describe('drawBar — AC5: fill color', () => {
  it('sets fill attribute to the geo color on all rect elements', () => {
    const rects = [
      makeRect({ value: 1, x: 0 }),
      makeRect({ value: 2, x: 40 }),
      makeRect({ value: 3, x: 80 }),
    ];
    const geo = makeVerticalGeo(rects, { color: '#FF0000' });
    const svg = drawBar(geo, TEST_THEME);

    // All rect elements should carry fill="#FF0000" (case-insensitive)
    const rectFragments = svg.match(/<rect[^/]*/g) ?? [];
    expect(rectFragments).toHaveLength(3);
    for (const fragment of rectFragments) {
      expect(fragment.toLowerCase()).toContain('fill="#ff0000"');
    }
  });
});
