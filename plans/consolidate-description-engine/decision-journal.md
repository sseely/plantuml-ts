# Decision Journal

Appended during execution. One row per non-trivial judgment call.

| Date | Batch/Task | Decision | Rationale |
|------|-----------|----------|-----------|
| 2026-06-26 | infra | Switch package manager pnpm → npm (per user). Regenerated lockfile, updated brief gate commands. | User directive mid-Batch-1; gates re-verified green under npm. |
| 2026-06-26 | B1/T1 | Include upstream `portin`/`portout` in `ALL_TYPES`, both mapping to `USymbol 'port'`. | D2 wants the *complete* ALL_TYPES; the locked USymbol contract stops at `port`. Folding the two keywords onto `port` keeps classification faithful without widening the contract type. |
| 2026-06-26 | B1/T1 | Handled T1 directly instead of dispatching typescript-pro. | Single small fully-specified foundational module; correctness of the upstream ALL_TYPES mapping is load-bearing for all downstream batches, so verified it first-hand. |
| 2026-06-26 | B2/T2 | Test drives the singleton registry via side-effect import of `src/index.js` + `extractBlocks`, not a hand-built registry. | Faithful to the "real registry" requirement and immune to registration-order drift. cocice resolves to `component` post-guard (correct pre-merge). All 4 gates green; Phase 1 complete. |
