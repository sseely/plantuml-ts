# T4 — LineRenderer

## Context

plantuml-js: TypeScript port of PlantUML. Pure SVG renderer — no DOM, no async.
T1 (AST) and T2 (layout/ChartGeometry) are complete.

**YAGNI does not apply.** Every rendering behavior in the Java source is in scope.

## Read Before Starting

- `~/git/plantuml/src/main/java/net/sourceforge/plantuml/chart/LineRenderer.java` —
  authoritative spec (117 lines — read the whole thing)
- `~/git/plantuml/src/main/java/net/sourceforge/plantuml/chart/ChartRenderer.java` —
  search for marker drawing (circle/square/triangle) — markers are drawn by ChartRenderer
  after calling LineRenderer; replicate that logic here since we own the full sub-renderer
- `src/diagrams/chart/layout.ts` — `LineSeriesGeo`, `DataPoint` types
- `src/core/svg.ts` — `line()`, `ellipse()`, `rect()`, `path()`, `text()` primitives
- `src/core/theme.ts` — `Theme` type
- `decisions.md` — D2, D6 (straight line segments, no curves)

## Task

Create `src/diagrams/chart/renderers/line.ts` exporting `drawLine()`.

## Write-Set

- `src/diagrams/chart/renderers/line.ts` (create)

## Interface Contract

```typescript
import type { LineSeriesGeo } from '../layout.js';
import type { Theme } from '../../../core/theme.js';

export function drawLine(geo: LineSeriesGeo, theme: Theme): string;
```

Returns SVG string fragment (no `<svg>` wrapper).

## Rendering Spec

Reference `LineRenderer.java`. Key behaviors:

- **Line segments:** Draw `<line>` from `points[i]` to `points[i+1]` for all consecutive
  pairs. Stroke = `geo.color`, `stroke-width="2"`. No curve interpolation (see D6).
- **Markers:** After drawing all segments, draw a marker at each point:
  - `circle` (default): `<circle cx r="4">` filled with `geo.color`
  - `square`: `<rect>` 8×8 centered on point, filled with `geo.color`
  - `triangle`: `<polygon>` with 3 vertices forming an upward triangle, filled with `geo.color`
- **Data labels:** When `geo.showLabels` is true, render `<text>` above each data point
  showing the numeric value. Offset y by -10px to clear the marker.
- **Single point:** If `points.length === 1`, draw only the marker (no line segments).

## Acceptance Criteria

**AC1:** Given a `LineSeriesGeo` with 4 points, when `drawLine()` runs, then the SVG
contains exactly 3 `<line>` elements connecting consecutive points.

**AC2:** Given `markerShape: 'circle'`, when `drawLine()` runs, then the SVG contains
`<circle>` elements at each data point (4 circles for 4 points).

**AC3:** Given `markerShape: 'square'`, when `drawLine()` runs, then the SVG contains
`<rect>` marker elements at each data point.

**AC4:** Given `markerShape: 'triangle'`, when `drawLine()` runs, then the SVG contains
`<polygon>` marker elements at each data point.

**AC5:** Given `showLabels: true` and a point with `value: 75`, when `drawLine()` runs,
then the SVG contains a `<text>` element with content `"75"`.

**AC6:** Given a `LineSeriesGeo` with a single point, when `drawLine()` runs, then the
SVG contains no `<line>` elements and one marker element.

## Quality Bar

`npm run typecheck` and `npm run lint` must pass on the written file.
Commit: `feat(chart): add LineRenderer`
