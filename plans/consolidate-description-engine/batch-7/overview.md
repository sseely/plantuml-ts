# Batch 7 — Plugin wiring + integration (Phase 2)

Assembles the engine behind a `SyncPlugin`. **Not yet registered** — registration
is the cutover (Batch 8), to avoid two plugins claiming the same blocks.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|-----------|------|
| T7 | `description/index.ts` + integration test | typescript-pro | `src/diagrams/description/index.ts`, `tests/integration/description.test.ts` | T4, T5, T6 | [x] |

See [T7-plugin-integration.md](T7-plugin-integration.md).
