# Batch 2 — Type + primitive layer

Two tasks, both depending only on T1's exported types (`Paint`, `Gradient`,
`parseColor`, `paintToSvg`). T2 and T3 write disjoint files (`src/core/svg.ts`
vs `src/core/theme.ts`) — run them in parallel per `~/.claude/rules/parallelism.md`.

| ID | Description | Agent | Writes | Depends On | Done |
|----|--------------|-------|--------|------------|------|
| T2 | svg.ts primitives accept Paint + emit gradient defs | typescript-pro (sonnet) | src/core/svg.ts, src/core/svg.test.ts (or existing test file) | T1 | [x] |
| T3 | Theme colors→Paint type, per-element buckets, resolveElementPaint (KEEP #FEFECE default) | typescript-pro (sonnet) | src/core/theme.ts, src/core/theme.test.ts | T1 | [x] |

## Sequencing note
T3 must **not** change the default fill/border colors in this batch — the
default-skin flip is D2, isolated to T9 (Batch 5) so every prior batch stays
green under the old `#FEFECE`/`#A80036` default. T3 only adds the
`Paint`-typed per-element bucket machinery and `resolveElementPaint`; it does
not recolor anything yet.

## Quality gates
Run the mission-level gates from `../README.md` after both T2 and T3 land
(typecheck, test, lint, build, DOT parity, write-set diff). DOT parity must
still read 350/221/41 — this batch touches only the primitive/type layer,
not layout.

## Next
On completion, mark T2 and T3 `[x]` here and in `../README.md`, commit
(one commit per task), then proceed to Batch 3 (`../batch-3/overview.md`).
