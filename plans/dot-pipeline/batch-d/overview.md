# Batch D — Clusters

Three tasks. T8 and T9 are new standalone files (parallel). T10 integrates
them into the existing pipeline (sequential, after T8+T9).

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T8 | cluster.ts — subgraph cluster handling | typescript-pro | `src/core/dot/cluster.ts`, `tests/unit/dot/cluster.test.ts` | Batch C | [x] |
| T9 | compound.ts — compound edge routing | typescript-pro | `src/core/dot/compound.ts`, `tests/unit/dot/compound.test.ts` | Batch C | [x] |
| T10 | Cluster integration — wire into rank, mincross, position, index | typescript-pro | `src/core/dot/rank.ts`, `src/core/dot/mincross.ts`, `src/core/dot/position.ts`, `src/core/dot/index.ts`, `src/core/dot/types.ts` | T8, T9 | [x] |

Run T8 and T9 in parallel. T10 runs after both.

**Visual QA gate after T10:** `pnpm visual:compare` + plantuml-visual-qa dot section.
