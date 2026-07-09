# Decision journal

Appended during execution. One row per non-trivial judgment call (a
reasonable developer might have chosen differently), per quality-gate
result, per write-set-expansion request, and per stop-condition trigger.

| Date | Task | Decision / event | Rationale | Outcome |
|------|------|------------------|-----------|---------|
| 2026-07-09 | — | Batch 1 plan: T1 (harness, tests/oracle/svg-conformance + package.json) ∥ T2 (klimt model, src/core/klimt + tests/unit/core/klimt) as parallel typescript-pro (sonnet) agents; write-sets disjoint per overview. Branch `feature/klimt-svg-emitter` created off main; baseline typecheck green. | Autonomous-mode parallelism rule: journal plan instead of user review. | launched |
| 2026-07-09 | T1 | Harness adaptations: (1) `style="k:v"` resolved into attrs, style wins, then dropped; (2) `data-*` stripped; (3) comment/PI skipping kept + tested at depth. `TOLERANCES` trimmed to `{deterministic: 0.01}` — graphviz-ts's `iterative` class + engine map have no analog here. In-source vitest block moved to standalone test files (repo glob). Unreachable strict-mode branches annotated `/* v8 ignore */` with justification instead of contrived tests. | Faithful port; D6/D7 honored; deviations are mechanical. | e4a0d7f |
| 2026-07-09 | T2 | Paint-for-HColor seam: `UParam.getColor()`/`getBackcolor()` carry `Paint`; `HColors.none()` → `'none'` keyword. Upstream `HColor implements UChange` can't map to a plain union type → invented `UForeground`/`Fore` mirroring real upstream `UBackground`/`Back`. `UDriver`+dispatch registry folded into AbstractCommonUGraphic.ts (upstream splits into AbstractUGraphic<O>); driver signature reduced to (shape,param). UClip/UPattern/UHidden stubbed by omission. UTranslate geometry helpers needing unported XPoint2D/XRectangle2D dropped. | Pre-decided seam (decisions.md); inventions journaled per brief. | 2556486 |
| 2026-07-09 | B1 | Quality gates: typecheck ✓, test 3801/3801 ✓ (90/90/90 met), lint ✓, build ✓, DOT parity 357/234/59 ✓, write-set diff exact ✓. | — | batch 1 complete |
