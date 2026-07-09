# Batch 5 — Default-skin flip (isolated churn)

Single task, runs last, after every other batch is green under the old
`#FEFECE`/`#A80036` default. See README.md "Sequencing rationale" for why
this recolor is isolated to the final batch.

| ID | Description | Agent | Writes | Depends On | Done |
|----|--------------|-------|--------|------------|------|
| T9 | Adopt upstream grey default skin + refresh baselines + DIVERGENCES | typescript-pro (sonnet) | `src/core/theme.ts` (default VALUES only), `DIVERGENCES.md`, + all color-asserting test baselines across the suite | T7, T8 | [x] |

## STOP condition
If the set of test files requiring edits exceeds **~20 files**, STOP and
re-scope before mass-editing. Exceeding that surface signals the default
flip is touching more than color assertions (e.g. layout, geometry, or
snapshot structure), which would mean the change is not actually isolated
to D2 and needs a fresh scoping pass rather than a mechanical push-through.

## Quality gates
Run the mission-level gates from `README.md` after this task lands:
`npm run typecheck && npm test && npm run lint && npm run build`, plus the
DOT-parity probe (350/221/41 unchanged) and the visual gap harness on
cacoma/lojiga.
