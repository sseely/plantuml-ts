# Decision journal

Appended during execution. One row per non-trivial judgment call, per
quality-gate result, per write-set-expansion request, and per
stop-condition trigger.

| Date | Task | Decision / event | Rationale | Outcome |
|------|------|------------------|-----------|---------|
| 2026-07-09 | B1 | Execution plan: T1 ∥ T2 ∥ T3 as parallel typescript-pro (sonnet) agents; disjoint write-sets verified from task specs. Agents do NOT commit — orchestrator commits one per task after batch gates, avoiding concurrent index locks. | Parallelism rules + disjoint files; concurrent `git commit` races on `.git/index`. | done |
| 2026-07-09 | T1 | Seed widened to `bigint \| number` (not bigint-only); `seedOf` exported from svg-graphics-core.ts (upstream locates hash in UmlSource — T17 may relocate). Verified jar pair: gradient id `ga1lkcxsvvc1d0` ↔ seed −1322063392101289393. Pre-existing doc-comment prose trimmed to stay under the 500-line hook. | Widening keeps Brief 1 call sites compiling byte-identical; hash is upstream `UmlSource.seed()` (distinct from `StringUtils.seed`). | done |
| 2026-07-09 | T2 | Extraction scheme: per-point (1pt-normalized) SansSerif table, fractional `getStringBounds` metrics (FRACTIONALMETRICS+ANTIALIASING on) — NOT `charWidth` ints. Verified linear scaling to 1e-15 and zero kerning (per-glyph sums == whole-string bounds). `fallbackAdvance` = mean of 560 measured advances. JVM: openjdk 21.0.1 (Microsoft), macOS. | Jar's `StringBounderSvg`/`StringBounderAwt` use fractional bounds; per-point table is additive-exact. | done |
| 2026-07-09 | T3 | Write-set expansion: new `src/core/klimt/geom/` (XDimension2D, HorizontalAlignment, MagneticBorder{,None}) + `src/core/klimt/font/StringBounder.ts` — required for USymbol's pinned asSmall/asBig signatures. Covered by push-forward clause "TextBlock-seam surface details in T3". TextBlock seam = drawU + calculateDimension + optional getMagneticBorder; getMinMax/getInnerPosition/getBackcolor dropped (no caller). USymbolSimpleAbstract deferred (pulls unported UGraphicStencil). SName = string alias, not the 100-member enum. SymbolContext ported from historical graphic/SymbolContext.java (== current klimt/Fashion.java). | Minimal upstream-named seam beats stubbing signatures; enum deferred until a constructor exists. | done |
| 2026-07-09 | B1 gates | typecheck ✓, npm test 133/133 files + coverage thresholds ✓ (exit 0), lint ✓, build ✓, DOT parity 357/234/59 (== floor) ✓, write-set audit ✓. | — | pass |
