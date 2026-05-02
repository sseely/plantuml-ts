/**
 * layoutChart() — pixel geometry for chart diagrams.
 *
 * Converts a ChartDiagramAST into a ChartGeometry that sub-renderers
 * (bar, line, area, scatter) consume directly without re-doing any math.
 *
 * Constants are sourced from ChartRenderer.java and BarRenderer.java.
 *
 * @module
 */

import type { ChartDiagramAST, ChartAxisDef, GridMode, SeriesType } from './ast.js';
import type { Theme } from '../../core/theme.js';
import type { StringMeasurer } from '../../core/measurer.js';

// ---------------------------------------------------------------------------
// Layout constants — from ChartRenderer.java
// ---------------------------------------------------------------------------

const MARGIN = 20;
const AXIS_LABEL_SPACE = 40;
const TITLE_SPACE = 30;
const LEGEND_MARGIN = 10;
const LEGEND_SYMBOL_SIZE = 12;
const LEGEND_TEXT_SPACING = 5;
const LEGEND_ITEM_SPACING = 15;
const X_AXIS_TITLE_EXTRA = 20;
const BAR_WIDTH_RATIO = 0.6; // from BarRenderer.java

/** Default minimum plot width in pixels. */
const MIN_PLOT_WIDTH = 400;
/** Fixed plot height in pixels — from getPlotHeight() in ChartRenderer.java. */
const PLOT_HEIGHT = 300;
/** Target number of automatic numeric axis ticks. */
const AUTO_TICK_COUNT = 5;

// ---------------------------------------------------------------------------
// Default color palette (D3-like, as specified in decisions.md)
// ---------------------------------------------------------------------------

const DEFAULT_COLORS: readonly string[] = [
  '#8888FF',
  '#FF8888',
  '#88FF88',
  '#FFAA00',
  '#AA88FF',
  '#FF88AA',
];

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface PlotArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TickMark {
  /** Data value (NaN for categorical ticks). */
  value: number;
  /** Display string. */
  label: string;
  /** Pixel coordinate along the axis. */
  pixelPos: number;
}

export interface AxisGeometry {
  min: number;
  max: number;
  ticks: TickMark[];
  title: string;
  titlePos: { x: number; y: number; rotate: boolean };
  /** Empty when gridMode is 'off'. */
  gridPixels: number[];
  /** Pixel coord of axis min value. */
  pixelMin: number;
  /** Pixel coord of axis max value. */
  pixelMax: number;
}

export interface BarRect {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Original data value (for labels). */
  value: number;
}

export interface DataPoint {
  /** Pixel x coordinate. */
  x: number;
  /** Pixel y coordinate. */
  y: number;
  /** Original y data value (for labels). */
  value: number;
  /** Original x data value (coordinate-pair mode only). */
  xValue?: number;
}

export interface BarSeriesGeo {
  type: 'bar';
  name: string;
  color: string;
  showLabels: boolean;
  rects: BarRect[];
  horizontal: boolean;
}

export interface LineSeriesGeo {
  type: 'line';
  name: string;
  color: string;
  showLabels: boolean;
  markerShape: 'circle' | 'square' | 'triangle';
  points: DataPoint[];
}

export interface AreaSeriesGeo {
  type: 'area';
  name: string;
  color: string;
  showLabels: boolean;
  points: DataPoint[];
  /** Bottom edge — zero-line or previous stacked area top. */
  baselinePoints: DataPoint[];
}

export interface ScatterSeriesGeo {
  type: 'scatter';
  name: string;
  color: string;
  showLabels: boolean;
  markerShape: 'circle' | 'square' | 'triangle';
  markerSize: number; // diameter in px; default 8
  points: DataPoint[];
}

export type SeriesGeo =
  | BarSeriesGeo
  | LineSeriesGeo
  | AreaSeriesGeo
  | ScatterSeriesGeo;

export interface LegendEntry {
  name: string;
  color: string;
  seriesType: SeriesType;
  /** Scatter-only: marker shape for the legend swatch. */
  markerShape?: 'circle' | 'square' | 'triangle';
  /** Scatter-only: marker diameter for the legend swatch. */
  markerSize?: number;
}

export interface LegendGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
  entries: LegendEntry[];
  /** Which side the legend sits on — drives vertical vs horizontal stacking. */
  position: 'left' | 'right' | 'top' | 'bottom';
}

export interface AnnotationGeometry {
  text: string;
  labelX: number;
  labelY: number;
  hasArrow: boolean;
  arrowTargetX?: number;
  arrowTargetY?: number;
}

export interface ChartGeometry {
  svgWidth: number;
  svgHeight: number;
  plotArea: PlotArea;
  hAxis: AxisGeometry;
  vAxis: AxisGeometry;
  v2Axis?: AxisGeometry;
  series: SeriesGeo[];
  legend?: LegendGeometry;
  annotations: AnnotationGeometry[];
  orientation: 'vertical' | 'horizontal';
  gridH: GridMode;
  gridV: GridMode;
  bgColor: string;
  title: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Map a data value to a pixel coordinate using the ChartAxis.java formula:
 *
 *   pixelMin + (value - axisMin) / (axisMax - axisMin) * (pixelMax - pixelMin)
 *
 * For the v-axis (y), pass pixelMin = plotArea bottom and pixelMax = plotArea top
 * so that larger values map to smaller pixel y (SVG y grows downward).
 */
function valueToPixel(
  value: number,
  pixelMin: number,
  pixelMax: number,
  axisMin: number,
  axisMax: number,
): number {
  if (axisMax === axisMin) return pixelMin;
  return pixelMin + ((value - axisMin) / (axisMax - axisMin)) * (pixelMax - pixelMin);
}

/**
 * Format a numeric value for axis tick labels — mirrors ChartRenderer.java formatAxisValue().
 */
function formatAxisValue(value: number): string {
  if (Math.abs(value) < 0.01 && value !== 0) {
    return value.toExponential(2);
  }
  if (value === Math.trunc(value)) {
    return String(Math.trunc(value));
  }
  return value.toFixed(1);
}

/**
 * Resolve a color with fallback from the default palette.
 */
function resolveColor(rawColor: string | null, index: number): string {
  if (rawColor !== null && rawColor.length > 0) return rawColor;
  return DEFAULT_COLORS[index % DEFAULT_COLORS.length]!;
}

// ---------------------------------------------------------------------------
// Axis tick generation
// ---------------------------------------------------------------------------

/**
 * Build ticks for a categorical h-axis (hAxis.labels is non-empty).
 *
 * All category positions are always computed for bar layout, but only
 * every tickSpacing-th entry appears in the returned TickMark array when
 * tickSpacing is set.
 */
function buildCategoricalTicks(
  labels: string[],
  plotWidth: number,
  tickSpacing: number | null,
): TickMark[] {
  const spacing = tickSpacing !== null && tickSpacing > 0 ? tickSpacing : 1;
  const ticks: TickMark[] = [];
  for (let i = 0; i < labels.length; i++) {
    if (i % spacing !== 0) continue;
    const pixelPos = (i + 0.5) * (plotWidth / labels.length);
    ticks.push({ value: NaN, label: labels[i]!, pixelPos });
  }
  return ticks;
}

/**
 * Build ticks for a numeric axis.
 *
 * Priority:
 *   1. customTicks map
 *   2. tickSpacing interval
 *   3. Auto ~5 ticks
 */
function buildNumericTicks(
  axis: ChartAxisDef,
  pixelMin: number,
  pixelMax: number,
): TickMark[] {
  const { min, max, customTicks, tickSpacing } = axis;

  // 1. Custom ticks map
  if (customTicks !== null && customTicks.size > 0) {
    const ticks: TickMark[] = [];
    for (const [value, label] of customTicks) {
      const pixelPos = valueToPixel(value, pixelMin, pixelMax, min, max);
      ticks.push({ value, label, pixelPos });
    }
    return ticks.sort((a, b) => a.value - b.value);
  }

  // 2. Explicit tick spacing
  if (tickSpacing !== null && tickSpacing > 0) {
    const ticks: TickMark[] = [];
    const start = Math.ceil(min / tickSpacing) * tickSpacing;
    for (
      let v = start;
      v <= max + tickSpacing * 0.01;
      v += tickSpacing
    ) {
      if (v > max + tickSpacing * 0.01) break;
      const clamped = Math.min(v, max);
      const pixelPos = valueToPixel(clamped, pixelMin, pixelMax, min, max);
      ticks.push({ value: clamped, label: formatAxisValue(clamped), pixelPos });
    }
    return ticks;
  }

  // 3. Automatic — target AUTO_TICK_COUNT ticks
  const ticks: TickMark[] = [];
  for (let i = 0; i <= AUTO_TICK_COUNT; i++) {
    const value = min + ((max - min) * i) / AUTO_TICK_COUNT;
    const pixelPos = valueToPixel(value, pixelMin, pixelMax, min, max);
    ticks.push({ value, label: formatAxisValue(value), pixelPos });
  }
  return ticks;
}

// ---------------------------------------------------------------------------
// AxisGeometry builders
// ---------------------------------------------------------------------------

function buildVAxisGeometry(
  axis: ChartAxisDef,
  plotArea: PlotArea,
  leftSide: boolean,
): AxisGeometry {
  // V-axis: pixelMin = bottom of plot, pixelMax = top of plot (inverted y).
  const pixelMin = plotArea.y + plotArea.height;
  const pixelMax = plotArea.y;

  // Categorical labels on v-axis: used in horizontal bar mode where vAxis
  // defines the row categories (e.g. v-axis [Product A, Product B, Product C]).
  const ticks: TickMark[] =
    axis.labels.length > 0
      ? axis.labels.map((label, i) => ({
          value: NaN,
          label,
          pixelPos: plotArea.y + (i + 0.5) * (plotArea.height / axis.labels.length),
        }))
      : buildNumericTicks(axis, pixelMin, pixelMax);
  const gridPixels: number[] =
    axis.gridMode === 'major' ? ticks.map((t) => t.pixelPos) : [];

  // Title position: centered vertically, to the left (or right for v2Axis)
  const titleX = leftSide
    ? plotArea.x - AXIS_LABEL_SPACE
    : plotArea.x + plotArea.width + AXIS_LABEL_SPACE;
  const titleY = plotArea.y + plotArea.height / 2;

  return {
    min: axis.min,
    max: axis.max,
    ticks,
    title: axis.title,
    titlePos: { x: titleX, y: titleY, rotate: true },
    gridPixels,
    pixelMin,
    pixelMax,
  };
}

function buildHAxisGeometry(
  axis: ChartAxisDef,
  plotArea: PlotArea,
): AxisGeometry {
  // H-axis: pixelMin = left of plot, pixelMax = right of plot.
  const pixelMin = plotArea.x;
  const pixelMax = plotArea.x + plotArea.width;

  const ticks: TickMark[] =
    axis.labels.length > 0
      ? buildCategoricalTicks(axis.labels, plotArea.width, axis.tickSpacing).map(
          (t) => ({ ...t, pixelPos: t.pixelPos + plotArea.x }),
        )
      : buildNumericTicks(axis, pixelMin, pixelMax);

  const gridPixels: number[] =
    axis.gridMode === 'major' ? ticks.map((t) => t.pixelPos) : [];

  // Title position: centered horizontally below the plot
  const titleX = plotArea.x + plotArea.width / 2;
  const titleY = plotArea.y + plotArea.height + AXIS_LABEL_SPACE + 10;

  return {
    min: axis.min,
    max: axis.max,
    ticks,
    title: axis.title,
    titlePos: { x: titleX, y: titleY, rotate: false },
    gridPixels,
    pixelMin,
    pixelMax,
  };
}

// ---------------------------------------------------------------------------
// Legend geometry
// ---------------------------------------------------------------------------

function buildLegendGeometry(
  ast: ChartDiagramAST,
  plotArea: PlotArea,
  colors: string[],
  measurer: StringMeasurer,
  font: { family: string; size: number },
  leftMargin: number,
  topMargin: number,
  v2AxisPresent: boolean,
): LegendGeometry | undefined {
  if (ast.legendPosition === 'none' || ast.series.length === 0) return undefined;

  const entries: LegendEntry[] = ast.series.map((s, i) => ({
    name: s.name,
    color: colors[i]!,
    seriesType: s.type,
    ...(s.type === 'scatter'
      ? { markerShape: s.markerShape, markerSize: s.markerSize ?? 8 }
      : {}),
  }));

  // Measure legend items
  let maxLabelWidth = 0;
  let totalItemHeight = 0;
  let totalItemWidth = 0;
  let maxLabelHeight = 0;

  for (const entry of entries) {
    const dim = measurer.measure(entry.name, font);
    if (
      ast.legendPosition === 'left' ||
      ast.legendPosition === 'right'
    ) {
      maxLabelWidth = Math.max(maxLabelWidth, dim.width);
      totalItemHeight += dim.height + LEGEND_ITEM_SPACING;
    } else {
      totalItemWidth +=
        dim.width + LEGEND_SYMBOL_SIZE + LEGEND_TEXT_SPACING + LEGEND_ITEM_SPACING;
      maxLabelHeight = Math.max(maxLabelHeight, dim.height);
    }
  }

  let legendX: number;
  let legendY: number;
  let legendWidth: number;
  let legendHeight: number;

  switch (ast.legendPosition) {
    case 'left':
      legendWidth =
        maxLabelWidth + LEGEND_SYMBOL_SIZE + LEGEND_TEXT_SPACING + LEGEND_MARGIN * 2;
      legendHeight = totalItemHeight;
      legendX = MARGIN;
      legendY = topMargin;
      break;
    case 'right':
      legendWidth =
        maxLabelWidth + LEGEND_SYMBOL_SIZE + LEGEND_TEXT_SPACING + LEGEND_MARGIN * 2;
      legendHeight = totalItemHeight;
      legendX =
        leftMargin +
        plotArea.width +
        (v2AxisPresent ? AXIS_LABEL_SPACE : 0) +
        LEGEND_MARGIN;
      legendY = topMargin;
      break;
    case 'top':
      legendWidth = totalItemWidth;
      legendHeight = maxLabelHeight + LEGEND_MARGIN * 2;
      legendX = leftMargin;
      legendY = MARGIN;
      break;
    case 'bottom':
      legendWidth = totalItemWidth;
      legendHeight = maxLabelHeight + LEGEND_MARGIN * 2;
      legendX = leftMargin;
      legendY = topMargin + plotArea.height + AXIS_LABEL_SPACE + LEGEND_MARGIN;
      break;
    default:
      return undefined;
  }

  return { x: legendX, y: legendY, width: legendWidth, height: legendHeight, entries, position: ast.legendPosition };
}

// ---------------------------------------------------------------------------
// Bar geometry — vertical grouped
// ---------------------------------------------------------------------------

function buildBarRectsGrouped(
  values: number[],
  seriesIndex: number,
  barSeriesCount: number,
  categoryCount: number,
  plotArea: PlotArea,
  vAxisMin: number,
  vAxisMax: number,
): BarRect[] {
  const categoryWidth = plotArea.width / categoryCount;
  const groupBarWidth = (categoryWidth * BAR_WIDTH_RATIO) / barSeriesCount;
  const rects: BarRect[] = [];

  const plotBottom = plotArea.y + plotArea.height;
  const plotTop = plotArea.y;

  // zeroY in plot-relative coords first, then offset to SVG
  const zeroYRelative = Math.max(
    0,
    Math.min(
      plotArea.height,
      plotArea.height -
        ((0 - vAxisMin) / (vAxisMax - vAxisMin)) * plotArea.height,
    ),
  );
  const zeroY = plotArea.y + zeroYRelative;

  for (let i = 0; i < Math.min(values.length, categoryCount); i++) {
    const value = values[i]!;
    const x =
      plotArea.x +
      i * categoryWidth +
      ((1 - BAR_WIDTH_RATIO) / 2) * categoryWidth +
      seriesIndex * groupBarWidth;

    const valueYRelative =
      plotArea.height - ((value - vAxisMin) / (vAxisMax - vAxisMin)) * plotArea.height;
    const valueY = plotArea.y + valueYRelative;

    const barY = Math.min(zeroY, valueY);
    const barHeight = Math.abs(valueY - zeroY);

    // Clamp within plot area
    const clampedY = Math.max(plotTop, Math.min(plotBottom, barY));
    const clampedHeight = Math.max(
      0,
      Math.min(plotBottom - clampedY, barHeight),
    );

    rects.push({ x, y: clampedY, width: groupBarWidth, height: clampedHeight, value });
  }

  return rects;
}

// ---------------------------------------------------------------------------
// Bar geometry — vertical stacked
// ---------------------------------------------------------------------------

function buildBarRectsStacked(
  barSeriesValues: number[][],
  categoryCount: number,
  plotArea: PlotArea,
  vAxisMin: number,
  vAxisMax: number,
): BarRect[][] {
  const categoryWidth = plotArea.width / categoryCount;
  const barWidth = categoryWidth * BAR_WIDTH_RATIO;
  const barOffset = (categoryWidth - barWidth) / 2;

  // One rect array per series
  const result: BarRect[][] = barSeriesValues.map(() => []);
  const plotBottom = plotArea.y + plotArea.height;
  const plotTop = plotArea.y;

  for (let catIdx = 0; catIdx < categoryCount; catIdx++) {
    const zeroYRelative =
      plotArea.height -
      ((0 - vAxisMin) / (vAxisMax - vAxisMin)) * plotArea.height;

    // Track cumulative tops: positive bars grow upward, negative grow downward
    let cumulativePositiveY = plotArea.y + zeroYRelative;
    let cumulativeNegativeY = plotArea.y + zeroYRelative;

    for (let si = 0; si < barSeriesValues.length; si++) {
      const values = barSeriesValues[si]!;
      if (catIdx >= values.length) continue;

      const value = values[catIdx]!;
      const x = plotArea.x + catIdx * categoryWidth + barOffset;

      const valueYRelative =
        plotArea.height -
        ((value - vAxisMin) / (vAxisMax - vAxisMin)) * plotArea.height;
      const valueY = plotArea.y + valueYRelative;

      const zeroAbsolute = plotArea.y + zeroYRelative;
      const barHeight = Math.abs(valueY - zeroAbsolute);

      let barY: number;
      if (value < 0) {
        barY = cumulativeNegativeY;
        cumulativeNegativeY += barHeight;
      } else {
        cumulativePositiveY -= barHeight;
        barY = cumulativePositiveY;
      }

      const clampedY = Math.max(plotTop, Math.min(plotBottom, barY));
      const clampedHeight = Math.max(
        0,
        Math.min(plotBottom - clampedY, barHeight),
      );

      result[si]!.push({ x, y: clampedY, width: barWidth, height: clampedHeight, value });
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Bar geometry — horizontal
// ---------------------------------------------------------------------------

function buildBarRectsHorizontal(
  values: number[],
  categoryCount: number,
  plotArea: PlotArea,
  hAxisMin: number,
  hAxisMax: number,
): BarRect[] {
  const categoryHeight = plotArea.height / categoryCount;
  const barThickness = categoryHeight * BAR_WIDTH_RATIO;
  const barOffset = (categoryHeight - barThickness) / 2;
  const rects: BarRect[] = [];

  for (let i = 0; i < Math.min(values.length, categoryCount); i++) {
    const value = values[i]!;
    const y = plotArea.y + i * categoryHeight + barOffset;
    const barWidth = Math.abs(
      ((value - hAxisMin) / (hAxisMax - hAxisMin)) * plotArea.width,
    );
    const x = plotArea.x;
    rects.push({ x, y, width: barWidth, height: barThickness, value });
  }

  return rects;
}

// ---------------------------------------------------------------------------
// Line / Scatter / Area point geometry
// ---------------------------------------------------------------------------

function buildDataPoints(
  values: number[],
  xValues: number[] | null,
  categoryCount: number,
  plotArea: PlotArea,
  vAxis: AxisGeometry,
  hAxis: AxisGeometry,
): DataPoint[] {
  const points: DataPoint[] = [];

  if (xValues !== null) {
    // Coordinate-pair mode
    for (let i = 0; i < values.length; i++) {
      const yVal = values[i]!;
      const xVal = xValues[i]!;
      const px = valueToPixel(xVal, hAxis.pixelMin, hAxis.pixelMax, hAxis.min, hAxis.max);
      const py = valueToPixel(yVal, vAxis.pixelMin, vAxis.pixelMax, vAxis.min, vAxis.max);
      points.push({ x: px, y: py, value: yVal, xValue: xVal });
    }
  } else {
    // Index-based categorical
    const count = categoryCount > 0 ? categoryCount : values.length;
    const categoryWidth = plotArea.width / count;
    for (let i = 0; i < Math.min(values.length, count); i++) {
      const yVal = values[i]!;
      const px = plotArea.x + (i + 0.5) * categoryWidth;
      const py = valueToPixel(yVal, vAxis.pixelMin, vAxis.pixelMax, vAxis.min, vAxis.max);
      points.push({ x: px, y: py, value: yVal });
    }
  }

  return points;
}

// ---------------------------------------------------------------------------
// Area baseline computation
// ---------------------------------------------------------------------------

function buildAreaBaseline(
  zeroY: number,
  currentPoints: DataPoint[],
  prevCumulativeValues: number[] | null,
  xValues: number[] | null,
  categoryCount: number,
  plotArea: PlotArea,
  vAxis: AxisGeometry,
  hAxis: AxisGeometry,
): DataPoint[] {
  if (prevCumulativeValues === null) {
    // Non-stacked or first stacked area: baseline is the zero line
    return currentPoints.map((p) => ({
      x: p.x,
      y: zeroY,
      value: 0,
      ...(p.xValue !== undefined ? { xValue: p.xValue } : {}),
    }));
  }

  // Stacked: baseline is previous area's top edge
  return buildDataPoints(
    prevCumulativeValues,
    xValues,
    categoryCount,
    plotArea,
    vAxis,
    hAxis,
  );
}

// ---------------------------------------------------------------------------
// Main layoutChart()
// ---------------------------------------------------------------------------

export function layoutChart(
  ast: ChartDiagramAST,
  theme: Theme,
  measurer: StringMeasurer,
): ChartGeometry {
  const font = { family: theme.fontFamily, size: theme.fontSize };
  const isHorizontal = ast.orientation === 'horizontal';

  // ------------------------------------------------------------------
  // Plot dimensions (mirrors ChartRenderer.java getPlotWidth/getPlotHeight)
  // ------------------------------------------------------------------
  // In horizontal mode categories are rows (vAxis.labels); in vertical mode
  // categories are columns (hAxis.labels).
  const categoryCount = isHorizontal
    ? ast.vAxis.labels.length
    : ast.hAxis.labels.length;
  const plotWidth = Math.max(MIN_PLOT_WIDTH, categoryCount * 60);
  const plotHeight = PLOT_HEIGHT;

  // ------------------------------------------------------------------
  // Assign colors to all series in order (shared counter)
  // ------------------------------------------------------------------
  const colors: string[] = ast.series.map((s, i) =>
    resolveColor(s.color, i),
  );

  // ------------------------------------------------------------------
  // Compute margins — adapted from ChartRenderer.java calculateDimension()
  // ------------------------------------------------------------------
  let leftMargin = MARGIN + AXIS_LABEL_SPACE;
  let topMargin = MARGIN + TITLE_SPACE;
  const hasXTitle =
    ast.hAxis.title !== '' && ast.hAxis.title !== undefined;
  const hasY2 = ast.v2Axis !== null;

  // Estimate legend dimensions for layout
  let legendEstimateW = 0;
  let legendEstimateH = 0;
  if (ast.legendPosition !== 'none' && ast.series.length > 0) {
    let maxLabelW = 0;
    let totalH = 0;
    let totalW = 0;
    let maxH = 0;
    for (const s of ast.series) {
      const dim = measurer.measure(s.name, font);
      if (ast.legendPosition === 'left' || ast.legendPosition === 'right') {
        maxLabelW = Math.max(maxLabelW, dim.width);
        totalH += dim.height + LEGEND_ITEM_SPACING;
      } else {
        totalW +=
          dim.width + LEGEND_SYMBOL_SIZE + LEGEND_TEXT_SPACING + LEGEND_ITEM_SPACING;
        maxH = Math.max(maxH, dim.height);
      }
    }
    if (ast.legendPosition === 'left' || ast.legendPosition === 'right') {
      legendEstimateW =
        maxLabelW + LEGEND_SYMBOL_SIZE + LEGEND_TEXT_SPACING + LEGEND_MARGIN * 2;
      legendEstimateH = totalH;
    } else {
      legendEstimateW = totalW;
      legendEstimateH = maxH + LEGEND_MARGIN * 2;
    }
  }

  if (ast.legendPosition === 'left') {
    leftMargin += legendEstimateW + LEGEND_MARGIN;
  } else if (ast.legendPosition === 'top') {
    topMargin += legendEstimateH + LEGEND_MARGIN;
  }

  // ------------------------------------------------------------------
  // PlotArea (SVG coords)
  // ------------------------------------------------------------------
  const plotArea: PlotArea = {
    x: leftMargin,
    y: topMargin,
    width: plotWidth,
    height: plotHeight,
  };

  // ------------------------------------------------------------------
  // SVG dimensions
  // ------------------------------------------------------------------
  let svgWidth =
    MARGIN + AXIS_LABEL_SPACE + plotWidth + (hasY2 ? AXIS_LABEL_SPACE : 0) + MARGIN;
  let svgHeight =
    MARGIN + TITLE_SPACE + plotHeight + AXIS_LABEL_SPACE + MARGIN;

  if (hasXTitle) svgHeight += X_AXIS_TITLE_EXTRA;

  if (ast.legendPosition === 'left' || ast.legendPosition === 'right') {
    svgWidth += legendEstimateW + LEGEND_MARGIN;
  } else if (ast.legendPosition === 'top' || ast.legendPosition === 'bottom') {
    svgHeight += legendEstimateH + LEGEND_MARGIN;
  }

  // ------------------------------------------------------------------
  // Axis geometries
  // ------------------------------------------------------------------
  const hAxisGeo = buildHAxisGeometry(ast.hAxis, plotArea);

  const vAxisGeo = buildVAxisGeometry(ast.vAxis, plotArea, /* leftSide */ true);
  const v2AxisGeo =
    ast.v2Axis !== null
      ? buildVAxisGeometry(ast.v2Axis, plotArea, /* leftSide */ false)
      : undefined;

  // ------------------------------------------------------------------
  // Series geometry
  // ------------------------------------------------------------------

  // Separate bar series for grouped/stacked computation
  const barSeriesIndices: number[] = [];
  const barSeriesValues: number[][] = [];
  for (let i = 0; i < ast.series.length; i++) {
    if (ast.series[i]!.type === 'bar') {
      barSeriesIndices.push(i);
      barSeriesValues.push(ast.series[i]!.values);
    }
  }
  const barSeriesCount = barSeriesIndices.length;

  // For stacked bars, compute all rects at once
  let stackedBarRects: BarRect[][] | null = null;
  if (ast.stackMode === 'stacked' && barSeriesCount > 1 && !isHorizontal) {
    const vMin = ast.vAxis.min;
    const vMax = ast.vAxis.max;
    stackedBarRects = buildBarRectsStacked(
      barSeriesValues,
      categoryCount > 0 ? categoryCount : Math.max(...barSeriesValues.map((v) => v.length)),
      plotArea,
      vMin,
      vMax,
    );
  }

  // Track cumulative area values for stacked areas
  let areaCumulativeValues: number[] | null = null;
  // Map from series index to its cumulative baseline (for area stacking)
  const areaBaselineMap = new Map<number, number[] | null>();

  const seriesGeos: SeriesGeo[] = [];

  for (let i = 0; i < ast.series.length; i++) {
    const s = ast.series[i]!;
    const color = colors[i]!;

    // Determine which v-axis to use
    const activeVAxis =
      s.useSecondaryAxis && v2AxisGeo !== undefined ? v2AxisGeo : vAxisGeo;
    const activeZeroY = valueToPixel(
      0,
      activeVAxis.pixelMin,
      activeVAxis.pixelMax,
      activeVAxis.min,
      activeVAxis.max,
    );

    switch (s.type) {
      case 'bar': {
        const catCount = categoryCount > 0 ? categoryCount : s.values.length;
        let rects: BarRect[];

        if (isHorizontal) {
          // In horizontal mode v-axis holds category labels; numeric range for
          // bar widths comes from hAxis (the horizontal numeric axis).
          rects = buildBarRectsHorizontal(
            s.values,
            catCount,
            plotArea,
            ast.hAxis.min,
            ast.hAxis.max,
          );
        } else if (stackedBarRects !== null) {
          // Stacked: find this series' position in the bar series list
          const barIdx = barSeriesIndices.indexOf(i);
          rects = stackedBarRects[barIdx] ?? [];
        } else {
          // Grouped (or single)
          const barIdx = barSeriesIndices.indexOf(i);
          rects = buildBarRectsGrouped(
            s.values,
            barIdx,
            barSeriesCount,
            catCount,
            plotArea,
            ast.vAxis.min,
            ast.vAxis.max,
          );
        }

        seriesGeos.push({
          type: 'bar',
          name: s.name,
          color,
          showLabels: s.showLabels,
          rects,
          horizontal: isHorizontal,
        });
        break;
      }

      case 'line': {
        const catCount = categoryCount > 0 ? categoryCount : s.values.length;
        const points = buildDataPoints(
          s.values,
          s.xValues,
          catCount,
          plotArea,
          activeVAxis,
          hAxisGeo,
        );
        seriesGeos.push({
          type: 'line',
          name: s.name,
          color,
          showLabels: s.showLabels,
          markerShape: s.markerShape,
          points,
        });
        break;
      }

      case 'area': {
        const catCount = categoryCount > 0 ? categoryCount : s.values.length;
        const points = buildDataPoints(
          s.values,
          s.xValues,
          catCount,
          plotArea,
          activeVAxis,
          hAxisGeo,
        );

        const baselineValues = areaBaselineMap.get(i) ?? areaCumulativeValues;
        const baselinePoints = buildAreaBaseline(
          activeZeroY,
          points,
          baselineValues ?? null,
          s.xValues,
          catCount,
          plotArea,
          activeVAxis,
          hAxisGeo,
        );

        seriesGeos.push({
          type: 'area',
          name: s.name,
          color,
          showLabels: s.showLabels,
          points,
          baselinePoints,
        });

        // Update cumulative for the next area series
        if (areaCumulativeValues === null) {
          areaCumulativeValues = [...s.values];
        } else {
          for (let j = 0; j < Math.min(s.values.length, areaCumulativeValues.length); j++) {
            areaCumulativeValues[j] = (areaCumulativeValues[j] ?? 0) + (s.values[j] ?? 0);
          }
          for (let j = areaCumulativeValues.length; j < s.values.length; j++) {
            areaCumulativeValues.push(s.values[j] ?? 0);
          }
        }
        break;
      }

      case 'scatter': {
        const catCount = categoryCount > 0 ? categoryCount : s.values.length;
        const points = buildDataPoints(
          s.values,
          s.xValues,
          catCount,
          plotArea,
          activeVAxis,
          hAxisGeo,
        );
        seriesGeos.push({
          type: 'scatter',
          name: s.name,
          color,
          showLabels: s.showLabels,
          markerShape: s.markerShape,
          markerSize: s.markerSize ?? 8,
          points,
        });
        break;
      }
    }
  }

  // ------------------------------------------------------------------
  // Legend
  // ------------------------------------------------------------------
  const legend = buildLegendGeometry(
    ast,
    plotArea,
    colors,
    measurer,
    font,
    leftMargin,
    topMargin,
    hasY2,
  );

  // ------------------------------------------------------------------
  // Annotations
  // ------------------------------------------------------------------
  const annotations: AnnotationGeometry[] = ast.annotations.map((ann) => {
    let labelX = 0;

    if (typeof ann.xPos === 'number') {
      // Numeric h-axis
      labelX = valueToPixel(
        ann.xPos,
        hAxisGeo.pixelMin,
        hAxisGeo.pixelMax,
        hAxisGeo.min,
        hAxisGeo.max,
      );
    } else {
      // Categorical h-axis — find matching label
      const idx = ast.hAxis.labels.indexOf(ann.xPos);
      if (idx >= 0) {
        labelX =
          plotArea.x + (idx + 0.5) * (plotArea.width / ast.hAxis.labels.length);
      }
    }

    // yPos always numeric, maps via primary vAxis
    const dataY = valueToPixel(
      ann.yPos,
      vAxisGeo.pixelMin,
      vAxisGeo.pixelMax,
      vAxisGeo.min,
      vAxisGeo.max,
    );

    // Label sits 28px above the data point; arrow points from label down to data point
    const ANNOTATION_OFFSET = 28;
    return {
      text: ann.text,
      labelX,
      labelY: dataY - ANNOTATION_OFFSET,
      hasArrow: ann.hasArrow,
      ...(ann.hasArrow ? { arrowTargetX: labelX, arrowTargetY: dataY } : {}),
    };
  });

  // ------------------------------------------------------------------
  // Assemble ChartGeometry
  // ------------------------------------------------------------------
  return {
    svgWidth,
    svgHeight,
    plotArea,
    hAxis: hAxisGeo,
    vAxis: vAxisGeo,
    ...(v2AxisGeo !== undefined ? { v2Axis: v2AxisGeo } : {}),
    series: seriesGeos,
    ...(legend !== undefined ? { legend } : {}),
    annotations,
    orientation: ast.orientation,
    gridH: ast.hAxis.gridMode,
    gridV: ast.vAxis.gridMode,
    bgColor: theme.colors.background,
    title: ast.title,
  };
}
