# T15 — Survey → parity.json + PARITY-SVG.md dashboard

## Context
The PARITY-style corpus dashboard (charter gate design): a survey runs
every corpus fixture through our pipeline, compares against the cached
jar SVG, and writes per-fixture verdicts to `parity.json`; a dashboard
renders that to markdown, exactly as graphviz-ts's
`test/corpus/dashboard.ts` renders `PARITY.md`. Report, not a gate.

## Task
1. `scripts/svg-parity-survey.ts`: iterate
   `test-results/dot-cache/{component,usecase}/*/` (each dir has the
   source + `in.svg`; check dir contents for the source-file convention
   — dot-sync-report.ts shows how to read the cache). For each fixture:
   render ours (renderSync), `compareSvg` vs `in.svg`, emit a verdict
   row: `conformant | structural-match | diverged | oracle-error |
   errored | timeout` (structural-match = same normalized tree shape,
   numeric diffs beyond band; port the verdict logic graviz-ts's survey
   uses where applicable — read `~/git/graphviz-ts/test/corpus/survey.test.ts`).
   Per-fixture timeout (default 10s) → `timeout`. Also record the DOT-
   EQUAL status from the dot-sync data so T18/T19 can filter eligibility.
   Output: `tests/oracle/svg-conformance/parity.json`.
2. `scripts/svg-parity-dashboard.ts`: near-verbatim port of graphviz-ts
   `dashboard.ts` → renders `tests/oracle/svg-conformance/PARITY-SVG.md`
   (totals, per-verdict counts, per-family tables, divergence ledger
   section fed from `oracle/accepted-divergences.json`).
3. `npm` scripts: `svg:survey`, `svg:dashboard` (package.json — journal
   the additions).

## Write-set
- `scripts/svg-parity-survey.ts`, `scripts/svg-parity-dashboard.ts`
- `tests/oracle/svg-conformance/{parity.json,PARITY-SVG.md}` (generated;
  commit the first real run's output)
- `tests/unit/scripts/svg-parity.test.ts` (verdict logic units)
- `package.json` (two scripts)

## Read-set
- `~/git/graphviz-ts/test/corpus/{dashboard.ts,survey.test.ts}` + `PARITY.md` (shape)
- `scripts/dot-sync-report.ts` (cache-reading precedent)
- `tests/oracle/svg-conformance/compare.ts` (harness)

## Interface contracts (consumed by T18/T19)
`parity.json`: `{ generatedAt, fixtures: Array<{ slug, type, verdict,
dotEqual: boolean, firstDiff?: string, maxDelta?: number }> }`.

## Acceptance criteria
1. Given the corpus with the legacy renderer still active, when the
   survey runs, then it completes without crashing and verdicts are
   overwhelmingly `diverged` (expected pre-cutover; proves the
   instrument).
2. Given parity.json, when the dashboard renders, then PARITY-SVG.md
   matches graphviz-ts's structural shape (totals, tables).
3. Given one fixture that throws in render, then its verdict is
   `errored` with the message captured, and the survey continues.

## Observability / Rollback
This IS the observability deliverable. / Reversible.

## Quality bar
Standard gates green. Scripts importing from `tests/oracle/*` is
established precedent.

## Commit
`feat(T15): svg parity survey + PARITY-SVG dashboard`
