# Batch 1 — burn + stub + tests + handoff

Single batch, **strictly sequential** (every task touches `src/core/` or the test
tree; none are parallel). One commit per task; squash the branch on merge.

| ID | Description | Writes | Depends On | Done |
|----|-------------|--------|------------|------|
| [T1](T1-stub-chokepoint.md) | Create chokepoint: `graph-layout.ts` (`layoutGraph` throws `PendingGraphvizError`) + `graph-layout.types.ts` (relocated types) | `src/core/graph-layout.ts`, `src/core/graph-layout.types.ts` | — | [x] |
| [T2](T2-repoint-consumers.md) | Repoint 6 diagram layouts to the chokepoint; delete `auto-layout.ts` | `src/diagrams/{class,component,state,usecase,dot,json}/layout.ts`, ⌫`src/core/auto-layout.ts` | T1 | [x] |
| [T3](T3-delete-engines.md) | Delete all 11 engine dirs (incl. `core/dot`, now unreferenced) | ⌫`src/core/{dot,circo,fdp,neato,osage,pack,patchwork,pathplan,sfdp,twopi,label}/` | T2 | [x] |
| [T4](T4-tests.md) | Delete engine tests; skip dark-type layout/render/integration tests; keep parser tests | `tests/unit/**`, `tests/integration/**` (per D5 rule) | T3 | [x] |
| [T5](T5-gates-commit.md) | Green all gates; commit each task; finalize branch | — | T4 | [x] |
| [T6](T6-handoff-seed.md) | Write `handoff-adapter.md` seed (throw-sites, skipped tests, type-adoption plan) | `plans/burn-graphviz-engines/handoff-adapter.md` | T5 | [x] |

## Dependency rationale
- T3 cannot delete engines until T2 removes every importer (else typecheck fails).
- T4 cannot finalize test fallout until T3 deletes the engines (else "delete
  engine tests" is ambiguous).
- T6 reads the *result* of T1–T5 (the throw-sites, the skip list) to seed the
  adapter mission.

## Per-task commits
`refactor(layout): <task summary>` — e.g. `refactor(layout): add graph-layout
chokepoint stubbing the dot seam`. Body explains why if >3 files. End with the
Co-Authored-By trailer.
