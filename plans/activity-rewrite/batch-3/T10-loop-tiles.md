# T10 — GtileWhile + GtileRepeat

## Context

plantuml-js is a TypeScript port of PlantUML. Stack: TypeScript + Vitest +
Vite. Test command: `npm test`. Typecheck: `npm run typecheck`. Lint:
`npm run lint`. Build: `npm run build`. All four must pass.

Batch 2 established routing classes (including loop routing) and leaf tiles.
This task builds two composite loop tiles. Both use `GConnectionVerticalDownThenBack`
(while back-edge on right) and `GConnectionDownThenUp` (repeat backward arrow
on left) from T5.

Back-edge right margin constant: `BACK_EDGE_MARGIN = 20` (use locally in the
tile; this is the distance the back-edge routes right of the tile's east boundary).

## Task

### `src/diagrams/activity/tiles/gtile-while.ts`

While-loop composite. Header diamond + body + back-edge (right side).

Constructor:
```typescript
(
  header: GtileDiamond,     // condition diamond
  body: Tile,               // loop body (any composite or leaf)
  exitLabel?: string,       // label on the exit (else) branch
  backLabel?: string,       // label on the back-edge (while-true branch)
  bounder: StringBounder,
  theme: Theme
)
```

Sizing:
```
const backEdgeWidth = BACK_EDGE_MARGIN;
this.width  = Math.max(header.width, body.width) + backEdgeWidth;
this.height = header.height + NODE_MARGIN_Y + body.height + NODE_MARGIN_Y;
```
(The exit continues below the while tile — no merge node inside this tile.)

Expose:
- `headerOffsetY = 0`
- `bodyOffsetY = header.height + NODE_MARGIN_Y`
- `backEdgeRightX: number` (= tile.width — the right edge the back-edge routes to)

Hooks:
- `NORTH_HOOK` → `{ x: width/2 - backEdgeWidth/2, y: 0 }` (center of header)
- `SOUTH_HOOK` → `{ x: width/2 - backEdgeWidth/2, y: height }` (exit below body)
- `EAST_HOOK`  → `{ x: width, y: height/2 }`
- `WEST_HOOK`  → `{ x: 0, y: height/2 }`

### `src/diagrams/activity/tiles/gtile-repeat.ts`

Repeat-until composite. Body + condition diamond + optional back-edge (left).

Constructor:
```typescript
(
  body: Tile,
  condition: GtileDiamond,   // repeat condition
  backwardBody?: Tile,        // optional "backward" block
  bounder: StringBounder,
  theme: Theme
)
```

Sizing:
```
const backEdgeWidth = BACK_EDGE_MARGIN;
this.width  = Math.max(body.width, condition.width) + backEdgeWidth;
this.height = body.height + NODE_MARGIN_Y + condition.height
            + (backwardBody ? NODE_MARGIN_Y + backwardBody.height : 0)
            + NODE_MARGIN_Y;
```

Expose:
- `bodyOffsetY = 0`
- `conditionOffsetY = body.height + NODE_MARGIN_Y`
- `backwardOffsetY: number | null`
- `backEdgeLeftX: number` (= 0 — the left edge the back-edge routes along)

Hooks:
- `NORTH_HOOK` → `{ x: width/2, y: 0 }` (top of body)
- `SOUTH_HOOK` → `{ x: width/2, y: height }` (exit below condition)
- `EAST_HOOK`  → `{ x: width, y: height/2 }`
- `WEST_HOOK`  → `{ x: 0, y: height/2 }`

### Tests

`tests/diagrams/activity/tiles/gtile-while.test.ts`:
- `height === header.height + 20 + body.height + 20`
- `width >= body.width` (back-edge margin adds to right)
- `NORTH_HOOK.y === 0`, `SOUTH_HOOK.y === height`
- `bodyOffsetY === header.height + NODE_MARGIN_Y`

`tests/diagrams/activity/tiles/gtile-repeat.test.ts`:
- `height` with no backward body
- `height` with backward body (larger)
- `NORTH_HOOK` and `SOUTH_HOOK` correct
- `conditionOffsetY === body.height + NODE_MARGIN_Y`

## Write-set

- `src/diagrams/activity/tiles/gtile-while.ts`
- `src/diagrams/activity/tiles/gtile-repeat.ts`
- `tests/diagrams/activity/tiles/gtile-while.test.ts`
- `tests/diagrams/activity/tiles/gtile-repeat.test.ts`

## Read-set

- `src/diagrams/activity/tiles/tile.ts` — TileComposite
- `src/diagrams/activity/tiles/points.ts` — GPoint, HookName
- `src/diagrams/activity/tiles/gtile-diamond.ts` — GtileDiamond
- `src/diagrams/activity/routing/gconnection-vertical-down-then-back.ts` — back-edge
- `src/diagrams/activity/routing/gconnection-down-then-up.ts` — repeat back-edge
- `src/diagrams/activity/layout.ts:70-85` — spacing constants

## Architecture Decisions

- D1: Tile-relative coordinates
- D2: GConnection routing returns waypoints for the back-edge; used by T13
- D4: One file per tile

## Acceptance Criteria

- Given `GtileWhile` with header height 40 and body height 80, when `height`
  is read, then `height === 40 + 20 + 80 + 20 === 160`
- Given `GtileRepeat` with body height 60 and condition height 40,
  when `height` is read, then `height === 60 + 20 + 40 + 20 === 140`
- Given `GtileRepeat` with backward body of height 30, when `height` is read,
  then `height` includes the backward body
- Given `npm test`, then all new loop tile tests pass

## Quality Bar

`npm run typecheck`, `npm test`, `npm run lint` must all pass.
Commit: `feat(activity): add GtileWhile and GtileRepeat composite tiles`
