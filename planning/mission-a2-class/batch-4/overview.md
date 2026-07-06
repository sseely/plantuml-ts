# Batch 4 — `newpage` shared-infra (multi-graph)

Cross-cutting: `newpage` splits a source into multiple pages/graphs. Fixes ~158
graph-count mismatches across ALL diagram types. Disjoint files from the layout
chain, so it may run in parallel with batch-2/3, but its **full-suite gate** is
mandatory (touches shared `block-extractor.ts`).

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|-----------|------|
| T6 | `newpage` → multi-page render path | typescript-pro | `src/core/block-extractor.ts`, `src/index.ts`, `tests/unit/core/*` | — | [ ] |

Gate after: **FULL** `npm test` (cross-type regression guard) + typecheck + lint.
STOP if another diagram type's tests break.
