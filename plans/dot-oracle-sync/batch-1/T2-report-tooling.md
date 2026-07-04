# T2 — Report drill-down + type-generic classification + json/dot probe

## Context

`scripts/dot-sync-report.ts` aggregates parity across a corpus but cannot show
WHY one fixture diverges — during diagnosis we hand-roll dump scripts. It also
only classifies DESCRIPTION fixtures (via `data-diagram-type="DESCRIPTION"` in
cached canonical SVGs under `test-results/visual-qa-svg/canonical/<type>/`),
which exist only for component/usecase.

## Task

1. **`--slug <slug>` mode:** for one fixture print (a) the oracle svek DOT,
   (b) our `toSvekDot` emission, (c) the per-check `StructuralDiff` with the
   failing checks' underlying values (e.g. minlen multisets side by side,
   shape multisets, cluster sizes, rankdir/nodesep/ranksep pairs). This is
   the loop's diagnosis entry point.
2. **Type-generic classification:** accept `--type-tag <TAG>` (default map:
   component/usecase→DESCRIPTION, class/object→CLASS, state→STATE). When
   canonical SVGs are missing for a type, generate them with the oracle jar
   (batch mode, reuse the pattern in `scripts/visual-qa-svg.ts`) into the
   same cache layout, then classify. Manifests come from
   `tests/visual/data/<type>.json` as today (regenerate via
   `npm run visual:classify` if a type's manifest is missing).
3. **json/dot probe:** run the oracle dump on 5 representative `@startjson`
   and `@startdot` fixtures; report whether svek-*.dot files appear. Write
   the finding into `plans/dot-oracle-sync/phase-5-json-dot/probe.md`
   (created by this task). Do not build anything further for those types.

## Read-set

- `scripts/dot-sync-report.ts` (whole), `scripts/visual-qa-svg.ts:1–80`
  (jar batch pattern), `scripts/classify-corpus.ts` (manifest generation)
- `tests/oracle/svek-dot.ts` (T1's extended `StructuralDiff` — coordinate:
  additive fields only)

## Write-set

`scripts/dot-sync-report.ts`, `plans/dot-oracle-sync/phase-5-json-dot/probe.md`

## Acceptance criteria

- Given `--slug babafi-51-dixi026 component`, when run, then both DOTs and a
  per-check value diff print, exit 0.
- Given `npx tsx scripts/dot-sync-report.ts class` on a machine with the
  oracle jar, then class fixtures classify and a report prints (no crash on
  missing canonical cache — it self-builds).
- Given the probe, then probe.md states for json and dot whether the svek
  dump path exists, with the raw evidence (file listing).

## Quality bar

Four gates (script is lint/typecheck-covered; no vitest requirement for the
script itself).

## Observability: N/A. Rollback: Reversible.
