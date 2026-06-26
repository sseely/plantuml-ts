# T5 — Plugin Wiring + Integration

## Context

plantuml-js is a TypeScript port of PlantUML. This task wires the completed
chronology plugin into the dispatcher, block extractor, and QA page builder.
The project uses vitest, tsc, eslint, vite.

Batches 1 and 2 are complete — all chronology source files exist.

## Task

1. Create `src/diagrams/chronology/index.ts` — the `SyncPlugin` export.
2. Add `'chronology'` to `DiagramType` and `START_SUFFIX_MAP` in `src/core/block-extractor.ts`.
3. Register `chronologyPlugin` in `src/index.ts`.
4. Add `'chronology'` to `IMPLEMENTED_TYPES` in `scripts/build-pages.ts`.

## Write-Set

- `src/diagrams/chronology/index.ts` (create)
- `src/core/block-extractor.ts` (modify)
- `src/index.ts` (modify)
- `scripts/build-pages.ts` (modify)

## Read-Set

- `src/diagrams/board/index.ts` — SyncPlugin pattern to mirror exactly
- `src/core/block-extractor.ts` — current `DiagramType` union and `START_SUFFIX_MAP`
- `src/index.ts` — current import list and `registry.register()` calls

## Implementation Details

### src/diagrams/chronology/index.ts

Mirror `src/diagrams/board/index.ts` exactly, substituting chronology names:

```typescript
import type { SyncPlugin } from '../../core/dispatcher.js';
import type { ChronologyDiagramAST, ChronologyGeometry } from './ast.js';
import { parseChronology } from './parser.js';
import { layoutChronology } from './layout.js';
import { renderChronology } from './renderer.js';

export const chronologyPlugin: SyncPlugin<ChronologyDiagramAST, ChronologyGeometry> = {
  type: 'chronology',

  accepts(_lines: readonly string[]): boolean {
    return false;
  },

  parse(source) {
    return parseChronology(source);
  },

  layoutSync(ast, _theme, _measurer) {
    return layoutChronology(ast);
  },

  render(geo, theme) {
    return renderChronology(geo, theme);
  },
};
```

### src/core/block-extractor.ts

Add `'chronology'` to the `DiagramType` union (after `'board'`):
```typescript
| 'chronology'
| 'unknown';
```

Add entry to `START_SUFFIX_MAP` (after `board: 'board'`):
```typescript
chronology: 'chronology',
```

### src/index.ts

Add import after the `boardPlugin` import:
```typescript
import { chronologyPlugin } from './diagrams/chronology/index.js';
```

Add registration after `registry.register(boardPlugin)`:
```typescript
registry.register(chronologyPlugin);
```

### scripts/build-pages.ts

Add `'chronology'` to the `IMPLEMENTED_TYPES` Set (alphabetical order, after `'board'`):
```typescript
'chronology',
```

## Acceptance Criteria

- **AC1:** `@startchronology\n[E] happens at 2023-11-24 10:11:50.750\n@endchronology`
  routed to `chronologyPlugin` and returns a valid SVG string
- **AC2:** `npm test` passes (all chronology unit tests green, no regressions)
- **AC3:** `npm run typecheck` passes (zero new type errors)
- **AC4:** `npm run build` produces dist/ without errors
- **AC5:** `npm run lint` passes

## Quality Bar

All four quality gates pass. This is the final commit before PR.

## Commit

`feat(chronology): register plugin and wire block extractor`
