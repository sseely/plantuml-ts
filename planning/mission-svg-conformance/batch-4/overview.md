# Batch 4 — Drivers + UGraphicSvg

Single task: the per-primitive serializer drivers and the `UGraphicSvg`
assembly that binds model → drivers → SvgGraphics.

| ID | Description | Agent | Writes | Depends On | Done |
|----|--------------|-------|--------|------------|------|
| T5 | Port Driver*Svg (rect/ellipse/line/polygon/path/dotpath/text) + UGraphicSvg; deferred stubs | typescript-pro (sonnet) | src/core/klimt/drawing/svg/driver-*.ts, src/core/klimt/drawing/svg/u-graphic-svg.ts, tests/unit/core/klimt/drivers.test.ts | T3, T4 | [ ] |

## Quality gates
Mission-level gates from `../README.md`. DOT parity 357/234/59.

## Next
Mark T5 `[x]`, commit, proceed to Batch 5 (T6 ∥ T7).
