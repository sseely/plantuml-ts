# T6 — Simple Leaf Tiles (Start, Stop, End, Break, Kill)

## Context

plantuml-js is a TypeScript port of PlantUML. Stack: TypeScript + Vitest +
Vite. Test command: `npm test`. Typecheck: `npm run typecheck`. Lint:
`npm run lint`. Build: `npm run build`. All four must pass.

T2 established `TileLeaf`, `GPoint`, and `HookName`. This task implements
the five fixed-size leaf tiles that correspond to circle/marker nodes in the
activity diagram. These tiles have no text and fixed dimensions derived from
the existing geometry constants in `layout.ts`.

Existing geometry constants (from `layout.ts`):
- `START_STOP_RADIUS = 10` — filled black circle
- `STOP_OUTER_RADIUS = 14` — outer circle for stop (inner radius = 10)
- End node: a crossed circle, outer radius = STOP_OUTER_RADIUS

## Task

Each tile extends `TileLeaf` and:
- Computes `width` and `height` at construction time (no measurer needed —
  dimensions are fixed)
- Implements `getCoord(hook)` returning tile-relative coordinates:
  - `NORTH_HOOK` → `{ x: width/2, y: 0 }`
  - `SOUTH_HOOK` → `{ x: width/2, y: height }`
  - `EAST_HOOK`  → `{ x: width, y: height/2 }`
  - `WEST_HOOK`  → `{ x: 0, y: height/2 }`

### `src/diagrams/activity/tiles/gtile-start.ts`
Filled black circle. `radius = 10`. `width = height = radius * 2`.

### `src/diagrams/activity/tiles/gtile-stop.ts`
Circle-in-circle (stop). Outer `radius = 14`. `width = height = radius * 2`.

### `src/diagrams/activity/tiles/gtile-end.ts`
Crossed circle (end/terminate). Same outer radius as stop: `radius = 14`.
`width = height = radius * 2`.

### `src/diagrams/activity/tiles/gtile-break.ts`
Break marker. Treat as a diamond with `min = 20`. `width = height = 20`.
(Break is rendered as a hexagonal/diamond shape; use a square bounding box.)

### `src/diagrams/activity/tiles/gtile-kill.ts`
Kill/detach marker. Same as stop shape (`radius = 14`). `width = height = radius * 2`.

### Tests — `tests/diagrams/activity/tiles/gtile-simple-leaf.test.ts`

For each tile class:
- `width` and `height` are positive numbers
- `getCoord(NORTH_HOOK).y === 0`
- `getCoord(SOUTH_HOOK).y === height`
- `getCoord(NORTH_HOOK).x === width / 2`
- `getCoord(EAST_HOOK).x === width`
- `getCoord(WEST_HOOK).x === 0`

## Write-set

- `src/diagrams/activity/tiles/gtile-start.ts`
- `src/diagrams/activity/tiles/gtile-stop.ts`
- `src/diagrams/activity/tiles/gtile-end.ts`
- `src/diagrams/activity/tiles/gtile-break.ts`
- `src/diagrams/activity/tiles/gtile-kill.ts`
- `tests/diagrams/activity/tiles/gtile-simple-leaf.test.ts`

## Read-set

- `src/diagrams/activity/tiles/tile.ts` — TileLeaf base class
- `src/diagrams/activity/tiles/points.ts` — GPoint, HookName constants
- `src/diagrams/activity/layout.ts:70-85` — geometry constants to match

## Architecture Decisions

- D1: Tile-relative coordinates (no x/y in constructor)
- D3: Construction-time sizing (trivial — no measurer needed for fixed-size tiles)
- D4: One file per tile

## Acceptance Criteria

- Given a `GtileStart`, when `width` and `height` are read, then both equal 20
- Given any simple leaf tile, when `getCoord(NORTH_HOOK)` is called,
  then `y === 0` and `x === width/2`
- Given any simple leaf tile, when `getCoord(SOUTH_HOOK)` is called,
  then `y === height` and `x === width/2`
- Given `npm test`, then all new tile tests pass

## Quality Bar

`npm run typecheck`, `npm test`, `npm run lint` must all pass.
Commit: `feat(activity): add simple leaf tiles (start, stop, end, break, kill)`
