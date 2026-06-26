# Batch 4 — Renderers + Plugin Wiring (parallel)

Four independent renderer tasks. Each depends on its diagram type's layout
task (Batch 3) and the SVG/theme additions (T3).

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|-----------|------|
| T12 | Class renderer + plugin wiring | typescript-pro | `src/diagrams/class/renderer.ts`, `src/diagrams/class/index.ts`, `tests/unit/class/renderer.test.ts` | T3, T8 | [x] |
| T13 | Component renderer + plugin wiring | typescript-pro | `src/diagrams/component/renderer.ts`, `src/diagrams/component/index.ts`, `tests/unit/component/renderer.test.ts` | T3, T9 | [x] |
| T14 | State renderer + plugin wiring | typescript-pro | `src/diagrams/state/renderer.ts`, `src/diagrams/state/index.ts`, `tests/unit/state/renderer.test.ts` | T3, T10 | [x] |
| T15 | Use case renderer + plugin wiring | typescript-pro | `src/diagrams/usecase/renderer.ts`, `src/diagrams/usecase/index.ts`, `tests/unit/usecase/renderer.test.ts` | T3, T11 | [x] |

After all four complete, run quality gates before starting Batch 5.
