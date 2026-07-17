import { describe, it, expect } from 'vitest';
import { WidthTableMeasurer } from '../../../src/core/measurer.js';
import { defaultTheme } from '../../../src/core/theme.js';
import {
  getWTitle,
  getHTitle,
  getTitleBaselineOffset,
  renderNamespaceFolder,
  NAMESPACE_TOP_EXTRA,
  NAMESPACE_SIDE_PADDING,
  PACKAGE_ROUND_CORNER,
  PACKAGE_STROKE_WIDTH,
} from '../../../src/diagrams/class/class-namespace-shape.js';
import type { NamespaceGeo } from '../../../src/diagrams/class/layout.js';

const measurer = new WidthTableMeasurer();

// ---------------------------------------------------------------------------
// G2 N17: jar-verified against test-results/dot-cache/class/finono-05-cuvu171
// (`package foo { class dummy2 }`, default 14pt font):
//   <path d="M8.5,6 L28.925,6 A3.75,3.75 0 0 1 31.425,8.5 L38.425,26
//            L121.5,26 A2.5,2.5 0 0 1 124,28.5 L124,100.5 A2.5,2.5 0 0 1
//            121.5,103 L8.5,103 A2.5,2.5 0 0 1 6,100.5 L6,8.5 A2.5,2.5 0
//            0 1 8.5,6" style="stroke:#000000;stroke-width:1.5;" fill="none"/>
//   <line x1="6" y1="26" x2="38.425" y2="26" .../>
//   <text x="10" y="18.8889" ... textLength="19.425" font-weight="700">foo</text>
// Box origin (6,6), width 118, height 97 (from surrounding NamespaceGeo).
// ---------------------------------------------------------------------------

describe('getWTitle', () => {
  it('is textWidth + 6 for "foo" at 14pt bold (jar: 19.425 -> 25.425)', () => {
    expect(getWTitle(measurer, defaultTheme, 'foo', 0)).toBeCloseTo(25.425, 3);
  });

  it('is textWidth + 6 for "a" at 14pt bold (jar: 7.7875 -> 13.7875)', () => {
    expect(getWTitle(measurer, defaultTheme, 'a', 0)).toBeCloseTo(13.7875, 3);
  });

  it('falls back to max(30, width/4) for an empty label', () => {
    expect(getWTitle(measurer, defaultTheme, '', 200)).toBe(50);
    expect(getWTitle(measurer, defaultTheme, '', 40)).toBe(30);
  });
});

describe('getHTitle', () => {
  it('is 20 at the default 14pt font (jar: finono-05-cuvu171/jinibe-02-tebi269)', () => {
    expect(getHTitle(measurer, defaultTheme, 'foo')).toBe(20);
  });

  it('scales with font size (jar: pixexi-81-sete111, skinparam FontSize 40 -> htitle 46)', () => {
    const theme40 = { ...defaultTheme, fontSize: 40 };
    expect(getHTitle(measurer, theme40, 'Configuration files')).toBe(46);
  });

  it('falls back to 10 for an empty label', () => {
    expect(getHTitle(measurer, defaultTheme, '')).toBe(10);
  });
});

describe('getTitleBaselineOffset', () => {
  it('is 2 + fontSize - descent, matching jar text y=18.8889 at box-top 6', () => {
    const offset = getTitleBaselineOffset(measurer, defaultTheme, 'foo');
    expect(6 + offset).toBeCloseTo(18.8889, 3);
  });
});

describe('NAMESPACE_TOP_EXTRA / NAMESPACE_SIDE_PADDING constants', () => {
  it('NAMESPACE_TOP_EXTRA is 13 (htitle=20 -> 33px gap, htitle=46 -> 59px gap)', () => {
    expect(NAMESPACE_TOP_EXTRA).toBe(13);
    expect(20 + NAMESPACE_TOP_EXTRA).toBe(33);
    expect(46 + NAMESPACE_TOP_EXTRA).toBe(59);
  });

  it('NAMESPACE_SIDE_PADDING is 16 (jar-verified content-driven side/bottom gap)', () => {
    expect(NAMESPACE_SIDE_PADDING).toBe(16);
  });
});

function finonoGeo(overrides?: Partial<NamespaceGeo>): NamespaceGeo {
  return {
    id: 'foo',
    x: 6,
    y: 6,
    width: 118,
    height: 97,
    label: 'foo',
    wtitle: getWTitle(measurer, defaultTheme, 'foo', 0),
    htitle: getHTitle(measurer, defaultTheme, 'foo'),
    baselineOffset: getTitleBaselineOffset(measurer, defaultTheme, 'foo'),
    ...overrides,
  };
}

describe('renderNamespaceFolder — byte-level jar parity (finono-05-cuvu171)', () => {
  it('emits the exact folder-tab <path> d attribute', () => {
    const svg = renderNamespaceFolder(finonoGeo(), defaultTheme);
    expect(svg).toContain(
      'd="M8.5,6 L28.925,6 A3.75,3.75 0 0 1 31.425,8.5 L38.425,26 L121.5,26 ' +
        'A2.5,2.5 0 0 1 124,28.5 L124,100.5 A2.5,2.5 0 0 1 121.5,103 L8.5,103 ' +
        'A2.5,2.5 0 0 1 6,100.5 L6,8.5 A2.5,2.5 0 0 1 8.5,6"',
    );
  });

  it('draws the outline with fill="none" and the jar-verified stroke', () => {
    const svg = renderNamespaceFolder(finonoGeo(), defaultTheme);
    expect(svg).toContain('fill="none"');
    expect(svg).toContain('stroke="#000000"');
    expect(svg).toContain(`stroke-width="${PACKAGE_STROKE_WIDTH}"`);
  });

  it('emits the exact tab hline', () => {
    const svg = renderNamespaceFolder(finonoGeo(), defaultTheme);
    expect(svg).toContain('<line x1="6" y1="26" x2="38.425" y2="26"');
  });

  it('emits the exact bold title text at (10, 18.8889)', () => {
    const svg = renderNamespaceFolder(finonoGeo(), defaultTheme);
    expect(svg).toContain('<text x="10" y="18.8889"');
    expect(svg).toContain('font-weight="bold"');
    expect(svg).toContain('fill="#000000"');
    expect(svg).toContain('>foo</text>');
  });

  it('respects theme.colors.graph.packageBackground for the outline fill', () => {
    const theme = {
      ...defaultTheme,
      colors: { ...defaultTheme.colors, graph: { ...defaultTheme.colors.graph, packageBackground: '#0000FF' } },
    };
    const svg = renderNamespaceFolder(finonoGeo(), theme);
    expect(svg).toContain('fill="#0000FF"');
  });
});

describe('PACKAGE_ROUND_CORNER', () => {
  it('is 5 (half=2.5, matching every jar-observed non-tab arc radius)', () => {
    expect(PACKAGE_ROUND_CORNER).toBe(5);
  });
});
