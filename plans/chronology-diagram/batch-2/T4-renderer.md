# T4 — Renderer + Renderer Tests

## Context

plantuml-js is a TypeScript port of PlantUML. This task implements the SVG
renderer for `@startchronology` diagrams. The project uses vitest, tsc, eslint,
vite. Pattern reference: `src/diagrams/board/renderer.ts`.

The renderer receives a fully-computed `ChronologyGeometry` and returns an SVG
string. It does not compute positions — all coordinates come from layout.

## Task

Implement `src/diagrams/chronology/renderer.ts` and write comprehensive unit tests
in `tests/unit/chronology/renderer.test.ts`.

## Write-Set

- `src/diagrams/chronology/renderer.ts` (create)
- `tests/unit/chronology/renderer.test.ts` (create)

## Read-Set

- `src/diagrams/chronology/ast.ts` — `ChronologyGeometry`, `EventGeometry`, `DayTick`
- `src/diagrams/board/renderer.ts` — `svgRoot` + `extraDefs` pattern
- `src/core/svg.ts` lines 228–250 — `diamond(cx, cy, size, extraAttrs?)` signature

## SVG Primitives (already in src/core/svg.ts)

```typescript
import { line, text, diamond, svgRoot } from '../../core/svg.js';
```

- `line(x1, y1, x2, y2, attrs?)` → `<line .../>`
- `text(x, y, content, attrs?)` → `<text ...>content</text>`
- `diamond(cx, cy, size, attrs?)` → `<polygon points="..."/>` (equilateral diamond)
- `svgRoot(width, height, parts, bgColor?, extraDefs?)` → full SVG string

## Rendering Spec

### Header row (y = 0 to headerHeight)

For each `DayTick`:
1. A short vertical tick line: `x1=x, y1=0, x2=x, y2=8` (stroke `#888888`, width 1)
2. A date label text: `x=x+2, y=10` (font 10px sans-serif, fill `#555555`, dominantBaseline `hanging`)

### Baseline

`line(0, baselineY, totalWidth, baselineY, { stroke: '#333333', strokeWidth: 1.5 })`

### Per event

1. Dashed vertical tick from baseline toward diamond:
   `line(x, baselineY-10, x, baselineY+10, { stroke:'#666666', strokeWidth:1, strokeDasharray:'3 3' })`
   (a short dashed tick centered on baseline)
2. Diamond marker:
   `diamond(x, baselineY, 10, { fill:'#000000', stroke:'#000000', strokeWidth:1 })`
3. Label text (12px sans-serif):
   - If `labelAbove`: `text(x, baselineY - 26, name, { ... textAnchor:'middle', fontSize:12 })`
   - If not `labelAbove`: `text(x, baselineY + 16, name, { ... textAnchor:'middle', fontSize:12, dominantBaseline:'hanging' })`

### svgRoot call

```typescript
return svgRoot(geo.totalWidth, geo.totalHeight, parts, theme.colors.background);
```

No extra defs needed (no filters or markers).

## Architecture Decisions

- **D3:** `diamond(x, baselineY, 10, ...)` — size=10 (half-diagonal)
- **D4:** Label offset = 26px above baseline, 16px below
- **D5:** Canvas 1000×80

## Interface Contract

```typescript
function renderChronology(geo: ChronologyGeometry, theme: Theme): string
```

## Acceptance Criteria

- **AC1:** Output SVG contains `<polygon` (diamond marker for each event)
- **AC2:** Output SVG contains `<line` for the horizontal baseline
- **AC3:** Output SVG contains each day label text string (e.g. `2023-11-24`)
- **AC4:** Output SVG contains `stroke-dasharray` (dashed event ticks)
- **AC5:** Output SVG contains `viewBox` or `width`/`height` attributes (from svgRoot)
- **AC6:** SVG for corpus fixture (2 events, 5 day ticks) contains exactly 2 `<polygon`
  elements and at least 6 `<line` elements (1 baseline + 5 day ticks + 2 event ticks)
- **AC7:** Empty geometry (`events=[], dayTicks=[]`) renders without throwing

## Quality Bar

`npm test`, `npm run typecheck`, `npm run lint` — zero new errors.
90/90/90 coverage for `renderer.ts`.

## Commit

`feat(chronology): add SVG renderer and renderer tests`
