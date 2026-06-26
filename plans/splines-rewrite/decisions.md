# Architecture Decisions

## D-1: `BoxCorridor` type locality

Define `BoxCorridor` as a local type inside `splines.ts`. Do not add it to
`types.ts`.

```typescript
type BoxCorridor = { rank: number; xLeft: number; xRight: number; yTop: number; yBottom: number };
```

**Rationale:** internal routing scratch type; not part of the public graph model.

## D-2: Simplified corridor routing

Walk through the midpoints of corridor boxes rather than implementing full
`Pshortestpath` polygon shortest-path routing.

**Rationale:** Midpoint simplification matches what Smetana actually uses and
keeps the implementation reviewable. Full polygon routing is expensive.

## D-3: Keep `fitBezier` for final curve

After computing corridor waypoints, continue using the existing `fitBezier`
(Catmull-Rom) for the final curve. Do not replace it.

**Rationale:** `fitBezier` is already correct and tested; the change is the
waypoint source, not the curve math.

## D-4: `tailportY` as a ratio

`tailportY` is a ratio in the range -0.5 to +0.5 relative to node height
from center. A value of `0` exits at the node vertical midpoint. This matches
`beginpath()` in `splines.c:392`.

When absent (`undefined`), treat as `0`.

## D-5: S-4 already closed

`adjustEndpoints` was removed in Mission 1 Batch 1. The Batch 2 note in the
mission spec about "integrate or remove adjustEndpoints (gap S-4)" is already
done — Batch 2 is `tailStartPoint` + S-1 only.
