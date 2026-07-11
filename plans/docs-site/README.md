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
| [batch-1](batch-1/overview.md) | Report generator, divergences restructure, scaffold | T1–T3 (parallel) | [ ] |
| [batch-2](batch-2/overview.md) | Copy-reports pipeline, playground | T4–T5 (parallel) | [ ] |
| [batch-3](batch-3/overview.md) | Deploy workflow + final verification | T6 | [ ] |

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
