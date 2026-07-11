# Architecture decisions (approved 2026-07-11)

## D1 — Parity data is committed, never generated in CI

CI cannot run the oracle jar (5,800-fixture corpus, local cache).
`scripts/dot-sync-report.ts --markdown` (additive flag) writes
`docs/parity-report.md` locally; the file is COMMITTED;
`docs-site/copy-reports.mjs` mirrors it into the site at build time
with link rewrites. Mirrors graphviz-ts (`test/corpus/PARITY-dot.md` →
`copy-reports.mjs`). Regenerating the report joins the parity-mission
close-out convention (A3/A4 keep it current); CI never needs the jar.

## D2 — Playground imports the library from source

The playground Vue component imports `renderSync` from `../src` via a
Vite alias. The site bundle always reflects the current tree; no
prebuild ordering. Consequence: a library type error fails `docs:build`
— an accepted de-facto CI gate on main pushes.

## D3 — DIVERGENCES.md itself is restructured per diagram type

Section order: **General** (cross-cutting: preprocessor, !import/
!include deferral), then one section per diagram type. The site page is
a mirrored copy, not a fork. Inbound anchor links get updated in the
same commit.

## D4 — No performance page in this mission

Deferred until honest jar-vs-TS benchmarks exist (methodology,
warm/cold JVM, corpus-scale). A hollow perf page undercuts the parity
page's credibility. Revisit as its own mission with a benchmark
harness.

---

# Operational notes (from readiness review)

- **Rollback:** Reversible — revert the commit; next push redeploys.
- **Detection:** `docs.yml` Actions status is the alarm. Playground
  must render errors inline (acceptance criterion in T5).
- **Stale-report risk:** mitigated by convention — parity missions
  regenerate `docs/parity-report.md` at close-out (added to their loop
  protocol step 6 going forward).
- **Manual step (maintainer):** GitHub → Settings → Pages → Source =
  GitHub Actions, once, before the first deploy succeeds.
