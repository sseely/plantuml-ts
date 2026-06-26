# Batch 1 — Research

All five tasks run in parallel. Each reads one C/TS pair plus the
relevant pdiff corpus fixtures and writes a findings report.
No source code is modified in this batch.

| ID | Description | Agent | Writes | Depends On | Done |
|---|---|---|---|---|---|
| T1 | rank.c vs rank.ts | code-reviewer | batch-1/T1-rank-findings.md | — | [x] |
| T2 | mincross.c vs mincross.ts | code-reviewer | batch-1/T2-mincross-findings.md | — | [x] |
| T3 | position.c vs position.ts | code-reviewer | batch-1/T3-position-findings.md | — | [x] |
| T4 | dotsplines.c vs splines.ts | code-reviewer | batch-1/T4-splines-findings.md | — | [x] |
| T5 | acyclic.c vs acyclic.ts | code-reviewer | batch-1/T5-acyclic-findings.md | — | [x] |

All five can be launched simultaneously. There are no write-set
conflicts (each writes a different findings file).
