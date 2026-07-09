# T13 — SvekEdge draw half + extremity factories

## Context
`svek/SvekEdge.java` (1,361 ln) draws edges: the spline body (DotPath),
per-end extremity decorations (arrowheads as drawn polygons — NOT SVG
markers), label/stereotype block placement along the path, and dashed/
bold/color styling. Its layout half (dot round-tripping, label position
solving) stays with our existing layout. Extremities live in
`svek/extremity/` (52 classes) — scope per D10: the decors our
description `link-grammar.ts` can produce; when reachability is
ambiguous, include and journal.

## Task
1. Determine the reachable decor set: read
   `src/diagrams/description/link-grammar.ts` +
   `link-edge-attrs.ts` and map each producible arrow form to upstream's
   `LinkDecor` enum values (read
   `~/git/plantuml/.../decoration/LinkDecor.java`). Journal the mapping
   table (our syntax → LinkDecor → ExtremityFactory class).
2. Port those `ExtremityFactory*`/`Extremity*` classes to
   `src/core/svek/extremity/` (names verbatim): polygon/path point math,
   angle computation from the spline end tangent, fill/stroke rules.
3. Port SvekEdge's **drawing half** to `src/core/svek/SvekEdge.ts`
   (+ splits per D2′): DotPath spline draw, extremity placement at both
   ends (tangent math), dashed/bold styling from link type, label and
   stereotype block placement given positions our layout already
   computes, and the edge's own comment/group decoration if upstream
   emits one (verify — `<!--link X to Y-->` comments exist in jar
   output; find the emitter).
4. Journal the cut line: every unported SvekEdge member + reason.

## Write-set
- `src/core/svek/SvekEdge.ts` (+ splits, journaled)
- `src/core/svek/extremity/*.ts` (reachable set)
- `tests/unit/core/svek/svek-edge.test.ts`

## Read-set
- `~/git/plantuml/src/main/java/net/sourceforge/plantuml/svek/SvekEdge.java` (all — read fully)
- `~/git/plantuml/src/main/java/net/sourceforge/plantuml/svek/extremity/` (the mapped classes)
- `~/git/plantuml/src/main/java/net/sourceforge/plantuml/decoration/LinkDecor.java`
- `src/diagrams/description/{link-grammar,link-edge-attrs}.ts` (read-only)
- `src/core/klimt/shape/DotPath.ts`
- Cached jar SVGs (grep `<!--link` in `test-results/dot-cache/component/*/in.svg`)

## Interface contracts (consumed by T17)
A SvekEdge drawable taking spline points + link attrs (from
`DescriptionEdgeGeo`) and drawing body + extremities + labels through a
klimt UGraphic.

## Acceptance criteria
1. Given a plain `-->` edge with the jar's spline points, then the drawn
   path + arrow polygon are conformant vs the jar's edge subtree.
2. Given a dashed `..>` edge, then dash + open-arrow decor match.
3. Given each mapped LinkDecor, then its extremity geometry matches the
   Java point math (unit-level assertions on the polygon points).
4. Given the journal, then the decor mapping table and SvekEdge cut line
   are recorded.

## Observability / Rollback
N/A. / Reversible.

## Quality bar
Standard gates green; ≥90/90/90; splits journaled.

## Commit
`feat(T13): port SvekEdge drawing half + reachable extremity factories`
