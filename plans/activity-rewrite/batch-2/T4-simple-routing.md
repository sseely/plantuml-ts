# T4 — GConnection Interface + Simple Routing Classes

## Context

plantuml-js is a TypeScript port of PlantUML. Stack: TypeScript + Vitest +
Vite. Test command: `npm test`. Typecheck: `npm run typecheck`. Lint:
`npm run lint`. Build: `npm run build`. All four must pass.

T2 established `Tile`, `TileLeaf`, `TileComposite`, and `GPoint` in
`src/diagrams/activity/tiles/`. This task builds the routing layer: an interface
and two simple connection classes. Routing classes take a source hook point and
a target hook point (both canvas-absolute, computed after coordinate assignment)
and return a `Point[]` array of waypoints for the renderer to draw as a polyline.

## Task

### 1. `src/diagrams/activity/routing/gconnection.ts` — GConnection interface

```typescript
import type { GPoint } from '../tiles/points.js';

export interface GConnection {
  getPoints(from: GPoint, to: GPoint): GPoint[];
}
```

### 2. `src/diagrams/activity/routing/gconnection-vertical-down.ts`

Straight vertical connection from `from` to `to`. Waypoints: `[from, to]`.
Used for: action → action, start → first action, last action → stop/end.

```typescript
export class GConnectionVerticalDown implements GConnection {
  getPoints(from: GPoint, to: GPoint): GPoint[] {
    return [from, to];
  }
}
```

### 3. `src/diagrams/activity/routing/gconnection-horizontal.ts`

Horizontal connection: move horizontally from `from.x` to `to.x` at `from.y`,
then drop vertically to `to.y`. Waypoints: `[from, { x: to.x, y: from.y }, to]`.
Used for: short-circuit terminal branch (hexagon east hook → terminal node).

```typescript
export class GConnectionHorizontal implements GConnection {
  getPoints(from: GPoint, to: GPoint): GPoint[] {
    if (from.y === to.y) return [from, to];
    return [from, { x: to.x, y: from.y }, to];
  }
}
```

### 4. `src/diagrams/activity/routing/index.ts`

Re-export `GConnection`, `GConnectionVerticalDown`, `GConnectionHorizontal`.

### 5. Tests — `tests/diagrams/activity/routing/gconnection.test.ts`

- `GConnectionVerticalDown.getPoints({x:10,y:0}, {x:10,y:50})` → `[{x:10,y:0}, {x:10,y:50}]`
- `GConnectionHorizontal.getPoints({x:0,y:20}, {x:80,y:40})` → `[{x:0,y:20}, {x:80,y:20}, {x:80,y:40}]`
- `GConnectionHorizontal.getPoints({x:0,y:20}, {x:80,y:20})` → `[{x:0,y:20}, {x:80,y:20}]` (same y → 2 points)
- Both classes satisfy the `GConnection` interface (compile-time check)

## Write-set

- `src/diagrams/activity/routing/gconnection.ts`
- `src/diagrams/activity/routing/gconnection-vertical-down.ts`
- `src/diagrams/activity/routing/gconnection-horizontal.ts`
- `src/diagrams/activity/routing/index.ts`
- `tests/diagrams/activity/routing/gconnection.test.ts`

## Read-set

- `src/diagrams/activity/tiles/points.ts` — GPoint type
- `src/diagrams/activity/tiles/tile.ts` — GConnection will reference GPoint
- `plans/activity-rewrite/decisions.md#d2` — GConnection output spec

## Architecture Decisions

- D2: GConnection returns `GPoint[]` waypoints; renderer draws polylines
- D4: One file per routing concept

## Acceptance Criteria

- Given `GConnectionVerticalDown`, when `getPoints` is called with any two
  points, then only the two endpoints are returned (no intermediate points)
- Given `GConnectionHorizontal`, when from and to have different y values,
  then exactly 3 waypoints are returned with a right-angle bend
- Given `GConnectionHorizontal`, when from and to have the same y, then
  only 2 waypoints are returned (degenerate case)
- Given `npm test`, then all new routing tests pass

## Quality Bar

`npm run typecheck`, `npm test`, `npm run lint` must all pass.
Commit: `feat(activity): add GConnection interface and simple routing classes`
