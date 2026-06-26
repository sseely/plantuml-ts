# Component Map — After Tile Rewrite

```mermaid
graph TD
    AST["ast.ts\nActivityDiagramAST\n(extended for Switch/Group/Spot/Goto/Label)"]
    PARSER["parser.ts\n(unchanged)"]
    TILES["tiles/\nGtileStart, GtileStop, GtileEnd\nGtileBreak, GtileKill\nGtileAction, GtileNote\nGtileDiamond, GtileSpot, GtileLabel\nGtileTopDown, GtileIf\nGtileWhile, GtileRepeat\nGtileFork, GtileSplit\nGtileSwitch, GtileGroup, GtilePartition"]
    ROUTING["routing/\nGConnectionVerticalDown\nGConnectionHorizontal\nGConnectionVerticalDownThenBack\nGConnectionDownThenUp\nGConnectionSideThenVerticalThenSide"]
    TILEBASE["tiles/tile.ts\nTile, TileLeaf, TileComposite\nStringBounder"]
    POINTS["tiles/points.ts\nGPoint, HookName\nNORTH_HOOK, SOUTH_HOOK\nEAST_HOOK, WEST_HOOK"]
    TILELAYOUT["layout/tile-layout.ts\nlayoutActivity()\ntileNode dispatcher\ntileIf, tileWhile, tileFork ..."]
    COORDS["layout/tile-coordinates.ts\nassignCoordinates()\n→ ActivityNodeGeo[]\n→ ActivityEdgeGeo[]\n→ SwimlaneGeo[]"]
    SWIMCTX["layout/swimlane-context.ts\nSwimlaneContext\nbuildSwimlaneContexts()"]
    RENDERER["renderer.ts\n(import path change only)"]
    SKIN["src/core/skinparam.ts\n+ activity keys\n(add only)"]
    THEME["src/core/theme.ts\n+ colors.graph.activity\n(add only)"]
    OLD["layout.old.ts\n(renamed; kept as reference)"]

    PARSER --> AST
    AST --> TILELAYOUT
    TILELAYOUT --> TILES
    TILES --> TILEBASE
    TILES --> POINTS
    TILELAYOUT --> COORDS
    COORDS --> ROUTING
    COORDS --> SWIMCTX
    COORDS --> RENDERER
    SKIN --> THEME
    THEME -.->|colors fed to| TILELAYOUT
    OLD -.->|reference only| TILELAYOUT
```

## Key Invariants

- `tiles/` files carry no canvas-absolute coordinates — tile-relative only
- `tile-coordinates.ts` is the only file that converts tile-relative → canvas-absolute
- `renderer.ts` is unchanged except for a single import path update (T14)
- `layout.old.ts` is never imported after T14 lands
