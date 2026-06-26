# T6 — ScatterRenderer

## Context

plantuml-js: TypeScript port of PlantUML. Pure SVG renderer — no DOM, no async.
T1 (AST) and T2 (layout/ChartGeometry) are complete.

**YAGNI does not apply.** Every rendering behavior in the Java source is in scope.

## Read Before Starting

- `~/git/plantuml/src/main/java/net/sourceforge/plantuml/chart/ScatterRenderer.java` —
  authoritative spec (244 lines — read the whole thing)
- `src/diagrams/chart/layout.ts` — `ScatterSeriesGeo`, `DataPoint` types
- `src/core/svg.ts` — `ellipse()`, `rect()`, `path()`, `text()` primitives
- `src/core/theme.ts` — `Theme` type
- `decisions.md` — D2 (return SVG strings)

## Task

Create `src/diagrams/chart/renderers/scatter.ts` exporting `drawScatter()`.

## Write-Set

- `src/diagrams/chart/renderers/scatter.ts` (create)

## Interface Contract

```typescript
import type { ScatterSeriesGeo } from '../layout.js';
import type { Theme } from '../../../core/theme.js';

export function drawScatter(geo: ScatterSeriesGeo, theme: Theme): string;
```

Returns SVG string fragment (no `<svg>` wrapper).

## Rendering Spec

Reference `ScatterRenderer.java`. Key behaviors:

- **Markers only:** No connecting lines between points.
- Marker shapes (same size and style as LineRenderer markers):
  - `circle` (default): `<circle r="4">` filled with `geo.color`
  - `square`: `<rect>` 8×8 centered on point, filled with `geo.color`
  - `triangle`: `<polygon>` upward triangle, filled with `geo.color`
- **Coordinate-pair mode:** `DataPoint.xValue` is set — use `point.x` / `point.y`
  pixel coordinates directly (layout already converted them).
- **Data labels:** When `geo.showLabels` is true, render `<text>` near each marker.
  Use `point.value` for the label content. Offset to avoid overlapping the marker.

## Acceptance Criteria

**AC1:** Given a `ScatterSeriesGeo` with 5 points, when `drawScatter()` runs, then the
SVG contains exactly 5 marker elements and no `<line>` or `<polyline>` elements.

**AC2:** Given `markerShape: 'circle'`, when `drawScatter()` runs, then each marker is
a `<circle>` element.

**AC3:** Given `markerShape: 'square'`, when `drawScatter()` runs, then each marker is
a `<rect>` element.

**AC4:** Given `markerShape: 'triangle'`, when `drawScatter()` runs, then each marker
is a `<polygon>` element.

**AC5:** Given coordinate-pair points (with `xValue` set), when `drawScatter()` runs,
then markers appear at the correct pixel positions matching the `point.x`/`point.y` values.

**AC6:** Given `showLabels: true`, when `drawScatter()` runs, then the SVG contains
`<text>` elements near each marker.

## Quality Bar

`npm run typecheck` and `npm run lint` must pass on the written file.
Commit: `feat(chart): add ScatterRenderer`
