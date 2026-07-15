/**
 * Unit tests for `buildAnnotationBlock` (src/core/annotations/blocks.ts) —
 * mission G0b / T4. Pins the TextBlockBordered/TextBlockMarged geometry:
 * padding inset, the +1 dimension quirk, the SVG rx/2 halving quirk, margin
 * applied outside the border, and multiline stacking via the jar-verified
 * line-advance/ascent ratios.
 *
 * Jar-verified fixture (2026-07-13, `oracle/dist/plantuml-oracle.jar
 * -tsvg -pipe`) backing the numeric constants asserted below:
 *
 *   @startuml
 *   title A Title
 *   header a header
 *   footer a footer
 *   legend bottom left
 *   This is
 *   my legend
 *   end legend
 *   a->b
 *   @enduml
 *
 * produced (legend fragment, default style — BASE_DEFAULTS.legend):
 *   <rect x="12" y="164.2422" width="80.6904" height="42.9766"
 *         fill="#DDDDDD" style="stroke:#000000;stroke-width:1;" rx="7.5"/>
 *   <text x="17" y="182.7773" ...>This is</text>
 *   <text x="17" y="199.2656" ...>my legend</text>
 *
 * Relations confirmed against this fixture (see blocks.ts's own doc
 * comments for the exact arithmetic each backs):
 *   - rect width  == pureTextWidth(70.6904) + padding(5+5) == 80.6904 (NO +1)
 *   - rect height == pureTextHeight(2*16.4883=32.9766) + padding(5+5) == 42.9766 (NO +1)
 *   - rx == roundCorner(15) / 2 == 7.5
 *   - text x == rect x + padding.left (12+5==17)
 *   - line-2 baseline - line-1 baseline == 16.4883 == 14 * (14.1328/12)
 *   - line-1 baseline - block top(rect y + padding.top) == 13.5352 == 14 * (11.6016/12)
 */
import { describe, it, expect } from 'vitest';
import { buildAnnotationBlock } from '../../src/core/annotations/blocks.js';
import type { AnnotationBoxStyle } from '../../src/core/annotations/style.js';
import { HorizontalAlignment } from '../../src/core/klimt/geom/HorizontalAlignment.js';
import { FixedMeasurer } from '../../src/core/measurer.js';

/** Jar-verified — see this file's module doc comment. */
const LINE_ADVANCE_RATIO = 14.1328 / 12;
const ASCENT_RATIO = 11.6016 / 12;

function makeStyle(overrides: Partial<AnnotationBoxStyle> = {}): AnnotationBoxStyle {
  return {
    fontSize: 14,
    fontStyle: 'plain',
    fontColor: '#000000',
    fontFamily: 'sans-serif',
    backgroundColor: null,
    lineColor: null,
    roundCorner: 0,
    padding: { top: 0, right: 0, bottom: 0, left: 0 },
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
    horizontalAlignment: HorizontalAlignment.LEFT,
    ...overrides,
  };
}

const LEGEND_STYLE: AnnotationBoxStyle = makeStyle({
  backgroundColor: '#DDDDDD',
  lineColor: 'black',
  roundCorner: 15,
  padding: { top: 5, right: 5, bottom: 5, left: 5 },
  margin: { top: 12, right: 12, bottom: 12, left: 12 },
});

describe('buildAnnotationBlock — legend defaults (jar fixture)', () => {
  const measurer = new FixedMeasurer(10.0985, 14); // arbitrary; only relations matter
  const block = buildAnnotationBlock('legend', ['This is', 'my legend'], LEGEND_STYLE, measurer);

  it('contains a rounded rect (rx = roundCorner / 2)', () => {
    expect(block.body).toMatch(/rx="7\.5"/);
  });

  it('contains the background (#DDDDDD) and border (black) colors', () => {
    expect(block.body).toMatch(/fill="#DDDDDD"/);
    // G1c: named colors resolve to their canonical jar hex (black -> #000000).
    expect(block.body).toMatch(/stroke="#000000"/);
  });

  it('rect dimension = pureText + padding, NO +1 (the +1 is block-outward only)', () => {
    const pureTextWidth = 'my legend'.length * 10.0985; // widest line
    const pureTextHeight = 2 * 14 * LINE_ADVANCE_RATIO;
    const rectMatch = /<rect x="0" y="0" width="([\d.]+)" height="([\d.]+)"/.exec(block.body);
    expect(rectMatch).not.toBeNull();
    expect(Number(rectMatch![1])).toBeCloseTo(pureTextWidth + 10, 6);
    expect(Number(rectMatch![2])).toBeCloseTo(pureTextHeight + 10, 6);
  });

  it('block-outward dimension = rect dimension + 1 + margin (12 each side)', () => {
    const pureTextWidth = 'my legend'.length * 10.0985;
    const pureTextHeight = 2 * 14 * LINE_ADVANCE_RATIO;
    expect(block.width).toBeCloseTo(pureTextWidth + 10 + 1 + 24, 6);
    expect(block.height).toBeCloseTo(pureTextHeight + 10 + 1 + 24, 6);
  });

  it('margin translates the border+text content by (12,12)', () => {
    expect(block.body).toMatch(/^<g transform="translate\(12,12\)">/);
  });

  it('text starts at padding.left (5) inside the rect — x="5"', () => {
    expect(block.body).toMatch(/<text x="5"/);
  });

  it('two-line advance matches the jar-verified ratio (16.4883 @ size 14)', () => {
    const ys = [...block.body.matchAll(/<text x="5" y="([\d.]+)"/g)].map((m) => Number(m[1]));
    expect(ys).toHaveLength(2);
    expect(ys[1]! - ys[0]!).toBeCloseTo(14 * LINE_ADVANCE_RATIO, 6);
  });

  it('first baseline = padding.top + ascent (jar-verified 11.6016/12 ratio)', () => {
    const first = /<text x="5" y="([\d.]+)"/.exec(block.body);
    expect(Number(first![1])).toBeCloseTo(5 + 14 * ASCENT_RATIO, 6);
  });
});

describe('buildAnnotationBlock — transparent defaults (title/caption/header/footer)', () => {
  it('draws no rect when backgroundColor and lineColor are both null', () => {
    const style = makeStyle({ padding: { top: 5, right: 5, bottom: 5, left: 5 } });
    const block = buildAnnotationBlock('title', ['T'], style, new FixedMeasurer(10, 14));
    expect(block.body).not.toMatch(/<rect/);
  });
});

describe('buildAnnotationBlock — block-level fontStyle (title default bold, not Creole markup)', () => {
  const measurer = new FixedMeasurer(10, 14);

  it('bold style emits font-weight="bold" on the <text> element', () => {
    const style = makeStyle({ fontStyle: 'bold' });
    const block = buildAnnotationBlock('title', ['T'], style, measurer);
    expect(block.body).toMatch(/<text[^>]*font-weight="bold"[^>]*>/);
  });

  it('italic style emits font-style="italic" on the <text> element', () => {
    const style = makeStyle({ fontStyle: 'italic' });
    const block = buildAnnotationBlock('title', ['T'], style, measurer);
    expect(block.body).toMatch(/<text[^>]*font-style="italic"[^>]*>/);
  });

  it('plain style emits neither attribute', () => {
    const style = makeStyle({ fontStyle: 'plain' });
    const block = buildAnnotationBlock('title', ['T'], style, measurer);
    expect(block.body).not.toMatch(/font-weight="bold"/);
    expect(block.body).not.toMatch(/font-style="italic"/);
  });
});

describe('buildAnnotationBlock — the +1 dimension quirk', () => {
  it('reports width/height 1px larger than the drawn (padded) box on each axis', () => {
    const style = makeStyle({ padding: { top: 0, right: 0, bottom: 0, left: 0 } });
    const measurer = new FixedMeasurer(3, 14);
    const block = buildAnnotationBlock('title', ['AB'], style, measurer);
    // pureTextWidth = 2 chars * 3 = 6; pureTextHeight = 14 * LINE_ADVANCE_RATIO
    expect(block.width).toBeCloseTo(6 + 1, 6);
    expect(block.height).toBeCloseTo(14 * LINE_ADVANCE_RATIO + 1, 6);
  });
});

describe('buildAnnotationBlock — per-line horizontal alignment (style.horizontalAlignment)', () => {
  const measurer = new FixedMeasurer(10, 14);

  it('CENTER centers the shorter line within the widest line', () => {
    const style = makeStyle({ horizontalAlignment: HorizontalAlignment.CENTER });
    const block = buildAnnotationBlock('legend', ['AB', 'A'], style, measurer);
    const xs = [...block.body.matchAll(/<text x="([\d.]+)"/g)].map((m) => Number(m[1]));
    // line 1 "AB" width 20 (widest); line 2 "A" width 10, centered at (20-10)/2=5
    expect(xs[0]).toBeCloseTo(0, 6);
    expect(xs[1]).toBeCloseTo(5, 6);
  });

  it('RIGHT right-aligns the shorter line', () => {
    const style = makeStyle({ horizontalAlignment: HorizontalAlignment.RIGHT });
    const block = buildAnnotationBlock('legend', ['AB', 'A'], style, measurer);
    const xs = [...block.body.matchAll(/<text x="([\d.]+)"/g)].map((m) => Number(m[1]));
    expect(xs[0]).toBeCloseTo(0, 6);
    expect(xs[1]).toBeCloseTo(10, 6); // 20 - 10
  });

  it('LEFT (default) keeps every line at x=0 within the text box', () => {
    const style = makeStyle({ horizontalAlignment: HorizontalAlignment.LEFT });
    const block = buildAnnotationBlock('legend', ['AB', 'A'], style, measurer);
    const xs = [...block.body.matchAll(/<text x="([\d.]+)"/g)].map((m) => Number(m[1]));
    expect(xs[0]).toBeCloseTo(0, 6);
    expect(xs[1]).toBeCloseTo(0, 6);
  });
});

describe('buildAnnotationBlock — Creole inline markup', () => {
  it('bolds **text** via a tspan, measuring the PLAIN (markup-stripped) text width', () => {
    const style = makeStyle();
    const measurer = new FixedMeasurer(10, 14);
    const block = buildAnnotationBlock('title', ['**bold**'], style, measurer);
    // spansToTspan (src/core/creole.ts) puts the inherited fill before font-weight.
    expect(block.body).toMatch(/<tspan fill="#000000" font-weight="bold">bold<\/tspan>/);
    // plain text is "bold" (4 chars) -> width 40, not the 8-char raw source
    expect(block.width).toBeCloseTo(40 + 1, 6);
  });

  it('escapes XML-significant characters in the span text', () => {
    const style = makeStyle();
    const measurer = new FixedMeasurer(10, 14);
    const block = buildAnnotationBlock('title', ['<a & b>'], style, measurer);
    expect(block.body).toContain('&lt;a &amp; b&gt;');
    expect(block.body).not.toContain('<a & b>');
  });
});
