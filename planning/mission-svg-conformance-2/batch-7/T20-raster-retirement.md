# T20 — Retire the raster visual-QA path

## Context
The playwright pixel-diff workflow is subsumed by the SVG conformance
harness + ratchet + overlay reports. Charter retirement scope, paths
verified 2026-07-09.

## Precondition (STOP if it fails)
Before deleting anything: enumerate the diagram types covered by
`tests/visual/reference/**` (28 subdirs) and compare against what the
ratchet + Brief 1 goldens now gate. The raster path covered ALL diagram
types; the SVG ratchet covers description-engine types only. The
retirement is still authorized (maintainer charter decision) **provided**
the raster spec's description/component/usecase coverage is subsumed —
for other diagram types the raster path was already advisory-only.
Verify `compare.spec.ts` is not load-bearing in CI for non-description
types (check CI config / package.json test wiring); if it is, STOP and
present the gap.

## Task
1. Delete: `tests/visual/compare.spec.ts`,
   `tests/visual/playwright-visual.config.ts`,
   `tests/visual/capture-reference.ts`, `tests/visual/reference/**`,
   `scripts/visual-qa-svg.ts`.
2. Remove the `visual:compare` script from `package.json`.
3. Sweep for dangling references:
   `grep -r "visual-qa-svg\|capture-reference\|playwright-visual\|visual:compare"`
   across the repo (docs, CI, scripts, agents config) — fix or flag each.
4. Do NOT touch: `scripts/visual-qa-dot.ts`, root `playwright.config.ts`,
   `visual:classify/capture/build/upload`, `scripts/capture-corpus.ts`,
   `scripts/upload-references.ts` (explicitly out of scope, maintainer
   2026-07-09).

## Write-set
- Deletions listed above + `package.json`

## Read-set
- `../charter.md#retirement-scope`
- CI config (`.github/workflows/**` if present)

## Acceptance criteria
1. Given the deletions, then `npm test`, `npm run lint`, `npm run build`
   all still green and no repo file references the deleted paths.
2. Given the precondition check, then the journal records the coverage
   comparison that authorized deletion.
3. Given `git log`, then deletion is a single revertable commit.

## Observability / Rollback
N/A. / Reversible via git revert (PNGs restore from history).

## Quality bar
Full gates green post-deletion.

## Commit
`chore(T20): retire playwright raster visual-QA path`
