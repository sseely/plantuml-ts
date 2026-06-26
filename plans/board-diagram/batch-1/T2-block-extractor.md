# T2 — Add 'board' to Block Extractor

## Context

plantuml-js uses a block extractor (`src/core/block-extractor.ts`) to split
preprocessed source lines into typed `UmlSource` blocks. Each @start<suffix>
keyword maps to a `DiagramType`. We are adding `@startboard / @endboard`.

The extractor has two places to update:
1. The `DiagramType` union (TypeScript type)
2. The `START_SUFFIX_MAP` runtime object

## Task

Modify `src/core/block-extractor.ts` to register `'board'` as a known
diagram type. Two one-line changes.

## Write-Set

- `src/core/block-extractor.ts` (modify)

## Read-Set

- `src/core/block-extractor.ts:11-58` — the `DiagramType` union and
  `START_SUFFIX_MAP` constant to understand exactly where to insert

## Changes Required

### 1. DiagramType union (around line 26)

Add `'board'` before `'unknown'`:

```typescript
export type DiagramType =
  | 'sequence'
  | 'class'
  | 'component'
  | 'state'
  | 'usecase'
  | 'activity'
  | 'object'
  | 'timing'
  | 'mindmap'
  | 'gantt'
  | 'wbs'
  | 'json'
  | 'yaml'
  | 'hcl'
  | 'board'      // ← add this
  | 'unknown';
```

### 2. START_SUFFIX_MAP (around line 43-58)

Add one entry after `hcl`:

```typescript
const START_SUFFIX_MAP: Readonly<Record<string, DiagramType>> = {
  // ... existing entries ...
  hcl: 'hcl',
  board: 'board',   // ← add this
};
```

## Acceptance Criteria

- Given `['@startboard', 'World', '+Card', '@endboard']`, when
  `extractBlocks` runs, then `blocks[0].type === 'board'`.
- Given `['@STARTBOARD', 'World', '@ENDBOARD']` (uppercase), when
  `extractBlocks` runs, then `blocks[0].type === 'board'` (case-insensitive
  match via the existing `toLowerCase()` in extractBlocks).
- No other existing types are affected — run `npm test` to confirm.

## Quality Bar

- `npm run typecheck` passes.
- `npm test` still passes (existing block-extractor tests must not break).
- Do NOT modify the detection logic (`probeState`, `probeSequence`, etc.) —
  board is only reachable via `@startboard`, never via `@startuml`.
