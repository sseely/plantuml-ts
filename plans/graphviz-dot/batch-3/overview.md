# Batch 3 — Crossing Minimization + Coordinate Assignment (parallel)

## Description

Two independent modules that can be written in parallel. T3 orders nodes
within rank layers to minimize edge crossings. T4 assigns pixel x/y
coordinates using the Brandes-Köpf algorithm. Both read from types.ts
and rank.ts (already created). Neither writes the other's files.

## Tasks

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|-----------|------|
| T3 | Crossing minimization | typescript-pro | mincross.ts, mincross.test.ts | T2 | [x] |
| T4 | Brandes-Köpf coordinate assignment | typescript-pro | position.ts, position.test.ts | T2 | [x] |

T3 and T4 have no write-set overlap — run in parallel.

## Quality Gate

```
npm test && npm run typecheck && npm run lint
```
