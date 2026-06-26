# T5 — Loop Routing Classes

## Context

plantuml-js is a TypeScript port of PlantUML. Stack: TypeScript + Vitest +
Vite. Test command: `npm test`. Typecheck: `npm run typecheck`. Lint:
`npm run lint`. Build: `npm run build`. All four must pass.

T2 established tile infrastructure. T4 established the `GConnection` interface.
This task adds routing classes for back-edges (while/repeat loops) and
fork/split branch arrangement. These are the routing classes corresponding to
Java's `GConnectionVerticalDownThenBack`, `GConnectionDownThenUp`, and
`GConnectionSideThenVerticalThenSide`.

## Task

### 1. `src/diagrams/activity/routing/gconnection-vertical-down-then-back.ts`

While-loop back-edge: from the loop body's south hook, go down slightly, turn
right, travel up the right side of the loop tile, turn left, arrive at the
while header's north or west hook.

Constructor receives `rightMargin: number` — how far right of the tile boundary
to route the return edge. Default: 20.

Waypoints (all canvas-absolute, passed as `from` = body-south, `to` = header-north):
```
from
{ x: from.x + rightMargin, y: from.y }      ← go right
{ x: from.x + rightMargin, y: to.y }        ← go up
to
```

### 2. `src/diagrams/activity/routing/gconnection-down-then-up.ts`

Repeat-loop back-edge: used for `repeat ... backward`. Exits south from the
condition check, routes around the left side to re-enter the body from the
north. Constructor receives `leftMargin: number` (default: 20).

Waypoints (`from` = condition-south, `to` = body-north):
```
from
{ x: from.x - leftMargin, y: from.y }       ← go left
{ x: from.x - leftMargin, y: to.y }         ← go up
to
```

### 3. `src/diagrams/activity/routing/gconnection-side-then-vertical-then-side.ts`

Fork/split branch horizontal connection. Used when two tiles in a fork are
side-by-side and need to connect to a join bar below. Routes: right from
`from`, down, then left to `to` (or straight down if x coords match).

Waypoints (`from` = branch-south-hook, `to` = join-bar-entry):
```
if from.x === to.x: [from, to]
else: [from, { x: from.x, y: to.y }, to]
```

### 4. Update `src/diagrams/activity/routing/index.ts`

Add exports for the three new classes.

### 5. Tests — `tests/diagrams/activity/routing/loop-routing.test.ts`

- `GConnectionVerticalDownThenBack` with `rightMargin=20`:
  from `{x:50, y:100}` to `{x:50, y:10}` → 4 points:
  `[{50,100}, {70,100}, {70,10}, {50,10}]`
- `GConnectionDownThenUp` with `leftMargin=20`:
  from `{x:50, y:100}` to `{x:50, y:10}` → 4 points:
  `[{50,100}, {30,100}, {30,10}, {50,10}]`
- `GConnectionSideThenVerticalThenSide` same x: 2 points
- `GConnectionSideThenVerticalThenSide` different x: 3 points

## Write-set

- `src/diagrams/activity/routing/gconnection-vertical-down-then-back.ts`
- `src/diagrams/activity/routing/gconnection-down-then-up.ts`
- `src/diagrams/activity/routing/gconnection-side-then-vertical-then-side.ts`
- `src/diagrams/activity/routing/index.ts` (extend exports)
- `tests/diagrams/activity/routing/loop-routing.test.ts`

## Read-set

- `src/diagrams/activity/routing/gconnection.ts` (from T4) — GConnection interface
- `src/diagrams/activity/tiles/points.ts` — GPoint type
- `plans/activity-rewrite/decisions.md#d2` — waypoint contract

## Architecture Decisions

- D2: GConnection returns `GPoint[]` waypoints
- D4: One file per routing concept

## Acceptance Criteria

- Given a `GConnectionVerticalDownThenBack` with rightMargin=20,
  when from={x:50,y:100} and to={x:50,y:10}, then exactly 4 waypoints
  form a right-side back-edge path
- Given a `GConnectionDownThenUp` with leftMargin=20,
  when from={x:50,y:100} and to={x:50,y:10}, then exactly 4 waypoints
  form a left-side back-edge path
- Given `GConnectionSideThenVerticalThenSide` with identical x coords,
  then 2 waypoints (straight down)
- Given `npm test`, then all tests pass

## Quality Bar

`npm run typecheck`, `npm test`, `npm run lint` must all pass.
Commit: `feat(activity): add loop and fork routing classes`
