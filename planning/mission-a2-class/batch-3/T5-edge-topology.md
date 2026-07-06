# T5 — Relationship-edge topology

## Context
Edges are the biggest structural failure (edgeCount 295, degree 321). T1's
diagnosis (in `decision-journal.md`) ranks the causes. This task ports the exact
edge-emission rules so our `dotEdges` match oracle edge count + degree multiset +
minlen. The comparator checks topology/minlen/label-counts, NOT arrow-shape
strings — so focus on emitting the right NUMBER and connectivity of edges, plus
`minlen` and any label/xlabel/taillabel/headlabel that upstream emits.

## Task
Implement the fixes for T1's top categories. Likely items (confirm against T1):
- **Association classes** — an association owning a class emits an extra
  node/edge structure; port it.
- **Link labels** — labels emitted as `label`/`xlabel` on the edge (affects
  label-count checks), not as separate nodes (or vice versa — match oracle).
- **Qualifier labels / first-second labels** (`"1" -- "0..*"`) →
  taillabel/headlabel.
- **`minlen`** — per relationship type / length (mirror `SvekEdge`/`Link`).
- Verify existing hierarchical from/to swap still matches oracle direction.
Do NOT change node shapes (T4 owns that logic; only touch edge construction).

## Write-set
- `src/diagrams/class/layout.ts` (edge construction only)
- `tests/unit/class/layout.test.ts` (edge-topology assertions)

## Read-set
- `../decision-journal.md` (T1 diagnosis — the authoritative work list)
- `src/diagrams/class/layout.ts:315-341` (current edge building)
- `src/diagrams/class/ast.ts` (`Relationship`, labels, `RelationshipType`)
- `tests/oracle/svek-dot.ts` (edge degree/minlen/label checks)
- `~/git/plantuml/.../svek/SvekEdge.java`, `.../cucadiagram/Link.java`,
  `.../classdiagram/` (edge emission + association classes)

## Architecture decisions
ADR-4 (diagnosis-first — implement what T1 found, in ranked order). STOP if a
category fails a check 3× (architectural issue).

## Acceptance criteria
- Given each of T1's top-3 categories, when fixed, then an example fixture per
  category has matching edge count + degree vs oracle.
- Given `scripts/dot-sync-report.ts class`, then edgeCount + degree failures
  drop materially vs the 295/321 baseline (log new numbers).
- Given the class ratchet + full suite, then green (no regression).

## Observability / Rollback
N/A. Reversible.

## Quality bar
Full gates + ratchet green; edge-failure deltas logged. One commit per coherent
category is acceptable if the batch grows (`fix(T5): …`).

## Commit
`feat(T5): port class relationship-edge topology`
