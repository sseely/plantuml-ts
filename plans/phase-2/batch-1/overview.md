# Batch 1 — Core Infrastructure (parallel)

Three independent tasks with no shared write targets. All can run in parallel.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|-----------|------|
| T1 | Plugin interface split (SyncPlugin/AsyncPlugin union) | typescript-pro | `src/core/dispatcher.ts`, `src/index.ts`, `tests/unit/dispatcher.test.ts` | — | [x] |
| T2 | ELK adapter | typescript-pro | `src/core/elk-adapter.ts`, `tests/unit/elk-adapter.test.ts` | — | [x] |
| T3 | SVG primitives + theme graph colors | typescript-pro | `src/core/svg.ts`, `src/core/theme.ts`, `tests/unit/svg.test.ts`, `tests/unit/theme.test.ts` | — | [x] |

After all three complete, run quality gates before starting Batch 2.
