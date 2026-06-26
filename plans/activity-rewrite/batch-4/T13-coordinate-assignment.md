# T13 — Tile Coordinate Assignment

## Context

plantuml-js is a TypeScript port of PlantUML. Stack: TypeScript + Vitest +
Vite. Test command: `npm test`. Typecheck: `npm run typecheck`. Lint:
`npm run lint`. Build: `npm run build`. All four must pass.

Batch 3 built all composite tiles. This task builds the coordinate-assignment
phase: a recursive walk over the tile tree that assigns canvas-absolute (x, y)
to each tile and produces the flat `ActivityNodeGeo[]`, `ActivityEdgeGeo[]`,
and `SwimlaneGeo[]` arrays that the existing renderer already consumes.

This is the bridge between the tile model (D1: tile-relative coordinates) and
the renderer's data contract (D5: flat arrays).

The existing renderer already handles `ActivityNodeGeo`, `ActivityEdgeGeo`,
`SwimlaneGeo`, and `ActivityGeometry` — do NOT change those interfaces.
They are imported from `layout.ts` (or after T1, from `layout.old.ts`).

## Task

### `src/diagrams/activity/layout/swimlane-context.ts`

```typescript
export interface SwimlaneContext {
  name: string;
  x: number;       // canvas-absolute left edge of lane
  width: number;   // lane width
}

export function buildSwimlaneContexts(
  laneNames: string[],
  startX: number,
  laneWidth: number,
): SwimlaneContext[] {
  return laneNames.map((name, i) => ({
    name,
    x: startX + i * laneWidth,
    width: laneWidth,
  }));
}
```

### `src/diagrams/activity/layout/tile-coordinates.ts`

Main export:
```typescript
export function assignCoordinates(
  root: Tile,
  ast: ActivityDiagramAST,
  baseX: number,
  baseY: number,
  bounder: StringBounder,
  theme: Theme,
): ActivityGeometry
```

This function:

1. **Swimlane pass** (if `ast.swimlanes` is non-empty): compute lane widths
   and positions using `buildSwimlaneContexts`. Total canvas width =
   `laneNames.length * SWIMLANE_MIN_WIDTH` (minimum; expand to fit content).

2. **Recursive walk** over the tile tree. For each tile type:
   - Compute its canvas (x, y) based on its parent's offset and the tile's
     position within the parent (using `childOffsets`, `branchOffsets`, etc.)
   - Emit an `ActivityNodeGeo` for leaf tiles
   - For composite tiles, recurse into children

3. **Edge routing**: After coordinate assignment, for each connection between
   tiles, instantiate the appropriate `GConnection` class, call
   `getPoints(from, to)` with canvas-absolute hook coordinates, and emit
   `ActivityEdgeGeo`.

4. **Back-edge routing** for `GtileWhile` and `GtileRepeat`: use
   `GConnectionVerticalDownThenBack` and `GConnectionDownThenUp` respectively.

5. **Swimlane geometry**: Emit `SwimlaneGeo[]` from `SwimlaneContext[]`.

6. **Bounds**: Scan all node and edge coordinates to compute
   `totalWidth` and `totalHeight`. Add `LAYOUT_MARGIN = 12` on all sides.

**The tile tree traversal is driven by a `kind` discriminant on each tile.**
Each concrete tile class must expose a `kind` string property so the walker
can dispatch to the correct rendering logic. Add `kind` properties to tile
classes as needed (push-forward rule: minor additions to tile files within the
tile write-set are permitted to make the walker work).

### Tests — `tests/diagrams/activity/layout/tile-coordinates.test.ts`

Build a simple tile tree manually (no AST parser needed):
- Single `GtileAction` at (0, 0) → one node geo, no edges
- `GtileTopDown` with 2 `GtileAction` children → 2 node geos, 1 edge between them
- Node geo x/y values match expected canvas-absolute positions
- `totalWidth >= node.width + 2 * LAYOUT_MARGIN`
- `totalHeight >= node.height + 2 * LAYOUT_MARGIN`
- `GtileWhile` → produces a back-edge with ≥4 waypoints

## Write-set

- `src/diagrams/activity/layout/tile-coordinates.ts`
- `src/diagrams/activity/layout/swimlane-context.ts`
- `tests/diagrams/activity/layout/tile-coordinates.test.ts`

## Read-set

- `src/diagrams/activity/tiles/tile.ts` — Tile, TileLeaf, TileComposite
- `src/diagrams/activity/tiles/points.ts` — GPoint, HookName constants
- All tile files (tiles/gtile-*.ts) — for kind dispatch and childOffsets
- All routing files (routing/gconnection-*.ts) — for edge waypoints
- `src/diagrams/activity/layout.ts:29-64` — ActivityNodeGeo, ActivityEdgeGeo,
  SwimlaneGeo, ActivityGeometry interfaces (import from layout.old.ts after T1)
- `src/diagrams/activity/ast.ts` — ActivityDiagramAST (for swimlane list)
- `src/core/theme.ts` — Theme

## Architecture Decisions

- D1: All coordinates are tile-relative until this module; canvas-absolute
  only assigned here
- D2: GConnection.getPoints() called here with canvas-absolute hook coords
- D5: Output is flat ActivityNodeGeo[]/ActivityEdgeGeo[] for renderer

## Acceptance Criteria

- Given a `GtileTopDown` with 2 `GtileAction` children at baseX=12, baseY=12,
  when `assignCoordinates` runs, then node[0].y === 12 and
  node[1].y === 12 + node[0].height + NODE_MARGIN_Y
- Given a `GtileWhile`, when `assignCoordinates` runs, then the back-edge
  `ActivityEdgeGeo` has ≥4 waypoints
- Given no swimlanes, when `assignCoordinates` runs, then
  `swimlanes` array is empty
- Given `npm test`, then all new coordinate-assignment tests pass

## Quality Bar

`npm run typecheck`, `npm test`, `npm run lint` must all pass.
Commit: `feat(activity): add tile coordinate assignment and swimlane context`
