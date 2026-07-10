# Batch 6 — Ratchet: infra, then expansion

Two sequential tasks (shared files: ratchet.json, goldens, the ratchet
test). T18 builds the gate and seeds it; T19 grows it and triages the
residue.

| ID | Description | Agent | Writes | Depends On | Done |
|----|--------------|-------|--------|------------|------|
| T18 | Ratchet infra + seed fixtures (D11) | typescript-pro (sonnet) | tests/oracle/svg-conformance/description.golden.ratchet.test.ts, oracle/goldens/svg-description/** | T17 | [x] |
| T19 | Expansion + divergence triage (iterate until dry) | typescript-pro (sonnet) or orchestrator-driven | oracle/goldens/svg-description/**, src/** port-bug fixes (ASK per file), oracle/accepted-divergences.json (maintainer sign-off ONLY) | T18 | [x] |

## Quality gates
Mission-level gates; from T18 on, the ratchet is part of `npm test`.

## Next
Mark T18/T19 `[x]`, commit, proceed to Batch 7.
