# T1 — Parity report generator

## Context
plantuml-ts (vitest, eslint, tsc strict; scripts/ covered by
tsconfig.node.json typecheck). `scripts/dot-sync-report.ts` already has
`--equal-list` and `--slug` modes and per-type aggregation (`Agg`).
Class just hit 680/680 comparable EQUAL. CI cannot run the jar — the
report output is COMMITTED (decisions.md#d1).

## Task
Add an additive `--markdown` mode: for every type manifest in
`tests/visual/data/*.json` that has cached oracle dumps
(`test-results/dot-cache/<type>/`), run the existing aggregation and
write `docs/parity-report.md`: a generated-by header (command + date
placeholder — NO Date.now() in src/, but scripts/ may use it), one
table row per type `{type, comparable, equal, pct, oracle-blind,
note}`, and a short legend explaining EQUAL vs oracle-blind. Types
without cache get a "not yet measured" row — never a failure. Do not
change any existing mode's behavior.

## Write-set
- scripts/dot-sync-report.ts (additive)
- docs/parity-report.md (generated + committed)

## Read-set
- scripts/dot-sync-report.ts (whole)
- ~/git/graphviz-ts/test/corpus/PARITY-dot.md (format inspiration)
- plans/docs-site/decisions.md#d1

## Interface contracts (consumed by T4)
`docs/parity-report.md` — plain markdown, repo-relative links only to
`DIVERGENCES.md` (if any), one `## Parity by diagram type` table.

## Acceptance criteria
- Given `npx tsx scripts/dot-sync-report.ts --markdown`, when it
  completes, then docs/parity-report.md exists with one row per
  cached type and class reads 680/680 (100%).
- Given a manifest type with no cache, then its row reads
  "not yet measured" and the command still exits 0.
- Given existing modes (default, --slug, --equal-list), then their
  output is byte-identical to before.

## Observability
N/A — local script; the committed file is the artifact.

## Rollback
Reversible.

## Commit
`feat(dot-sync): --markdown parity report for the docs site`
