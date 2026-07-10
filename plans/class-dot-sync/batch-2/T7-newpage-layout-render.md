# T7 — newpage layout + stacked render

## Context
T6 gives `ClassAst.pages`. Upstream lays out and exports each page as an
independent svek graph (`NewpagedDiagram.java:87-162`). Our library returns
ONE SVG string, so pages render stacked vertically — a deliberate,
documented adaptation (decision D1).

## Task
1. `layoutClass`: when `pages` present, run the full existing single-page
   pipeline once per page (including T5's degenerate skip per page — a page
   with one class produces zero captures, matching that page's absent
   `svek-N.dot`… verify against an oracle sample first: does the jar dump a
   dot file for a degenerate page? Diagnose before assuming; journal it).
   One layout-observer capture per non-degenerate page, in page order.
2. Combine page geometries with vertical offsets (page gap: pick a constant,
   document it — the offset is ours, not upstream's, since upstream emits
   separate files).
3. `renderClass`: render each page's geometry into one stacked SVG.
4. CHANGELOG entry: class `newpage` output change (pages were silently
   merged; now rendered as stacked pages), per the friction principle.

## Write-set
- `src/diagrams/class/layout.ts`, `class-dot-graph.ts`, `renderer.ts`
- `CHANGELOG.md`
- `tests/unit/class/**`, corpus spot-checks

## Read-set
- T6's contract (`ClassAst.pages`)
- `src/diagrams/class/layout.ts` post-T5 (whole)
- `~/git/plantuml/.../NewpagedDiagram.java:87-162`

## Acceptance criteria
- Given `sadamo-18-siva346`, when the report runs, then captured graph count
  equals the oracle's `svek-N.dot` count and the fixture leaves the
  graph-count bucket.
- Given any single-page fixture, then SVG output is byte-identical to
  pre-T7.
- Given the report, then graph-count mismatch drops substantially from 158
  (journal exact delta) and EQUAL strictly increases; no pinned slug
  regresses.
- All four gates pass.

## Observability
Report deltas in the journal.

## Rollback
Reversible. Output change is CHANGELOG'd, not silent.

## Commit
`feat(class): per-page layout + stacked newpage rendering`
