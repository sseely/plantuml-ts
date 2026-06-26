# T2 — Parser + Parser Tests

## Context

plantuml-js is a TypeScript port of PlantUML. This task implements the parser
for `@startchronology` diagrams. The project uses vitest, tsc, eslint, vite.
Pattern reference: `src/diagrams/board/parser.ts` — mimic its structure.

All timestamps must be parsed as UTC epoch milliseconds using `Date.UTC()`.

## Task

Implement `src/diagrams/chronology/parser.ts` and write comprehensive unit tests
in `tests/unit/chronology/parser.test.ts`.

## Write-Set

- `src/diagrams/chronology/parser.ts` (create)
- `tests/unit/chronology/parser.test.ts` (create)

## Read-Set

- `src/diagrams/chronology/ast.ts` — `ChronologyEvent`, `ChronologyDiagramAST`
- `src/diagrams/board/parser.ts` — structural pattern to mirror
- `src/core/block-extractor.ts` — `UmlSource` type
- `tests/visual/data/chronology.json` — corpus fixture

## Grammar

One command only:
```
[TaskName] happens [at|on|the] YYYY-MM-DD HH:mm:ss[.SSS]
```

Regex (from Java `ComplementHour`):
- Subject: `/^\[([^\]]+)\]/` extracts the task name
- Verb: `happens` followed by optional `at`, `on`, or `the`
- Date+time: `(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})`
- Optional milliseconds: `\.(\d+)`

The full line regex:
```
/^\[([^\]]+)\]\s+happens\s+(?:at|on|the)?\s*(\d{4}-\d{2}-\d{2})\s+(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?/
```

Lines that don't match this pattern, `@startchronology`, `@endchronology`, and
blank lines are silently ignored.

## Timestamp Computation

```typescript
const ms = parseInt(msStr ?? '0', 10);
const timestampMs = Date.UTC(year, month - 1, day, hour, minute, second, ms);
```

Where `msStr` is the optional milliseconds capture group (e.g. `'750'`).
If `msStr` has fewer than 3 digits, treat as-is (e.g. `'75'` → 75ms).

## Architecture Decisions

- D2: All timestamps in UTC (use `Date.UTC`)

## Interface Contract (output)

```typescript
function parseChronology(source: UmlSource): ChronologyDiagramAST
```

## Acceptance Criteria

- **AC1:** `[Event1] happens at 2023-11-24 10:11:50.750` →
  `{ name: 'Event1', timestampMs: 1700820710750 }`
- **AC2:** `[Event2] happens at 2023-11-28 14:11:50.750` →
  `{ name: 'Event2', timestampMs: 1701180710750 }`
- **AC3:** `happens on 2023-01-01 00:00:00` and `happens the 2023-01-01 00:00:00`
  parse identically to `happens at 2023-01-01 00:00:00`
- **AC4:** `[A] happens at 2023-01-01 12:00:00` (no milliseconds) →
  `timestampMs` is a valid UTC epoch millisecond with ms=0
- **AC5:** `@startchronology` / `@endchronology` wrapper lines produce no events
- **AC6:** Blank lines and unrecognized lines are silently ignored
- **AC7:** Full fixture parse → 2 events with correct names and timestamps

## Quality Bar

`npm test` (all tests pass), `npm run typecheck`, `npm run lint` — zero new errors.
90/90/90 coverage for `parser.ts`.

## Commit

`feat(chronology): add parser and parser tests`
