# Batch 1 — Infrastructure + Parser

Two independent tasks run in parallel. Neither writes the same file.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T1 | Core infra: DiagramType + theme | typescript-pro | `src/core/block-extractor.ts`, `src/core/theme.ts` | — | [x] |
| T2 | AST + parser | typescript-pro | `src/diagrams/json/ast.ts`, `src/diagrams/json/parser.ts`, `tests/unit/json/parser.test.ts` | — | [x] |

Both tasks can start immediately. T3 (layout) requires both to be complete.
