# Batch 2 — Core Foundations (parallel)

Five independent tasks. All depend on Batch 1 (T1) only. No two tasks share
a write target. Run all five in parallel.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|-----------|------|
| T2 | Preprocessor | typescript-pro | `src/core/preprocessor.ts`, `tests/unit/preprocessor.test.ts` | T1 | [ ] |
| T3 | Block extractor + dispatcher | typescript-pro | `src/core/block-extractor.ts`, `src/core/dispatcher.ts`, `tests/unit/block-extractor.test.ts` | T1 | [ ] |
| T4 | SVG primitives | typescript-pro | `src/core/svg.ts`, `tests/unit/svg-primitives.test.ts` | T1 | [ ] |
| T5 | Creole parser | typescript-pro | `src/core/creole.ts`, `tests/unit/creole.test.ts` | T1 | [ ] |
| T6 | Theme + measurer | typescript-pro | `src/core/theme.ts`, `src/core/measurer.ts`, `tests/unit/measurer.test.ts` | T1 | [ ] |

After all five complete, run quality gates before proceeding to Batch 3.
