# Architecture Decisions — Mission A2 (all approved 2026-07-06)

## ADR-1 — Class node shape rule (plaintext vs rect) — REVISED 2026-07-06
- **Original premise (FALSIFIED):** "oracle renders a class as `shape=plaintext`
  (HTML table) when it has compartments/ports/a stereotype, else `shape=rect`."
- **Evidence overturning it (T4 investigation, verified against source + the real
  oracle DOT cache):** `EntityImageClass.getShapeType()`
  (`~/git/plantuml/.../svek/image/EntityImageClass.java:255-260`) returns
  `RECTANGLE` for **every** ordinary class regardless of members/stereotype, and
  `SvekNode.appendShape()` emits `shape=rect,label=""` for it — the compartment
  text is painted in a later SVG post-pass, never through Graphviz. Corpus:
  **501/544 files use `shape=rect`, only 43 use `shape=plaintext`**;
  `02-members/svek-1.dot` renders a 3-member class as `shape=rect,label=""`.
- **REVISED decision:** ordinary classifiers stay `shape=rect` (we already emit
  rect). Emit `shape=plaintext` **only** for the three real triggers, each a
  generic shield/port table (NOT a compartment table):
  1. qualified-association shield target (`SvekNode.isShielded`, ADR-5/T7),
  2. `Class::member` port target (`RECTANGLE_HTML_FOR_PORTS`),
  3. lollipop-interface circle.
- **Consequences:** the 227 shapeOk failures are driven by parser gaps +
  misrouting (T1), not a broad shape change. The narrow plaintext rule lands in
  **T7** (it coincides with the qualifier/port work). The 9 baseline goldens are
  unaffected (all already rect). Superseded framing removed from the objective.

## ADR-2 — HTML-table label fidelity — REVISED 2026-07-06
- **Context:** the comparator never reads inside `label=…`. Per revised ADR-1,
  oracle emits `label=""` on ordinary rects, so the compartment table is **not**
  the DOT-parity mechanism.
- **REVISED decision:** T3's `buildClassHtmlLabel` (already built) is retained
  for **our own future SVG rendering** (the SVG gate), NOT wired into the DOT
  emit for ordinary classes. For DOT parity, ordinary class rects carry an empty
  label; the three plaintext triggers (revised ADR-1) get a small generic
  shield/port table modeled on `svek-dot-emit.ts`'s existing port table.
- **Consequences:** T3 is not wasted (SVG gate will need it) but is decoupled
  from structural parity; no compartment table is emitted into svek DOT.

## ADR-6 — Graph-attribute parity (nodesep/ranksep) — NEW 2026-07-06
- **Context (missing from the original brief):** `structurallyEqual` requires
  **all 10** checks incl. `nodesepOk`/`ranksepOk` (numeric eq, eps 1e-6). Class
  layout hard-coded `nodeSep=40` (0.5556in) but oracle emits
  `nodesep=0.486111in` (35px) in 511/515 fixtures → `nodesepOk` failed 475/680,
  making ≥90% arithmetically impossible. `rankSep=60` (0.833333in) already
  matched (ranksep fails only 3).
- **Decision (T4, done):** feed `nodeSep=35, rankSep=60` in `layout.ts`.
- **Consequences:** cleared 471/475 nodesepOk failures; structural parity
  **9/680 (1%) → 136/680 (20%)** from one constant. The 4 residual nodesep
  fails are oracle's `0.138889in` (10px) outliers — niche, deferred.

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
