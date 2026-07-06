# T1 — Diagnose class edge-topology divergence

## Context
plantuml-ts is a TypeScript port of PlantUML. The class DOT-sync mission brings
our svek DOT into structural parity with the oracle. The comparator
(`tests/oracle/svek-dot.ts` `compareStructural`) checks node count, **edge
degree multiset**, shape multiset, **minlen multiset**, label counts, cluster
sizes, and graph attrs. The biggest failures are edges: `edgeCount` 295,
`degree` 321 of 680 fixtures. This task finds *why* before T5 codes the fix
(ADR-4, diagnosis-first).

## Task
Instrument a representative sample (~30) of class fixtures where `edgeCount`/
`degree` fail. For each, compare our emitted edges (via the layout-input
observer) against the oracle svek DOT. Categorize the divergence causes and
rank them by frequency. Candidate causes to check: association classes (an
association that owns a class → extra node+edges), link labels rendered as
separate label nodes, hierarchical from/to swaps (`extension`/`implementation`
already swap — verify), self-links, `lollipop`/interface links, n-ary
associations, and edges to/from members.

## Write-set
- `planning/mission-a2-class/decision-journal.md` — append a **"T1 edge
  diagnosis"** entry: a ranked table of the top divergence categories, each with
  a fixture example, the oracle vs ours edge count, and a one-line mechanism.

## Read-set
- `src/diagrams/class/layout.ts` (edge building — how `ast.relationships` →
  `dotEdges`)
- `src/diagrams/class/ast.ts` (`Relationship`, `RelationshipType`)
- `tests/oracle/svek-dot.ts` (what `compareStructural` actually checks)
- `scripts/dot-sync-report.ts` (how to run the class gate)
- `~/git/plantuml/.../classdiagram/` + `.../svek/` (oracle edge emission)
- Oracle svek DOTs: `test-results/dot-cache/class/<slug>/svek-*.dot`

## Method (diagnosis discipline)
Instrument before hypothesizing. Use `setLayoutInputObserver` (see the
scratchpad probes from S1L) to capture our `DotInputGraph`, parse the oracle DOT
with `parseSvekDot`, and diff edge counts/degree per fixture. Do NOT propose
fixes — this task's deliverable is the *mechanism breakdown* that T5 will act on.

## Acceptance criteria
- Given the sample, when diagnosed, then the decision-journal entry names the
  **top 3** edge-count divergence categories, each with ≥1 fixture example and
  the oracle-vs-ours counts.
- Given each category, then a one-sentence mechanism (why the count differs) is
  recorded, traced to `layout.ts:<line>` or an oracle Java source.

## Observability / Rollback
N/A — analysis only, no code. Reversible (doc append).

## Quality bar
No code changes. The journal entry is specific enough that T5 can implement
without re-diagnosing.

## Commit
`docs(T1): diagnose class edge-topology divergence`
