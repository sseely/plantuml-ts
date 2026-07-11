# Mission: docs-site (F3)

Publish a GitHub Pages documentation site for plantuml-ts, modeled on
`~/git/graphviz-ts/docs-site` (VitePress). Required: a **parity page**
(per-diagram-type numbers, regenerated from committed report output,
never hand-maintained) and a **divergences page organized per diagram
type**; a live in-browser playground running the actual library; guide
pages; a Pages deploy workflow. **No performance page** (deferred, D4).

## Branch

`feature/docs-site` off `main`. Squash merge is fine for this mission
(no per-task commit IDs referenced externally) — maintainer's call at
merge time.

## Batches

| Batch | Description | Tasks | Status |
|-------|-------------|-------|--------|
| [batch-1](batch-1/overview.md) | Report generator, divergences restructure, scaffold | T1–T3 (parallel) | [x] |
| [batch-2](batch-2/overview.md) | Copy-reports pipeline, playground | T4–T5 (parallel) | [x] |
| [batch-3](batch-3/overview.md) | Deploy workflow + final verification | T6 | [x] |

## Quality gates (all must pass before any commit)

```sh
npm test              # vitest + coverage 90/90/90
npm run typecheck
npm run lint
npm run build
npm run docs:build    # once T3 lands — the site must build
```

## Write-set boundary

`docs-site/**`, `docs/parity-report.md`, `DIVERGENCES.md` (+ files
linking to its anchors), `scripts/dot-sync-report.ts` (additive),
`package.json` (docs scripts + vitepress devDep), `.gitignore`,
`.github/workflows/docs.yml`, `planning/mission-index.md` (F3 status),
this plan directory. Anything else: STOP.

## Stop conditions

1. Files outside the write-set boundary need changes.
2. Two consecutive gate failures on the same check.
3. A decision D1–D4 proves wrong in practice (e.g. VitePress cannot
   compile the library for the playground) — journal + stop.
4. Anything requiring repo settings/secrets beyond the one manual
   Pages-source toggle, or workflow permissions beyond
   `pages: write` + `id-token: write`.

## Push-forward conditions

- VitePress config details (theme, nav ordering), guide prose,
  copy-reports link-rewrite specifics, action version pins,
  small additive package.json script tweaks.
- The one manual step (GitHub → Settings → Pages → Source = GitHub
  Actions) is the MAINTAINER's; note it in the final summary, don't
  attempt it.

## Index

- [decisions.md](decisions.md) — D1–D4 + operational notes
- [diagrams/data-flow.md](diagrams/data-flow.md) — report pipeline
- [decision-journal.md](decision-journal.md) — appended during execution

Note: `plans/` is COMMITTED in this repo (established convention),
deviating from the plan-mission skill's gitignore default.

---

## Mission summary (2026-07-11)

**Tasks: 6/6 planned completed** (T1–T6; batches 1–3). Commits: one per
task on `feature/docs-site` (e989fdb, 4628bdd, 30e7427, 7d9f258,
52c245e, 67e013d) + plan-tracking chores.

**Decisions made:** 8 journal entries. Flagged for maintainer review:

- **`libraryDataFileShim`** in `docs-site/.vitepress/config.ts` —
  VitePress unconditionally executes any imported `*.data.ts` module as
  a data-loader config; the shim re-suffixes the two measurer data
  files. Alternative (renaming the `src/` files) crossed T5's
  write-set. New `*.data.ts` files reachable from `src/index.ts` need
  adding to the shim (see `.agent-notes/docs-site-vitepress-data-ts.md`).
- Playground editor is a plain textarea (no Shiki) — dep was owned by
  the parallel task; cosmetic follow-up if wanted.
- `scripts/dot-sync-report.ts` sits at exactly the 500-line hook cap;
  the next change there forces a module split.

**Quality gates:** all pass at every batch boundary and at close —
npm test (5647 tests, 90/90/90 coverage), typecheck, lint, build,
docs:build. E2E: clean-build dist contains all five page groups,
interlinked under `/plantuml-ts/`; parity page shows class 680/680
(100%).

**Known issues / follow-ups:**
- **MANUAL STEP (maintainer):** GitHub → Settings → Pages → Source =
  GitHub Actions — required once, before the first deploy can succeed.
- Deploy verifiable only post-merge (workflow triggers on push to main).
- Perf page deliberately absent (D4) — future mission with a real
  benchmark harness.
