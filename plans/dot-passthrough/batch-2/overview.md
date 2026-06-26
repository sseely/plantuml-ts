# Batch 2 — Layout + Layout Tests

## Description

Convert `DotDiagramAST` to `DotGeometry` by measuring nodes, building a
`DotInputGraph`, running the Sugiyama layout engine (`src/core/dot/`), and
mapping the result back to geometry types. Write unit tests.

Depends on Batch 1 (T1) for the AST types.

## Tasks

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T2 | Layout function + layout tests | typescript-pro | `src/diagrams/dot/layout.ts`, `tests/unit/dot/layout.test.ts` | T1 | [x] |

## Notes

- T2 is the only task — no parallelism needed.
- After T2 completes, run all four quality gates before starting Batch 3.
