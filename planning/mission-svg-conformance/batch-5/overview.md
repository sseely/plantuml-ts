# Batch 5 — Conformance suite ∥ docs + charter

Two parallel tasks with disjoint write-sets. T6 proves the emitter fully
conformant and bootstraps the divergence ledger; T7 documents the
methodology and writes Brief 2's charter.

| ID | Description | Agent | Writes | Depends On | Done |
|----|--------------|-------|--------|------------|------|
| T6 | Emitter conformance suite + ledger bootstrap | typescript-pro (sonnet) | tests/oracle/svg-conformance/emitter.golden.test.ts, oracle/goldens/svg-conformance/**, oracle/accepted-divergences.json | T1, T5 | [x] |
| T7 | Docs (conformance methodology) + catalog + Brief 2 charter | typescript-pro (sonnet) | docs/svg-conformance.md, .claude/catalog.md, planning/mission-svg-conformance-2/README.md | — | [x] |

## Quality gates
Mission-level gates from `../README.md`. T6's suite itself becomes part of
`npm test` — it must be green AND fully conformant before this batch closes.

## Next
Mark T6/T7 `[x]`, commit (one per task), run final full gates, write the
mission summary in `../README.md`.
