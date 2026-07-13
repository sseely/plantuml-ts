# Batch 2 — Cutover + triage (parallel)

Requires batch 1. Disjoint write-sets: T3 owns the description engine +
census expectations; T4 owns oracle/goldens/** + ledger docs.

| ID | Description | Agent | Writes | Depends On | Done |
|---|---|---|---|---|---|
| T3 | Description doc-dims cutover to LimitFinder (SvekResult recipe) | typescript-pro | src/diagrams/description/renderer.ts (+ a small support module if cap demands), tests/unit/description-doc-dims.test.ts, tests/oracle/svg-conformance/* ONLY if expectations legitimately change | T1 | [ ] |
| T4 | Newly-comparable fixture triage: EQUAL → goldens; non-EQUAL → ledger | typescript-pro | oracle/goldens/{class,state,description}/** additions, oracle/goldens/{state,object}/size-backlog.json, plans/g0-limitfinder/newcomer-triage.md (new) | T2 | [ ] |

Gate after batch: full gates + DOT gate at the NEW (post-T2) baseline +
census — expect the conformant count to RISE (size-clean tier unlocks);
record before/after.
