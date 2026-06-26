# Batch C — Pipeline refactor

Three tasks. T5 and T6 can run in parallel (different files). T7 must run
after both (it updates index.ts and deletes the edgelabels dead-code).

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T5 | rank.ts refactor — call class1, decomp; remove inline vchain | typescript-pro | `src/core/dot/rank.ts` | Batch B | [x] |
| T6 | mincross.ts + flat.ts — extract flat.ts, call class2 at entry | typescript-pro | `src/core/dot/mincross.ts`, `src/core/dot/flat.ts`, `tests/unit/dot/flat.test.ts` | Batch B | [x] |
| T7 | index.ts cleanup — wire class2, delete edgelabels.ts | typescript-pro | `src/core/dot/index.ts` (delete `edgelabels.ts`, `edgelabels.test.ts`) | T5, T6 | [x] |

Run T5 and T6 in parallel. T7 runs after both.

**Visual QA gate after T7:** `pnpm visual:compare` + plantuml-visual-qa dot section.
After T7: run all four quality gates + visual QA.
