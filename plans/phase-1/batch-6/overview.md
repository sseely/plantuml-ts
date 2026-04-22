# Batch 6 — Public API + Demo App (parallel)

Two independent tasks. Both depend on Batch 5 (T9). No shared write targets.
Run both in parallel.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|-----------|------|
| T10 | Public API + integration tests | typescript-pro | `src/index.ts` (full impl), `tests/integration/sequence.test.ts`, `tests/integration/canonical-examples.test.ts`, `tests/helpers/render.ts`, `tests/helpers/svg-assertions.ts`, `tests/fixtures/sequence/` (5-8 .puml files) | T9 | [x] |
| T11 | Demo app | frontend-developer | `demo/vite.config.ts`, `demo/index.html`, `demo/app.ts`, `demo/style.css`, `demo/examples/sequence/canonical.puml` | T9 | [x] |

After both complete, run full quality gates. This is the final batch.
