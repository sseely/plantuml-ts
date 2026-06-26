# Batch 3 — Layouts (parallel)

Four independent layout tasks. Each depends on the ELK adapter (T2) and its
diagram type's parser task from Batch 2.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|-----------|------|
| T8 | Class layout | typescript-pro | `src/diagrams/class/layout.ts`, `tests/unit/class/layout.test.ts` | T2, T4 | [ ] |
| T9 | Component layout | typescript-pro | `src/diagrams/component/layout.ts`, `tests/unit/component/layout.test.ts` | T2, T5 | [ ] |
| T10 | State layout | typescript-pro | `src/diagrams/state/layout.ts`, `tests/unit/state/layout.test.ts` | T2, T6 | [ ] |
| T11 | Use case layout | typescript-pro | `src/diagrams/usecase/layout.ts`, `tests/unit/usecase/layout.test.ts` | T2, T7 | [ ] |

After all four complete, run quality gates before starting Batch 4.
