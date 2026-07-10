# Batch 1 — Decks cleared: splits, deletion, jar unification, ratchet lock

T1–T4 have disjoint write-sets → run in parallel. T9 runs after T4.
No behavior changes in this batch except T4's jar resolution order; the
class EQUAL count (357) and every other gate must be unchanged throughout.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|-----------|------|
| T1 | Split parser: COMMANDS → class-commands.ts | sonnet | src/diagrams/class/parser.ts, src/diagrams/class/class-commands.ts | — | [x] |
| T2 | Split layout: DOT builders → class-dot-graph.ts | sonnet | src/diagrams/class/layout.ts, src/diagrams/class/class-dot-graph.ts | — | [x] |
| T3 | Delete class-html-label.ts + test | sonnet | deletions only | — | [x] |
| T4 | Unify oracle jar resolution | sonnet | scripts/dot-sync-report.ts | — | [x] |
| T9 | Bulk ratchet expansion (~357 goldens) | sonnet | oracle/goldens/class/**, tests/oracle/class-dot-parity.test.ts | T4 | [x] |
