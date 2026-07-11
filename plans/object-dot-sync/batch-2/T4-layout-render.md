# T4 — Object/map node sizing, DOT emission, SVG rendering

## Context
Follows T1–T3 (AST carries OBJECT/MAP leaves). A2 established: normal
class nodes emit `shape=rect,label=""` with pre-measured width/height
(`svek/SvekNode.java#appendShape:132-166`); compartments are drawn in
SVG, never in DOT. Object/map nodes follow the same pattern with
different inner content: object = name header + `field = value`
compartment (no methods compartment); map = name header + key⇒value
table rows (upstream draws an inner vertical line between key and
value columns — check `EntityImageMap.java` for exact metrics).

## Task
1. Sizing: measure object/map leaves in class layout exactly as the
   Java does (read `svek/image/EntityImageObject.java` and
   `EntityImageMap.java` for dimension math — margins, line heights,
   the map key/value column split).
2. DOT: class-dot-graph emits object/map nodes with those sizes (same
   rect/label conventions as class leaves).
3. SVG: renderer draws object header + fields compartment and map
   rows with the divider line, reusing class-renderer conventions
   (fonts, padding, stereotype placement).
4. TDD: sizing unit tests against known oracle dims (pick 2–3 cached
   fixtures and assert exact node width/height from their oracle DOT).

## Write-set
- src/diagrams/class/layout.ts, class-dot-graph.ts, renderer.ts,
  class-layout-helpers.ts (if sizing helpers live there), tests

## Read-set
- ~/git/plantuml/.../svek/image/EntityImageObject.java (whole)
- ~/git/plantuml/.../svek/image/EntityImageMap.java (whole)
- test-results/dot-cache/object/<slug>/ oracle DOT for chosen fixtures
- batch-1 interface contracts (T1, T3)

## Acceptance criteria
- Given a cached map fixture, when our DOT is diffed, then node
  width/height match the oracle within the harness equality bar.
- Given an object fixture with fields, then dims match likewise.
- Given `npm test`, then class ratchet (687) still green.
- Given `npx tsx scripts/dot-sync-report.ts object` (via the class
  parser directly is fine pre-T5), then EQUAL does not drop below 34.

## Observability
N/A.

## Rollback
Reversible.

## Commit
`feat(class-dot): object/map node sizing, DOT emission, SVG render`
