# T8 — Sequence Layout

## Context

Project: plantuml-js — TypeScript PlantUML renderer producing SVG in browser.
Stack: TypeScript 5 strict, Vitest for tests.

The layout engine is a pure function: it takes a `SequenceDiagramAST` and a
`StringMeasurer` and returns a `SequenceGeometry` with absolute x/y coordinates
for every visual element. No DOM access. No SVG output. Pure data transformation.

All types are already defined in `src/diagrams/sequence/ast.ts` (by T7).
The `StringMeasurer` interface and `FormulaMeasurer` are in `src/core/measurer.ts` (by T6).
The `Theme` type is in `src/core/theme.ts` (by T6).

Tests use `FixedMeasurer` (charWidth=8, lineHeight=16) for deterministic geometry.

## Task

Implement `src/diagrams/sequence/layout.ts` and its tests using TDD.
Write each test first, then implement. Follow test descriptions in
`planning/tdd-plan.md` under `tests/unit/sequence/layout.test.ts`.

## Write-set

| File | Action |
|------|--------|
| `src/diagrams/sequence/layout.ts` | Create |
| `tests/unit/sequence/layout.test.ts` | Create |

## Read-set

- `planning/tdd-plan.md` — section `tests/unit/sequence/layout.test.ts`
- `planning/diagram-types.md` — section "Sequence Diagrams — Layout algorithm"
- `src/diagrams/sequence/ast.ts` — all AST and Geometry types
- `src/core/measurer.ts` — `StringMeasurer`, `FixedMeasurer` interfaces
- `src/core/theme.ts` — `Theme` interface, `defaultTheme`

## Interface contract

```typescript
// src/diagrams/sequence/layout.ts

import type { SequenceDiagramAST, SequenceGeometry } from './ast.js';
import type { Theme } from '../../core/theme.js';
import type { StringMeasurer } from '../../core/measurer.js';

export function layoutSequence(
  ast: SequenceDiagramAST,
  theme: Theme,
  measurer: StringMeasurer
): SequenceGeometry;
```

Pure function — no side effects, no async.

## Layout algorithm

### Step 1: Participant columns

For each participant (in `ast.participants` order):
1. Measure the display label width using `measurer.measure(label, font)`
2. Column width = `max(theme.sequence.participantMinWidth, labelWidth + theme.sequence.participantPadding * 2)`
3. Column center x = `sum of previous column widths + (current column width / 2)` + left margin (30px)
4. Participant box: x = centerX - width/2, y = 0 (top), height = measured label height + vertical padding (20px)

### Step 2: Event y-positions

Start `currentY` at `max participant height + theme.sequence.messageSpacing`.

Walk `ast.events` in order. For each event:

**MessageEvent:**
- Measure label width
- y = currentY
- fromX = participants[from].centerX, toX = participants[to].centerX
- For self-message: toX = fromX + activationWidth + 20
- currentY += theme.sequence.messageSpacing + label line height

**NoteEvent:**
- Measure note text (may be multi-line; split on `\n`, take max width)
- noteWidth = max measured width + notePadding * 2
- noteHeight = lineCount * lineHeight + notePadding * 2
- Position: for 'left of P' → x = participants[P].centerX - noteWidth - noteMargin
- For 'right of P' → x = participants[P].centerX + noteMargin
- For 'over A, B' → x = min(participants[A].centerX, participants[B].centerX) - noteMargin, width spans to max center + noteMargin
- y = currentY
- currentY += noteHeight + theme.sequence.messageSpacing

**ActivationEvent (activate):**
- Record activation start: `activationStart[participantId] = currentY`
- No height yet; height computed on deactivate

**ActivationEvent (deactivate):**
- activationHeight = currentY - activationStart[participantId]
- Emit ActivationGeo: lifelineX = participants[participantId].centerX, y = start, height

**FrameEvent:**
- Recursively layout children (each branch)
- Frame y = start of first child event
- Frame height = end of last child event in any branch - frame y + frameHeaderHeight
- Frame x = leftmost participant center - margin
- Frame width = rightmost participant center + margin - frame x
- currentY = frame y + frame height + messageSpacing

**DividerEvent:**
- y = currentY
- totalWidth = total diagram width (computed at the end)
- currentY += 30 (divider height)

**SpaceEvent:**
- y = currentY; height = event.pixels
- currentY += event.pixels

### Step 3: Totals

- `lifelineEndY` = `currentY + theme.sequence.lifelineExtension`
- `totalHeight` = `lifelineEndY + participant box height` (footer)
- `totalWidth` = `last participant right edge + 30` (right margin)

## Acceptance criteria

- Given two participants, when laid out with FixedMeasurer, then
  `geo.participants[0].centerX < geo.participants[1].centerX`
- Given two sequential messages, when laid out, then
  `geo.events[1].y > geo.events[0].y`
- Given a self-message on Alice, when laid out, then
  `(geo.events[0] as MessageGeo).toX > (geo.events[0] as MessageGeo).fromX`
- Given activate → message → deactivate on Alice, when laid out, then
  the ActivationGeo in events has height > 0
- Given a loop frame with two messages inside, when laid out, then
  `(frame as FrameGeo).y <= firstMsgY` and
  `(frame as FrameGeo).y + (frame as FrameGeo).height >= secondMsgY`
- Given a note left of Alice, when laid out, then
  `(note as NoteGeo).x + (note as NoteGeo).width <= geo.participants[aliceIdx].centerX`

## Quality bar

`pnpm typecheck && pnpm lint && pnpm test` all pass. Coverage ≥ 90% on
`src/diagrams/sequence/layout.ts`. Commit:
`feat(sequence): implement layout engine`
