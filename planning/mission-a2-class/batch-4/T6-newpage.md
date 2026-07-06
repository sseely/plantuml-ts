# T6 — `newpage` → multi-page (shared infra)

## Context
`newpage` splits one `@startuml…@enduml` into multiple pages; oracle emits one
svek graph per page (drives ~158 graph-count mismatches). It is cross-cutting
(all diagram types), currently unsupported. `renderSync` returns a single SVG.
Per ADR-3 the split happens at the block-extractor and the render path becomes
multi-graph, **additively** (single-page callers unaffected).

## Task
1. In `src/core/block-extractor.ts`, split a block's lines on a `newpage`
   directive (mirror upstream: `newpage [optional title]`) into N `UmlSource`
   pages, each carrying the same diagram type + the shared preamble
   (skinparams/defines before the first `newpage` apply to all pages — verify
   against oracle).
2. Add an additive multi-page render entry (e.g. `renderPagesSync`/pages array)
   in `src/index.ts` so each page lays out independently → N `DotInputGraph`s.
   Keep `renderSync` returning the first/single page unchanged.
3. The DOT-parity harness captures one `DotInputGraph` per layout call, so N
   pages → N graphs automatically once each page is laid out.

## Write-set
- `src/core/block-extractor.ts` (modify — page split)
- `src/index.ts` (modify — additive multi-page path)
- `tests/unit/core/block-extractor.test.ts` (+ a render-path test) (modify/create)

## Read-set
- `src/core/block-extractor.ts` (current `UmlSource` extraction)
- `src/index.ts:125-160` (`renderSync`)
- `~/git/plantuml/.../core/` newpage handling; oracle multi-`svek-*.dot`
  fixtures (e.g. `test-results/dot-cache/class/bufogi-69-naba929`)

## Architecture decisions
ADR-3. **Additive** — do NOT change the single-page `renderSync` signature/return
for existing callers. Preamble-before-first-`newpage` applies to all pages
(confirm against oracle).

## Acceptance criteria
- Given `class test / newpage / class test2`, when extracted, then 2 `UmlSource`
  pages; when laid out, 2 `DotInputGraph`s.
- Given a single-page source, then `renderSync` behaves exactly as before.
- Given the **full** `npm test`, then green — no other diagram type regresses.

## Observability / Rollback
N/A. Reversible.

## Quality bar
FULL suite green (cross-type guard), typecheck + lint clean. STOP if any
non-class test breaks and the cause isn't an obvious additive fix.

## Commit
`feat(T6): newpage → multi-page render path (shared infra)`
