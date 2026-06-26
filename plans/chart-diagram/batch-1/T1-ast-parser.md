# T1 — AST Types, Parser, Block-Extractor

## Context

plantuml-js is a TypeScript port of PlantUML. We're adding `@startchart` / `@endchart`
support (Phase 5n). The project uses pure SVG rendering, no DOM, no async in layout.

Stack: TypeScript 5, Vite, Vitest. All tests in `tests/unit/`. Plugin pattern:
`SyncPlugin<AST, Geometry>` from `src/core/dispatcher.ts`.

**YAGNI does not apply here.** Every behavior in the Java source is in scope.

## Read Before Starting

- `~/git/plantuml/src/main/java/net/sourceforge/plantuml/chart/ChartDiagram.java` —
  enum definitions (LegendPosition, GridMode, StackMode, Orientation)
- `~/git/plantuml/src/main/java/net/sourceforge/plantuml/chart/ChartAxis.java` —
  LabelPosition enum, field names
- `~/git/plantuml/src/main/java/net/sourceforge/plantuml/chart/ChartSeries.java` —
  SeriesType, MarkerShape enums, field names
- `~/git/plantuml/src/main/java/net/sourceforge/plantuml/chart/ChartAnnotation.java`
- `~/git/plantuml/src/main/java/net/sourceforge/plantuml/chart/command/` — all 11
  command files (regex patterns are the definitive parse spec)
- `src/core/block-extractor.ts` — see how 'packetdiag' was added; add 'chart' the
  same way
- `src/diagrams/packetdiag/ast.ts` — structural reference for AST shape
- `src/diagrams/packetdiag/parser.ts` — structural reference for parser shape

## Task

1. Create `src/diagrams/chart/ast.ts` with all types (see Interface Contracts below).
2. Create `src/diagrams/chart/parser.ts` with `parseChart(source: UmlSource): ChartDiagramAST`.
3. Modify `src/core/block-extractor.ts`: add `'chart'` to the `DiagramType` union and
   to `START_SUFFIX_MAP` (key: `'chart'`, value: `'chart'`).
4. Create `tests/unit/chart/parser.test.ts` with tests for all acceptance criteria.

## Write-Set

- `src/diagrams/chart/ast.ts` (create)
- `src/diagrams/chart/parser.ts` (create)
- `tests/unit/chart/parser.test.ts` (create)
- `src/core/block-extractor.ts` (modify — add 'chart' only)

## Interface Contracts

### ChartDiagramAST (export from ast.ts)

```typescript
export type SeriesType = 'bar' | 'line' | 'area' | 'scatter';
export type MarkerShape = 'circle' | 'square' | 'triangle';
export type LegendPosition = 'none' | 'left' | 'right' | 'top' | 'bottom';
export type GridMode = 'off' | 'major';
export type StackMode = 'grouped' | 'stacked';
export type Orientation = 'vertical' | 'horizontal';
export type LabelPosition = 'default' | 'top' | 'right';

export interface ChartAxisDef {
  title: string;
  min: number;
  max: number;
  autoScale: boolean;           // true until explicit range is set
  labels: string[];             // categorical labels (empty = numeric mode)
  customTicks: Map<number, string> | null;
  tickSpacing: number | null;
  labelPosition: LabelPosition;
  gridMode: GridMode;
}

export interface ChartSeriesDef {
  name: string;
  type: SeriesType;
  values: number[];             // y-values (index-based) or y-values (coord-pair)
  xValues: number[] | null;     // null = index-based; non-null = coordinate pairs
  color: string | null;         // raw hex string e.g. '#FF0000', or null for default
  useSecondaryAxis: boolean;
  showLabels: boolean;
  markerShape: MarkerShape;
}

export interface ChartAnnotationDef {
  text: string;
  xPos: number | string;        // number for numeric axis, string for categorical
  yPos: number;
  hasArrow: boolean;
}

export interface ChartDiagramAST {
  hAxis: ChartAxisDef;
  vAxis: ChartAxisDef;
  v2Axis: ChartAxisDef | null;
  series: ChartSeriesDef[];
  legendPosition: LegendPosition;
  stackMode: StackMode;
  orientation: Orientation;
  annotations: ChartAnnotationDef[];
  errors: string[];             // validation errors; non-empty = render error diagram
}
```

### parseChart signature

```typescript
import type { UmlSource } from '../../core/block-extractor.js';
export function parseChart(source: UmlSource): ChartDiagramAST;
```

### Default axis values (match Java ChartAxis constructor)

```
title: ''
min: 0, max: 100, autoScale: true
labels: []
customTicks: null
tickSpacing: null
labelPosition: 'default'
gridMode: 'off'
```

## Parser Command Specs

All 11 commands, one line each:

1. **h-axis / x-axis** — regex `[hx]-axis`; optional `"title"`, optional `min --> max`
   range, optional `[label, ...]`, optional `spacing N`, `label-right`, `grid`
2. **v-axis / y-axis** — regex `[vy]-axis`; optional `"title"`, optional `min --> max`,
   optional `[labels]` (horizontal bar mode), optional `ticks [val:"label",...]`,
   optional `spacing N.N`, `label-top`, `grid`
3. **v2-axis / y2-axis** — regex `[vy]2-axis`; same options as v-axis; sets `v2Axis`
4. **bar** — `bar "name" [v1, v2, ...]` optional `#color`, `v2`/`y2`, `labels`
5. **line** — `line <<stereo>> "name" [v1,v2,...]` OR `[(x1,y1),(x2,y2),...]`;
   optional `#color`, `v2`/`y2`, `labels`; stereo sets markerShape
6. **area** — `area "name" [v1,v2,...]`; optional `#color`, `v2`/`y2`, `labels`
7. **scatter** — `scatter "name" [v1,v2,...]` OR coordinate pairs; optional `#color`,
   `v2`/`y2`, `labels`
8. **legend** — `legend left|right|top|bottom`
9. **stackMode** — `stackMode grouped|stacked`
10. **orientation** — `orientation horizontal|vertical`
11. **annotation** — `annotation "text" at (xPos, yPos)` optional `<<arrow>>`
    Also: `grid h-axis` / `grid v-axis` standalone sets gridMode on that axis

Stereotype → markerShape mapping: `<<circle>>` → circle (default), `<<square>>` → square,
`<<triangle>>` → triangle.

Series default name: `line0`, `bar1`, etc. — type name + count of that type seen so far.

## Validation Rules (push errors into ast.errors, do not throw)

- Coordinate pairs only for `line` or `scatter` — error otherwise
- Coordinate pairs require explicit numeric h-axis range (autoScale must be false on hAxis)
- Cannot mix index-based and coordinate-pair series in one diagram
- X-coordinates must fall within declared h-axis `[min, max]`

## Acceptance Criteria

**AC1:** Given `@startchart` source with `h-axis ["Jan","Feb","Mar"]`, `v-axis "Y" 0 --> 100`,
and `bar "sales" [10, 50, 30]`, when `parseChart()` runs, then `ast.hAxis.labels` equals
`["Jan","Feb","Mar"]`, `ast.vAxis.min` is 0, `ast.vAxis.max` is 100, `ast.series[0].values`
equals `[10, 50, 30]`, and `ast.errors` is empty.

**AC2:** Given a `line` command with coordinate pairs `[(1,10),(2,20)]` and no explicit
h-axis range, when `parseChart()` runs, then `ast.errors` contains a message about requiring
numeric h-axis range.

**AC3:** Given one `line` series with index-based data and a second `line` series with
coordinate pairs, when `parseChart()` runs, then `ast.errors` contains a message about
mixing data formats.

**AC4:** Given `h-axis "x" -5 --> 5` and `v2-axis "y2" 0 --> 200`, when `parseChart()` runs,
then `ast.hAxis.min` is -5, `ast.hAxis.max` is 5, `ast.hAxis.autoScale` is false, and
`ast.v2Axis` is not null with `max` 200.

**AC5:** Given `v-axis ticks [0:"Low", 50:"Mid", 100:"High"]`, when `parseChart()` runs,
then `ast.vAxis.customTicks` is a Map with 3 entries: 0→"Low", 50→"Mid", 100→"High".

**AC6:** Given `annotation "peak" at (3, 85) <<arrow>>`, when `parseChart()` runs, then
`ast.annotations[0].text` is "peak", `ast.annotations[0].xPos` is 3, `ast.annotations[0].yPos`
is 85, and `ast.annotations[0].hasArrow` is true.

**AC7:** Given `line "speed" [10, 20, 30]` with no name explicitly tested — verify default
naming: a `bar` command with no `"name"` produces series name `"bar0"`.

**AC8:** Given `grid h-axis` as a standalone line, when `parseChart()` runs, then
`ast.hAxis.gridMode` is `'major'`.

## Quality Bar

`npm test`, `npm run typecheck`, `npm run lint`, `npm run build` must all pass.
Commit: `feat(chart): add AST types and parser`
