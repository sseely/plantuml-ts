# Batch 1 — Parallel Source Reads

Two independent reads that can run in parallel. T3 (synthesis) is in
batch-2-synthesize.md and depends on both.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T1 | Read Java gtile + Instruction model + command catalog | research-analyst | batch-1/java-model-notes.md | — | [x] |
| T2 | Read our TypeScript activity source | research-analyst | batch-1/ts-current-notes.md | — | [x] |

Both tasks write different files and read different sources — run in parallel.
