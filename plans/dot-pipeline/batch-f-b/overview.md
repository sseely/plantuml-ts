# Batch F-B — Integration

Two tasks that wire the F-A libraries into the pipeline. T18 and T19 can run
in parallel — T18 touches splines.ts; T19 touches index.ts. No overlap.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T18 | splines pathplan integration — wire pathplan into edge routing | typescript-pro | `src/core/dot/splines.ts` | T14, T15, Batch E | [x] |
| T19 | xlabel wiring — wire label/ into layout pipeline | typescript-pro | `src/core/dot/index.ts`, `src/core/dot/types.ts` | T17, Batch E | [x] |

Run T18 and T19 in parallel.

**Visual QA gate after T19 (final):** `pnpm visual:compare` + plantuml-visual-qa
dot section. This is the final gate before the mission is complete.
