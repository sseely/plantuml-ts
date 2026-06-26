# Batch 2 — Network Simplex Ranking

## Description

Implement the rank assignment stage using the network simplex algorithm
(Gansner et al. 1993). Also creates the index.ts stub so the module
is importable. After this batch, every node in a DotWorkingGraph gets
an integer rank.

## Tasks

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|-----------|------|
| T2 | Network simplex ranking + index stub | typescript-pro | rank.ts, rank.test.ts, index.ts | T1 | [x] |

## Quality Gate

```
npm test && npm run typecheck && npm run lint
```
