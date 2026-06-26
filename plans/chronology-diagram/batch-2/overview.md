# Batch 2 — Parser, Layout, Renderer (Parallel)

Three tasks with no write-set conflicts. Launch all three simultaneously.
All three read `src/diagrams/chronology/ast.ts` from Batch 1.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T2 | Parser + parser tests | typescript-pro | `src/diagrams/chronology/parser.ts`, `tests/unit/chronology/parser.test.ts` | T1 | [ ] |
| T3 | Layout + layout tests | typescript-pro | `src/diagrams/chronology/layout.ts`, `tests/unit/chronology/layout.test.ts` | T1 | [ ] |
| T4 | Renderer + renderer tests | typescript-pro | `src/diagrams/chronology/renderer.ts`, `tests/unit/chronology/renderer.test.ts` | T1 | [ ] |

Run quality gates after all three complete. All four must pass.
