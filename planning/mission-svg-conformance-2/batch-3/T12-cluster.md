# T12 — Cluster draw sequence

## Context
`svek/Cluster.java` (760 ln) owns container/package rendering: the
cluster body, title placement, style resolution, and its own
group/comment decoration. Only the **drawing half** ports — position
inputs come from our existing layout (`layout.ts` computes container
geometry; NOT touched).

## Task
Port the drawing half to `src/core/svek/Cluster.ts` (+ splits per D2′ if
the 500-line cap bites — journal boundaries): body draw (rect vs
USymbol-based containers — packages draw via USymbolFolder/package
style), title/stereotype block placement, rounded corners, the cluster's
`UGroup`/`UComment` decoration (`<g class="cluster" data-qualified-name…>`
+ `<!--cluster X-->` — verify exact upstream group attrs), and dashed
border variants. Layout-side members (`getClusterPosition`, rank stuff)
stay unported — journal the cut line precisely (which methods ported,
which deferred-with-reason).

## Write-set
- `src/core/svek/Cluster.ts` (+ split files, journaled)
- `tests/unit/core/svek/cluster.test.ts`

## Read-set
- `~/git/plantuml/src/main/java/net/sourceforge/plantuml/svek/Cluster.java` (all 760 — read fully, port the drawing half)
- `src/core/decoration/symbol/` (T3 base; package symbol arrives with
  Batch 2 — if T12 runs before T8 lands, code against the base and test
  with a stub symbol; the batch gate re-verifies together)
- Cached jar SVGs with packages (grep `<g class="cluster"` in
  `test-results/dot-cache/component/*/in.svg`)

## Interface contracts (consumed by T17)
A `Cluster` drawable taking container geometry + title blocks and
drawing decoration + body + title through a klimt UGraphic.

## Acceptance criteria
1. Given a package container fixture fragment, when drawn with the
   jar's geometry, then conformant vs the jar's cluster subtree
   (comment + group + body + title).
2. Given a dashed-border container kind, then dash emission matches the
   jar's.
3. Given the cut line, then every unported Cluster.java member is listed
   in the journal with its reason (layout-half / needs-svek-machinery).

## Observability / Rollback
N/A. / Reversible.

## Quality bar
Standard gates green; ≥90/90/90; splits journaled.

## Commit
`feat(T12): port Cluster drawing half (body, title, decoration)`
