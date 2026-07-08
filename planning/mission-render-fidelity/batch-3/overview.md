# Batch 3 — Skinparam + geometry

Three tasks, all depending only on Batch 2 outputs (T2's Paint-aware svg
primitives, T3's `Paint`-typed theme + per-element buckets +
`resolveElementPaint`). Each task writes a disjoint file — run all three in
parallel per `~/.claude/rules/parallelism.md`.

| ID | Description | Agent | Writes | Depends On | Done |
|----|--------------|-------|--------|------------|------|
| T4 | Parse gradient skinparam values → Paint; map per-element keys → buckets | typescript-pro (sonnet) | src/core/skinparam.ts, src/core/skinparam.test.ts | T1, T3 | [x] |
| T5 | Route element-scoped style-block entries into per-element buckets | typescript-pro (sonnet) | src/core/style-map-theme.ts, src/core/style-map-theme.test.ts | T3 | [x] |
| T6 | Rewrite the 4 USymbol icon geometries faithfully + per-element color | typescript-pro (sonnet) | src/core/usymbol-shapes.ts, src/core/usymbol-shapes.test.ts | T2, T3 | [x] |

## Sequencing note
All three tasks only read from T3's exported `resolveElementPaint` /
bucket shape and (T4 only) T1's `parseColor` — none of them touch
`svg.ts` or `theme.ts` directly, so there is no write-set overlap with
Batch 2 or with each other.

## Quality gates
Run the mission-level gates from `../README.md` after all three tasks land
(typecheck, test, lint, build, DOT parity, write-set diff). DOT parity must
still read 350/221/41 — this batch is skinparam parsing + icon geometry,
not layout.

## Next
On completion, mark T4, T5, T6 `[x]` here and in `../README.md`, commit
(one commit per task), then proceed to Batch 4 (`../batch-4/overview.md`).
