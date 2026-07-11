# Batch 1 — Mechanism catalog + parser/command alignment

T1 and T2 run in PARALLEL (disjoint write-sets: T1 writes only
plans/state-dot-sync/mechanisms.md; T2 writes parser/AST + tests).
Both are prerequisites for batch-2.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|-----------|------|
| T1 | Svek-state mechanism catalog (read-only investigation) | sonnet | plans/state-dot-sync/mechanisms.md | T0 | [x] |
| T2 | Parser/AST audit vs StateDiagramFactory + port gaps | sonnet | src/diagrams/state/{parser,ast}.ts, tests/unit/state/** | T0 | [x] |
