# T5 — AreaRenderer

## Context

plantuml-js: TypeScript port of PlantUML. Pure SVG renderer — no DOM, no async.
T1 (AST) and T2 (layout/ChartGeometry) are complete.

**YAGNI does not apply.** Every rendering behavior in the Java source is in scope.

## Read Before Starting

- `~/git/plantuml/src/main/java/net/sourceforge/plantuml/chart/AreaRenderer.java` —
  authoritative spec (180 lines — read the whole thing)
- `src/diagrams/chart/layout.ts` — `AreaSeriesGeo`, `DataPoint` types
- `src/core/svg.ts` — `path()`, `line()`, `text()`, `group()` primitives
- `src/core/theme.ts` — `Theme` type
- `decisions.md` — D2 (return SVG strings)

## Task

Create `src/diagrams/chart/renderers/area.ts` exporting `drawArea()`.

## Write-Set

- `src/diagrams/chart/renderers/area.ts` (create)

## Interface Contract

```typescript
import type { AreaSeriesGeo } from '../layout.js';
import type { Theme } from '../../../core/theme.js';

export function drawArea(geo: AreaSeriesGeo, theme: Theme): string;
```

Returns SVG string fragment (no `<svg>` wrapper).

## Rendering Spec

Reference `AreaRenderer.java`. Key behaviors:

- **Filled polygon:** Build a `<path>` that traces:
  1. Forward through `geo.points` (top edge of the area)
  2. Backward through `geo.baselinePoints` (bottom edge — zero-line or previous stack top)
  3. Close with `Z`
  Fill = `geo.color` at reduced opacity (match upstream — typically 0.5–0.7 alpha).
  Stroke = `geo.color` at full opacity along the top edge only.
- **Top edge stroke:** Draw a separate `<path>` or `<polyline>` along `geo.points` with
  `stroke=geo.color` and `stroke-width="2"` — this gives the area a defined upper boundary.
- **Stacking:** `geo.baselinePoints` already encodes the correct baseline (provided by
  layout); this renderer does not need to know whether stacking is active.
- **Data labels:** When `geo.showLabels` is true, render `<text>` above each point in
  `geo.points` showing the numeric value.

## Acceptance Criteria

**AC1:** Given an `AreaSeriesGeo` with 3 points and a flat baseline (y = plotHeight),
when `drawArea()` runs, then the SVG contains a `<path>` element whose `d` attribute
traces forward through the 3 points and backward through the 3 baseline points.

**AC2:** Given a stacked `AreaSeriesGeo` where `baselinePoints` is non-flat (previous
series top), when `drawArea()` runs, then the polygon closes against those baseline points
(not the zero-line).

**AC3:** The fill color has reduced opacity relative to the stroke color (inspect SVG for
`fill-opacity` or `rgba`/`opacity` attribute on the path).

**AC4:** Given `showLabels: true` and a point with `value: 60`, when `drawArea()` runs,
then the SVG contains a `<text>` element with content `"60"`.

**AC5:** Given 4 points, when `drawArea()` runs, then a top-edge stroke line is present
in the SVG connecting the 4 points (separate from the fill polygon or as a stroke on the
same path).

## Quality Bar

`npm run typecheck` and `npm run lint` must pass on the written file.
Commit: `feat(chart): add AreaRenderer`
