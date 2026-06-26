# T2 — tailStartPoint + S-1

## Context

Project: TypeScript port of PlantUML's Graphviz dot layout engine.
Stack: TypeScript, vitest.

Batch 1 replaced `routeLongEdge` with `makeBBoxCorridors` +
`routeLongEdgeInCorridor`. Both `routeShortEdge` and `routeLongEdgeInCorridor`
still use `ellipseEdgePoint(edge.from, ...)` to find the start point, ignoring
`edge.tailportY`. Sequence diagram lifeline arrows rely on `tailportY` to
connect at a specific vertical position on node boundaries.

## Task

1. Add `tailStartPoint` (private function, above `routeShortEdge`):

   ```typescript
   // C: beginpath() splines.c:392 — start.p = node_center + port.p
   function tailStartPoint(edge: DotEdge, rankDir: DotWorkingGraph['rankDir']): Point {
     const node = edge.from;
     const cx = node.x + node.width / 2;
     const cy = node.y + node.height / 2;
     if (edge.tailportY !== undefined) {
       const portY = cy + edge.tailportY * node.height;
       if (rankDir === 'LR') return { x: node.x + node.width, y: portY };
       if (rankDir === 'RL') return { x: node.x, y: portY };
       // TB / BT: exit bottom face (TB) or top face (BT) at horizontal port
       const portX = cx + edge.tailportY * node.width;
       if (rankDir === 'BT') return { x: portX, y: node.y };
       return { x: portX, y: node.y + node.height }; // TB
     }
     return ellipseEdgePoint(node, center(edge.to));
   }
   ```

   Note: `tailportY` is documented as a vertical ratio for LR/RL and used as a
   horizontal ratio for TB/BT to specify the exit column. Use the same ratio
   field for both axes following the C `beginpath()` port offset logic.

2. In `routeShortEdge`, replace:
   ```typescript
   const start = ellipseEdgePoint(edge.from, center(edge.to));
   ```
   with:
   ```typescript
   const start = tailStartPoint(edge, _rankDir);
   ```
   Remove the `_` underscore prefix from `rankDir` parameter.

3. In `routeLongEdgeInCorridor`, replace the start-point computation with:
   ```typescript
   const start = tailStartPoint(edge, rankDir);
   ```

## Write-set

- `src/core/dot/splines.ts`
- `tests/unit/dot/splines.test.ts`

## Read-set

- `src/core/dot/splines.ts` — current state after T1
- `src/core/dot/types.ts:73–75` — `DotEdge.tailportY` field
- `decisions.md` — D-4, D-5

## Architecture decisions

- D-4: `tailportY` is a ratio -0.5 to +0.5; absent means treat as 0 (use fallback)
- D-5: S-4 is already closed — do not reference `adjustEndpoints`

## Interface contracts

```typescript
function tailStartPoint(edge: DotEdge, rankDir: DotWorkingGraph['rankDir']): Point
```

## Acceptance criteria

- Given `edge.tailportY = 0.4` and `rankDir = 'LR'`,
  when `tailStartPoint` is called,
  then the returned y coordinate equals `cy + 0.4 * node.height`.

- Given `edge.tailportY = 0` and any `rankDir`,
  when `tailStartPoint` is called,
  then the returned point is at the node center y (portY = cy).

- Given `edge.tailportY = undefined`,
  when `tailStartPoint` is called,
  then it returns `ellipseEdgePoint(edge.from, center(edge.to))`.

- Given a short edge with `tailportY = 0.3` and `rankDir = 'LR'`,
  when `routeEdges` is called,
  then `edge.points[0].y` is within 1px of `cy + 0.3 * node.height`.

## Quality bar

Run `npm test && npm run typecheck && npm run lint && npm run build`. All must
exit 0.
