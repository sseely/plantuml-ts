# T16 — Overlay triage report

## Context
The successor to the raster diff workflow: for a given fixture, produce
a single HTML file overlaying our SVG and the jar's (opacity/side-by-side
toggles) plus the harness's `Diff[]` list, for human triage of
non-conformant cases. Driven by the SVG harness, no pixels, no
playwright.

## Task
`scripts/svg-overlay-report.ts <type>/<slug> [...more]`: renders ours,
loads the cached jar `in.svg`, runs `compareSvg`, writes
`test-results/svg-overlay/<slug>.html` — both SVGs inline (ours tinted
via CSS filter), a diff table (path, expected, actual, delta), toggle
controls (pure inline JS/CSS, self-contained file). A `--from-parity`
mode reads `parity.json` (T15) and generates reports for every
`diverged` fixture.

## Write-set
- `scripts/svg-overlay-report.ts`
- `tests/unit/scripts/svg-overlay.test.ts`

## Read-set
- `tests/oracle/svg-conformance/{compare,normalize}.ts`
- `scripts/dot-sync-report.ts` (cache reading)
- T15's parity.json shape (`batch-4/T15-survey-dashboard.md`
  interface contract)

## Acceptance criteria
1. Given a diverged fixture, when the report generates, then the HTML
   contains both SVGs, the diff table, and opens standalone (no external
   requests).
2. Given `--from-parity` with two diverged rows, then two reports are
   written.
3. Given a conformant fixture, then the report says so and shows zero
   diffs.

## Observability / Rollback
N/A — tooling. / Reversible.

## Quality bar
Standard gates green. Output dir `test-results/` is gitignored (verify;
journal if not).

## Commit
`feat(T16): svg overlay triage report`
