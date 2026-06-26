# T2 — Layout + ChartGeometry

## Context

plantuml-js: TypeScript port of PlantUML. Layout for chart diagrams is pure arithmetic —
no graph engine. All pixel positions are computed from axis min/max/range and plot dimensions.

T1 is complete. `ChartDiagramAST` is available from `src/diagrams/chart/ast.ts`.

**YAGNI does not apply.** Every layout behavior in the Java source is in scope.

## Read Before Starting

- `~/git/plantuml/src/main/java/net/sourceforge/plantuml/chart/ChartRenderer.java` —
  plot dimensions, margins, axis pixel geometry (lines 1-200 especially)
- `~/git/plantuml/src/main/java/net/sourceforge/plantuml/chart/BarRenderer.java` —
  bar width ratio (default 0.6), category width formula, stacking logic
- `~/git/plantuml/src/main/java/net/sourceforge/plantuml/chart/ChartAxis.java` —
  `valueToPixel()` method (the pixel mapping formula)
- `src/diagrams/chart/ast.ts` — ChartDiagramAST shape
- `src/core/measurer.ts` — StringMeasurer interface (for measuring tick label widths)
- `src/core/theme.ts` — Theme type (for color palette)
- `decisions.md` — all decisions apply here

## Task

Create `src/diagrams/chart/layout.ts` exporting:
1. All `ChartGeometry` interfaces (see below) — these are consumed by all Batch 3 agents
2. `layoutChart(ast: ChartDiagramAST, theme: Theme, measurer: StringMeasurer): ChartGeometry`

Create `tests/unit/chart/layout.test.ts` covering all acceptance criteria.

## Write-Set

- `src/diagrams/chart/layout.ts` (create)
- `tests/unit/chart/layout.test.ts` (create)

## Interface Contracts (export ALL from layout.ts)

```typescript
export interface PlotArea {
  x: number; y: number; width: number; height: number;
}

export interface TickMark {
  value: number;      // data value (NaN for categorical ticks)
  label: string;      // display string
  pixelPos: number;   // pixel coordinate along the axis
}

export interface AxisGeometry {
  min: number; max: number;
  ticks: TickMark[];
  title: string;
  titlePos: { x: number; y: number; rotate: boolean };
  gridPixels: number[];   // empty if gridMode 'off'
  pixelMin: number;       // pixel coordinate of axis min
  pixelMax: number;       // pixel coordinate of axis max
}

export interface BarRect {
  x: number; y: number; width: number; height: number;
  value: number;          // original data value (for labels)
}

export interface DataPoint {
  x: number; y: number;   // pixel coordinates
  value: number;          // original y data value (for labels)
  xValue?: number;        // original x data value (coord-pair mode only)
}

export interface BarSeriesGeo {
  type: 'bar';
  name: string; color: string; showLabels: boolean;
  rects: BarRect[];
  horizontal: boolean;
}

export interface LineSeriesGeo {
  type: 'line';
  name: string; color: string; showLabels: boolean;
  markerShape: 'circle' | 'square' | 'triangle';
  points: DataPoint[];
}

export interface AreaSeriesGeo {
  type: 'area';
  name: string; color: string; showLabels: boolean;
  points: DataPoint[];
  baselinePoints: DataPoint[]; // bottom edge — zero-line or previous stacked area top
}

export interface ScatterSeriesGeo {
  type: 'scatter';
  name: string; color: string; showLabels: boolean;
  markerShape: 'circle' | 'square' | 'triangle';
  points: DataPoint[];
}

export type SeriesGeo = BarSeriesGeo | LineSeriesGeo | AreaSeriesGeo | ScatterSeriesGeo;

export interface LegendEntry {
  name: string; color: string;
  seriesType: 'bar' | 'line' | 'area' | 'scatter';
}

export interface LegendGeometry {
  x: number; y: number; width: number; height: number;
  entries: LegendEntry[];
}

export interface AnnotationGeometry {
  text: string;
  labelX: number; labelY: number;
  hasArrow: boolean;
  arrowTargetX?: number; arrowTargetY?: number;
}

export interface ChartGeometry {
  svgWidth: number; svgHeight: number;
  plotArea: PlotArea;
  hAxis: AxisGeometry;
  vAxis: AxisGeometry;
  v2Axis?: AxisGeometry;
  series: SeriesGeo[];
  legend?: LegendGeometry;
  annotations: AnnotationGeometry[];
  orientation: 'vertical' | 'horizontal';
  gridH: GridMode; gridV: GridMode;
  bgColor: string;
}

export function layoutChart(
  ast: ChartDiagramAST,
  theme: Theme,
  measurer: StringMeasurer,
): ChartGeometry;
```

Import `GridMode` re-exported from `ast.ts` in layout.ts — do not redefine it.

## Layout Algorithm Notes

### Default color palette
Cycle through `['#8888FF','#FF8888','#88FF88','#FFAA00','#AA88FF','#FF88AA']` (match
upstream ChartRenderer palette) when `series.color` is null. Primary axis series and
secondary axis series share the same cycle counter.

### Plot dimensions (read from upstream ChartRenderer constants)
- Default SVG: 600 × 400. Read the exact constants from ChartRenderer.java lines ~50-80.
- Plot margins: leave room for axis labels and titles. Read upstream margin constants.

### Axis tick generation
- Categorical h-axis: one tick per label, evenly spaced across plotArea.width.
  Apply `tickSpacing` to skip labels (show every Nth label).
- Numeric axis: compute tick interval from range and desired tick count (~5 ticks).
  If `customTicks` is set, use those positions instead. If `tickSpacing` is set, use
  that as the interval.

### Bar geometry (vertical, grouped)
- `categoryWidth = plotArea.width / categoryCount`
- `barWidthRatio = 0.6` (default; match BarRenderer.java constant)
- For N grouped series: `singleBarWidth = categoryWidth * barWidthRatio / N`
- Each bar's x offset within its category: `(seriesIndex / N) * categoryWidth * barWidthRatio + (1-barWidthRatio)/2 * categoryWidth`
- y: from `zeroY` (clamped 0-line) to value pixel

### Bar geometry (stacked)
- Bars accumulate: each series's bar bottom = sum of previous series values at that category
- Read BarRenderer.java stacking logic for exact formula

### Horizontal orientation swap
- When `orientation === 'horizontal'`: bars grow left-to-right (width = value pixels,
  height = bar thickness). Swap plotArea width/height role in calculations.

### Area baseline
- Non-stacked: `baselinePoints` is the zero-line (y = zeroPixel for all x).
- Stacked: `baselinePoints` is the previous area series's `points` array (same x coords).

### Legend geometry
- `legend left/right`: placed outside plotArea, full height of plotArea
- `legend top/bottom`: placed outside plotArea, full width
- Leave margin between legend and plotArea

### Annotation pixel positions
- If `xPos` is a number and h-axis is numeric: use `hAxis.valueToPixel(xPos)`
- If `xPos` is a string: look up in categorical labels array, use that tick's pixel pos
- `yPos` always numeric: use primary vAxis pixel mapping
- `arrowTargetX/Y` = same as label position (the annotation text IS at the data point;
  the arrow points FROM label TO data point only if label is offset — match upstream)

## Acceptance Criteria

**AC1:** Given a categorical h-axis with 4 labels and 2 bar series in grouped mode, when
`layoutChart()` runs, then each `BarSeriesGeo` has 4 `rects` with non-overlapping x ranges
within their category slots.

**AC2:** Given `v-axis "Y" 0 --> 100` and bar value 50, when `layoutChart()` runs, then
the rect's y coordinate maps to the midpoint of the plot area (within ±2px).

**AC3:** Given `stackMode stacked` and 2 bar series with values `[10, 20]` and `[30, 40]`,
when `layoutChart()` runs, then series[1].rects[0].y equals series[0].rects[0].y minus
series[1].rects[0].height (bars stack without gap).

**AC4:** Given `orientation horizontal`, when `layoutChart()` runs, then bar rects have
`height` equal to bar thickness and `width` proportional to the data value.

**AC5:** Given `legend left`, when `layoutChart()` runs, then `legend.x < plotArea.x`
and `legend.entries.length` equals the number of series.

**AC6:** Given a `v2-axis "y2" 0 --> 200` and a series with `useSecondaryAxis: true` and
value 100, when `layoutChart()` runs, then the series point y maps to the midpoint of
the plot area (scaled against 0–200, not the primary axis range).

**AC7:** Given `v-axis grid` and a tick at value 50, when `layoutChart()` runs, then
`vAxis.gridPixels` contains the pixel coordinate for that tick.

**AC8:** Given an annotation `"peak"` at categorical x label `"Feb"` and y 75, when
`layoutChart()` runs, then `annotations[0].labelX` matches the pixel position of the
"Feb" category tick.

## Quality Bar

`npm test`, `npm run typecheck`, `npm run lint`, `npm run build` must all pass.
Commit: `feat(chart): add layout and ChartGeometry types`
