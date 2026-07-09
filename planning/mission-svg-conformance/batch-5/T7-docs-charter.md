# T7 — Conformance docs + catalog + Brief 2 charter

## Context
The methodology needs an outward-facing definition (maintainer directive:
the term is **conformant**, defined as graphviz-ts defines it), the catalog
must record the new modules so future agents reuse instead of reinvent, and
Brief 2 needs a charter capturing the settled program decisions so its
detailed `/plan-mission` starts from facts, not rediscovery.

## Task
1. `docs/svg-conformance.md` — modeled on graphviz-ts `docs/conformance.md`:
   define *conformant* (numeric agreement within ±0.01 after normalization;
   non-numeric exactly equal; per-case pass = zero diffs), the divergence
   accounting model (100% target; tracked gap vs accepted divergence;
   ledger at `oracle/accepted-divergences.json`; maintainer sign-off rule),
   and how to run the suite.
2. `.claude/catalog.md` — add entries: `src/core/klimt/**` (drawing model +
   SVG emitter, Done), `tests/oracle/svg-conformance/**` (harness + suite,
   Done), with one-line API surfaces. Mark old `svg.ts` as "legacy emitter —
   migrate consumers to klimt; retire after last migration".
3. `planning/mission-svg-conformance-2/README.md` — Brief 2 **charter**
   (not a full brief; it gets its own /plan-mission): objective (migrate
   the description engine to draw through klimt mirroring
   `EntityImageDescription`/`Cluster`/`SvekEdge` draw-call sequences incl.
   `UComment`/`UGroup` decoration), inherited decisions (D1′–D7 by
   reference), the gate design already settled (DOT-EQUAL-first ratchet on
   committed goldens; PARITY-style corpus dashboard generated from a
   parity.json; overlays), the declared costs (description renderer/test
   churn), and the retirement scope (playwright raster path:
   tests/visual/compare.spec.ts, playwright-visual.config.ts,
   capture-reference.ts, committed reference PNGs, `visual:compare` script;
   `scripts/visual-qa-svg.ts` subsumed). Note follow-up candidates:
   remaining renderer migrations type-by-type; `svg.ts` retirement last;
   capture-corpus/upload-references retirement (explicitly out of scope,
   maintainer 2026-07-09).

## Write-set
- `docs/svg-conformance.md` (new)
- `.claude/catalog.md` (modify)
- `planning/mission-svg-conformance-2/README.md` (new)

## Read-set
- `~/git/graphviz-ts/docs/conformance.md` (model), `test/corpus/PARITY.md`
- `../decisions.md`, `../README.md`
- `.claude/catalog.md` (existing format)

## Acceptance criteria
1. Given docs/svg-conformance.md, then "conformant" is defined per D4′/D7
   and the sign-off rule for accepted divergences is explicit.
2. Given the catalog, then klimt + harness entries exist and svg.ts is
   marked legacy-pending-migration.
3. Given the Brief 2 charter, then scope, inherited decisions, gate design,
   declared costs, and retirement list are all present (≤120 lines).

## Observability / Rollback
N/A — docs. / Reversible.

## Quality bar
`npm run lint` clean (markdown untouched by eslint, but gates still run
between batches). No source changes.

## Commit
`docs(T7): conformance methodology, catalog entries, Brief 2 charter`
