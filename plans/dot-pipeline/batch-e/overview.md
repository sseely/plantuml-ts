# Batch E — Routing helpers

Three independent tasks. All can run in parallel — no write-set overlap.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T11 | sameport.ts + splines update — same-side port routing | typescript-pro | `src/core/dot/sameport.ts`, `src/core/dot/splines.ts`, `tests/unit/dot/sameport.test.ts` | Batch D | [ ] |
| T12 | conc.ts + rank update — edge concentration | typescript-pro | `src/core/dot/conc.ts`, `src/core/dot/rank.ts`, `tests/unit/dot/conc.test.ts` | Batch D | [ ] |
| T13 | aspect.ts + index update — aspect ratio adjustment | typescript-pro | `src/core/dot/aspect.ts`, `src/core/dot/index.ts`, `tests/unit/dot/aspect.test.ts` | Batch D | [ ] |

Run T11, T12, T13 in parallel.

**Visual QA gate after T13:** `pnpm visual:compare` + plantuml-visual-qa dot section.
