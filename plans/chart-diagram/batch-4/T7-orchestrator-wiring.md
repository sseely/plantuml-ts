# T7 — ChartRenderer Orchestrator + Plugin Wiring

## Context

plantuml-js: TypeScript port of PlantUML. Pure SVG renderer — no DOM, no async.
Batches 1–3 are complete. All four sub-renderers exist in `src/diagrams/chart/renderers/`.

**YAGNI does not apply.** Every rendering behavior in the Java source is in scope.

## Read Before Starting

- `~/git/plantuml/src/main/java/net/sourceforge/plantuml/chart/ChartRenderer.java` —
  full 1422 lines — this is the authoritative spec for everything this task builds
- `src/diagrams/chart/layout.ts` — `ChartGeometry`, all geo types, `layoutChart()`
- `src/diagrams/chart/renderers/bar.ts` — `drawBar()`
- `src/diagrams/chart/renderers/line.ts` — `drawLine()`
- `src/diagrams/chart/renderers/area.ts` — `drawArea()`
- `src/diagrams/chart/renderers/scatter.ts` — `drawScatter()`
- `src/diagrams/chart/parser.ts` — `parseChart()`
- `src/diagrams/chart/ast.ts` — `ChartDiagramAST`
- `src/core/svg.ts` — `svgRoot()`, `rect()`, `line()`, `text()`, `group()`
- `src/core/theme.ts` — `Theme`, `resolveTheme()`
- `src/core/measurer.ts` — `StringMeasurer`, `FormulaMeasurer`
- `src/index.ts` — see how `packetdiagPlugin` is imported and registered (~line 20, 44)
- `src/diagrams/packetdiag/index.ts` — plugin shape reference
- `decisions.md` — all decisions apply

## Task

1. Create `src/diagrams/chart/renderer.ts` with `renderChart(geo, theme): string`
2. Create `src/diagrams/chart/index.ts` with `chartPlugin: SyncPlugin`
3. Modify `src/index.ts` — import and register `chartPlugin`
4. Create `tests/unit/chart/renderer.test.ts` with integration tests

## Write-Set

- `src/diagrams/chart/renderer.ts` (create)
- `src/diagrams/chart/index.ts` (create)
- `src/index.ts` (modify — add import + register call only)
- `tests/unit/chart/renderer.test.ts` (create)

## Interface Contracts

### renderer.ts

```typescript
import type { ChartGeometry } from './layout.js';
import type { Theme } from '../../core/theme.js';

export function renderChart(geo: ChartGeometry, theme: Theme): string;
```

### index.ts

```typescript
import type { SyncPlugin } from '../../core/dispatcher.js';
import type { ChartDiagramAST } from './ast.js';
import type { ChartGeometry } from './layout.js';
import { parseChart } from './parser.js';
import { layoutChart } from './layout.js';
import { renderChart } from './renderer.js';

export const chartPlugin: SyncPlugin<ChartDiagramAST, ChartGeometry> = {
  type: 'chart',
  accepts(_lines: readonly string[]): boolean { return false; },
  parse(source) { return parseChart(source); },
  layoutSync(ast, theme, measurer) { return layoutChart(ast, theme, measurer); },
  render(geo, theme) { return renderChart(geo, theme); },
};
```

### src/index.ts change

Add after the packetdiag import line:
```typescript
import { chartPlugin } from './diagrams/chart/index.js';
```
Add after `registry.register(packetdiagPlugin)`:
```typescript
registry.register(chartPlugin);
```

## Renderer Drawing Order (match ChartRenderer.java)

1. Background rect (full SVG area, theme background color)
2. Plot area background (white or theme plot bg)
3. Grid lines (h-axis gridPixels → horizontal lines; v-axis gridPixels → vertical lines)
4. Area series (drawn first, under bars and lines)
5. Bar series
6. Line series
7. Scatter series
8. Axes (lines, tick marks, tick labels, axis titles)
9. Secondary Y-axis (if present)
10. Legend box + entries
11. Annotations (text + optional arrow)
12. Wrap everything in `svgRoot(width, height, children, theme.colors.background)`

## Axis Drawing

- **H-axis line:** horizontal `<line>` at bottom of plot area
- **V-axis line:** vertical `<line>` at left edge of plot area
- **Tick marks:** short `<line>` perpendicular to axis at each `TickMark.pixelPos`
- **Tick labels:** `<text>` at each tick (centered on h-axis, right-aligned on v-axis)
  Apply `tickSpacing` skip — if set, only show every Nth label (already encoded in
  `AxisGeometry.ticks` by layout, so just render all ticks)
- **Axis title:** `<text>` at `titlePos.x/y`; if `rotate: true`, apply
  `transform="rotate(-90, x, y)"`
- **Secondary Y-axis:** same as V-axis but at right edge of plot area; use `v2Axis` geometry

## Legend Drawing

- Border rect around legend area
- For each entry: colored swatch rect (12×12) + series name text
- Entries stacked vertically (or horizontally for top/bottom legend)

## Annotation Drawing

- `<text>` at `labelX/labelY`
- If `hasArrow`: draw a small arrow from label toward `arrowTargetX/Y`
  (a `<line>` with a small arrowhead — match upstream ChartRenderer annotation rendering)

## Error Diagram

If `ast.errors` is non-empty, return a simple error SVG (red border rect + error text).
Match the pattern used by other diagram types in the project.

## Acceptance Criteria

**AC1:** Given a complete chart source with `bar`, `line`, `legend left`, when
`render('@startchart\n...\n@endchart')` runs via the public API, then a valid SVG string
is returned, `svgWidth > 0`, and the SVG contains both `<rect>` (bars) and `<line>` (line
segments) elements.

**AC2:** Given `grid v-axis` enabled, when `renderChart()` runs, then the SVG contains
horizontal `<line>` elements inside the plot area at tick positions.

**AC3:** Given `legend right`, when `renderChart()` runs, then the SVG contains a legend
`<rect>` border whose x coordinate is greater than `plotArea.x + plotArea.width`.

**AC4:** Given an annotation `"peak"` with `hasArrow: true`, when `renderChart()` runs,
then the SVG contains the text "peak" and a small arrow element near the annotation target.

**AC5:** Given a `ChartDiagramAST` with `errors: ['some error']`, when `renderChart()` runs
(or the plugin's `layoutSync` is called), then the returned SVG contains the error message
text and a visually distinct error border.

**AC6:** Given a diagram with both primary and secondary Y-axis series, when `renderChart()`
runs, then the SVG contains two vertical axis lines (left and right edges of plot area).

**AC7:** Given `chartPlugin` registered, when `renderSync('@startchart\nh-axis ["A","B"]\nv-axis "Y" 0-->100\nbar [10,50]\n@endchart')` runs, then a non-empty SVG string is returned
without throwing.

## Quality Bar

`npm test`, `npm run typecheck`, `npm run lint`, `npm run build` must all pass.
Commit: `feat(chart): add ChartRenderer orchestrator and plugin registration`
