# Batch A — Foundation helpers

Two new files with no dependencies on each other. Both are pure algorithms
that the rest of the pipeline will call.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T1 | fastgr.ts — adjacency list flattening | typescript-pro | `src/core/dot/fastgr.ts`, `tests/unit/dot/fastgr.test.ts` | — | [x] |
| T2 | decomp.ts — connected component decomposition | typescript-pro | `src/core/dot/decomp.ts`, `tests/unit/dot/decomp.test.ts` | — | [x] |

Run T1 and T2 in parallel (no write-set overlap).

After both complete: run `npm test && npm run typecheck && npm run lint && npm run build`.
