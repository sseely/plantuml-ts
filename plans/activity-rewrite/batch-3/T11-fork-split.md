# T11 — GtileFork + GtileSplit

## Context

plantuml-js is a TypeScript port of PlantUML. Stack: TypeScript + Vitest +
Vite. Test command: `npm test`. Typecheck: `npm run typecheck`. Lint:
`npm run lint`. Build: `npm run build`. All four must pass.

Batch 2 established routing classes and leaf tiles. This task builds two
composite parallel-branch tiles: fork/join (synchronized) and split/end-split
(unsynchronized). Both render a horizontal bar above and below the branches.

Bar geometry:
- `BAR_HEIGHT = 8` — height of the fork/join bar
- `BAR_OVERHANG = 10` — how far the bar extends left/right of the branch area

## Task

### `src/diagrams/activity/tiles/gtile-fork.ts`

Synchronized parallel branches (fork...join). Fork bar + branches side-by-side
+ join bar.

Constructor:
```typescript
(
  branches: Tile[],       // one tile per parallel branch
  bounder: StringBounder,
  theme: Theme
)
```

Sizing:
```
const branchTotalWidth = branches.reduce((sum, b) => sum + b.width, 0)
  + (branches.length - 1) * NODE_MARGIN_X;
this.width  = branchTotalWidth + 2 * BAR_OVERHANG;
this.height = BAR_HEIGHT + NODE_MARGIN_Y
            + maxBranchHeight
            + NODE_MARGIN_Y + BAR_HEIGHT;
```

`branchOffsets[i]` — x offset of each branch inside the tile:
```
branchOffsets[0] = BAR_OVERHANG;
branchOffsets[i] = branchOffsets[i-1] + branches[i-1].width + NODE_MARGIN_X;
```

`branchTopY = BAR_HEIGHT + NODE_MARGIN_Y`

Expose:
- `branchOffsets: readonly number[]`
- `branchTopY: number`
- `barWidth: number` (= this.width — the full bar spans the tile)

Hooks:
- `NORTH_HOOK` → `{ x: width/2, y: 0 }`         (center of fork bar)
- `SOUTH_HOOK` → `{ x: width/2, y: height }`     (center of join bar)
- `EAST_HOOK`  → `{ x: width, y: height/2 }`
- `WEST_HOOK`  → `{ x: 0, y: height/2 }`

### `src/diagrams/activity/tiles/gtile-split.ts`

Unsynchronized parallel branches (split...end split). Identical structure to
`GtileFork` but semantically independent (no synchronization bar).

Constructor, sizing, and hooks: identical to `GtileFork`.

The only difference is the node kind tag (`kind: 'split'` vs `kind: 'fork'`)
which is used by the coordinate-assignment phase to generate the correct
renderer node type.

To avoid code duplication: create a private shared helper in `gtile-fork.ts`
(or a local utility) that both classes use for sizing. Do not create a third
shared file (keep to the write-set).

Alternatively, `GtileSplit extends GtileFork` is acceptable if it doesn't
require changes to the write-set.

### Tests

`tests/diagrams/activity/tiles/gtile-fork.test.ts`:
- 2 branches (w=80, w=80) → `width === 80+40+80 + 2*10 === 230`
- `height === BAR_HEIGHT + 20 + maxBranchHeight + 20 + BAR_HEIGHT`
- `branchOffsets[0] === BAR_OVERHANG`, `branchOffsets[1] === BAR_OVERHANG + 80 + NODE_MARGIN_X`
- `NORTH_HOOK.y === 0`, `SOUTH_HOOK.y === height`

`tests/diagrams/activity/tiles/gtile-split.test.ts`:
- Same geometry tests as fork
- `new GtileSplit(branches, ...) instanceof GtileSplit`

## Write-set

- `src/diagrams/activity/tiles/gtile-fork.ts`
- `src/diagrams/activity/tiles/gtile-split.ts`
- `tests/diagrams/activity/tiles/gtile-fork.test.ts`
- `tests/diagrams/activity/tiles/gtile-split.test.ts`

## Read-set

- `src/diagrams/activity/tiles/tile.ts` — TileComposite
- `src/diagrams/activity/tiles/points.ts` — GPoint, HookName
- `src/diagrams/activity/routing/gconnection-side-then-vertical-then-side.ts` — branch routing
- `src/diagrams/activity/layout.ts:70-85` — BAR_HEIGHT, NODE_MARGIN_X constants

## Architecture Decisions

- D1: Tile-relative coordinates
- D4: One file per concept (split extends fork or uses local helper — no third file)

## Acceptance Criteria

- Given `GtileFork` with 2 branches of width 80 and margin 40,
  when `width` is read, then `width === 230` (branches + overhang)
- Given `GtileFork` with 2 branches of heights 60 and 80,
  when `height` is read, then max branch height (80) is used
- Given `GtileSplit` with identical inputs as a fork, when `width` and `height`
  are read, then they equal the fork's dimensions
- Given `npm test`, then all new fork/split tests pass

## Quality Bar

`npm run typecheck`, `npm test`, `npm run lint` must all pass.
Commit: `feat(activity): add GtileFork and GtileSplit composite tiles`
