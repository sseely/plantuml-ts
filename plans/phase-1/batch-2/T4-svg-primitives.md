# T4 — SVG Primitives

## Context

Project: plantuml-js — TypeScript PlantUML renderer producing SVG in browser.
Stack: TypeScript 5 strict, Vitest for tests.

All SVG output in this library is produced by composing pure string-building
functions. No DOM API. These primitives are the only place SVG markup is
generated; the renderer layer calls them exclusively.

## Task

Implement `src/core/svg.ts` and its tests using TDD. Write each test first,
then implement. Follow the test descriptions in `planning/tdd-plan.md` under
`tests/unit/svg-primitives.test.ts`.

## Write-set

| File | Action |
|------|--------|
| `src/core/svg.ts` | Create |
| `tests/unit/svg-primitives.test.ts` | Create |

## Read-set

- `planning/tdd-plan.md` — section `tests/unit/svg-primitives.test.ts`
- `planning/decisions.md` — D3 (string building, not DOM)

## Interface contract

```typescript
export interface BoxStyle {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  strokeDasharray?: string;
  rx?: number;
  opacity?: number;
}

export interface LineStyle {
  stroke?: string;
  strokeWidth?: number;
  strokeDasharray?: string;
  markerEnd?: string;
  markerStart?: string;
}

export interface TextStyle {
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  fill?: string;
  textAnchor?: 'start' | 'middle' | 'end';
}

export type ArrowType =
  | 'sync' | 'async' | 'reply' | 'replyAsync'
  | 'extension' | 'implementation'
  | 'composition' | 'aggregation'
  | 'dependency' | 'lost' | 'found';

export function svgRoot(width: number, height: number, children: string[]): string;
export function rect(x: number, y: number, w: number, h: number, style?: BoxStyle): string;
export function line(x1: number, y1: number, x2: number, y2: number, style?: LineStyle): string;
export function text(x: number, y: number, content: string, style?: TextStyle): string;
export function path(d: string, style?: LineStyle): string;
export function group(id: string, children: string[]): string;
export function defs(children: string[]): string;
export function arrowHead(type: ArrowType): string;  // returns <marker> element
export function arrowHeadRef(type: ArrowType): string; // returns marker id for use in markerEnd
```

## Implementation notes

- `svgRoot` must include a `<defs>` section with all arrow markers referenced
  by any child element. Collect all `ArrowType` used and emit their markers.
  Simplest approach: always emit all standard markers in defs — they are
  small and the overhead is negligible.
- `arrowHead('sync')` → filled closed triangle (standard UML sync arrow)
- `arrowHead('async')` → open arrowhead (two lines, no fill)
- `arrowHead('reply')` → same as sync but dashed line style is on the line,
  not the marker — marker is identical to sync
- `arrowHead('extension')` → large hollow triangle (inheritance)
- `arrowHead('composition')` → filled diamond
- `arrowHead('aggregation')` → hollow diamond
- `arrowHead('lost')` / `arrowHead('found')` → circle marker

## Acceptance criteria

- Given `rect(0, 0, 100, 50, { fill: 'white', stroke: 'black' })`, when
  called, then output matches `/<rect x="0" y="0" width="100" height="50"/`
  and contains `fill="white"` and `stroke="black"`
- Given `line(0, 0, 100, 0, {})`, when called, then output matches
  `/<line x1="0" y1="0" x2="100" y2="0"/`
- Given `svgRoot(400, 300, ['<rect/>'])`, when called, then output starts
  with `<svg xmlns="http://www.w3.org/2000/svg"` and ends with `</svg>`
- Given `arrowHead('sync')`, when called, then output contains `<marker`
  and a `<polygon` with a non-empty `fill` attribute
- Given `group('g1', ['<rect/>'])`, when called, then output is
  `<g id="g1"><rect/></g>`

## Quality bar

`pnpm typecheck && pnpm lint && pnpm test` all pass. Coverage ≥ 90% on
`src/core/svg.ts`. Commit: `feat(core): implement SVG primitive builders`
