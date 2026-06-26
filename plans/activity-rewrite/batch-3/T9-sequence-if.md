# T9 — GtileTopDown (Sequence) + GtileIf

## Context

plantuml-js is a TypeScript port of PlantUML. Stack: TypeScript + Vitest +
Vite. Test command: `npm test`. Typecheck: `npm run typecheck`. Lint:
`npm run lint`. Build: `npm run build`. All four must pass.

Batch 2 established leaf tiles and routing classes. This task builds two
composite tiles: the sequence container (`GtileTopDown`, which stacks child
tiles vertically) and the conditional branching tile (`GtileIf`).

Inter-tile spacing: `NODE_MARGIN_Y = 20` between vertically stacked tiles.

## Task

### `src/diagrams/activity/tiles/gtile-top-down.ts`

Vertical sequence of child tiles. Mirrors Java `GtileTopDown`.

Constructor: `(children: Tile[], bounder: StringBounder, theme: Theme)`

Sizing:
```
this.width  = Math.max(...children.map(c => c.width));
this.height = children.reduce((sum, c) => sum + c.height, 0)
            + (children.length - 1) * NODE_MARGIN_Y;
```

Children's tile-relative y-offsets are computed during construction and stored
internally as `childOffsets: number[]`. Child `i` starts at:
```
childOffsets[0] = 0
childOffsets[i] = childOffsets[i-1] + children[i-1].height + NODE_MARGIN_Y
```

Hooks:
- `NORTH_HOOK` → first child's NORTH_HOOK translated by first child's x-offset
  (center the first child): `{ x: width/2, y: 0 }`
- `SOUTH_HOOK` → `{ x: width/2, y: height }`
- `EAST_HOOK`  → `{ x: width, y: height/2 }`
- `WEST_HOOK`  → `{ x: 0, y: height/2 }`

Expose: `childOffsets: readonly number[]`

### `src/diagrams/activity/tiles/gtile-if.ts`

If/elseif/else composite. Mirrors Java `GtileIf`.

Constructor:
```typescript
(
  diamond: GtileDiamond,
  branches: Array<{ tile: Tile; label?: string }>,
  mergeDiamond: GtileDiamond | null,  // null if any branch is terminal
  bounder: StringBounder,
  theme: Theme
)
```

Sizing:
- Branches lay out side-by-side with `NODE_MARGIN_X = 40` gap between them
- Total width = sum of branch widths + (n-1) * NODE_MARGIN_X
- Total height = diamond.height + NODE_MARGIN_Y + tallest branch height
  + (mergeDiamond ? NODE_MARGIN_Y + mergeDiamond.height : 0)

Branch x-offsets: `branchOffsets[0] = 0`, `branchOffsets[i] = sum of widths[0..i-1] + i * NODE_MARGIN_X`

Hooks:
- `NORTH_HOOK` → `{ x: width/2, y: 0 }` (top of diamond)
- `SOUTH_HOOK` → `{ x: width/2, y: height }` (bottom of merge diamond, or bottom of tallest branch)
- `EAST_HOOK`  → `{ x: width, y: height/2 }`
- `WEST_HOOK`  → `{ x: 0, y: height/2 }`

Expose: `branchOffsets: readonly number[]`, `diamondOffsetY: number` (= 0),
`branchOffsetY: number` (= diamond.height + NODE_MARGIN_Y),
`mergeOffsetY: number | null`

### Tests

`tests/diagrams/activity/tiles/gtile-top-down.test.ts`:
- 0 children → width=0, height=0
- 1 child (w=100, h=50) → width=100, height=50, childOffsets=[0]
- 2 children (w=100,h=50 and w=80,h=30) → width=100, height=50+20+30=100, childOffsets=[0,70]
- NORTH_HOOK and SOUTH_HOOK at correct y positions

`tests/diagrams/activity/tiles/gtile-if.test.ts`:
- 2 branches, no merge diamond → height includes only branches, not merge
- 2 branches, with merge diamond → height includes merge
- branchOffsets correct for 2 equal-width branches
- NORTH_HOOK at y=0, SOUTH_HOOK at y=height

## Write-set

- `src/diagrams/activity/tiles/gtile-top-down.ts`
- `src/diagrams/activity/tiles/gtile-if.ts`
- `tests/diagrams/activity/tiles/gtile-top-down.test.ts`
- `tests/diagrams/activity/tiles/gtile-if.test.ts`

## Read-set

- `src/diagrams/activity/tiles/tile.ts` — TileComposite, StringBounder
- `src/diagrams/activity/tiles/points.ts` — GPoint, HookName
- `src/diagrams/activity/tiles/gtile-diamond.ts` — GtileDiamond (from T8)
- `src/diagrams/activity/layout.ts:70-85` — spacing constants

## Architecture Decisions

- D1: Tile-relative coordinates; canvas-absolute assigned later by T13
- D3: Sizing at construction time
- D4: One file per tile

## Acceptance Criteria

- Given `GtileTopDown` with 3 children (heights 40, 30, 50), when `height`
  is read, then `height === 40 + 20 + 30 + 20 + 50 === 160`
- Given `GtileTopDown` with 2 children (widths 100, 60), when `width` is
  read, then `width === 100` (max)
- Given `GtileIf` with 2 branches of equal width 80 and margin 40,
  when `width` is read, then `width === 80 + 40 + 80 === 200`
- Given `GtileIf` with `mergeDiamond=null`, when `SOUTH_HOOK` is called,
  then y equals the tile's total height

## Quality Bar

`npm run typecheck`, `npm test`, `npm run lint` must all pass.
Commit: `feat(activity): add GtileTopDown and GtileIf composite tiles`
