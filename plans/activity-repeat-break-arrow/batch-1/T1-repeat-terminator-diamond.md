# T1 — repeat terminator fix + repeat-start diamond

## Context

Project: `plantuml-js` — TypeScript port of PlantUML, pure SVG output.
Stack: TypeScript, Vitest, ESLint, Vite.
Test command: `npm test` (vitest + 90/90/90 coverage thresholds).
Type check: `npm run typecheck` (tsc --noEmit).
Lint: `npm run lint`.

Two bugs that cascade from the same fixture (`bisoje-74-pipa697.puml`):

1. `repeat while` (space-separated, no parens) is not recognised as the
   loop terminator. `parseNodes` uses stop keyword `'repeatwhile'`
   (no space). `matchesStopKeyword` checks `lineLc === kw ||
   lineLc.startsWith(kw + ' ') || lineLc.startsWith(kw + '(')` — so
   `'repeat while'` never matches. Also `RE_REPEATWHILE` requires parens:
   `/^repeatwhile\s*\(([^)]*)\)\s*$/i` — fails for bare `repeat while`.

2. `repeat-start` is rendered as a rounded rectangle instead of a diamond.
   In `renderNode`, `case 'repeat-start'` falls through to `renderAction`.
   Upstream Java renders the repeat entry node as a diamond.

## Task

Fix both bugs:

### Fix 1 — stop keyword + regex

- Add `'repeat while'` to the stop keyword array passed to `parseNodes`
  when parsing a `repeat` body. Currently only `['repeatwhile']`.
  Change to `['repeatwhile', 'repeat while']`.
- Update `RE_REPEATWHILE` to accept both spellings and make parens
  optional:
  ```
  /^repeat\s*while(?:\s*\(([^)]*)\))?\s*$/i
  ```
  This matches: `repeatwhile`, `repeat while`, `repeatwhile(cond)`,
  `repeat while (cond)`, `repeat while(cond)`.
- After matching, `condition` will be `repeatMatch[1]?.trim() ?? ''`.
  Empty string means no explicit exit condition (break is the only exit).

### Fix 2 — repeat-start renders as diamond

In `renderNode` switch (`src/diagrams/activity/renderer.ts:126`):
- Remove `'repeat-start'` from the `case 'action'` branch.
- Add a new case `'repeat-start'` that calls `renderDiamond`.

`renderDiamond` at line 77 reads `node.label` for the text — `repeat-start`
nodes have no label, so it will render as an empty diamond, which is correct.

## Write-set

- `src/diagrams/activity/parser.ts` — RE_REPEATWHILE + stop keywords
- `src/diagrams/activity/renderer.ts` — repeat-start → renderDiamond
- `tests/unit/activity/parser.test.ts` — new/updated parser tests
- `tests/unit/activity/renderer.test.ts` — new/updated renderer tests

## Read-set

- `src/diagrams/activity/parser.ts:50-81` — RE_REPEATWHILE, matchesStopKeyword
- `src/diagrams/activity/parser.ts:376-400` — repeat / repeatwhile parsing
- `src/diagrams/activity/renderer.ts:125-154` — renderNode switch
- `src/diagrams/activity/renderer.ts:77-91` — renderDiamond
- `tests/unit/activity/parser.test.ts` — existing test patterns
- `tests/unit/activity/renderer.test.ts` — existing test patterns

## Architecture decisions

- D4 (decisions.md): stop keywords `['repeatwhile', 'repeat while']`,
  `RE_REPEATWHILE = /^repeat\s*while(?:\s*\(([^)]*)\))?\s*$/i`,
  empty condition string is valid (break-only exit path).

## Acceptance criteria

```
Given `repeat while` (space-separated, no parens) at end of repeat block,
When parsed,
Then a `repeat` AST node is produced with `condition = ''`.

Given `repeat while (some condition)` (space, parens),
When parsed,
Then a `repeat` AST node is produced with `condition = 'some condition'`.

Given `repeatwhile(cond)` (no space, parens),
When parsed,
Then a `repeat` AST node is produced with `condition = 'cond'`
(existing behaviour preserved).

Given a `repeat-start` node in the geo graph,
When rendered,
Then the SVG output contains a `<polygon>` element (diamond) not a
`<rect>` element (action).
```

## Quality bar

`npm test && npm run typecheck && npm run lint` must all pass.
No files outside the write-set should be modified.
