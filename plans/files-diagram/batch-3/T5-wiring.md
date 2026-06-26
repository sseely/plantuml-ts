# T5 — Plugin Wiring + Integration

## Context

plantuml-js is a TypeScript port of PlantUML. This task wires the completed
files plugin into the dispatcher, block extractor, and QA page builder.
Stack: vitest, tsc, eslint, vite.

Batches 1 and 2 are complete — all files source files exist.

## Task

1. Create `src/diagrams/files/index.ts` — the `SyncPlugin` export.
2. Add `'files'` to `DiagramType` and `START_SUFFIX_MAP` in `src/core/block-extractor.ts`.
3. Register `filesPlugin` in `src/index.ts`.
4. Add `'files'` to `IMPLEMENTED_TYPES` in `scripts/build-pages.ts`.
5. Add `tests/visual/data/files.json` — corpus fixture for visual QA.

## Write-Set

- `src/diagrams/files/index.ts` (create)
- `src/core/block-extractor.ts` (modify)
- `src/index.ts` (modify)
- `scripts/build-pages.ts` (modify)
- `tests/visual/data/files.json` (create)

## Read-Set

- `src/diagrams/board/index.ts` — SyncPlugin pattern to mirror exactly
- `src/diagrams/chronology/index.ts` — recent example of the same pattern
- `src/core/block-extractor.ts` lines 11–62 — current `DiagramType` union and `START_SUFFIX_MAP`
- `src/index.ts` lines 1–41 — current import list and `registry.register()` calls
- `scripts/build-pages.ts` lines 21–35 — current `IMPLEMENTED_TYPES` Set

## Implementation Details

### src/diagrams/files/index.ts

Mirror `src/diagrams/board/index.ts` exactly, substituting files names:

```typescript
import type { SyncPlugin } from '../../core/dispatcher.js';
import type { FilesDiagramAST, FilesGeometry } from './ast.js';
import { parseFiles } from './parser.js';
import { layoutFiles } from './layout.js';
import { renderFiles } from './renderer.js';

export const filesPlugin: SyncPlugin<FilesDiagramAST, FilesGeometry> = {
  type: 'files',

  accepts(_lines: readonly string[]): boolean {
    return false;
  },

  parse(source) {
    return parseFiles(source);
  },

  layoutSync(ast, _theme, measurer) {
    return layoutFiles(ast, measurer);
  },

  render(geo, theme) {
    return renderFiles(geo, theme);
  },
};
```

Note: `layoutFiles` takes `measurer` as its second argument — pass it through.

### src/core/block-extractor.ts

Add `'files'` to the `DiagramType` union (after `'chronology'`, before `'unknown'`):
```typescript
| 'files'
| 'unknown';
```

Add entry to `START_SUFFIX_MAP` (after `chronology: 'chronology'`):
```typescript
files: 'files',
```

### src/index.ts

Add import after the `chronologyPlugin` import:
```typescript
import { filesPlugin } from './diagrams/files/index.js';
```

Add registration after `registry.register(chronologyPlugin)`:
```typescript
registry.register(filesPlugin);
```

### scripts/build-pages.ts

Add `'files'` to the `IMPLEMENTED_TYPES` Set (alphabetical order, after `'chronology'`):
```typescript
'files',
```

### tests/visual/data/files.json

Visual QA fixture. Use this structure (a real-world directory tree with a note):

```json
{
  "type": "files",
  "label": "files — directory tree with note",
  "source": "@startfiles\n/src/\n/src/index.ts\n/src/utils/\n/src/utils/helper.ts\n/tests/\n/tests/index.test.ts\n<note>\nMain entry point\n</note>\n/README.md\n@endfiles"
}
```

## Acceptance Criteria

- **AC1:** `@startfiles\n/src/foo.ts\n@endfiles` routed to `filesPlugin`
  and returns a valid SVG string containing `📄`
- **AC2:** `@startfiles\n/src/\n@endfiles` renders a folder icon `📂`
- **AC3:** `npm test` passes (all files unit tests green, no regressions)
- **AC4:** `npm run typecheck` passes (zero new type errors)
- **AC5:** `npm run build` produces dist/ without errors
- **AC6:** `npm run lint` passes

## Quality Bar

All four quality gates pass. This is the final commit for the feature.

## Commit

`feat(files): register plugin and wire block extractor`
