# T3 — Layout + Layout Tests

## Context

plantuml-js is a TypeScript port of PlantUML. Stack: vitest, tsc, eslint, vite.
Pattern reference: `src/diagrams/board/layout.ts`, `src/diagrams/chronology/layout.ts`.

## Task

Create `src/diagrams/files/layout.ts` and `tests/unit/files/layout.test.ts`.

## Write-Set

- `src/diagrams/files/layout.ts` (create)
- `tests/unit/files/layout.test.ts` (create)

## Read-Set

- `src/diagrams/files/ast.ts` — all types
- `src/diagrams/board/layout.ts` — arithmetic layout pattern
- `src/core/measurer.ts` lines 1–50 — `StringMeasurer` interface

## Architecture Decisions

- **D2 (measurer):** Accept `StringMeasurer` as second parameter. Call
  `measurer.measure(iconPrefix + name, { family: 'sans-serif', size: 14 })`
  to get `labelWidth` for each entry.
- **D5 (constants):** `ROW_HEIGHT=22`, `INDENT=20`, `PADDING=10`, `FONT_SIZE=14`

## Layout Algorithm

DFS pre-order traversal of `ast.root.children` (skip root itself):

```typescript
const ROW_HEIGHT = 22;
const INDENT = 20;
const PADDING = 10;

function traverse(node: FileEntry, depth: number, state: { row: number }, measurer, out: EntryGeometry[]):
  const iconPrefix = node.type === 'folder' ? '📂 ' : node.type === 'note' ? '' : '📄 ';
  const labelText = node.type === 'note' ? (node.noteLines?.join(' ') ?? '') : iconPrefix + node.name;
  const { width: labelWidth } = measurer.measure(
    node.type === 'note' ? '' : iconPrefix + node.name,
    { family: 'sans-serif', size: 14 }
  );
  out.push({
    type: node.type,
    name: node.name,
    depth,
    x: depth * INDENT,
    y: state.row * ROW_HEIGHT,
    noteLines: node.noteLines,
    labelWidth,
  });
  state.row += 1;
  for (const child of node.children):
    traverse(child, depth + 1, state, measurer, out);
```

`totalWidth = Math.max(...entries.map(e => e.x + e.labelWidth)) + PADDING * 2`

For note entries: `labelWidth` can be measured as the longest note line, or use
the max of `measurer.measure(line, ...)` across all note lines.

Note height in the geometry is not computed here — the renderer handles note box
sizing. Layout only places the top-left y of the note entry.

## Empty AST Edge Case

If `ast.root.children` is empty: return `{ entries: [], totalWidth: 0, totalHeight: 0 }`.

## Interface Contract

```typescript
export function layoutFiles(ast: FilesDiagramAST, measurer: StringMeasurer): FilesGeometry
```

## Acceptance Criteria

- **AC1:** Root-level entries have `depth=0`, `x=0`
- **AC2:** Children of root have `depth=1`, `x=20`; grandchildren `depth=2`, `x=40`
- **AC3:** DFS pre-order: parent entry appears before its children entries
- **AC4:** `y` increments by 22 per entry across the flat output array
- **AC5:** Note entry appears at its DFS position (between its preceding and following siblings)
- **AC6:** `totalHeight = entries.length * ROW_HEIGHT`
- **AC7:** Empty AST returns zero geometry without throwing
- **AC8:** `labelWidth` is positive for non-empty names; measured via the passed-in measurer

## Quality Bar

`npm test -- --run tests/unit/files/layout.test.ts` passes.
`npm run typecheck` and `npm run lint` pass with zero new errors.
90/90/90 coverage on `layout.ts`. Use `FormulaMeasurer` in tests (import from
`../../../src/core/measurer.js`). Write at least 10 tests.

## Commit

`feat(files): add layout engine and layout tests`
