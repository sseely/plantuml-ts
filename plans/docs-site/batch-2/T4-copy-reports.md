# T4 — copy-reports pipeline

## Context
Model: `~/git/graphviz-ts/docs-site/copy-reports.mjs` (read whole —
mirror + per-source link-rewrite table, gitignored copies, wired as
the first step of docs:dev/docs:build).

## Task
`docs-site/copy-reports.mjs`: mirror `docs/parity-report.md` →
`docs-site/parity.md` and `DIVERGENCES.md` → `docs-site/divergences.md`,
rewriting repo-relative links to site paths (e.g. a parity-report link
to DIVERGENCES.md → `/divergences`). Replace T3's stubs. Wire
`docs:copy-reports` into `docs:dev`/`docs:build` (graphviz-ts pattern).
Gitignore the two mirrored copies (sources are the originals — put a
header comment in each copy saying so).

## Write-set
- docs-site/copy-reports.mjs, package.json, .gitignore
- docs-site/parity.md + docs-site/divergences.md become generated
  (delete the T3 stubs)

## Read-set
- ~/git/graphviz-ts/docs-site/copy-reports.mjs (whole)
- docs/parity-report.md (T1 output), DIVERGENCES.md (T2 shape)
- ~/git/graphviz-ts/package.json:43-46 (script wiring)

## Acceptance criteria
- Given `npm run docs:build`, when run, then the site contains parity
  + divergences pages whose content matches the committed sources with
  links rewritten.
- Given the mirrored copies, then git status shows them ignored.

## Observability
N/A.

## Rollback
Reversible.

## Commit
`feat(docs): copy-reports pipeline for parity + divergences pages`
