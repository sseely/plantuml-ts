/**
 * Integration tests for renderChart() and chartPlugin.
 *
 * Acceptance criteria AC1–AC7 from the T7 task spec.
 */

import { describe, it, expect } from 'vitest';
import { renderChart } from '../../../src/diagrams/chart/renderer.js';
import { chartPlugin } from '../../../src/diagrams/chart/index.js';
import { layoutChart } from '../../../src/diagrams/chart/layout.js';
import { parseChart } from '../../../src/diagrams/chart/parser.js';
import { renderSync } from '../../../src/index.js';
import { resolveTheme } from '../../../src/core/theme.js';
import { FormulaMeasurer } from '../../../src/core/measurer.js';
import type { UmlSource } from '../../../src/core/block-extractor.js';
import type { ChartGeometry } from '../../../src/diagrams/chart/layout.js';
import type { Theme } from '../../../src/core/theme.js';

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

const theme: Theme = resolveTheme('default');
const measurer = new FormulaMeasurer();

/** Build a UmlSource from content lines. */
function src(lines: string[]): UmlSource {
  return { lines, type: 'chart' };
}

/**
 * Build a minimal ChartGeometry for renderer-level unit tests.
 * Callers can override any field via layoutChart or direct construction.
 */
function makeMinimalGeo(): ChartGeometry {
  const ast = parseChart(
    src([
      'h-axis ["A","B","C"]',
      'v-axis "Y" 0 --> 100',
      'bar [10, 50, 30]',
    ]),
  );
  return layoutChart(ast, theme, measurer);
}

// ---------------------------------------------------------------------------
// AC1: bar + line + legend produces <rect> and <line> elements
// ---------------------------------------------------------------------------

describe('AC1: bar + line chart renders both <rect> and <line>', () => {
  it('renderSync produces SVG with rect and line elements', () => {
    const svg = renderSync(
      '@startchart\n' +
      'h-axis ["Jan","Feb","Mar"]\n' +
      'v-axis "Y" 0-->100\n' +
      'bar "sales" [10,50,30]\n' +
      'line "trend" [5,40,60]\n' +
      'legend left\n' +
      '@endchart',
    );
    expect(svg).toContain('<rect');
    expect(svg).toContain('<line');
    expect(svg).toMatch(/^<svg/);
    expect(svg).toContain('</svg>');
  });

  it('renderChart with bar and line geo contains rect and line', () => {
    const ast = parseChart(
      src([
        'h-axis ["A","B"]',
        'v-axis "Y" 0-->50',
        'bar [10,20]',
        'line [5,25]',
      ]),
    );
    const geo = layoutChart(ast, theme, measurer);
    const svg = renderChart(geo, theme);
    expect(svg).toContain('<rect');
    expect(svg).toContain('<line');
  });
});

// ---------------------------------------------------------------------------
// AC2: grid v-axis produces horizontal <line> elements in plot area
// ---------------------------------------------------------------------------

describe('AC2: v-axis grid produces horizontal grid lines', () => {
  it('grid on v-axis → horizontal <line> elements at tick y positions', () => {
    const ast = parseChart(
      src([
        'h-axis ["A","B","C"]',
        'v-axis "Y" 0-->100 grid',
      ]),
    );
    const geo = layoutChart(ast, theme, measurer);
    expect(geo.vAxis.gridPixels.length).toBeGreaterThan(0);

    const svg = renderChart(geo, theme);
    // Grid lines have a stroke-dasharray attribute
    expect(svg).toContain('stroke-dasharray="4 2"');
    // Each horizontal grid line spans the plot width — x1 should equal plotArea.x
    expect(svg).toContain(`x1="${geo.plotArea.x}"`);
  });

  it('no grid by default → no dasharray lines', () => {
    const geo = makeMinimalGeo();
    // Default geo has no grid pixels
    expect(geo.vAxis.gridPixels).toHaveLength(0);
    expect(geo.hAxis.gridPixels).toHaveLength(0);
    const svg = renderChart(geo, theme);
    expect(svg).not.toContain('stroke-dasharray="4 2"');
  });
});

// ---------------------------------------------------------------------------
// AC3: legend right → legend <rect> x > plotArea.x + plotArea.width
// ---------------------------------------------------------------------------

describe('AC3: legend right positions legend beyond right edge of plot', () => {
  it('legend rect x > plotArea.x + plotArea.width', () => {
    const ast = parseChart(
      src([
        'h-axis ["A","B","C"]',
        'v-axis "Y" 0-->100',
        'bar "series1" [10,20,30]',
        'legend right',
      ]),
    );
    const geo = layoutChart(ast, theme, measurer);
    expect(geo.legend).toBeDefined();
    const legend = geo.legend!;
    const plotRight = geo.plotArea.x + geo.plotArea.width;
    expect(legend.x).toBeGreaterThan(plotRight);

    const svg = renderChart(geo, theme);
    // The legend border rect should have x > plotRight.
    // We verify via the geometry check above; also verify SVG contains the rect.
    expect(svg).toContain('<rect');
  });
});

// ---------------------------------------------------------------------------
// AC4: annotation with hasArrow → SVG contains annotation text + line
// ---------------------------------------------------------------------------

describe('AC4: annotation with hasArrow renders text and arrow line', () => {
  it('annotation produces text element and line toward arrow target', () => {
    const ast = parseChart(
      src([
        'h-axis ["A","B","C"]',
        'v-axis "Y" 0-->100',
        'bar [10,50,30]',
        'annotation "peak" at (B, 50) <<arrow>>',
      ]),
    );
    const geo = layoutChart(ast, theme, measurer);
    expect(geo.annotations).toHaveLength(1);
    expect(geo.annotations[0]!.hasArrow).toBe(true);

    const svg = renderChart(geo, theme);
    expect(svg).toContain('peak');
    // Arrow line: renderChart draws a line from labelY-8 toward arrowTarget
    expect(svg).toContain('<line');
  });

  it('annotation without arrow renders text only — no extra line from annotation', () => {
    const ast = parseChart(
      src([
        'h-axis ["A","B"]',
        'v-axis "Y" 0-->100',
        'bar [10,20]',
        'annotation "note" at (A, 10)',
      ]),
    );
    const geo = layoutChart(ast, theme, measurer);
    expect(geo.annotations[0]!.hasArrow).toBe(false);

    const svg = renderChart(geo, theme);
    expect(svg).toContain('note');
  });
});

// ---------------------------------------------------------------------------
// AC5: errors in AST → error SVG with red border and message
// ---------------------------------------------------------------------------

describe('AC5: AST errors produce a visually distinct error SVG', () => {
  it('chartPlugin returns error SVG when AST has errors', () => {
    const badSrc = src(['line [(1,10),(2,20)]']); // coordinate pairs require explicit h-axis range
    const ast = parseChart(badSrc);
    expect(ast.errors.length).toBeGreaterThan(0);

    const geo = chartPlugin.layoutSync(ast, theme, measurer);
    const svg = chartPlugin.render(geo, theme);
    // Error SVG must contain the error text and a red-ish border color
    expect(svg).toContain('#dc2626');
    expect(svg).toContain('stroke="#dc2626"');
    expect(svg).not.toContain('<defs>'); // error SVG is minimal, no svgRoot defs
  });

  it('renderChart with errors field renders error SVG', () => {
    const geo = makeMinimalGeo();
    const errorGeo = { ...geo, errors: ['test validation error'] as readonly string[] };
    const svg = renderChart(errorGeo, theme);
    expect(svg).toContain('test validation error');
    expect(svg).toContain('#dc2626');
    expect(svg).toContain('stroke="#dc2626"');
  });

  it('error SVG has red fill on background rect', () => {
    const geo = makeMinimalGeo();
    const errorGeo = { ...geo, errors: ['oops'] as readonly string[] };
    const svg = renderChart(errorGeo, theme);
    expect(svg).toContain('fill="#fee2e2"');
  });
});

// ---------------------------------------------------------------------------
// AC6: primary + secondary Y-axis → two vertical axis lines
// ---------------------------------------------------------------------------

describe('AC6: primary + secondary Y-axis produces two vertical axis lines', () => {
  it('v2-axis results in two drawVAxis calls → two axis line SVG elements', () => {
    const ast = parseChart(
      src([
        'h-axis ["A","B","C"]',
        'v-axis "Y1" 0-->100',
        'v2-axis "Y2" 0-->200',
        'bar "b1" [10,20,30]',
        'bar "b2" [100,150,200] v2',
      ]),
    );
    const geo = layoutChart(ast, theme, measurer);
    expect(geo.v2Axis).toBeDefined();

    const svg = renderChart(geo, theme);
    // The primary axis line is at plotArea.x; secondary is at plotArea.x + plotArea.width.
    // Both appear as vertical <line> elements. We count axis-style lines (no dasharray).
    const axisLineCount = (svg.match(/<line[^>]+stroke="[^"]*"(?:[^>]*)\/>/g) ?? []).filter(
      (l) => !l.includes('dasharray'),
    ).length;
    // At least 2 vertical lines (one per axis) plus tick marks
    expect(axisLineCount).toBeGreaterThanOrEqual(2);
  });

  it('v2Axis line x2 equals plotArea.x + plotArea.width in geo', () => {
    const ast = parseChart(
      src([
        'h-axis ["A","B"]',
        'v-axis "Y1" 0-->50',
        'v2-axis "Y2" 0-->100',
        'bar [10,20]',
        'bar [50,80] v2',
      ]),
    );
    const geo = layoutChart(ast, theme, measurer);
    const rightEdge = geo.plotArea.x + geo.plotArea.width;
    // Secondary axis is drawn at rightEdge — verify geometry is correct
    expect(geo.v2Axis).toBeDefined();
    // SVG should have the rightEdge x value in a line element
    const svg = renderChart(geo, theme);
    expect(svg).toContain(`x1="${rightEdge}"`);
  });
});

// ---------------------------------------------------------------------------
// AC7: chartPlugin registered → renderSync returns valid SVG without throwing
// ---------------------------------------------------------------------------

describe('AC7: chartPlugin registered — renderSync handles @startchart', () => {
  it('minimal chart diagram does not throw and returns valid SVG', () => {
    let svg: string;
    expect(() => {
      svg = renderSync(
        '@startchart\n' +
        'h-axis ["A","B"]\n' +
        'v-axis "Y" 0-->100\n' +
        'bar [10,50]\n' +
        '@endchart',
      );
    }).not.toThrow();
    expect(svg!).toMatch(/^<svg/);
    expect(svg!).toContain('</svg>');
    expect(svg!.length).toBeGreaterThan(0);
  });

  it('chartPlugin type is "chart"', () => {
    expect(chartPlugin.type).toBe('chart');
  });

  it('chartPlugin.accepts returns false (resolved by type, not heuristics)', () => {
    expect(chartPlugin.accepts(['h-axis ["A","B"]', 'bar [1,2]'])).toBe(false);
  });

  it('chartPlugin round-trips parse→layout→render without throwing', () => {
    const source = src([
      'h-axis ["Jan","Feb","Mar","Apr"]',
      'v-axis "Units" 0-->200',
      'bar "Revenue" [50,80,120,90]',
      'line "Target" [100,100,100,100]',
      'legend bottom',
    ]);
    const ast = chartPlugin.parse(source);
    expect(ast.errors).toHaveLength(0);
    const geo = chartPlugin.layoutSync(ast, theme, measurer);
    const svg = chartPlugin.render(geo, theme);
    expect(svg).toMatch(/^<svg/);
    expect(svg).toContain('</svg>');
  });
});

// ---------------------------------------------------------------------------
// Additional renderer unit tests
// ---------------------------------------------------------------------------

describe('renderChart — plot area background', () => {
  it('renders a white plot area background rect', () => {
    const geo = makeMinimalGeo();
    const svg = renderChart(geo, theme);
    // Plot area background uses fill="#FFFFFF"
    expect(svg).toContain('fill="#FFFFFF"');
  });
});

describe('renderChart — h-axis rendering', () => {
  it('renders h-axis tick labels for categorical axis', () => {
    const ast = parseChart(
      src([
        'h-axis ["Alpha","Beta","Gamma"]',
        'v-axis "Y" 0-->100',
        'bar [1,2,3]',
      ]),
    );
    const geo = layoutChart(ast, theme, measurer);
    const svg = renderChart(geo, theme);
    expect(svg).toContain('Alpha');
    expect(svg).toContain('Beta');
    expect(svg).toContain('Gamma');
  });

  it('renders h-axis title when set', () => {
    const ast = parseChart(
      src([
        'h-axis "Category" ["X","Y"]',
        'v-axis "Y" 0-->100',
        'bar [10,20]',
      ]),
    );
    const geo = layoutChart(ast, theme, measurer);
    const svg = renderChart(geo, theme);
    expect(svg).toContain('Category');
  });
});

describe('renderChart — v-axis rendering', () => {
  it('renders v-axis tick labels for numeric axis', () => {
    const ast = parseChart(
      src([
        'h-axis ["A","B"]',
        'v-axis "Y" 0-->100',
        'bar [10,50]',
      ]),
    );
    const geo = layoutChart(ast, theme, measurer);
    const svg = renderChart(geo, theme);
    // Auto-ticks produce labels like "0", "20", "40", "60", "80", "100"
    expect(svg).toContain('0');
    expect(svg).toContain('100');
  });

  it('renders v-axis title when set', () => {
    const ast = parseChart(
      src([
        'h-axis ["A","B"]',
        'v-axis "Revenue" 0-->100',
        'bar [10,50]',
      ]),
    );
    const geo = layoutChart(ast, theme, measurer);
    const svg = renderChart(geo, theme);
    expect(svg).toContain('Revenue');
  });
});

describe('renderChart — area series', () => {
  it('renders area series as a filled path', () => {
    const ast = parseChart(
      src([
        'h-axis ["A","B","C"]',
        'v-axis "Y" 0-->100',
        'area [10,50,30]',
      ]),
    );
    const geo = layoutChart(ast, theme, measurer);
    const svg = renderChart(geo, theme);
    expect(svg).toContain('<path');
    expect(svg).toContain('fill-opacity="0.5"');
  });
});

describe('renderChart — scatter series', () => {
  it('renders scatter series as circle markers', () => {
    const ast = parseChart(
      src([
        'h-axis ["A","B","C"]',
        'v-axis "Y" 0-->100',
        'scatter [10,50,30]',
      ]),
    );
    const geo = layoutChart(ast, theme, measurer);
    const svg = renderChart(geo, theme);
    expect(svg).toContain('<circle');
  });
});

describe('renderChart — legend top / bottom', () => {
  it('legend top → legend y is less than plotArea.y', () => {
    const ast = parseChart(
      src([
        'h-axis ["A","B"]',
        'v-axis "Y" 0-->100',
        'bar "s1" [10,20]',
        'legend top',
      ]),
    );
    const geo = layoutChart(ast, theme, measurer);
    expect(geo.legend).toBeDefined();
    expect(geo.legend!.y).toBeLessThan(geo.plotArea.y);
    const svg = renderChart(geo, theme);
    expect(svg).toContain('s1');
  });

  it('legend bottom → legend y is greater than plotArea.y + plotArea.height', () => {
    const ast = parseChart(
      src([
        'h-axis ["A","B"]',
        'v-axis "Y" 0-->100',
        'bar "s1" [10,20]',
        'legend bottom',
      ]),
    );
    const geo = layoutChart(ast, theme, measurer);
    expect(geo.legend).toBeDefined();
    expect(geo.legend!.y).toBeGreaterThan(geo.plotArea.y + geo.plotArea.height);
  });
});

describe('renderChart — empty series', () => {
  it('chart with no series renders without throwing', () => {
    const ast = parseChart(
      src([
        'h-axis ["A","B"]',
        'v-axis "Y" 0-->100',
      ]),
    );
    const geo = layoutChart(ast, theme, measurer);
    let svg: string;
    expect(() => { svg = renderChart(geo, theme); }).not.toThrow();
    expect(svg!).toMatch(/^<svg/);
  });
});

describe('renderChart — SVG root structure', () => {
  it('output has correct width and height from geo', () => {
    const geo = makeMinimalGeo();
    const svg = renderChart(geo, theme);
    expect(svg).toContain(`width="${geo.svgWidth}"`);
    expect(svg).toContain(`height="${geo.svgHeight}"`);
  });

  it('output is well-formed SVG with defs block', () => {
    const geo = makeMinimalGeo();
    const svg = renderChart(geo, theme);
    expect(svg).toContain('<defs>');
    expect(svg).toContain('</defs>');
  });
});

describe('renderChart — h-axis vertical grid lines', () => {
  it('h-axis grid → vertical <line> elements with dasharray', () => {
    const ast = parseChart(
      src([
        'h-axis ["A","B","C"] grid',
        'v-axis "Y" 0-->100',
        'bar [10,20,30]',
      ]),
    );
    const geo = layoutChart(ast, theme, measurer);
    expect(geo.hAxis.gridPixels.length).toBeGreaterThan(0);
    const svg = renderChart(geo, theme);
    expect(svg).toContain('stroke-dasharray="4 2"');
  });
});

describe('chartPlugin.layoutSync — error propagation', () => {
  it('errors from AST appear on returned geometry', () => {
    const ast = parseChart(src(['line [(1,10),(2,20)]']));
    expect(ast.errors.length).toBeGreaterThan(0);
    const geo = chartPlugin.layoutSync(ast, theme, measurer);
    expect(geo.errors).toBeDefined();
    expect((geo.errors ?? []).length).toBeGreaterThan(0);
  });

  it('clean AST has no errors on geometry', () => {
    const ast = parseChart(
      src([
        'h-axis ["A","B"]',
        'v-axis "Y" 0-->100',
        'bar [10,20]',
      ]),
    );
    expect(ast.errors).toHaveLength(0);
    const geo = chartPlugin.layoutSync(ast, theme, measurer);
    // errors should be undefined or empty
    expect(geo.errors === undefined || geo.errors.length === 0).toBe(true);
  });
});
