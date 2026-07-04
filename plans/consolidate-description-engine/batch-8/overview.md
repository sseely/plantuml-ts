# Batch 8 — Cutover (Phase 3)

Register the new engine, delete the two old plugins, migrate remaining tests,
update the catalog and `DiagramType` union. One atomic logical change.

| ID | Description | Agent | Writes | Deletes | Depends On | Done |
|----|-------------|-------|--------|---------|-----------|------|
| T8 | Register + delete + migrate | typescript-pro | `src/index.ts`, `src/core/block-extractor.ts`, `.claude/catalog.md` | `src/diagrams/component/**`, `src/diagrams/usecase/**`, `tests/unit/component/**`, `tests/unit/usecase/**`, `tests/integration/{component,usecase}.test.ts` | T7 | [x] |

See [T8-cutover.md](T8-cutover.md).
