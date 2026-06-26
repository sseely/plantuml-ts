# T3 — BarRenderer

## Context

plantuml-js: TypeScript port of PlantUML. Pure SVG renderer — no DOM, no async.
T1 (AST) and T2 (layout/ChartGeometry) are complete.

**YAGNI does not apply.** Every rendering behavior in the Java source is in scope.

## Read Before Starting

- `~/git/plantuml/src/main/java/net/sourceforge/plantuml/chart/BarRenderer.java` —
  authoritative spec for bar drawing logic
- `src/diagrams/chart/layout.ts` — `BarSeriesGeo`, `BarRect` types
- `src/core/svg.ts` — `rect()`, `text()`, `line()`, `group()` primitives
- `src/core/theme.ts` — `Theme` type
- `decisions.md` — D2 (return SVG strings)

## Task

Create `src/diagrams/chart/renderers/bar.ts` exporting `drawBar()`.

## Write-Set

- `src/diagrams/chart/renderers/bar.ts` (create)

## Interface Contract

```typescript
import type { BarSeriesGeo } from '../layout.js';
import type { Theme } from '../../../core/theme.js';

export function drawBar(geo: BarSeriesGeo, theme: Theme): string;
```

Returns an SVG string (fragment, no `<svg>` wrapper). The orchestrator wraps it.

## Rendering Spec

Reference `BarRenderer.java` for all geometry. Key behaviors:

- **Vertical bars (default):** `<rect>` from `zeroY` to `valueY`, width = `rect.width`,
  x = `rect.x`. Fill = `geo.color`. Stroke = slightly darker or theme border color.
- **Horizontal bars:** `<rect>` from `zeroX` to `valueX`, height = `rect.height`,
  y = `rect.y`. Same fill/stroke rules.
- **Zero-line clamping:** Bars crossing zero extend in both directions from the zero pixel.
  Read `BarRenderer.java` `zeroY` calculation — `Math.max(0, Math.min(plotHeight, ...))`.
- **Data labels:** When `geo.showLabels` is true, render a `<text>` element above (vertical)
  or to the right of (horizontal) each bar showing the numeric value.
- **Bar border:** 1px stroke in a slightly darker shade of the fill color. Match upstream.

`BarRect` already has final pixel coordinates from layout — no further math needed.

## Acceptance Criteria

**AC1:** Given a `BarSeriesGeo` with 3 rects (vertical), when `drawBar()` runs, then the
returned SVG contains exactly 3 `<rect>` elements with the x/y/width/height from the geo.

**AC2:** Given `horizontal: true`, when `drawBar()` runs, then each `<rect>` has
`height` matching `rect.height` and `width` matching `rect.width` (as computed by layout).

**AC3:** Given `showLabels: true` and a rect with `value: 42`, when `drawBar()` runs,
then the SVG contains a `<text>` element with content `"42"` near that bar.

**AC4:** Given a bar with negative value, when `drawBar()` runs, then the rect extends
downward from the zero-line (its `y` is above `zeroY` and `height` is positive).

**AC5:** Given `color: '#FF0000'`, when `drawBar()` runs, then all rects have
`fill="#FF0000"`.

## Quality Bar

`npm run typecheck` and `npm run lint` must pass on the written file.
Full `npm test` pass is verified at the batch level after all T3–T6 complete.
Commit: `feat(chart): add BarRenderer`
