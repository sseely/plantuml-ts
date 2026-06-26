# Batch 2 — AST + Parsers (parallel)

Four independent parser tasks. All depend on Batch 1. No shared write targets.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|-----------|------|
| T4 | Class diagram AST + parser | typescript-pro | `src/diagrams/class/ast.ts`, `src/diagrams/class/parser.ts`, `tests/unit/class/parser.test.ts` | T1, T3 | [x] |
| T5 | Component diagram AST + parser | typescript-pro | `src/diagrams/component/ast.ts`, `src/diagrams/component/parser.ts`, `tests/unit/component/parser.test.ts` | T1, T3 | [x] |
| T6 | State diagram AST + parser | typescript-pro | `src/diagrams/state/ast.ts`, `src/diagrams/state/parser.ts`, `tests/unit/state/parser.test.ts` | T1, T3 | [x] |
| T7 | Use case diagram AST + parser | typescript-pro | `src/diagrams/usecase/ast.ts`, `src/diagrams/usecase/parser.ts`, `tests/unit/usecase/parser.test.ts` | T1, T3 | [x] |

After all four complete, run quality gates before starting Batch 3.
