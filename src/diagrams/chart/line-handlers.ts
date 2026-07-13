/**
 * Per-line-shape handlers for the chart diagram parser's dispatch chain.
 * Split out of parser.ts (mission G0b/T6) purely to keep both files under
 * the project's 500-line file cap -- no behavior change; every handler
 * below is verbatim logic moved from parser.ts's single dispatch loop,
 * mechanically extracted into one function per line shape (same priority
 * order, same mutations, same `continue`-on-match semantics -- now
 * expressed as "return true").
 */

import type {
  ChartAxisDef,
  ChartAnnotationDef,
  ChartDiagramAST,
  ChartSeriesDef,
  GridMode,
  LabelPosition,
  LegendPosition,
  MarkerShape,
  Orientation,
  SeriesType,
  StackMode,
} from './ast.js';
import type { StyleMap } from '../../core/skinparam.js';
import {
  RE_AREA, RE_BAR, RE_GRID, RE_HAXIS, RE_LEGEND, RE_LINE, RE_ORIENTATION, RE_SCATTER,
  RE_STACKMODE, RE_V2AXIS, RE_VAXIS, RE_ANNOTATION,
  addSeries, colorFromStereo, makeAxis, markerShapeFromStereo, markerSizeFromStereo,
  parseCoordinatePairs, parseCustomTicks, parseLabels, parseYValues, resolveSeriesColor,
  stereoToMarker,
} from './parse-helpers.js';

// ---------------------------------------------------------------------------
// Axes
// ---------------------------------------------------------------------------

function applyAxisRange(axis: ChartAxisDef, minStr: string | undefined, maxStr: string | undefined): void {
  if (minStr === undefined || maxStr === undefined) return;
  axis.min = Number(minStr);
  axis.max = Number(maxStr);
  axis.autoScale = false;
}

/** v2-axis / y2-axis (must be checked before v-axis). */
export function tryV2Axis(ast: ChartDiagramAST, line: string): boolean {
  const m = RE_V2AXIS.exec(line);
  if (m === null) return false;
  if (ast.v2Axis === null) ast.v2Axis = makeAxis();
  const axis = ast.v2Axis;
  const title = m[2];
  const ticksStr = m[6];
  const spacingStr = m[7];

  if (title !== undefined) axis.title = title;
  applyAxisRange(axis, m[3], m[4]);
  if (ticksStr !== undefined) {
    const ticks = parseCustomTicks(ticksStr);
    if (ticks !== null) axis.customTicks = ticks;
  }
  if (spacingStr !== undefined) {
    const sp = Number(spacingStr);
    if (sp > 0) axis.tickSpacing = sp;
  }
  if (m[8] !== undefined) axis.labelPosition = 'top' satisfies LabelPosition;
  if (m[9] !== undefined) axis.gridMode = 'major' satisfies GridMode;
  return true;
}

/** v-axis / y-axis (NOT v2/y2). */
export function tryVAxis(ast: ChartDiagramAST, line: string): boolean {
  const m = RE_VAXIS.exec(line);
  if (m === null) return false;
  const axis = ast.vAxis;
  const title = m[2];
  const labelsStr = m[5];
  const ticksStr = m[6];
  const spacingStr = m[7];

  if (labelsStr !== undefined) {
    axis.labels = parseLabels(labelsStr);
    return true;
  }
  if (title !== undefined) axis.title = title;
  applyAxisRange(axis, m[3], m[4]);
  if (ticksStr !== undefined) {
    const ticks = parseCustomTicks(ticksStr);
    if (ticks !== null) axis.customTicks = ticks;
  }
  if (spacingStr !== undefined) {
    const sp = Number(spacingStr);
    if (sp > 0) axis.tickSpacing = sp;
  }
  if (m[8] !== undefined) axis.labelPosition = 'top' satisfies LabelPosition;
  if (m[9] !== undefined) axis.gridMode = 'major' satisfies GridMode;
  return true;
}

function applyHAxisTitleAndRange(
  axis: ChartAxisDef,
  title: string | undefined,
  minStr: string | undefined,
  maxStr: string | undefined,
  labelsStr: string | undefined,
): void {
  if (title !== undefined) axis.title = title;
  if (minStr !== undefined && maxStr !== undefined) {
    axis.min = Number(minStr);
    axis.max = Number(maxStr);
    axis.autoScale = false;
  } else if (labelsStr !== undefined) {
    axis.labels = parseLabels(labelsStr);
  }
}

/** h-axis / x-axis. */
export function tryHAxis(ast: ChartDiagramAST, line: string): boolean {
  const m = RE_HAXIS.exec(line);
  if (m === null) return false;
  const axis = ast.hAxis;
  const spacingStr = m[5];

  if (spacingStr !== undefined) {
    const sp = parseInt(spacingStr, 10);
    if (sp > 0) axis.tickSpacing = sp;
  }
  if (m[6] !== undefined) axis.labelPosition = 'right' satisfies LabelPosition;
  if (m[7] !== undefined) axis.gridMode = 'major' satisfies GridMode;
  applyHAxisTitleAndRange(axis, m[1], m[2], m[3], m[4]);
  return true;
}

/** grid h-axis|v-axis (standalone command). */
export function tryGrid(ast: ChartDiagramAST, line: string): boolean {
  const m = RE_GRID.exec(line);
  if (m === null) return false;
  const axisToken = m[1]!.toLowerCase();
  if (axisToken === 'h-axis' || axisToken === 'x-axis') {
    ast.hAxis.gridMode = 'major';
  } else {
    ast.vAxis.gridMode = 'major';
  }
  return true;
}

// ---------------------------------------------------------------------------
// Series (bar / line / area / scatter)
// ---------------------------------------------------------------------------

/** bar <<stereo>>? "name"? [data] #color? v2? labels? */
export function tryBar(ast: ChartDiagramAST, line: string, styleMap: StyleMap): boolean {
  // #lizard forgives -- Lizard 1.23.0's TypeScript reader misattributes a
  // later interface/function's span to this one (same "optimistic
  // function" push/pop tool quirk documented in activity/node-dispatch.ts);
  // tryBar's own body is well within threshold.
  const m = RE_BAR.exec(line);
  if (m === null) return false;
  const stereo = m[1];
  const data = m[3] ?? '';
  const values = parseYValues(data);
  if (values === null) {
    ast.errors.push('Invalid number format in bar data');
    return true;
  }
  const name = m[2] !== undefined ? m[2] : `bar${ast.series.length}`;
  const colorRaw = m[4];
  const secondary = m[5];
  const showLabels = m[6] !== undefined;
  const color = colorRaw !== undefined ? resolveSeriesColor(colorRaw) : (colorFromStereo(stereo, styleMap, 'bar') ?? null);

  const series: ChartSeriesDef = {
    name,
    type: 'bar' satisfies SeriesType,
    values,
    xValues: null,
    color,
    useSecondaryAxis: secondary !== undefined,
    showLabels,
    markerShape: 'circle',
    markerSize: null,
  };
  addSeries(ast, series);
  return true;
}

interface SeriesCommon {
  name: string;
  color: string | null;
  useSecondaryAxis: boolean;
  showLabels: boolean;
  markerShape: MarkerShape;
  markerSize: number | null;
}

/** Shared line/scatter data-body parser: coordinate-pair form `(x,y),...`
 *  when `data` contains `(`, else a plain comma-separated y-values list.
 *  Returns `null` (with `ast.errors` already pushed) on a parse failure. */
function buildDataSeries(
  ast: ChartDiagramAST,
  type: 'line' | 'scatter',
  data: string,
  common: SeriesCommon,
): ChartSeriesDef | null {
  if (data.includes('(')) {
    const parsed = parseCoordinatePairs(data);
    if (parsed === null) {
      ast.errors.push(`Invalid coordinate pair format in ${type} data`);
      return null;
    }
    return { type, values: parsed.yValues, xValues: parsed.xValues, ...common };
  }
  const values = parseYValues(data);
  if (values === null) {
    ast.errors.push(`Invalid number format in ${type} data`);
    return null;
  }
  return { type, values, xValues: null, ...common };
}

/** line <<stereo>>? "name"? [data] #color? v2? labels? */
export function tryLine(ast: ChartDiagramAST, line: string, styleMap: StyleMap): boolean {
  const m = RE_LINE.exec(line);
  if (m === null) return false;
  const stereo = m[1];
  const data = m[3] ?? '';
  const colorRaw = m[4];
  const name = m[2] !== undefined ? m[2] : `line${ast.series.length}`;
  const color = colorRaw !== undefined ? resolveSeriesColor(colorRaw) : (colorFromStereo(stereo, styleMap, 'line') ?? null);

  const series = buildDataSeries(ast, 'line', data, {
    name, color, useSecondaryAxis: m[5] !== undefined, showLabels: m[6] !== undefined,
    markerShape: stereoToMarker(stereo), markerSize: null,
  });
  if (series !== null) addSeries(ast, series);
  return true;
}

/** area <<stereo>>? "name"? [data] #color? v2? labels? */
export function tryArea(ast: ChartDiagramAST, line: string, styleMap: StyleMap): boolean {
  const m = RE_AREA.exec(line);
  if (m === null) return false;
  const stereo = m[1];
  const data = m[3] ?? '';
  const values = parseYValues(data);
  if (values === null) {
    ast.errors.push('Invalid number format in area data');
    return true;
  }
  const name = m[2] !== undefined ? m[2] : `area${ast.series.length}`;
  const colorRaw = m[4];
  const secondary = m[5];
  const showLabels = m[6] !== undefined;
  const color = colorRaw !== undefined ? resolveSeriesColor(colorRaw) : (colorFromStereo(stereo, styleMap, 'area') ?? null);

  const series: ChartSeriesDef = {
    name,
    type: 'area' satisfies SeriesType,
    values,
    xValues: null,
    color,
    useSecondaryAxis: secondary !== undefined,
    showLabels,
    markerShape: 'circle',
    markerSize: null,
  };
  addSeries(ast, series);
  return true;
}

function scatterMarkerShape(stereo: string | undefined, markerStr: string | undefined, styleMap: StyleMap): MarkerShape {
  if (markerStr !== undefined) {
    const ml = markerStr.toLowerCase();
    return ml === 'square' ? 'square' : ml === 'triangle' ? 'triangle' : 'circle';
  }
  // Style-class MarkerShape overrides stereo-name-based shape
  return markerShapeFromStereo(stereo, styleMap) ?? stereoToMarker(stereo);
}

/** scatter <<stereo>>? "name"? [data] #color? v2? labels? <<marker>>? */
export function tryScatter(ast: ChartDiagramAST, line: string, styleMap: StyleMap): boolean {
  const m = RE_SCATTER.exec(line);
  if (m === null) return false;
  const stereo = m[1];
  const data = m[3] ?? '';
  const colorRaw = m[4];
  const name = m[2] !== undefined ? m[2] : `scatter${ast.series.length}`;
  const color = colorRaw !== undefined ? resolveSeriesColor(colorRaw) : (colorFromStereo(stereo, styleMap, 'scatter') ?? null);

  const series = buildDataSeries(ast, 'scatter', data, {
    name, color, useSecondaryAxis: m[5] !== undefined, showLabels: m[6] !== undefined,
    markerShape: scatterMarkerShape(stereo, m[7], styleMap), markerSize: markerSizeFromStereo(stereo, styleMap),
  });
  if (series !== null) addSeries(ast, series);
  return true;
}

// ---------------------------------------------------------------------------
// legend / stackMode / orientation / annotation
//
// legend (RE_LEGEND) is chart's OWN bespoke command -- NOT the shared
// chrome annotation matcher (mission G0b/T6's `matchAnnotationCommand`,
// which this file never calls). `title` used to be here too (RE_TITLE)
// until T8 migrated it to the shared chrome matcher (parser.ts's
// `dispatchChartLine`) -- it no longer has a bespoke handler in this file.
// `ChartDiagramAST` already has an unrelated `annotations:
// ChartAnnotationDef[]` field (plot text/arrow callouts) that predates
// this mission and must not be confused with the shared
// `DiagramAnnotations` chrome model -- see parser.ts's
// `tryChartLegend`-before-matcher ordering comment.
// ---------------------------------------------------------------------------

/** `legend left|right|top|bottom` — chart's own data-series legend
 *  position command. MUST be tried before the shared annotation matcher
 *  (parser.ts): both `legend right` (this) and a bare `legend` block
 *  opener (chrome) share the `legend` keyword, and the shared matcher's
 *  single-line `matchLegend` would otherwise swallow `legend right` as
 *  literal legend TEXT "right" instead of a position. */
export function tryChartLegend(ast: ChartDiagramAST, line: string): boolean {
  const m = RE_LEGEND.exec(line);
  if (m === null) return false;
  ast.legendPosition = m[1]!.toLowerCase() as LegendPosition;
  return true;
}

export function tryStackMode(ast: ChartDiagramAST, line: string): boolean {
  const m = RE_STACKMODE.exec(line);
  if (m === null) return false;
  ast.stackMode = m[1]!.toLowerCase() as StackMode;
  return true;
}

export function tryOrientation(ast: ChartDiagramAST, line: string): boolean {
  const m = RE_ORIENTATION.exec(line);
  if (m === null) return false;
  ast.orientation = m[1]!.toLowerCase() as Orientation;
  return true;
}

/** `annotation "text" at (xPos, yPos) <<arrow>>?` — chart's own plot
 *  annotation (text/arrow callout), unrelated to chrome. */
export function tryChartAnnotation(ast: ChartDiagramAST, line: string): boolean {
  const m = RE_ANNOTATION.exec(line);
  if (m === null) return false;
  const text = m[1]!;
  const xPosStr = m[2]!.trim();
  const yPosStr = m[3]!.trim();
  const arrowStr = m[4];

  const yPos = Number(yPosStr);
  if (isNaN(yPos)) {
    ast.errors.push(`Y position must be a numeric value: ${yPosStr}`);
    return true;
  }

  const xPosNum = Number(xPosStr);
  const xPos: number | string = isNaN(xPosNum) ? xPosStr : xPosNum;

  const annotation: ChartAnnotationDef = { text, xPos, yPos, hasArrow: arrowStr !== undefined };
  ast.annotations.push(annotation);
  return true;
}
