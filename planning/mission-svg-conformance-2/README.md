# Mission charter — SVG conformance, Brief 2: description-engine migration

Charter only. This is not a runnable mission brief — it gets its own
`/plan-mission` decomposition into batches/tasks before execution. Written
by T7 of Brief 1 (`planning/mission-svg-conformance/`) per program decision
"B" (2026-07-09).

## Objective

Migrate the `description` diagram engine (`src/diagrams/description/`) to
draw through the klimt emitter (`src/core/klimt/**`, Brief 1) instead of the
homegrown `src/core/svg.ts` primitives. The port must mirror upstream's
draw-call sequences, not just reproduce their visual output:

- `EntityImageDescription` (`net.sourceforge.plantuml.klimt...` entity
  rendering) — component/interface/node/database/cloud/folder/etc. shape
  draw sequences.
- `Cluster` — container/package draw sequences, including the `UGroup` /
  `UComment` decoration wrapper: entity `<g class="entity"
  data-qualified-name=…>` groups and `<!--entity X-->` comments are drawn
  by **svek code**, not by the shape classes themselves. Brief 1 ported the
  `UGroup`/`UComment` shapes so they exist; wiring svek to actually emit
  them through those shapes is Brief 2 territory.
- `SvekEdge` — edge/link draw sequences (line/path segments, arrowheads).

Deliverable: `description` diagram SVG output is **conformant** (per
`docs/svg-conformance.md`) with the jar's output for the fixtures the
fixture ratchet below covers, with `svek`'s decoration draw calls included
in the comparison (not just leaf shapes).

## Inherited decisions

D1′–D7 in `planning/mission-svg-conformance/decisions.md` are inherited by
reference and not restated here. In particular: D1′ (positional golden
comparison, no shape-inventory layer), D2′ (module layout mirrors upstream),
D3′ (driver scope — deferred drivers remain deferred unless a description
fixture proves otherwise, per that decision's stop condition), D4′/D7
(conformance target and 0.01 band), D5′ (divergence accounting — tracked
gap vs. maintainer-signed accepted divergence, no untracked residue), D6
(`@xmldom/xmldom` dev-only).

## Gate design (already settled)

- **DOT-EQUAL-first fixture ratchet.** Migration proceeds fixture-by-fixture
  against **committed goldens** (jar-verified SVG, same source as Brief 1's
  T6 material — `test-results/dot-cache/description/<slug>/in.svg` and the
  component/usecase/deployment variants). A fixture only ratchets into the
  gated set once its klimt-drawn output is conformant; the gate then holds
  it there (regression-proof), mirroring graphviz-ts's corpus-survey
  discipline rather than a single pass/fail suite.
- **PARITY-style corpus dashboard.** Generated from a `parity.json` survey
  (per-fixture verdict: conformant / structural-match / diverged /
  oracle-error / errored / timeout), rendered to a markdown dashboard the
  same way graphviz-ts's `test/corpus/dashboard.ts` renders
  `test/corpus/PARITY.md` from its survey. Report, not a gate — visibility
  into progress across the full description/component/usecase/deployment
  corpus while the fixture ratchet gates the committed subset.
- **Overlay reports.** Per-fixture visual overlay (klimt output vs. jar
  reference) for triaging non-conformant cases during migration — the
  successor to the raster diff workflow being retired below, but driven by
  the SVG conformance harness instead of pixel comparison.

## Declared costs

- `src/diagrams/description/renderer.ts` + `renderer-helpers.ts` churn:
  every draw call currently emitting via `src/core/svg.ts` helpers
  (`rect`, `ellipse`, `path`, `line`, `text`, `group`, …) is replaced with
  klimt `UGraphic`/`UDriver` calls mirroring upstream's `EntityImage*`
  classes.
- Test churn: `tests/` fixtures/specs asserting on `src/core/svg.ts`-shaped
  output for `description` diagrams need updating to the new klimt-emitted
  shape (attribute names, `<g>` nesting, marker refs all change).
- No parser, AST, or layout changes — this is a renderer-layer migration
  only; `layout.ts`/`layout-helpers.ts` are out of scope.

## Retirement scope

The raster (pixel-diff) visual-QA path is subsumed by SVG conformance and
retired at the end of Brief 2:

- `tests/visual/compare.spec.ts` — Playwright pixel-diff spec.
- `tests/visual/playwright-visual.config.ts` — its Playwright config
  (brief text named `playwright-visual.config.ts` at repo root; the actual
  file lives under `tests/visual/`, matching the `visual:compare` script
  path below).
- `tests/visual/capture-reference.ts` — reference-PNG capture script
  (brief text guessed `scripts/`; the actual file lives under
  `tests/visual/`).
- `tests/visual/reference/**` — committed reference PNGs (28 diagram-type
  subdirectories).
- `visual:compare` npm script (`package.json`): `"playwright test --config
  tests/visual/playwright-visual.config.ts"`.
- `scripts/visual-qa-svg.ts` — subsumed by the SVG conformance harness and
  its overlay reports (above).

Not touched by this retirement: `scripts/visual-qa-dot.ts`,
`playwright.config.ts` (root, used by `test:e2e`), and the
`visual:classify`/`visual:capture`/`visual:build`/`visual:upload`/`visual`
scripts, which serve the separate corpus-classification/demo-site workflow
— review those for retirement only if Brief 2 makes them redundant too.

## Follow-up candidates

- Remaining renderer migrations, type-by-type, after `description`: each
  diagram type's `renderer.ts` is a separate migration in the same
  fixture-ratchet style once Brief 2 proves the pattern.
- `src/core/svg.ts` retirement — last, only after every consumer has
  migrated to klimt (catalog.md already marks it legacy-pending-migration).
- **Explicitly OUT of scope** (maintainer, 2026-07-09):
  `scripts/capture-corpus.ts` and `scripts/upload-references.ts` retirement
  — these serve the corpus-classification/demo-site workflow, not the
  raster visual-QA path being retired here, and are not touched by Brief 2.
