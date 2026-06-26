# Batch 3 — Component Decomposition (M-6)

Wraps `minimizeCrossings` to detect weakly-connected components and
process each independently. Depends on Batch 2 (T2) because T2
modifies the same function body.

## Tasks

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T3 | M-6 WCC decomposition | typescript-pro | mincross.ts, mincross.test.ts | T2 | [ ] |

## What T3 does

Adds a `findWeaklyConnectedComponents(nodes, edges)` helper that returns
`DotNode[][]` — one array per WCC. In `minimizeCrossings`:

1. Find WCCs from `graph.nodes` and `graph.edges`.
2. If only one component, run existing logic unchanged (no-op).
3. If multiple components, run the full sweep on each component's
   subgraph independently, then merge back by assigning global orders
   that preserve each component's internal ordering (pack components
   left-to-right by minRank of their first node).

C reference: `decomp.c` (all 130 lines) — `decomp()` / `recomp()`.

## Commit

```
fix(dot): M-6 WCC decomposition in minimizeCrossings
```
