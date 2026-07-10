# T5 — Degenerate-diagram skip: 0–1 entities → no DOT graph

## Context
Upstream skips graphviz entirely for degenerate diagrams
(`svek/GraphvizImageBuilder.java:211-223`): 0 entities →
`EntityImageSimpleEmpty`; exactly 1 root leaf and no links →
`EntityImageDegenerated`. The description engine ports this as
`degenerateSingleLeaf` (`src/diagrams/description/layout-helpers.ts:410`,
used at `description/layout.ts:487-489`) — zero layout-observer captures,
matching the oracle's zero `svek-N.dot`. The class engine always calls
`layout(dotGraph)` (`layout.ts:490` pre-split), so a bare `class A` fixture
is an automatic graph-count loss (oracle 0 vs ours 1).

## Task
Port the same gating into `layoutClass`: when the diagram has 0 classifiers,
or exactly 1 root classifier with no relationships (mind notes — a floating
note or note-on-class counts as an entity upstream; check
`isDegeneratedWithFewEntities`'s exact leaf counting before coding), skip
`layout()` and place the single node directly, mirroring the description
port's geometry handling. Follow description's implementation shape.

## Write-set
- `src/diagrams/class/class-dot-graph.ts`, `src/diagrams/class/layout.ts`
- `tests/unit/class/**` (new focused test), possibly a corpus spot-check

## Read-set
- `src/diagrams/description/layout-helpers.ts:400-440` (the pattern)
- `~/git/plantuml/.../svek/GraphvizImageBuilder.java:200-230` (the spec)
- `plans/class-dot-sync/decisions.md` (verified facts)

## Acceptance criteria
- Given `@startuml\nclass A\n@enduml`, when rendered, then zero layout
  graphs are captured AND the SVG still draws class A.
- Given `@startuml\nclass A\nclass B\nA->B\n@enduml`, then exactly one
  graph is captured (unchanged behavior).
- Given the report, then EQUAL strictly increases (journal the delta) and
  no T9-pinned slug regresses.
- All four gates pass.

## Observability
N/A beyond report delta in the journal.

## Rollback
Reversible.

## Commit
`fix(class-dot): skip graphviz for degenerate 0/1-entity diagrams`
(body: Java citation GraphvizImageBuilder.java:211-223)
