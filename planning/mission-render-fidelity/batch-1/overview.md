# Batch 1 — Paint foundation

Single-task batch. T1 creates the `Paint` color/gradient model (D1) that every
later batch imports. Nothing else in this mission can start until T1's
exported types and functions exist — it is the root dependency of the whole
mission (see README.md batch table).

| ID | Description | Agent | Writes | Depends On | Done |
|----|--------------|-------|--------|------------|------|
| T1 | Create the Paint color/gradient model | typescript-pro (sonnet) | src/core/paint.ts, src/core/paint.test.ts | — | [ ] |

## Quality gates
Run the mission-level gates from `../README.md` after T1 lands (typecheck,
test, lint, build, DOT parity, write-set diff).

## Next
On completion, mark T1 `[x]` here and in `../README.md`, commit, then proceed
to Batch 2 (`../batch-2/overview.md`) — T2 and T3 both depend only on T1.
