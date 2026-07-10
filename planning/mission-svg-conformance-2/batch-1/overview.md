# Batch 1 — Foundations: seed ∥ metrics ∥ symbol base

Three independent tasks with disjoint write-sets — run in parallel.

| ID | Description | Agent | Writes | Depends On | Done |
|----|--------------|-------|--------|------------|------|
| T1 | bigint seed in SvgGraphicsCore (D8) | typescript-pro (sonnet) | src/core/klimt/drawing/svg/svg-graphics-core.ts, tests/unit/core/klimt/svg-graphics.test.ts | — | [x] |
| T2 | Jar font-metrics extraction → data table (D12) | typescript-pro (sonnet) | scripts/extract-jar-font-metrics/**, src/core/measurer-jar.data.ts | — | [x] |
| T3 | USymbol/SymbolContext/TextBlock base plumbing (D9) | typescript-pro (sonnet) | src/core/decoration/symbol/{USymbol,SymbolContext,…}.ts, tests/unit/core/decoration/symbol-base.test.ts | — | [x] |

## Quality gates
Mission-level gates from `../README.md` after all three land.

## Next
Mark T1/T2/T3 `[x]` here and in `../README.md`, commit (one per task),
proceed to Batch 2.
