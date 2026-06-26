# T14 — tile-layout.ts Entry Point + Renderer Rewire

## Context

plantuml-js is a TypeScript port of PlantUML. Stack: TypeScript + Vitest +
Vite. Test command: `npm test`. Typecheck: `npm run typecheck`. Lint:
`npm run lint`. Build: `npm run build`. All four must pass.

T13 built `assignCoordinates`. This task builds the top-level entry point
`tile-layout.ts`, which mirrors the existing `layoutActivity` function
signature exactly, and rewires `renderer.ts` and `index.ts` to import from
`tile-layout.ts` instead of `layout.old.ts`.

After this task, the tile-based pipeline is live. `layout.old.ts` is no longer
imported anywhere but is kept for reference (deletion is a follow-up cleanup
commit, not part of this mission).

## Task

### `src/diagrams/activity/layout/tile-layout.ts`

Public interface — must match the existing `layoutActivity` signature exactly:

```typescript
export function layoutActivity(
  ast: ActivityDiagramAST,
  theme: Theme,
  measurer: StringMeasurer,
): ActivityGeometry
```

Implementation:

1. **Early return** for empty AST (same as current):
   ```typescript
   if (ast.nodes.length === 0) {
     return { totalWidth: 0, totalHeight: 0, nodes: [], edges: [], swimlanes: [] };
   }
   ```

2. **Adapt measurer**: Convert `StringMeasurer` (the existing measurer type)
   to `StringBounder` (the tile interface). Both have a dimension-measurement
   method — confirm the shapes match; if not, write a thin adapter.

3. **Build tile tree**: Recursively tile the AST:
   - `tileNodes(ast.nodes, bounder, theme)` → calls the appropriate tile
     constructor for each node kind
   - Returns a single root `Tile` (typically a `GtileTopDown`)

4. **Assign coordinates**: Call `assignCoordinates(rootTile, ast, LAYOUT_MARGIN,
   LAYOUT_MARGIN, bounder, theme)` → returns `ActivityGeometry`

5. **Return** the `ActivityGeometry` directly.

**`tileNodes` dispatcher**: A private function that maps `ActivityNode` kinds
to tile constructors:

```typescript
function tileNode(node: ActivityNode, bounder: StringBounder, theme: Theme): Tile {
  switch (node.kind) {
    case 'start':     return new GtileStart();
    case 'stop':      return new GtileStop();
    case 'end':       return new GtileEnd();
    case 'kill':      return new GtileKill();
    case 'break':     return new GtileBreak();
    case 'action':    return new GtileAction(node, bounder, theme);
    case 'note':      return new GtileNote(node, bounder, theme);
    case 'diamond':   return new GtileDiamond(node.label, bounder, theme);
    case 'if':        return tileIf(node, bounder, theme);
    case 'while':     return tileWhile(node, bounder, theme);
    case 'repeat':    return tileRepeat(node, bounder, theme);
    case 'fork':      return tileFork(node, bounder, theme);
    case 'split':     return tileSplit(node, bounder, theme);
    case 'switch':    return tileSwitch(node, bounder, theme);
    case 'group':     return tileGroup(node, bounder, theme);
    case 'partition': return tilePartition(node, bounder, theme);
    default:
      // Unknown node kinds: emit a minimal placeholder tile so layout
      // continues. Log to console.warn for visibility.
      console.warn(`tile-layout: unknown node kind '${(node as any).kind}'`);
      return new GtileAction({ kind: 'action', label: '?', swimlane: undefined }, bounder, theme);
  }
}
```

Each `tileIf`, `tileWhile`, `tileRepeat`, `tileFork`, `tileSplit`, `tileSwitch`,
`tileGroup`, `tilePartition` is a private function that recursively calls
`tileNode` on child branches.

### Rewire imports

After `tile-layout.ts` exports a `layoutActivity` with the same signature:

1. In `src/diagrams/activity/renderer.ts`:
   Change `from './layout.js'` → `from './layout/tile-layout.js'`
   (types only: ActivityNodeGeo, ActivityEdgeGeo, SwimlaneGeo, ActivityGeometry
   still come from `layout.old.ts` — confirm they are re-exported or move the
   interface exports to a shared `types.ts` if needed to avoid circular imports)

2. In `src/diagrams/activity/index.ts`:
   Change layout import similarly.

**Important**: If moving the type exports to a shared file is needed to break
a circular import, that shared file (`src/diagrams/activity/activity-types.ts`)
is in this task's write-set. Add it if needed.

### Tests

`tests/diagrams/activity/layout/tile-layout.test.ts`:

Round-trip tests using the public `layoutActivity` function:

- Empty AST → `{ totalWidth: 0, totalHeight: 0, nodes: [], edges: [], swimlanes: [] }`
- Single `start` node → 1 node geo, kind='start'
- `start → action("Hello") → stop` → 3 node geos, 2 edge geos, sensible coords
- `if` with two branches → ≥3 node geos
- `while` loop → back-edge present in edges (≥4 waypoints)

These are integration tests of the full tile pipeline.

## Write-set

- `src/diagrams/activity/layout/tile-layout.ts`
- `src/diagrams/activity/renderer.ts` (import path change only)
- `src/diagrams/activity/index.ts` (import path change only)
- `src/diagrams/activity/activity-types.ts` (only if needed to break circular
  import; otherwise do not create)
- `tests/diagrams/activity/layout/tile-layout.test.ts`

## Read-set

- `src/diagrams/activity/layout/tile-coordinates.ts` — assignCoordinates
- `src/diagrams/activity/layout/swimlane-context.ts`
- All tile files (tiles/gtile-*.ts)
- `src/diagrams/activity/layout.ts:1411-1425` — existing layoutActivity
  signature to match exactly
- `src/diagrams/activity/ast.ts` — ActivityDiagramAST, ActivityNode
- `src/diagrams/activity/renderer.ts:1-20` — import sites to update
- `src/diagrams/activity/index.ts` — import sites to update
- `src/core/measurer.ts` — StringMeasurer shape (for adapter)
- `plans/activity-rewrite/decisions.md` — D5 (renderer bridge)

## Architecture Decisions

- D5: renderer.ts import path changes only; no logic changes to renderer
- D6: layout.old.ts is NOT deleted in this task

## Acceptance Criteria

- Given an empty AST, when `layoutActivity` runs, then returns the zero geometry
- Given `start → action("Hello") → stop` AST, when `layoutActivity` runs,
  then 3 nodes are returned with positive coordinates and two edges
- Given a `while` loop AST, when `layoutActivity` runs, then at least one
  edge has ≥4 waypoints (the back-edge)
- Given `npm test`, then ALL existing activity tests still pass (no regressions)
- Given `npm run typecheck`, then zero errors

## Quality Bar

`npm run typecheck`, `npm test`, `npm run lint`, `npm run build` must all pass.
Commit: `feat(activity): wire tile-based layout pipeline as active layoutActivity`
