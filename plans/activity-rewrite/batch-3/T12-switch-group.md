# T12 — GtileSwitch + GtileGroup + GtilePartition

## Context

plantuml-js is a TypeScript port of PlantUML. Stack: TypeScript + Vitest +
Vite. Test command: `npm test`. Typecheck: `npm run typecheck`. Lint:
`npm run lint`. Build: `npm run build`. All four must pass.

Batch 2 established leaf tiles and routing classes. This task adds the three
remaining composite tile types: switch/case (branching on expression),
group (background box with title), and partition (swimlane-style wrapper).

Note on AST nodes: `ActivitySwitch`, `ActivityCase`, `ActivityGroup`,
`ActivityPartition` are being added to the AST in a companion task. If those
types don't exist yet, define minimal local interfaces inline and annotate with
`// TODO: import from ast.ts once extended`. Do not stop — continue with the
local definition and note it in the decision journal.

## Task

### `src/diagrams/activity/tiles/gtile-switch.ts`

Switch/case branching. Diamond + cases side-by-side + optional merge point.

Constructor:
```typescript
(
  diamond: GtileDiamond,
  cases: Array<{ tile: Tile; label?: string }>,
  mergeDiamond: GtileDiamond | null,
  bounder: StringBounder,
  theme: Theme
)
```

Sizing: identical to `GtileIf` (diamond + branches side-by-side + optional merge).
Re-use the same layout formula:
```
width  = sum of case widths + (n-1) * NODE_MARGIN_X
height = diamond.height + NODE_MARGIN_Y + maxCaseHeight
       + (mergeDiamond ? NODE_MARGIN_Y + mergeDiamond.height : 0)
```

Hooks: same as `GtileIf` — NORTH at diamond top, SOUTH at merge bottom (or
branch bottom if no merge).

Expose: `caseOffsets: readonly number[]`, `diamondOffsetY`, `caseOffsetY`,
`mergeOffsetY: number | null`

### `src/diagrams/activity/tiles/gtile-group.ts`

Background-box annotation with title. Wraps a body tile.

Constructor:
```typescript
(
  title: string,
  body: Tile,
  bounder: StringBounder,
  theme: Theme
)
```

Sizing:
```
const titleMeasured = bounder.getDimension(title, theme.fontSize);
const TITLE_H = titleMeasured.height + 8;
const H_PAD   = 12;
this.width  = Math.max(body.width + 2 * H_PAD, titleMeasured.width + 2 * H_PAD);
this.height = TITLE_H + NODE_MARGIN_Y + body.height + H_PAD;
```

Expose: `titleHeight: number`, `bodyOffsetX: number` (= H_PAD),
`bodyOffsetY: number` (= TITLE_H + NODE_MARGIN_Y)

Hooks:
- `NORTH_HOOK` → `{ x: width/2, y: 0 }`
- `SOUTH_HOOK` → `{ x: width/2, y: height }`
- `EAST_HOOK`  → `{ x: width, y: height/2 }`
- `WEST_HOOK`  → `{ x: 0, y: height/2 }`

### `src/diagrams/activity/tiles/gtile-partition.ts`

Swimlane-style named partition box. Identical structure to `GtileGroup` but
with a different visual (left-side label or top header). Constructor, sizing,
and hook logic are the same. Expose a `kind: 'partition'` tag.

Constructor, sizing, hooks: same as `GtileGroup`.

### Tests

`tests/diagrams/activity/tiles/gtile-switch.test.ts`:
- 2 cases → width/height same formula as GtileIf
- NORTH_HOOK.y === 0, SOUTH_HOOK.y === height

`tests/diagrams/activity/tiles/gtile-group.test.ts`:
- Short title → width uses body width + padding
- Long title → width uses title width + padding
- `bodyOffsetY === TITLE_H + NODE_MARGIN_Y`
- NORTH_HOOK and SOUTH_HOOK correct

`tests/diagrams/activity/tiles/gtile-partition.test.ts`:
- Same geometry as group
- `tile.kind === 'partition'`

## Write-set

- `src/diagrams/activity/tiles/gtile-switch.ts`
- `src/diagrams/activity/tiles/gtile-group.ts`
- `src/diagrams/activity/tiles/gtile-partition.ts`
- `tests/diagrams/activity/tiles/gtile-switch.test.ts`
- `tests/diagrams/activity/tiles/gtile-group.test.ts`
- `tests/diagrams/activity/tiles/gtile-partition.test.ts`

## Read-set

- `src/diagrams/activity/tiles/tile.ts` — TileComposite
- `src/diagrams/activity/tiles/points.ts` — GPoint, HookName
- `src/diagrams/activity/tiles/gtile-diamond.ts` — GtileDiamond
- `src/diagrams/activity/ast.ts` — ActivitySwitch, ActivityGroup, ActivityPartition
  (may need to be defined locally if AST extensions not yet merged)
- `src/diagrams/activity/layout.ts:70-85` — spacing constants

## Architecture Decisions

- D1: Tile-relative coordinates
- D4: One file per tile type

## Acceptance Criteria

- Given `GtileSwitch` with 2 cases of width 80 and margin 40,
  when `width` is read, then `width === 200`
- Given `GtileGroup` with a short title and body width 100,
  when `width` is read, then `width === 100 + 2*12 === 124` (or larger if
  title is wider)
- Given `GtilePartition`, when `kind` is read, then `'partition'`
- Given `npm test`, then all new composite tile tests pass

## Quality Bar

`npm run typecheck`, `npm test`, `npm run lint` must all pass.
Commit: `feat(activity): add GtileSwitch, GtileGroup, GtilePartition composite tiles`
