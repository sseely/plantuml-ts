# Batch 2 — Parser, Layout, Renderer (Parallel)

Three tasks with no write-set conflicts. Launch all three simultaneously.
All read `src/diagrams/files/ast.ts` from Batch 1.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T2 | Parser + parser tests | typescript-pro | `src/diagrams/files/parser.ts`, `tests/unit/files/parser.test.ts` | T1 | [ ] |
| T3 | Layout + layout tests | typescript-pro | `src/diagrams/files/layout.ts`, `tests/unit/files/layout.test.ts` | T1 | [ ] |
| T4 | Renderer + renderer tests | typescript-pro | `src/diagrams/files/renderer.ts`, `tests/unit/files/renderer.test.ts` | T1 | [ ] |

Run all four quality gates after all three complete.
