# Batch 5 — Sequence Renderer

Single task. Depends on T4 (SVG primitives), T5 (Creole), T7 (AST + Geometry
types), and T8 (layout). All prior batches must be complete.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|-----------|------|
| T9 | Sequence renderer + plugin wiring | typescript-pro | `src/diagrams/sequence/renderer.ts`, `src/diagrams/sequence/index.ts`, `tests/unit/sequence/renderer.test.ts` | T4, T5, T7, T8 | [x] |

After T9 completes, run quality gates before proceeding to Batch 6.
