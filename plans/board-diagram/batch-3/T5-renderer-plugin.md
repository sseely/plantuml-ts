# T5 — Renderer + Renderer Tests + Board Plugin Index

## Context

plantuml-js ports PlantUML to TypeScript. We are implementing `@startboard`
(Phase 5i). The renderer converts `BoardGeometry` (pixel coordinates) to an
SVG string. No DOM, no async — pure string building.

Java reference: `Activity.drawMe`, `CardBox.drawU`, `BoardDiagram.drawMe`
in `~/git/plantuml/src/main/java/net/sourceforge/plantuml/board/`.

Stack: TypeScript 5, Vitest. Use SVG primitives from `src/core/svg.ts`.

## Task

Create `renderer.ts`, `renderer.test.ts`, and the board plugin `index.ts`.

## Write-Set

- `src/diagrams/board/renderer.ts` (create)
- `tests/unit/board/renderer.test.ts` (create)
- `src/diagrams/board/index.ts` (create)

## Read-Set

- `src/diagrams/board/ast.ts` — `BoardDiagramAST`, `BoardGeometry`, `ActivityGeometry`, `CardGeometry`
- `src/diagrams/board/layout.ts` — `layoutBoard` function signature
- `src/diagrams/board/parser.ts` — `parseBoard` function signature
- `src/core/svg.ts` — `rect()`, `line()`, `text()`, `svgRoot()` primitives
- `src/core/theme.ts` — `Theme` type
- `src/diagrams/hcl/index.ts` — SyncPlugin pattern to mirror
- `src/core/dispatcher.ts` — `SyncPlugin` type
- `plans/board-diagram/decisions.md` — decisions B, C, E (shadow, text, double-draw)

## Architecture Decisions (apply these)

**Decision B — Shadow:** For each card at origin `(cx, cy)`:
1. Shadow rect: `rect(cx+1, cy+1, 150, 70, { fill: '#AAAAAA' })`
2. Card rect: `rect(cx, cy, 150, 70, { fill: '#D3D3D3', stroke: '#000000', strokeWidth: 1 })`
3. Label text: `text(cx+3, cy+3, label, { fontFamily: 'sans-serif', fontSize: 14, dominantBaseline: 'hanging' })`

**Decision C — Text:** `dominant-baseline="hanging"` with `y = cy + 3`.

**Decision E — Double-draw:** Each activity loop:
1. Draw header card at `(activityXOffset + 10, 10)` (the column header)
2. Loop `activity.cards` (which includes the root node at dx=0, dy=0)
   and draw each at `(activityXOffset + card.dx + 10, card.dy + 10)`
The root card is drawn twice at the same position — this mirrors Java.

## Renderer Implementation

```typescript
const CARD_W = 150;
const CARD_H = 70;
const CELL_W = 170;
const CELL_H = 90;
const INSET = 10;

function renderCard(cx: number, cy: number, label: string): string {
  const shadow = rect(cx + 1, cy + 1, CARD_W, CARD_H, { fill: '#AAAAAA' });
  const box = rect(cx, cy, CARD_W, CARD_H, {
    fill: '#D3D3D3', stroke: '#000000', strokeWidth: 1,
  });
  const label_ = text(cx + 3, cy + 3, label, {
    fontFamily: 'sans-serif', fontSize: 14,
    dominantBaseline: 'hanging', fill: '#000000',
  });
  return shadow + box + label_;
}

export function renderBoard(geo: BoardGeometry, theme: Theme): string {
  const parts: string[] = [];

  for (const activity of geo.activities) {
    const ox = activity.xOffset;

    // Header card (drawn first — Decision E)
    parts.push(renderCard(ox + INSET, INSET, /* activity name from cards[0] */));

    // All cards from BArray (including root at dx=0, dy=0)
    for (const card of activity.cards) {
      parts.push(renderCard(ox + card.dx + INSET, card.dy + INSET, card.label));
    }
  }

  // Horizontal dashed row separator lines
  for (let i = 0; i < geo.maxStage; i++) {
    const y = (i + 1) * CELL_H - 10;
    parts.push(line(0, y, geo.totalWidth, y, {
      stroke: '#000000', strokeWidth: 0.5, strokeDasharray: '5 5',
    }));
  }

  // Canvas height: enough for all stages + one cell for header row
  const height = (geo.maxStage + 1) * CELL_H;
  return svgRoot(geo.totalWidth || 10, height || 10, parts, theme.colors.background);
}
```

**Note on header name:** The header card needs the activity name. Two options:
1. Store `activityName` in `ActivityGeometry` (requires changing T1's types)
2. The first card in `cards[]` is always the root node (stage=0) — use its label

Option 2 is cleaner (no type change needed). The root card has `dx=0, dy=0, label=activityName`. The renderer draws it as the header AND includes it in the BArray loop. Both draws land at the same pixel position, matching Java's double-draw.

If going with option 2: the header draw becomes the first `renderCard` call from the cards loop. No separate header draw needed — the double-draw simply means the BArray loop already covers it. Actually, re-read decision E: Java calls `getBox().drawU(ug)` separately THEN loops BArray. Mirror this by:
- One explicit renderCard for the header at `(ox+INSET, INSET)` using the first card's label
- Then looping all cards (which includes root again at dx=0, dy=0)

This means the root card is rendered twice. That is intentional per decision E.

## Board Plugin (index.ts)

Mirror `src/diagrams/hcl/index.ts` exactly:

```typescript
import type { SyncPlugin } from '../../core/dispatcher.js';
import type { BoardDiagramAST } from './ast.js';
import type { BoardGeometry } from './ast.js';
import { parseBoard } from './parser.js';
import { layoutBoard } from './layout.js';
import { renderBoard } from './renderer.js';

export const boardPlugin: SyncPlugin<BoardDiagramAST, BoardGeometry> = {
  type: 'board',

  accepts(_lines: readonly string[]): boolean {
    return false;
  },

  parse(source) {
    return parseBoard(source);
  },

  layoutSync(ast, theme, _measurer) {
    return layoutBoard(ast);
    // theme and measurer unused — board layout is purely arithmetic
  },

  render(geo, theme) {
    return renderBoard(geo, theme);
  },
};
```

## Acceptance Criteria

1. Given `BoardGeometry` with 1 activity and 1 card at `(dx=0, dy=0)`, when
   `renderBoard` called, then SVG contains a `<rect>` at `x="10" y="10"`.
2. Given card at `dx=170, dy=90`, when rendered, then SVG contains `<rect>`
   with `x="180" y="100"` (170+10, 90+10).
3. Given card at `dx=170, dy=90`, when rendered, then shadow rect at
   `x="181" y="101"` (180+1, 100+1).
4. Given `maxStage=2`, when rendered, then SVG contains 2 `<line>` elements
   with `stroke-dasharray="5 5"` at y=80 and y=170.
5. Given `maxStage=0`, when rendered, then no `<line>` elements in SVG.
6. Given 2 activities with fullWidths 170 and 340, when rendered, then
   second activity cards are offset by 170px.
7. `boardPlugin.accepts([])` returns `false`.
8. `boardPlugin.type === 'board'`.
9. Given `@startboard\nWorld\n+Card\n@endboard`, when `renderSync` called
   (integration), then result starts with `<svg`.

## Quality Bar

- `npm test` passes.
- 90/90/90 coverage for `renderer.ts`.
- `npm run typecheck` passes — no `any` in renderer or index.
- SVG output is well-formed (all tags closed, no unclosed attributes).
