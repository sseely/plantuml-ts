# T3 — Flat-state svek emission

## Context
Decision D1: rewrite `src/diagrams/state/layout.ts`'s DOT layer to
svek conventions, mirroring `src/diagrams/class/class-dot-graph.ts` /
`class/layout.ts` patterns (duplicate consciously; SI1 unifies later).
Scope: diagrams with NO composite states (T4 adds those) — but the new
structure must be composite-ready (mechanisms.md#autonom informs the
shape).

## Task
1. New `src/diagrams/state/state-dot-graph.ts` (+ sizing module):
   nodes with svek shapes per mechanisms.md#shapes (rounded rect w/
   measured dims per EntityImageState, circle start/end, history,
   fork/join, choice, sdlreceive, empty-description variant honoring
   `hide empty description`), edges with minlen + HTML-table labels,
   graph attrs nodesep/ranksep (+ floors) and rankdir.
2. Rewire `layoutClass`-style flow in state/layout.ts: parse-AST →
   measure → DotInputGraph → layout() → geometry; keep the public
   layout/render seam signatures used by index.ts.
3. Renderer alignment for changed geometry (visuals per
   EntityImageState — divergences from old greenfield look are
   upstream-alignment, note them).
4. TDD: sizing tests pinned to 2-3 cached flat fixtures' exact oracle
   dims; DOT-shape tests via setLayoutInputObserver + toSvekDot.
5. Measure: `dot-sync-report state` — report EQUAL delta (expect the
   flat subset to move; composites still mismatch until T4).

## Write-set
- src/diagrams/state/** ; tests/unit/state/**, tests/unit/dot? (no)

## Read-set
- plans/state-dot-sync/mechanisms.md (authoritative)
- src/diagrams/class/{class-dot-graph,layout,class-layout-helpers,class-object-map-sizing}.ts (patterns)
- ~/git/plantuml/.../svek/image/EntityImageState*.java, EntityImageCircle*.java
- Complexity hook rules (500-line cap, CCN 10 — split modules freely under src/diagrams/state/)

## Acceptance criteria
- Given a flat fixture from mechanisms.md's evidence set, then our
  svek DOT matches shapes + sizes exactly (unit test).
- Given `npm test`, then class/object/description ratchets green.
- Given the report, then EQUAL > 0 and no bucket regresses.

## Observability
N/A. **Rollback:** Reversible.

## Commit
`feat(state-dot): svek-faithful flat-state emission (T3)`
