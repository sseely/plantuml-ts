# T6 — Wire boardPlugin into src/index.ts + build-pages.ts

## Context

plantuml-js dispatches diagram rendering through a plugin registry. Each
plugin is imported in `src/index.ts` and registered via `registry.register()`.
The visual QA page builder (`scripts/build-pages.ts`) lists implemented types
in `IMPLEMENTED_TYPES` — adding `'board'` there enables the board QA page
generation via `npm run visual:build`.

## Task

Two small additions to wire everything together.

## Write-Set

- `src/index.ts` (modify)
- `scripts/build-pages.ts` (modify)

## Read-Set

- `src/index.ts:16` — existing `hclPlugin` import pattern to follow
- `src/index.ts:36` — existing `registry.register(hclPlugin)` pattern
- `scripts/build-pages.ts:21-32` — `IMPLEMENTED_TYPES` set

## Changes Required

### src/index.ts

1. Add import after the `hclPlugin` import (line ~16):
```typescript
import { boardPlugin } from './diagrams/board/index.js';
```

2. Add registration after `registry.register(hclPlugin)` (line ~36):
```typescript
registry.register(boardPlugin);
```

Order within the registry does not matter for `board` since `accepts()`
always returns `false` — board is only reachable via type `'board'` from
the block extractor.

### scripts/build-pages.ts

Add `'board'` to the `IMPLEMENTED_TYPES` set (line ~21-32):

```typescript
const IMPLEMENTED_TYPES = new Set([
  'activity',
  'board',       // ← add this
  'class',
  'component',
  'hcl',
  'json',
  'object',
  'sequence',
  'state',
  'usecase',
  'yaml',
]);
```

Keep entries in alphabetical order (existing convention).

## Acceptance Criteria

1. Given `@startboard\nWorld\n+Europe\n@endboard`, when `renderSync(source)`
   is called from the public API, then result starts with `<svg` and does not
   contain `PlantUML error`.
2. Given `@startboard\n@endboard` (empty board), when `renderSync`, then result
   starts with `<svg` (no crash on empty activity list).
3. `npm run build` produces a dist bundle without errors.
4. `npm run visual:build` (or equivalent) generates `tests/visual/board.html`
   when `tests/visual/data/board.json` exists (it already does — 4 fixtures).

## Quality Bar

- `npm test` passes (all existing + new board tests).
- `npm run typecheck` passes.
- `npm run lint` passes.
- `npm run build` succeeds.
