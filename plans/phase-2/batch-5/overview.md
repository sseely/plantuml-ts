# Batch 5 — Public API + Demo App (parallel)

Two independent tasks. Both depend on all of Batch 4 (T12–T15) and T1.
No shared write targets.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|-----------|------|
| T16 | Public API update + integration tests | typescript-pro | `src/index.ts`, `tests/integration/class.test.ts`, `tests/integration/component.test.ts`, `tests/integration/state.test.ts`, `tests/integration/usecase.test.ts`, `tests/fixtures/class/*.puml`, `tests/fixtures/component/*.puml`, `tests/fixtures/state/*.puml`, `tests/fixtures/usecase/*.puml` | T1, T12–T15 | [x] |
| T17 | Demo app updates | frontend-developer | `demo/index.html`, `demo/app.ts`, `demo/examples/class/canonical.puml`, `demo/examples/component/canonical.puml`, `demo/examples/state/canonical.puml`, `demo/examples/usecase/canonical.puml` | T12–T15 | [x] |

After both complete, run quality gates before starting Batch 6.
