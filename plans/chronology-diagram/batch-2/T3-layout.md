# T3 — Layout + Layout Tests

## Context

plantuml-js is a TypeScript port of PlantUML. This task implements pure
arithmetic layout for `@startchronology` diagrams — no graph engine.
The project uses vitest, tsc, eslint, vite. Pattern reference:
`src/diagrams/board/layout.ts`.

## Task

Implement `src/diagrams/chronology/layout.ts` and write comprehensive unit tests
in `tests/unit/chronology/layout.test.ts`.

## Write-Set

- `src/diagrams/chronology/layout.ts` (create)
- `tests/unit/chronology/layout.test.ts` (create)

## Read-Set

- `src/diagrams/chronology/ast.ts` — all types
- `src/diagrams/board/layout.ts` — arithmetic layout pattern

## Architecture Decisions

- **D1 (x-scale):**
  ```
  minMs = minEpochDay × 86_400_000
  maxMs = (maxEpochDay + 1) × 86_400_000
  x = 1000 × (eventMs − minMs) / (maxMs − minMs)
  ```
  Where `minEpochDay` and `maxEpochDay` come from `Math.floor(eventMs / 86_400_000)`.
- **D2 (UTC):** epoch days derived from UTC timestamps already stored in AST.
- **D4 (labels):** Even-index events → `labelAbove: true`. Odd → `labelAbove: false`.
- **D5 (dimensions):** `totalWidth=1000`, `headerHeight=30`, `baselineY=40`, `totalHeight=80`.

## Day Tick Generation

Generate one `DayTick` for each midnight UTC within `[minMs, maxMs)`:

```typescript
const numDays = maxEpochDay - minEpochDay + 1;
for (let i = 0; i < numDays; i++) {
  const dayMs = (minEpochDay + i) * 86_400_000;
  const x = 1000 * (dayMs - minMs) / (maxMs - minMs);
  const d = new Date(dayMs);
  const label = `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())}`;
  dayTicks.push({ x, label });
}
```

Where `pad(n) = String(n).padStart(2, '0')`.

## Single-Event Edge Case

If `events.length === 1`:
- `minEpochDay = maxEpochDay` (same day)
- `minMs = dayStart`, `maxMs = dayStart + 86_400_000` (one full day range)
- No division by zero. Event placed at its time-of-day fraction.
- One day tick at x=0.

## Interface Contract

```typescript
function layoutChronology(ast: ChronologyDiagramAST): ChronologyGeometry
```

## Verified Numbers (corpus fixture)

Input:
- Event1: timestampMs=1700820710750 (2023-11-24 10:11:50.750 UTC)
- Event2: timestampMs=1701180710750 (2023-11-28 14:11:50.750 UTC)

Expected output:
- minMs = 1700784000000, maxMs = 1701216000000, range = 432000000
- Event1.x ≈ 84.98 (tolerance ±0.01)
- Event2.x ≈ 918.31 (tolerance ±0.01)
- Event1.labelAbove = true, Event2.labelAbove = false
- dayTicks: length=5
  - { x: 0,   label: '2023-11-24' }
  - { x: 200, label: '2023-11-25' }
  - { x: 400, label: '2023-11-26' }
  - { x: 600, label: '2023-11-27' }
  - { x: 800, label: '2023-11-28' }
- totalWidth=1000, headerHeight=30, baselineY=40, totalHeight=80

## Acceptance Criteria

- **AC1:** Corpus fixture → Event1.x ≈ 84.98, Event2.x ≈ 918.31
- **AC2:** Day ticks: 5 entries at x=0, 200, 400, 600, 800 with correct labels
- **AC3:** `totalWidth=1000`, `headerHeight=30`, `baselineY=40`, `totalHeight=80`
- **AC4:** `events[0].labelAbove=true`, `events[1].labelAbove=false`
- **AC5:** Single-event AST → event placed at time-of-day fraction, no throw,
  one day tick at x=0
- **AC6:** Empty AST → `{ events:[], dayTicks:[], totalWidth:1000, totalHeight:80, baselineY:40, headerHeight:30 }`

## Quality Bar

`npm test`, `npm run typecheck`, `npm run lint` — zero new errors.
90/90/90 coverage for `layout.ts`.

## Commit

`feat(chronology): add layout engine and layout tests`
