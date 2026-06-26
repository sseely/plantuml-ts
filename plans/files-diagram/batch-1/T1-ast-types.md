# T1 — AST Type Definitions

## Context

plantuml-js is a TypeScript port of PlantUML. This task creates all type
definitions for the `@startfiles` diagram type. All other files tasks import
from this file. Stack: vitest, tsc, eslint, vite.

## Task

Create `src/diagrams/files/ast.ts` with exactly the types below. No logic.

## Write-Set

- `src/diagrams/files/ast.ts` (create)

## Read-Set

- `src/diagrams/board/ast.ts` — structural reference only

## Types to Export

```typescript
export type FileEntryType = 'folder' | 'file' | 'note';

export interface FileEntry {
  type: FileEntryType;
  name: string;          // empty string for root; note lines stored separately
  children: FileEntry[];
  noteLines?: string[];  // only set when type === 'note'
}

export interface FilesDiagramAST {
  root: FileEntry;       // root.children are the top-level entries
}

export interface EntryGeometry {
  type: FileEntryType;
  name: string;
  depth: number;
  x: number;             // left pixel (depth * INDENT)
  y: number;             // top pixel (rowIndex * ROW_HEIGHT)
  noteLines?: string[];
  labelWidth: number;    // measured pixel width of icon + space + name
}

export interface FilesGeometry {
  entries: EntryGeometry[];
  totalWidth: number;
  totalHeight: number;
}
```

## Quality Bar

`npm run typecheck` and `npm run lint` pass with zero new errors.

## Commit

`feat(files): add AST and geometry type definitions`
