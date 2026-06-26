# Batch 3 — Labeled Flat Edges (S-5) + Multi-Edge Fanning (S-6)

Two independent improvements to `splines.ts`. Both are self-contained within
the file.

## Tasks

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T3 | routeFlatEdge label routing + long-edge fanning | typescript-pro | splines.ts, splines.test.ts | T2 | [x] |

## What T3 does

**S-5 — Labeled flat edges:**
- Extend `routeFlatEdge` to detect `edge.labelNode`
- When a label node exists, use its x position as the intermediate routing
  point following `make_flat_labeled_edge` logic (`dotsplines.c:1314–1416`):
  build three segments (tail→label, label width, label→head)
- Emit 6-point path: `[start, wp1, labelMid, labelMid, wp2, end]`
  where `labelMid = { x: labelNode.x + labelNode.width/2, y: labelNode.y + labelNode.height/2 }`

**S-6 — Multi-edge long fanning:**
- Before the `for (const edge of graph.longEdges)` loop in `routeEdges`,
  build a parallel count map for long edges (key: `from.id→to.id`)
- In `routeLongEdgeInCorridor`, accept optional `fanIdx: number` and
  `fanTotal: number` parameters (default 0 and 1)
- When `fanTotal > 1`, shift each corridor midpoint x by
  `(fanIdx - (fanTotal - 1) / 2) * MULTISEP` (constant 16)
  — C: `dotsplines.c:1885–1907` `Multisep` offset

## Commit

```
fix(dot): S-5 labeled flat edges, S-6 long-edge fanning
```
