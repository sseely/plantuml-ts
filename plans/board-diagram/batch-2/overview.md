# Batch 2 — Parser + Layout (parallel)

Both tasks read T1's `ast.ts` but write different files. Run in parallel.

## Tasks

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T3 | Parser + parser tests | typescript-pro | `src/diagrams/board/parser.ts`, `tests/unit/board/parser.test.ts` | T1 | [ ] |
| T4 | Layout + layout tests | typescript-pro | `src/diagrams/board/layout.ts`, `tests/unit/board/layout.test.ts` | T1 | [ ] |

## Interface contracts produced

### T3 → consumed by T5 (renderer)

```typescript
// parser.ts exports:
export function parseBoard(source: UmlSource): BoardDiagramAST
```

### T4 → consumed by T5 (renderer)

```typescript
// layout.ts exports:
export function layoutBoard(ast: BoardDiagramAST): BoardGeometry
```

`BoardGeometry` structure defined in `decisions.md#A` and `batch-1/overview.md`.
