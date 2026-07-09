# Batch 1 — Harness ∥ klimt model core

Two independent tasks with disjoint write-sets — run in parallel. T1 is the
comparison instrument (tests/oracle + package.json); T2 is the drawing-model
root every later batch builds on (src/core/klimt).

| ID | Description | Agent | Writes | Depends On | Done |
|----|--------------|-------|--------|------------|------|
| T1 | Near-verbatim harness port (normalize + compare) + xmldom devDep | typescript-pro (sonnet) | tests/oracle/svg-conformance/normalize.ts, compare.ts, normalize.test.ts, compare.test.ts, package.json, package-lock.json | — | [x] |
| T2 | klimt model core: UGraphic state chain | typescript-pro (sonnet) | src/core/klimt/{UGraphic,AbstractCommonUGraphic,UParam,UTranslate,UStroke,UChange,UShape}.ts + tests/unit/core/klimt/model.test.ts | — | [x] |

## Quality gates
Mission-level gates from `../README.md` after both land. DOT parity must
read 357/234/59 (nothing here has consumers).

## Next
Mark T1/T2 `[x]` here and in `../README.md`, commit (one per task),
proceed to Batch 2.
