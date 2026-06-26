# T3 — Labeled Flat Edges (S-5) + Multi-Edge Long Fanning (S-6)

## Context

Project: TypeScript port of PlantUML's Graphviz dot layout engine.
Stack: TypeScript, vitest.

After Batches 1 and 2, long-edge routing uses corridors and tailport points.
Two remaining gaps in `splines.ts`:
- S-5: `routeFlatEdge` ignores `edge.labelNode`; the label position is not
  used to guide the flat-edge curve.
- S-6: Multiple parallel long edges (same from/to, span > 1) collapse onto
  the same corridor midpoint and appear as a single thick line.

## Task

### S-5 — Labeled flat edge routing

Modify `routeFlatEdge` (currently at ~line 422) to detect `edge.labelNode`:

```typescript
export function routeFlatEdge(
  edge: DotEdge,
  obstacles: ObstaclePolygon[],
  rankDir: DotWorkingGraph['rankDir'],
): Point[] {
  // ... existing wp1/wp2 detour logic unchanged ...

  const start = ellipseEdgePoint(from, wp1);
  const end   = ellipseEdgePoint(to,   wp2);

  // S-5: route through label node when present
  // C: make_flat_labeled_edge() dotsplines.c:1314-1416
  if (edge.labelNode) {
    const ln = edge.labelNode;
    const lx = ln.x + ln.width / 2;
    const ly = ln.y + ln.height / 2;
    return [start, wp1, { x: lx, y: ly }, { x: lx, y: ly }, wp2, end];
  }

  void obstacles;
  return [start, wp1, wp2, end];
}
```

### S-6 — Multi-edge long fanning

1. Add constant near `PARALLEL_OFFSET`:
   ```typescript
   const MULTISEP = 16;
   ```

2. In `routeEdges`, before the `for (const edge of graph.longEdges)` loop,
   build a parallel count map for long edges:
   ```typescript
   const longParallelCount = new Map<string, number>();
   const longParallelIdx   = new Map<DotEdge, number>();
   for (const edge of graph.longEdges) {
     const key = `${edge.from.id}→${edge.to.id}`;
     const idx = longParallelCount.get(key) ?? 0;
     longParallelIdx.set(edge, idx);
     longParallelCount.set(key, idx + 1);
   }
   ```

3. Update the long-edge routing loop to pass fan info:
   ```typescript
   for (const edge of graph.longEdges) {
     const key = `${edge.from.id}→${edge.to.id}`;
     const fanTotal = longParallelCount.get(key) ?? 1;
     const fanIdx   = longParallelIdx.get(edge) ?? 0;
     const corridors = makeBBoxCorridors(edge, graph);
     routeLongEdgeInCorridor(edge, corridors, rankDir, fanIdx, fanTotal);
     if (edge.reversed) {
       edge.points = edge.points.slice().reverse();
     }
   }
   ```

4. Update `routeLongEdgeInCorridor` signature and midpoint calculation:
   ```typescript
   function routeLongEdgeInCorridor(
     edge: DotEdge,
     corridors: BoxCorridor[],
     rankDir: DotWorkingGraph['rankDir'],
     fanIdx = 0,
     fanTotal = 1,
   ): void {
     // ...
     // C: dotsplines.c:1885-1907 — Multisep offset for parallel long edges
     const fanOffset = fanTotal > 1 ? (fanIdx - (fanTotal - 1) / 2) * MULTISEP : 0;
     // Apply fanOffset to each corridor midpoint x (TB/BT) or y (LR/RL)
     const waypoints: Point[] = [start];
     for (const c of corridors) {
       const mx = (c.xLeft + c.xRight) / 2 + (rankDir === 'TB' || rankDir === 'BT' ? fanOffset : 0);
       const my = (c.yTop + c.yBottom) / 2 + (rankDir === 'LR' || rankDir === 'RL' ? fanOffset : 0);
       waypoints.push({ x: mx, y: my });
     }
     waypoints.push(end);
     // ... fitBezier / snap unchanged ...
   }
   ```

## Write-set

- `src/core/dot/splines.ts`
- `tests/unit/dot/splines.test.ts`

## Read-set

- `src/core/dot/splines.ts` — current state after T2
- `src/core/dot/types.ts:88–90` — `DotEdge.labelNode` field
- `decisions.md` — D-2

## Interface contracts

No new exports. `routeFlatEdge` signature unchanged. `routeLongEdgeInCorridor`
gains two optional parameters with default values.

## Acceptance criteria

- Given a flat edge with a `labelNode` at position `(lx, ly)`,
  when `routeFlatEdge` is called,
  then the returned path has 6 points and `path[2].x` equals
  `lx + labelNode.width / 2`.

- Given a flat edge without a `labelNode`,
  when `routeFlatEdge` is called,
  then the returned path has 4 points (existing behavior preserved).

- Given two parallel long edges between the same node pair,
  when `routeEdges` is called,
  then the two edges have different `points[1].x` values (they are
  offset by `MULTISEP`).

- Given a single long edge (no parallel siblings),
  when `routeEdges` is called,
  then its corridor midpoints are not offset (fanOffset = 0).

## Quality bar

Run `npm test && npm run typecheck && npm run lint && npm run build`. All must
exit 0.
