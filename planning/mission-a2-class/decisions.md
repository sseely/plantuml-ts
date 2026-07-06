# Architecture Decisions — Mission A2 (all approved 2026-07-06)

## ADR-1 — Class node shape rule (plaintext vs rect)
- **Context:** oracle renders a class as `shape=plaintext` (HTML table) when it
  has compartments / ports / a stereotype, else `shape=rect` (bare class).
- **Decision:** mirror upstream's exact condition — port it from
  `CucaDiagramFileMakerSvek` / `EntityImageClass` in `~/git/plantuml`, not a
  guessed heuristic.
- **Consequences:** fixes the 227 shapeOk failures; risk of regressing the 9
  currently-EQUAL (bare-class) fixtures if the rule is wrong — **pin them as
  goldens first (T2)** before changing the rule (T4).

## ADR-2 — HTML-table label fidelity
- **Context:** the comparator never reads inside `label=<…>`; structural EQUAL
  needs only `shape=plaintext`. But width/height (tolerant now) and the future
  SVG gate need real compartments.
- **Decision:** build the **full compartment table** (name / stereotype /
  attributes / operations rows) in a new `class-html-label.ts`, reusing
  `WidthTableMeasurer` for cell sizing.
- **Consequences:** faithful + future-proof for the SVG gate; structural parity
  lands as soon as the shape is right, regardless of internals.

## ADR-3 — `newpage` handling location
- **Context:** cross-cutting (all diagram types); currently unsupported;
  `renderSync` returns one SVG.
- **Decision:** split at the **block-extractor** — one
  `@startuml…newpage…@enduml` becomes N `UmlSource` pages; add an additive
  multi-graph render path. The DOT-parity harness captures one `DotInputGraph`
  per layout call, so N pages → N graphs.
- **Consequences:** fixes ~158 graph-count mismatches across ALL types; a
  shared-infra change (its own batch) touching `block-extractor.ts` + the render
  API — **additive** (`renderSync` unchanged for single-page). Run the FULL
  suite after this batch.

## ADR-4 — Relationship-edge topology (diagnosis-first)
- **Context:** edgeCount (295) + degree (321) are the biggest failures — wrong
  edge *count/topology*, not just decorations (the comparator checks minlen
  multiset + degree + label counts, not arrow-shape strings).
- **Decision:** **T1 diagnoses first** — instrument samples to find the
  divergence cause (association classes, labels-as-nodes, hierarchical swaps,
  self-links) before coding T5, then port the exact edge-emission rules.
- **Consequences:** evidence-led; the edge fix is the largest task.

## ADR-5 — Qualifier ports
- **Context:** `class1 [Qualifier] <-- class2` forces class1 to plaintext + a
  `PORT` and a port-qualified edge.
- **Decision:** port `[Qualifier]` parsing (AST field on `Relationship`) + the
  plaintext port-edge form, reusing the existing port HTML-table emitter in
  `svek-dot-emit.ts`.
- **Consequences:** niche but in-scope; small parser + emit change.

## Rollback
All tasks **Reversible** (one commit each; revert to undo). No data migration.
Goldens additive.
