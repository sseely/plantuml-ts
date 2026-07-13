/**
 * Tests for layoutChart() — ChartGeometry type-contract and layout math.
 *
 * Acceptance criteria from the task spec (AC1–AC8) plus structural and
 * edge-case tests.
 */

import { describe, it, expect } from 'vitest';
import { layoutChart } from '../../../src/diagrams/chart/layout.js';
import type { ChartDiagramAST, ChartAxisDef } from '../../../src/diagrams/chart/ast.js';
import { FixedMeasurer } from '../../../src/core/measurer.js';
import type { Theme } from '../../../src/core/theme.js';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

/** A minimal Theme sufficient for layout (no style cascades needed). */
const TEST_THEME: Theme = {
  fontFamily: 'sans-serif',
  fontSize: 12,
  colors: {
    background: '#FFFFFF',
    nodeBackground: '#f1f1f1',
    border: '#000000',
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

/** FixedMeasurer: 8px per char, 12px line height */
const MEASURER = new FixedMeasurer(8, 12);

// ---------------------------------------------------------------------------
// Default axis helpers
// ---------------------------------------------------------------------------

function numericAxis(
  min: number,
  max: number,
  gridMode: 'off' | 'major' = 'off',
): ChartAxisDef {
  return {
    title: '',
    min,
    max,
    autoScale: false,
    labels: [],
    customTicks: null,
    tickSpacing: null,
    labelPosition: 'default',
    gridMode,
  };
}

function categoricalAxis(labels: string[]): ChartAxisDef {
  return {
    title: '',
    min: 0,
    max: labels.length,
    autoScale: false,
    labels,
    customTicks: null,
    tickSpacing: null,
    labelPosition: 'default',
    gridMode: 'off',
  };
}

function makeAST(overrides: Partial<ChartDiagramAST> = {}): ChartDiagramAST {
  return {
    hAxis: categoricalAxis(['Jan', 'Feb', 'Mar', 'Apr']),
    vAxis: numericAxis(0, 100),
    v2Axis: null,
    series: [],
    legendPosition: 'none',
    stackMode: 'grouped',
    orientation: 'vertical',
    annotations: [],
    errors: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// AC1 — Categorical h-axis with 4 labels, 2 bar series in grouped mode
//         Each BarSeriesGeo has 4 rects with non-overlapping x ranges
// ---------------------------------------------------------------------------

describe('AC1: grouped bar series — non-overlapping rects', () => {
  it('two bar series produce 4 rects each with non-overlapping x ranges per category', () => {
    const ast = makeAST({
      series: [
        {
          name: 'A',
          type: 'bar',
          values: [10, 20, 30, 40],
          xValues: null,
          color: null,
          useSecondaryAxis: false,
          showLabels: false,
          markerShape: 'circle',
          markerSize: null,
        },
        {
          name: 'B',
          type: 'bar',
          values: [15, 25, 35, 45],
          xValues: null,
          color: null,
          useSecondaryAxis: false,
          showLabels: false,
          markerShape: 'circle',
          markerSize: null,
        },
      ],
    });

    const geo = layoutChart(ast, TEST_THEME, MEASURER);

    const s0 = geo.series[0];
    const s1 = geo.series[1];
    expect(s0?.type).toBe('bar');
    expect(s1?.type).toBe('bar');

    if (s0?.type !== 'bar' || s1?.type !== 'bar') return;

    expect(s0.rects).toHaveLength(4);
    expect(s1.rects).toHaveLength(4);

    // Within each category slot, the two bars must not overlap
    for (let i = 0; i < 4; i++) {
      const r0 = s0.rects[i]!;
      const r1 = s1.rects[i]!;

      // r0 ends at r0.x + r0.width; r1 starts at r1.x — must not overlap
      expect(r0.x + r0.width).toBeLessThanOrEqual(r1.x + 0.01); // +0.01 for fp tolerance
    }
  });
});

// ---------------------------------------------------------------------------
// AC2 — v-axis 0 --> 100, bar value 50 → rect y at midpoint of plot height
// ---------------------------------------------------------------------------

describe('AC2: bar value 50 maps to plot midpoint', () => {
  it('bar rect y ≈ plotArea.y + plotArea.height / 2 (within ±5px)', () => {
    const ast = makeAST({
      hAxis: categoricalAxis(['X']),
      vAxis: numericAxis(0, 100),
      series: [
        {
          name: 'S',
          type: 'bar',
          values: [50],
          xValues: null,
          color: null,
          useSecondaryAxis: false,
          showLabels: false,
          markerShape: 'circle',
          markerSize: null,
        },
      ],
    });

    const geo = layoutChart(ast, TEST_THEME, MEASURER);
    const s = geo.series[0];
    expect(s?.type).toBe('bar');
    if (s?.type !== 'bar') return;

    const rect = s.rects[0]!;
    const expectedY = geo.plotArea.y + geo.plotArea.height / 2;
    expect(rect.y).toBeCloseTo(expectedY, 0); // within ±1px
  });
});

// ---------------------------------------------------------------------------
// AC3 — stacked mode: series[1].rects[0].y + height ≈ series[0].rects[0].y
// ---------------------------------------------------------------------------

describe('AC3: stacked bars — series 1 sits on top of series 0', () => {
  it('rects stack correctly for values [10,20] and [30,40]', () => {
    const ast = makeAST({
      hAxis: categoricalAxis(['A', 'B']),
      vAxis: numericAxis(0, 100),
      stackMode: 'stacked',
      series: [
        {
          name: 'S0',
          type: 'bar',
          values: [10, 20],
          xValues: null,
          color: null,
          useSecondaryAxis: false,
          showLabels: false,
          markerShape: 'circle',
          markerSize: null,
        },
        {
          name: 'S1',
          type: 'bar',
          values: [30, 40],
          xValues: null,
          color: null,
          useSecondaryAxis: false,
          showLabels: false,
          markerShape: 'circle',
          markerSize: null,
        },
      ],
    });

    const geo = layoutChart(ast, TEST_THEME, MEASURER);
    const s0 = geo.series[0];
    const s1 = geo.series[1];
    expect(s0?.type).toBe('bar');
    expect(s1?.type).toBe('bar');
    if (s0?.type !== 'bar' || s1?.type !== 'bar') return;

    // Series 1 bottom (y + height) should equal series 0 top (y) for category 0
    const r0_cat0 = s0.rects[0]!;
    const r1_cat0 = s1.rects[0]!;

    // Series 1 sits on top of Series 0: r1.y + r1.height ≈ r0.y
    expect(r1_cat0.y + r1_cat0.height).toBeCloseTo(r0_cat0.y, 0);
  });
});

// ---------------------------------------------------------------------------
// AC4 — horizontal orientation: bar rects have width proportional to value,
//        height equal to bar thickness
// ---------------------------------------------------------------------------

describe('AC4: horizontal bars', () => {
  it('bar rects have width proportional to value and uniform height', () => {
    const ast = makeAST({
      hAxis: categoricalAxis(['A', 'B', 'C']),
      vAxis: numericAxis(0, 100),
      orientation: 'horizontal',
      series: [
        {
          name: 'S',
          type: 'bar',
          values: [25, 50, 75],
          xValues: null,
          color: null,
          useSecondaryAxis: false,
          showLabels: false,
          markerShape: 'circle',
          markerSize: null,
        },
      ],
    });

    const geo = layoutChart(ast, TEST_THEME, MEASURER);
    const s = geo.series[0];
    expect(s?.type).toBe('bar');
    if (s?.type !== 'bar') return;

    expect(s.horizontal).toBe(true);
    expect(s.rects).toHaveLength(3);

    const [r25, r50, r75] = s.rects;
    // Heights should all be equal (bar thickness)
    expect(r25!.height).toBeCloseTo(r50!.height, 1);
    expect(r50!.height).toBeCloseTo(r75!.height, 1);

    // Widths proportional to values: r50.width ≈ 2 * r25.width
    expect(r50!.width).toBeCloseTo(r25!.width * 2, 1);
    // r75.width ≈ 3 * r25.width
    expect(r75!.width).toBeCloseTo(r25!.width * 3, 1);
  });
});

// ---------------------------------------------------------------------------
// AC5 — legend left: legend.x < plotArea.x, entries.length = series count
// ---------------------------------------------------------------------------

describe('AC5: legend left', () => {
  it('legend.x < plotArea.x and entries.length equals series count', () => {
    const ast = makeAST({
      legendPosition: 'left',
      series: [
        {
          name: 'Alpha',
          type: 'bar',
          values: [10, 20, 30, 40],
          xValues: null,
          color: null,
          useSecondaryAxis: false,
          showLabels: false,
          markerShape: 'circle',
          markerSize: null,
        },
        {
          name: 'Beta',
          type: 'line',
          values: [5, 15, 25, 35],
          xValues: null,
          color: null,
          useSecondaryAxis: false,
          showLabels: false,
          markerShape: 'circle',
          markerSize: null,
        },
      ],
    });

    const geo = layoutChart(ast, TEST_THEME, MEASURER);

    expect(geo.legend).toBeDefined();
    expect(geo.legend!.x).toBeLessThan(geo.plotArea.x);
    expect(geo.legend!.entries).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// AC6 — secondary axis: series with useSecondaryAxis:true scaled against v2Axis
// ---------------------------------------------------------------------------

describe('AC6: secondary axis scaling', () => {
  it('series on v2Axis 0-200 with value 100 maps to plot midpoint', () => {
    const ast = makeAST({
      hAxis: categoricalAxis(['A']),
      vAxis: numericAxis(0, 100),
      v2Axis: numericAxis(0, 200),
      series: [
        {
          name: 'Primary',
          type: 'line',
          values: [50],
          xValues: null,
          color: null,
          useSecondaryAxis: false,
          showLabels: false,
          markerShape: 'circle',
          markerSize: null,
        },
        {
          name: 'Secondary',
          type: 'line',
          values: [100],
          xValues: null,
          color: null,
          useSecondaryAxis: true,
          showLabels: false,
          markerShape: 'circle',
          markerSize: null,
        },
      ],
    });

    const geo = layoutChart(ast, TEST_THEME, MEASURER);

    // Both series have value == midpoint of their respective axes
    // so both should land at the same pixel y
    const primaryLine = geo.series[0];
    const secondaryLine = geo.series[1];
    expect(primaryLine?.type).toBe('line');
    expect(secondaryLine?.type).toBe('line');
    if (primaryLine?.type !== 'line' || secondaryLine?.type !== 'line') return;

    const primaryY = primaryLine.points[0]!.y;
    const secondaryY = secondaryLine.points[0]!.y;

    // Both at midpoint of plot area
    const midY = geo.plotArea.y + geo.plotArea.height / 2;
    expect(primaryY).toBeCloseTo(midY, 0);
    expect(secondaryY).toBeCloseTo(midY, 0);
  });
});

// ---------------------------------------------------------------------------
// AC7 — vAxis gridMode:'major' → vAxis.gridPixels non-empty
// ---------------------------------------------------------------------------

describe('AC7: grid pixels populated when gridMode is major', () => {
  it('vAxis.gridPixels is non-empty for gridMode major', () => {
    const ast = makeAST({
      vAxis: numericAxis(0, 100, 'major'),
    });

    const geo = layoutChart(ast, TEST_THEME, MEASURER);
    expect(geo.vAxis.gridPixels.length).toBeGreaterThan(0);
  });

  it('vAxis.gridPixels is empty for gridMode off', () => {
    const ast = makeAST({
      vAxis: numericAxis(0, 100, 'off'),
    });

    const geo = layoutChart(ast, TEST_THEME, MEASURER);
    expect(geo.vAxis.gridPixels).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// AC8 — Annotation at categorical "Feb" → labelX matches Feb tick pixel
// ---------------------------------------------------------------------------

describe('AC8: annotation categorical x maps to category tick pixel', () => {
  it('"Feb" annotation labelX matches hAxis tick for "Feb"', () => {
    const ast = makeAST({
      hAxis: categoricalAxis(['Jan', 'Feb', 'Mar', 'Apr']),
      vAxis: numericAxis(0, 100),
      annotations: [
        {
          text: 'peak',
          xPos: 'Feb',
          yPos: 80,
          hasArrow: false,
        },
      ],
    });

    const geo = layoutChart(ast, TEST_THEME, MEASURER);
    const ann = geo.annotations[0]!;

    // Find the Feb tick in hAxis
    const febTick = geo.hAxis.ticks.find((t) => t.label === 'Feb');
    expect(febTick).toBeDefined();

    expect(ann.labelX).toBeCloseTo(febTick!.pixelPos, 1);
  });
});

// ---------------------------------------------------------------------------
// Structural tests
// ---------------------------------------------------------------------------

describe('ChartGeometry structure', () => {
  it('returns a well-formed ChartGeometry for an empty series list', () => {
    const ast = makeAST();
    const geo = layoutChart(ast, TEST_THEME, MEASURER);

    expect(geo.svgWidth).toBeGreaterThan(0);
    expect(geo.svgHeight).toBeGreaterThan(0);
    expect(geo.plotArea.width).toBeGreaterThan(0);
    expect(geo.plotArea.height).toBeGreaterThan(0);
    expect(geo.series).toHaveLength(0);
    expect(geo.annotations).toHaveLength(0);
    expect(geo.legend).toBeUndefined();
  });

  it('v2Axis is present when ast.v2Axis is set', () => {
    const ast = makeAST({ v2Axis: numericAxis(0, 200) });
    const geo = layoutChart(ast, TEST_THEME, MEASURER);
    expect(geo.v2Axis).toBeDefined();
    expect(geo.v2Axis?.min).toBe(0);
    expect(geo.v2Axis?.max).toBe(200);
  });

  it('v2Axis is absent when ast.v2Axis is null', () => {
    const ast = makeAST({ v2Axis: null });
    const geo = layoutChart(ast, TEST_THEME, MEASURER);
    expect(geo.v2Axis).toBeUndefined();
  });

  it('plotArea.x matches leftMargin (no legend)', () => {
    const ast = makeAST({ legendPosition: 'none' });
    const geo = layoutChart(ast, TEST_THEME, MEASURER);
    // leftMargin = MARGIN(20) + AXIS_LABEL_SPACE(40) = 60
    expect(geo.plotArea.x).toBe(60);
  });

  it('legend none → geo.legend is undefined', () => {
    const ast = makeAST({ legendPosition: 'none' });
    const geo = layoutChart(ast, TEST_THEME, MEASURER);
    expect(geo.legend).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Axis tick tests
// ---------------------------------------------------------------------------

describe('axis tick generation', () => {
  it('categorical h-axis produces one tick per label (no tickSpacing)', () => {
    const ast = makeAST({
      hAxis: categoricalAxis(['A', 'B', 'C']),
    });
    const geo = layoutChart(ast, TEST_THEME, MEASURER);
    expect(geo.hAxis.ticks).toHaveLength(3);
    expect(geo.hAxis.ticks[0]!.label).toBe('A');
    expect(geo.hAxis.ticks[2]!.label).toBe('C');
  });

  it('categorical h-axis with tickSpacing=2 produces every other tick', () => {
    const ast = makeAST({
      hAxis: {
        ...categoricalAxis(['A', 'B', 'C', 'D']),
        tickSpacing: 2,
      },
    });
    const geo = layoutChart(ast, TEST_THEME, MEASURER);
    expect(geo.hAxis.ticks).toHaveLength(2); // indices 0, 2
    expect(geo.hAxis.ticks[0]!.label).toBe('A');
    expect(geo.hAxis.ticks[1]!.label).toBe('C');
  });

  it('numeric v-axis auto ticks: 6 ticks (0..5) for range 0-100', () => {
    const ast = makeAST({ vAxis: numericAxis(0, 100) });
    const geo = layoutChart(ast, TEST_THEME, MEASURER);
    // AUTO_TICK_COUNT = 5 → 6 ticks (0 through 5 inclusive)
    expect(geo.vAxis.ticks).toHaveLength(6);
    expect(geo.vAxis.ticks[0]!.value).toBe(0);
    expect(geo.vAxis.ticks[5]!.value).toBe(100);
  });

  it('numeric v-axis custom ticks are used instead of auto ticks', () => {
    const ast = makeAST({
      vAxis: {
        ...numericAxis(0, 100),
        customTicks: new Map([
          [0, 'Low'],
          [50, 'Mid'],
          [100, 'High'],
        ]),
      },
    });
    const geo = layoutChart(ast, TEST_THEME, MEASURER);
    expect(geo.vAxis.ticks).toHaveLength(3);
    expect(geo.vAxis.ticks[1]!.label).toBe('Mid');
  });

  it('numeric v-axis tickSpacing generates interval-based ticks', () => {
    const ast = makeAST({
      vAxis: {
        ...numericAxis(0, 100),
        tickSpacing: 25,
      },
    });
    const geo = layoutChart(ast, TEST_THEME, MEASURER);
    // 0, 25, 50, 75, 100 → 5 ticks
    expect(geo.vAxis.ticks).toHaveLength(5);
    expect(geo.vAxis.ticks[2]!.value).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// Color assignment tests
// ---------------------------------------------------------------------------

describe('color assignment', () => {
  it('series with explicit color uses that color', () => {
    const ast = makeAST({
      series: [
        {
          name: 'S',
          type: 'bar',
          values: [10],
          xValues: null,
          color: '#FF0000',
          useSecondaryAxis: false,
          showLabels: false,
          markerShape: 'circle',
          markerSize: null,
        },
      ],
    });
    const geo = layoutChart(ast, TEST_THEME, MEASURER);
    expect(geo.series[0]!.color).toBe('#FF0000');
  });

  it('series with null color gets default palette color', () => {
    const ast = makeAST({
      series: [
        {
          name: 'S',
          type: 'bar',
          values: [10],
          xValues: null,
          color: null,
          useSecondaryAxis: false,
          showLabels: false,
          markerShape: 'circle',
          markerSize: null,
        },
      ],
    });
    const geo = layoutChart(ast, TEST_THEME, MEASURER);
    expect(geo.series[0]!.color).toBe('#8888FF');
  });

  it('six series cycle through all default palette colors', () => {
    const palette = ['#8888FF', '#FF8888', '#88FF88', '#FFAA00', '#AA88FF', '#FF88AA'];
    const series = palette.map((_, i) => ({
      name: `S${i}`,
      type: 'bar' as const,
      values: [10],
      xValues: null,
      color: null,
      useSecondaryAxis: false,
      showLabels: false,
      markerShape: 'circle' as const,
      markerSize: null,
    }));
    const ast = makeAST({
      hAxis: categoricalAxis(['X']),
      series,
    });
    const geo = layoutChart(ast, TEST_THEME, MEASURER);
    for (let i = 0; i < 6; i++) {
      expect(geo.series[i]!.color).toBe(palette[i]);
    }
  });
});

// ---------------------------------------------------------------------------
// Annotation arrow target
// ---------------------------------------------------------------------------

describe('annotation geometry', () => {
  it('annotation with hasArrow:true has arrowTargetX matching labelX and arrowTargetY at data point', () => {
    const ast = makeAST({
      hAxis: categoricalAxis(['A', 'B']),
      vAxis: numericAxis(0, 100),
      annotations: [
        { text: 'note', xPos: 'A', yPos: 50, hasArrow: true },
      ],
    });
    const geo = layoutChart(ast, TEST_THEME, MEASURER);
    const ann = geo.annotations[0]!;
    expect(ann.hasArrow).toBe(true);
    // labelX and arrowTargetX share the same column
    expect(ann.arrowTargetX).toBe(ann.labelX);
    // label is offset 28px above the data point; arrow tip is AT the data point
    expect(ann.arrowTargetY).toBe(ann.labelY + 28);
  });

  it('annotation with hasArrow:false has no arrow target coords', () => {
    const ast = makeAST({
      annotations: [{ text: 'note', xPos: 'Jan', yPos: 50, hasArrow: false }],
    });
    const geo = layoutChart(ast, TEST_THEME, MEASURER);
    const ann = geo.annotations[0]!;
    expect(ann.hasArrow).toBe(false);
    expect(ann.arrowTargetX).toBeUndefined();
    expect(ann.arrowTargetY).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Area series tests
// ---------------------------------------------------------------------------

describe('area series geometry', () => {
  it('non-stacked area: baselinePoints all have same y (zero line)', () => {
    const ast = makeAST({
      hAxis: categoricalAxis(['A', 'B', 'C']),
      vAxis: numericAxis(0, 100),
      series: [
        {
          name: 'Area',
          type: 'area',
          values: [20, 50, 80],
          xValues: null,
          color: null,
          useSecondaryAxis: false,
          showLabels: false,
          markerShape: 'circle',
          markerSize: null,
        },
      ],
    });
    const geo = layoutChart(ast, TEST_THEME, MEASURER);
    const s = geo.series[0];
    expect(s?.type).toBe('area');
    if (s?.type !== 'area') return;

    // All baseline points should share the same y (zero line)
    const firstY = s.baselinePoints[0]!.y;
    for (const pt of s.baselinePoints) {
      expect(pt.y).toBeCloseTo(firstY, 1);
    }
  });

  it('stacked area: second area baseline matches first area points', () => {
    const ast = makeAST({
      hAxis: categoricalAxis(['A', 'B']),
      vAxis: numericAxis(0, 100),
      stackMode: 'stacked',
      series: [
        {
          name: 'A1',
          type: 'area',
          values: [10, 20],
          xValues: null,
          color: null,
          useSecondaryAxis: false,
          showLabels: false,
          markerShape: 'circle',
          markerSize: null,
        },
        {
          name: 'A2',
          type: 'area',
          values: [30, 40],
          xValues: null,
          color: null,
          useSecondaryAxis: false,
          showLabels: false,
          markerShape: 'circle',
          markerSize: null,
        },
      ],
    });
    const geo = layoutChart(ast, TEST_THEME, MEASURER);

    const a1 = geo.series[0];
    const a2 = geo.series[1];
    expect(a1?.type).toBe('area');
    expect(a2?.type).toBe('area');
    if (a1?.type !== 'area' || a2?.type !== 'area') return;

    // a2's baseline should match a1's top points (the cumulative values [10,20])
    // which are the same pixel positions as a1.points
    expect(a2.baselinePoints).toHaveLength(2);
    expect(a2.baselinePoints[0]!.y).toBeCloseTo(a1.points[0]!.y, 1);
    expect(a2.baselinePoints[1]!.y).toBeCloseTo(a1.points[1]!.y, 1);
  });
});

// ---------------------------------------------------------------------------
// Legend top / bottom / right positions
// ---------------------------------------------------------------------------

describe('legend position variants', () => {
  function seriesWithTwoItems(): ChartDiagramAST['series'] {
    return [
      {
        name: 'X',
        type: 'bar' as const,
        values: [10],
        xValues: null,
        color: null,
        useSecondaryAxis: false,
        showLabels: false,
        markerShape: 'circle' as const,
        markerSize: null,
      },
      {
        name: 'Y',
        type: 'line' as const,
        values: [20],
        xValues: null,
        color: null,
        useSecondaryAxis: false,
        showLabels: false,
        markerShape: 'circle' as const,
        markerSize: null,
      },
    ];
  }

  it('legend right → legend.x > plotArea.x + plotArea.width', () => {
    const ast = makeAST({
      hAxis: categoricalAxis(['A']),
      legendPosition: 'right',
      series: seriesWithTwoItems(),
    });
    const geo = layoutChart(ast, TEST_THEME, MEASURER);
    expect(geo.legend).toBeDefined();
    expect(geo.legend!.x).toBeGreaterThan(geo.plotArea.x + geo.plotArea.width);
  });

  it('legend top → legend.y < plotArea.y', () => {
    const ast = makeAST({
      hAxis: categoricalAxis(['A']),
      legendPosition: 'top',
      series: seriesWithTwoItems(),
    });
    const geo = layoutChart(ast, TEST_THEME, MEASURER);
    expect(geo.legend).toBeDefined();
    expect(geo.legend!.y).toBeLessThan(geo.plotArea.y);
  });

  it('legend bottom → legend.y > plotArea.y + plotArea.height', () => {
    const ast = makeAST({
      hAxis: categoricalAxis(['A']),
      legendPosition: 'bottom',
      series: seriesWithTwoItems(),
    });
    const geo = layoutChart(ast, TEST_THEME, MEASURER);
    expect(geo.legend).toBeDefined();
    expect(geo.legend!.y).toBeGreaterThan(geo.plotArea.y + geo.plotArea.height);
  });
});

// ---------------------------------------------------------------------------
// valueToPixel edge cases
// ---------------------------------------------------------------------------

describe('v-axis pixel mapping', () => {
  it('value at min maps to bottom of plot area (pixelMin)', () => {
    const ast = makeAST({
      hAxis: categoricalAxis(['A']),
      vAxis: numericAxis(0, 100),
      series: [
        {
          name: 'S',
          type: 'line',
          values: [0],
          xValues: null,
          color: null,
          useSecondaryAxis: false,
          showLabels: false,
          markerShape: 'circle',
          markerSize: null,
        },
      ],
    });
    const geo = layoutChart(ast, TEST_THEME, MEASURER);
    const s = geo.series[0];
    if (s?.type !== 'line') return;
    const bottom = geo.plotArea.y + geo.plotArea.height;
    expect(s.points[0]!.y).toBeCloseTo(bottom, 1);
  });

  it('value at max maps to top of plot area (pixelMax)', () => {
    const ast = makeAST({
      hAxis: categoricalAxis(['A']),
      vAxis: numericAxis(0, 100),
      series: [
        {
          name: 'S',
          type: 'line',
          values: [100],
          xValues: null,
          color: null,
          useSecondaryAxis: false,
          showLabels: false,
          markerShape: 'circle',
          markerSize: null,
        },
      ],
    });
    const geo = layoutChart(ast, TEST_THEME, MEASURER);
    const s = geo.series[0];
    if (s?.type !== 'line') return;
    const top = geo.plotArea.y;
    expect(s.points[0]!.y).toBeCloseTo(top, 1);
  });
});

// ---------------------------------------------------------------------------
// Scatter series geometry
// ---------------------------------------------------------------------------

describe('scatter series geometry', () => {
  it('produces a ScatterSeriesGeo with the correct number of points', () => {
    const ast = makeAST({
      hAxis: categoricalAxis(['A', 'B', 'C']),
      vAxis: numericAxis(0, 100),
      series: [
        {
          name: 'Dots',
          type: 'scatter',
          values: [25, 50, 75],
          xValues: null,
          color: '#00FF00',
          useSecondaryAxis: false,
          showLabels: true,
          markerShape: 'square',
          markerSize: null,
        },
      ],
    });

    const geo = layoutChart(ast, TEST_THEME, MEASURER);
    const s = geo.series[0];
    expect(s?.type).toBe('scatter');
    if (s?.type !== 'scatter') return;

    expect(s.points).toHaveLength(3);
    expect(s.color).toBe('#00FF00');
    expect(s.markerShape).toBe('square');
    expect(s.showLabels).toBe(true);
  });

  it('scatter with coordinate pairs maps x values through h-axis', () => {
    const ast = makeAST({
      hAxis: numericAxis(0, 10),
      vAxis: numericAxis(0, 100),
      series: [
        {
          name: 'Dots',
          type: 'scatter',
          values: [50],
          xValues: [5],
          color: null,
          useSecondaryAxis: false,
          showLabels: false,
          markerShape: 'circle',
          markerSize: null,
        },
      ],
    });

    const geo = layoutChart(ast, TEST_THEME, MEASURER);
    const s = geo.series[0];
    if (s?.type !== 'scatter') return;

    const pt = s.points[0]!;
    // xValue=5 is midpoint of 0-10, should land at midpoint of plotWidth + plotArea.x
    const midX = geo.plotArea.x + geo.plotArea.width / 2;
    expect(pt.x).toBeCloseTo(midX, 1);
    expect(pt.xValue).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// Annotation with numeric xPos
// ---------------------------------------------------------------------------

describe('annotation with numeric xPos', () => {
  it('numeric xPos maps through h-axis valueToPixel', () => {
    const ast = makeAST({
      hAxis: numericAxis(0, 10),
      vAxis: numericAxis(0, 100),
      annotations: [
        { text: 'mid', xPos: 5, yPos: 50, hasArrow: true },
      ],
    });

    const geo = layoutChart(ast, TEST_THEME, MEASURER);
    const ann = geo.annotations[0]!;

    // xPos=5 is mid of 0-10 → should be at mid of plotWidth + plotArea.x
    const midX = geo.plotArea.x + geo.plotArea.width / 2;
    expect(ann.labelX).toBeCloseTo(midX, 1);
  });
});

// ---------------------------------------------------------------------------
// Additional branch coverage
// ---------------------------------------------------------------------------

describe('stacked bars with negative values', () => {
  it('negative value in stacked mode uses negative cumulative branch', () => {
    const ast = makeAST({
      hAxis: categoricalAxis(['A']),
      vAxis: numericAxis(-100, 100),
      stackMode: 'stacked',
      series: [
        {
          name: 'Neg',
          type: 'bar',
          values: [-30],
          xValues: null,
          color: null,
          useSecondaryAxis: false,
          showLabels: false,
          markerShape: 'circle',
          markerSize: null,
        },
        {
          name: 'Neg2',
          type: 'bar',
          values: [-20],
          xValues: null,
          color: null,
          useSecondaryAxis: false,
          showLabels: false,
          markerShape: 'circle',
          markerSize: null,
        },
      ],
    });

    const geo = layoutChart(ast, TEST_THEME, MEASURER);
    const s0 = geo.series[0];
    const s1 = geo.series[1];
    expect(s0?.type).toBe('bar');
    expect(s1?.type).toBe('bar');
    if (s0?.type !== 'bar' || s1?.type !== 'bar') return;

    // Both have negative values so they stack downward (positive y direction)
    const r0 = s0.rects[0]!;
    const r1 = s1.rects[0]!;
    // s1 starts at the bottom of s0
    expect(r1.y).toBeCloseTo(r0.y + r0.height, 0);
  });
});

describe('stacked area with unequal series lengths', () => {
  it('second area series with more values than first accumulates correctly', () => {
    const ast = makeAST({
      hAxis: categoricalAxis(['A', 'B', 'C']),
      vAxis: numericAxis(0, 100),
      stackMode: 'stacked',
      series: [
        {
          name: 'Short',
          type: 'area',
          values: [10, 20],  // only 2 values
          xValues: null,
          color: null,
          useSecondaryAxis: false,
          showLabels: false,
          markerShape: 'circle',
          markerSize: null,
        },
        {
          name: 'Long',
          type: 'area',
          values: [30, 40, 50],  // 3 values — triggers the extra-values branch
          xValues: null,
          color: null,
          useSecondaryAxis: false,
          showLabels: false,
          markerShape: 'circle',
          markerSize: null,
        },
      ],
    });

    const geo = layoutChart(ast, TEST_THEME, MEASURER);
    const s1 = geo.series[1];
    expect(s1?.type).toBe('area');
    if (s1?.type !== 'area') return;
    expect(s1.points).toHaveLength(3);
    // Baseline covers only the first 2 points (extent of first-series values)
    // and is derived from the first series values [10, 20].
    // The cumulative update path (extra-values branch) runs but the baseline itself
    // only has as many points as the prior cumulative array.
    expect(s1.baselinePoints.length).toBeGreaterThan(0);
    // First two baseline points reflect the first series cumulative (10 and 20),
    // so they should be above the zero line (smaller pixel y than zero line)
    const zeroY = geo.plotArea.y + geo.plotArea.height;
    expect(s1.baselinePoints[0]!.y).toBeLessThan(zeroY);
    expect(s1.baselinePoints[1]!.y).toBeLessThan(zeroY);
  });
});
