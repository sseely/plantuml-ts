# Batch 1 — Box-Corridor Routing Core (S-3)

Replace `routeLongEdge` with corridor-based routing. No tailport or fanning yet.

## Tasks

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T1 | makeBBoxCorridors + routeLongEdgeInCorridor | typescript-pro | splines.ts, splines.test.ts | — | [x] |

## What T1 does

1. Add local type `BoxCorridor` at top of `splines.ts`
2. Add `makeBBoxCorridors(edge, graph): BoxCorridor[]`  
   — C: `maximal_bbox()` `dotsplines.c:2168–2225`  
   — Per virtual node: left boundary = nearest left sibling's right edge;
     right boundary = nearest right sibling's left edge
3. Add `routeLongEdgeInCorridor(edge, corridors, rankDir): void`  
   — C: `make_regular_edge()` `dotsplines.c:1783–1845` (simplified)  
   — Walk corridor midpoints as waypoints, call `fitBezier`  
   — Reverse control points for reversed edges (`edge_normalize`)
4. Replace `routeLongEdge` call in `routeEdges` with `makeBBoxCorridors` +
   `routeLongEdgeInCorridor`; keep the `edge.reversed` reversal after
5. Add tests: corridor midpoint extraction, reversed edge normalization,
   a single virtual node, two virtual nodes

## Commit

```
fix(dot): S-3 box-corridor routing for long edges
```
