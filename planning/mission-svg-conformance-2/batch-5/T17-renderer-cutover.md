# T17 — Renderer cutover: description draws through klimt

## Context
The migration. `renderer.ts` (143 ln) + `renderer-helpers.ts` (287 ln)
currently emit via `src/core/svg.ts` helpers with `<marker>` arrowheads.
They are NOT faithful ports — per the project's rewrite license
("upstream architecture is authoritative"), replace them with the
upstream-mirroring pipeline built in Batches 1–4. Layout
(`layout*.ts`, `DescriptionGeometry`) is untouched; geometry in,
conformant SVG out.

## Task
Rewrite `src/diagrams/description/renderer.ts` + `renderer-helpers.ts`:
1. `renderDescription(geo, theme)` builds
   `UGraphicSvg.build(seedOf(source…), option, '$version$', jarMeasurer)`
   — determine what the jar puts in `option` for description diagrams
   (background style, dimensions, `data-diagram-type="DESCRIPTION"`) and
   reproduce the preamble. (Seed: the geometry/AST must carry the source
   string or its seed — if the plugin interface doesn't expose it to
   `render()`, thread it via `DescriptionGeometry` from `layoutSync`
   (layout.ts owns that type — that file is in-scope ONLY for the
   type-carrying field addition; journal it; no layout-math changes).)
2. Per node: `EntityImageDescription` (T14) inside `DecorateEntityImage`
   (T11); containers via `Cluster` (T12); recurse children as the
   current renderer does structurally, but with upstream draw order
   (read how the jar orders clusters/entities/edges in output — verify
   against a cached SVG; match it).
3. Per edge: `SvekEdge` (T13) from `DescriptionEdgeGeo` points + attrs.
4. `index.ts`: wire render(); delete now-dead marker/svgRoot usage from
   this engine (svg.ts itself untouched — other engines still use it).
5. Rewrite `tests/unit/description/renderer.test.ts` (820 ln) and
   `tests/integration/description.test.ts` to the new output shape —
   preserve every behavior the old tests covered (each old test maps to
   a new assertion or is journaled as obsolete-with-reason). Add one
   end-to-end conformance test: a small fixture rendered from source is
   conformant vs its cached jar SVG (the first true full-document
   proof).

## Write-set
- `src/diagrams/description/{renderer,renderer-helpers,index}.ts`
- `src/diagrams/description/layout.ts` — ONLY if the seed/source thread
  requires the type field (journal; no math changes)
- `tests/unit/description/renderer.test.ts`,
  `tests/integration/description.test.ts`

## Read-set
- All Batch 1–4 interface contracts (task files' contracts sections)
- `src/diagrams/description/{layout,layout-helpers}.ts` (geometry shapes, read-only)
- One full cached jar SVG for draw-order verification
- `~/git/plantuml/.../svek/SvekResult.java` or equivalent (how upstream
  orders the document — find the drawU that iterates)

## Interface contracts (consumed by T18)
Public plugin API unchanged: `plugin.render(geo, theme): string` now
returns the klimt-emitted document.

## Acceptance criteria
1. Given a simple component fixture rendered from source, then the
   output is fully conformant vs its cached jar SVG (zero diffs).
2. Given every previously-passing description unit/integration test,
   then each maps to a passing new-shape assertion or a journaled
   obsolescence.
3. Given the full suite, then non-description diagram outputs are
   byte-identical to before (no cross-engine bleed).
4. Given `npm run svg:survey`, then it completes and the journal records
   the first real verdict counts.

## Observability / Rollback
Survey counts journaled. / Reversible (single revert restores legacy).

## Quality bar
Standard gates green; ≥90/90/90; DOT parity ≥ its current floor.

## Commit
`feat(T17): description renderer draws through klimt (cutover)`
