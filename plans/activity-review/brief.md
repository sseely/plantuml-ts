# Architecture Brief: PlantUML Activity Diagram Reimplementation

## 1. Executive Summary

Our current activity implementation uses single-pass absolute coordinate assignment, which cannot properly handle tile composition, swimlane geometry, or edge routing from tile boundaries. Java's gtile engine organizes layouts as self-sizing tiles with named attachment hooks (NORTH/SOUTH/EAST/WEST) that compose hierarchically. The reimplementation must replace `layout.ts` with a tile-based framework where each node type (action, if, while, fork) returns a `Tile` object with intrinsic width, height, and internal point geometry, enabling swimlane-aware composition and general-purpose edge routing.

## 2. Gap Table: Instruction Types

| Instruction Class | We have it? | Gap Severity | Notes |
|---|---|---|---|
| InstructionSimple | Yes | None | Maps to ActivityAction; color and stereotype support exists |
| InstructionStart | Yes | None | Maps to ActivityStart |
| InstructionStop | Yes | None | Maps to ActivityStop |
| InstructionEnd | Yes | None | Maps to ActivityEnd; distinct from stop |
| InstructionSpot | **No** | Medium | Named colored marker; needs ActivitySpot node + renderer |
| InstructionBreak | Yes | Minor | ActivityBreak exists; break-exit synthetic node handling is simplified |
| InstructionGoto | **No** | Medium | Unconditional jump; requires label-goto post-layout pass |
| InstructionLabel | **No** | Medium | Jump target marker; required for goto support |
| InstructionList | Yes | None | Sequential container; mapped to branch arrays |
| InstructionIf | Yes | Medium | Partial; elseif chains parse correctly, but layout short-circuits on 2-branch with terminal |
| InstructionWhile | Yes | Medium | Parsed; back-edge routing is hardcoded, not tile-composed |
| InstructionRepeat | Yes | Medium | Parsed; break handling is simplified (no back-edge from break) |
| InstructionFork | Yes | Medium | Parsed; branches always synchronized (no async variants) |
| InstructionSplit | Yes | Medium | Parsed; visual distinction from fork is unclear in renderer |
| InstructionSwitch | **No** | Critical | Switch/case/default not supported; absent from parser and AST |
| InstructionGroup | **No** | Medium | Group/box annotation with background; missing parser and AST |
| InstructionPartition | **Partial** | Medium | Swimlane headers parse and render, but nesting/partitioning semantics unclear |

**Total: 17 instructions; 14 recognized (3 missing critical, 6 partial/simplistic)**

## 3. Structural Mismatches

### 3.1 Width Measurement Decoupling
- **Java gtile**: Each tile measures itself via `calculateDimension(StringBounder)` returning `XDimension2D`. Composite tiles query child dimensions, compose, and return total width cached on the tile.
- **Our model**: Two-phase: `measureSubtreeWidth()` computes dimensions, then `layoutSequence()` assigns coordinates. Measurements not cached; recomputed per branch.
- **Problem**: Edge routing coordinates (e.g., while back-edge right margin `centerX + bodyWidth / 2`) computed once from measured widths. Width changes require manual routing updates. No single source of truth.

### 3.2 Swimlane Geometry Decoupling
- **Java gtile**: Swimlanes are explicit composition contexts. Nodes inside a swimlane are laid out relative to lane origin, not canvas origin. Per-lane layout contexts compose independently.
- **Our model**: Swimlane is an attribute on nodes. Layout is canvas-relative. `nodeCenterX()` snaps nodes to lane centers post-hoc.
- **Problem**: Multi-swimlane forks lay out all branches in canvas space, then snap to lane centers. Column alignment may diverge from upstream (which uses per-lane contexts).

### 3.3 Tile-Boundary Routing
- **Java gtile**: Routing computed from named boundary points (NORTH_HOOK, SOUTH_HOOK, EAST_HOOK, WEST_HOOK, NORTH_BORDER, SOUTH_BORDER). Connection classes (GConnectionVerticalDown, GConnectionSideBySide) route from one tile's hook to another's, independent of tile position.
- **Our model**: layoutWhile/layoutRepeat explicitly compute waypoints using absolute coordinates (`rightX = centerX + halfW + margin`).
- **Problem**: Adding new layout variants requires manual coordinate recalculation. Back-edge routing is hardcoded per construct, not general.

### 3.4 Composite Node Composition
- **Java gtile**: An if tile composes child tiles vertically, measures widths, lays them side-by-side, returns a single tile to parent. Callers compose at tile level, not node level.
- **Our model**: layoutIf returns BranchResult with flat node/edge arrays. Callers wire multiple exits via `exitIds[]` as an array, not as a single composed object.
- **Problem**: No strict layering. Multiple open exits from composite nodes require understanding that one composite has multiple predecessors, not a single tile. Complicates nesting (e.g., if inside repeat).

### 3.5 Short-Circuit If/Terminal Optimization
- **Our model** (lines 769–842 in layout.ts): When 2 branches and one is terminal-only, routes terminal horizontally and main branch downward.
- **Problem**: Violates general side-by-side model; special case that diverges from upstream for 2-branch if with terminal.

### 3.6 Edge Label Transience
- **Java gtile**: Edge labels are part of tile composition (LinkRendering carries label + color).
- **Our model**: `arrow-label` nodes intercepted in layoutSequence, converted to `pendingLabel` consumed by next edge. Label not tied to node.
- **Problem**: If arrow-label precedes branching construct with multiple branches, label attaches to first branch edge, but intended edge may be to specific branch. Ambiguous.

---

## 4. Prerequisites: Primitives Needed

| Primitive | What it is | We have? | Gap | Effort |
|---|---|---|---|---|
| **Tile interface** | Self-sizing composition primitive (width, height, internal point geometry) | No | Need to build Tile, TileLeaf, TileComposite base classes | L |
| **StringBounder (richer API)** | Text measurement for tile sizing via `calculateDimension(StringBounder)` | Partial | `src/core/measurer.ts` exists; needs typed `calculateDimension()` contract on all tile types | S |
| **GPoint (named hooks)** | Named anchor points (NORTH_HOOK, SOUTH_HOOK, EAST_HOOK, WEST_HOOK) on tiles | No | Need GPoint class with static named constants; all tile types must expose `getCoord(name)` | M |
| **GConnection routing** | Named routing patterns (VerticalDown, SideBySide, Back-arrow) | No | Need 4–6 routing classes implementing GConnection interface; each computes waypoints from hook-to-hook deltas | M |
| **LinkRendering (activity variant)** | Edge metadata (label, color, arrow style, swimlane) | Partial | `src/core/` has no LinkRendering; need ActivityLinkRendering or extend existing | S |
| **Swimlane context** | Per-lane layout origin and width for composition | No | Need SwimlaneContext class; tile layout uses lane context instead of canvas context | M |
| **Display (rich text)** | Creole-like markup for labels | Partial | Check if `src/core/display.ts` exists; if not, build minimal version | S |
| **Colors / HColor** | Per-node background, line, fill colors | Partial | `src/core/skinparam.ts` has some color support; activity-specific inline `#color` may need extension | S |
| **BoxStyle enum** | Activity box shape variants (rect, diamond, etc.) | Partial | Not formalized; renderer has shape logic, but no enum for reuse in tile layout | S |
| **Spot marker** | Named colored intermediate waypoint | No | Need ActivitySpot AST node + GtileSpot tile + renderer | S |
| **Goto/Label routing** | Post-layout pass for unconditional jumps | No | Need control-flow rewriting phase after tile layout | L |
| **Switch/Case AST** | Switch statement parsing and composition | No | Need ActivitySwitch, ActivityCase AST nodes + parser regex + layout tile | M |
| **Group/Partition AST** | Group annotation with background box + title | No | Need ActivityGroup, ActivityPartition AST nodes + parser + layout tile | M |

**Effort Summary**: S (8 items, ~2 days), M (4 items, ~4 days), L (2 items, ~6 days). **Total estimated effort for prerequisites: ~2 weeks.**

---

## 5. Keep / Extend / Replace Verdict

| File | Verdict | Reason |
|---|---|---|
| `src/diagrams/activity/ast.ts` | **Keep** | AST node types are well-structured and cover all current recognized constructs. Swimlane attachment is appropriate for leaf nodes. Will need extension for ActivitySpot, ActivitySwitch, ActivityCase, ActivityGroup, ActivityPartition, but no restructuring required. |
| `src/diagrams/activity/parser.ts` | **Keep** | Recursive descent is clean and correct. Regex matchers are well-documented. Stop-keyword matching is robust. Unbalanced-parenthesis joining is correct. Silent failure on unknown lines is intentional. Comprehensive test coverage (60+ cases). Will need extension for switch, group, partition, spot, goto, label syntax, but no refactoring required. |
| `src/diagrams/activity/layout.ts` | **Replace** | Absolute coordinate computation is fragile and hard to extend. Width measurement is decoupled from layout. Swimlane geometry is post-hoc. Back-edge routing is hardcoded per construct. Short-circuit if/terminal optimization diverges from general model. Architectural mismatch with tile-based composition. Rebuild as tile-based framework. |
| `src/diagrams/activity/renderer.ts` | **Extend** | SVG rendering is pure and fast. Node shape functions are correct. Edge rendering is simple. Swimlane rendering is correct. Gaps: no test coverage for edge label pills, stereotypes (input/output), save parallelogram. Keep structure; add tests for edge label background, verify chevron and parallelogram rendering against upstream. No structural changes needed; rendering is decoupled from layout. |

---

## 6. Recommended Architecture for Reimplementation

### 6.1 New Tile-Based Layout Framework

**New modules:**

1. **`src/diagrams/activity/tiles/tile.ts`**
   - Base interface: `Tile { width: number; height: number; getCoord(name: string): GPoint; }`
   - Concrete classes: `TileLeaf` (simple box, diamond, circle), `TileComposite` (composition of child tiles).
   - Every tile returns a self-contained geometry object; parent tiles compose child tiles by querying their dimensions and arranging them.

2. **`src/diagrams/activity/tiles/points.ts`**
   - `GPoint` class with named static constants: `NORTH_HOOK`, `SOUTH_HOOK`, `EAST_HOOK`, `WEST_HOOK`, `NORTH_BORDER`, `SOUTH_BORDER`.
   - `GPoint.NORTH_HOOK` is the canonical entry point (typically top-center).
   - All tile types expose `getCoord(name: string): GPoint` for routing queries.

3. **`src/diagrams/activity/routing/gconnection.ts`**
   - Base interface: `GConnection { getHooks(): GPoint[]; drawTranslatable(): SVGElement; }`
   - Implementations:
     - `GConnectionVerticalDown`: vertical entry → body → exit.
     - `GConnectionBackArrow`: exits right, curves right/up/left back to entry (for while/repeat).
     - `GConnectionSideBySide`: horizontal branch-to-branch (for fork/split).
   - Each connection computes waypoints from source/target hooks, independent of tile position.

4. **`src/diagrams/activity/layout/tile-layout.ts`** (replaces layout.ts)
   - **Entry point**: `layoutActivityDiagram(ast: ActivityDiagramAST): Tile`
   - **Recursive tilers**:
     - `tileSequence(nodes: ActivityNode[]): Tile` — vertical composition of tiles.
     - `tileAction(node: ActivityAction): Tile` — leaf tile for action box.
     - `tileIf(node: ActivityIf): Tile` — if/elseif/else diamond + branches side-by-side.
     - `tileWhile(node: ActivityWhile): Tile` — loop header + body + back-edge.
     - `tileRepeat(node: ActivityRepeat): Tile` — start + body + condition + back-edge.
     - `tileFork(node: ActivityFork): Tile` — fork bar + branches + join bar.
     - `tileSwitch(node: ActivitySwitch): Tile` — switch diamond + cases side-by-side.
     - `tileGroup(node: ActivityGroup): Tile` — background box + nested content.
   - Each tiler returns a `Tile` object; no coordinate assignment. Coordinates assigned only when rendering.

5. **`src/diagrams/activity/layout/swimlane-context.ts`**
   - `SwimlaneContext` class: per-lane origin (x, y), lane width, layout metadata.
   - Tiles composed within a lane context use lane-relative coordinates, not canvas-relative.
   - Multi-swimlane fork creates separate SwimlaneContext per branch.

6. **`src/diagrams/activity/layout/tile-coordinates.ts`** (new)
   - **After tile layout complete**: Phase 2 assigns canvas-relative (x, y) coordinates by walking the tile tree.
   - `assignCoordinates(rootTile: Tile, baseX: number, baseY: number): TileGeometry`
   - Returns `TileGeometry { tile: Tile; x: number; y: number; children: TileGeometry[]; }`
   - This is where swimlane snapping happens: if node has swimlane, snap x to lane center; otherwise use tile-computed x.

### 6.2 AST Extensions

**New AST node types:**
- `ActivitySpot { kind: 'spot'; name: string; color?: HColor; swimlane?: string; }`
- `ActivitySwitch { kind: 'switch'; expression: string; cases: ActivityCase[]; swimlane?: string; }`
- `ActivityCase { condition: string; body: ActivityNode[]; label?: string; }`
- `ActivityGroup { kind: 'group'; title: string; body: ActivityNode[]; color?: HColor; symbol?: USymbol; swimlane?: string; }`
- `ActivityPartition { kind: 'partition'; name: string; body: ActivityNode[]; swimlane?: string; }`
- `ActivityGoto { kind: 'goto'; targetLabel: string; swimlane?: string; }`
- `ActivityLabel { kind: 'label'; name: string; swimlane?: string; }`

### 6.3 Parser Extensions

Add regex matchers and AST node creation for:
- **Switch/case**: `switch (expr)` → `case (cond):` → `endswitch;`
- **Group/partition**: `group label {` / `partition name {` → `}`
- **Spot**: `spot name #color` (if supported)
- **Goto/label**: `label name;` → `goto name;`

No restructuring needed; parser.ts grows with new matcher blocks.

### 6.4 Renderer Updates

Update renderer.ts to:
- Accept `TileGeometry` instead of flat node arrays.
- Walk tile tree recursively, rendering each tile in place.
- Render GConnection routing (curves, back-arrows, labels).
- Swimlane rendering unchanged (separate pass over swimlane registry).

### 6.5 Build Order

1. **Phase 1**: Tile interfaces + GPoint + concrete leaf tiles (TileAction, TileStart, TileStop, TileCircle).
2. **Phase 2**: GConnection classes + routing logic (VerticalDown, BackArrow, SideBySide).
3. **Phase 3**: Composite tilers (tileSequence, tileIf, tileFork, tileWhile).
4. **Phase 4**: Advanced tilers (tileSwitch, tileGroup, tilePartition, tileGoto).
5. **Phase 5**: Coordinate assignment (tile-coordinates.ts) + swimlane context.
6. **Phase 6**: AST + parser extensions for new node types.
7. **Phase 7**: Renderer walk-and-render + test coverage.

This order ensures each phase can be independently tested before dependent phases begin.

---

## 7. Rename Plan

To allow new tile-based implementation to use canonical module names:

| Current File | Rename To | Reason |
|---|---|---|
| `src/diagrams/activity/layout.ts` | `src/diagrams/activity/layout.old.ts` | Absolute-coordinate model; replaced by `tile-layout.ts` |
| (no change needed) | `src/diagrams/activity/tiles/tile.ts` | New module; canonical name |
| (no change needed) | `src/diagrams/activity/routing/gconnection.ts` | New module; canonical name |

**Keep canonical names**:
- `src/diagrams/activity/ast.ts` — no rename; extension only.
- `src/diagrams/activity/parser.ts` — no rename; extension only.
- `src/diagrams/activity/renderer.ts` — no rename; extension only.

**Migration strategy**:
- Branch layout.ts to layout.old.ts immediately.
- Implement tile-layout.ts alongside (separate module; no name conflict).
- Renderer imports tile-layout.ts (not layout.old.ts) after Phase 7.
- Delete layout.old.ts after verification.

---

## Quality Gates

After each phase, run:
```bash
npm test              # All tests must pass
npm run typecheck     # No type errors
npm run lint          # No linting errors
```

Before merging to main:
```bash
npm test
npm run typecheck
npm run lint
npm run build
```

All four gates must pass.

---

## Estimated Timeline

- **Prerequisites build**: 2 weeks (StringBounder API, GPoint, GConnection, tile interfaces).
- **Tile-based layout reimplementation**: 3 weeks (phases 1–5).
- **AST + parser + renderer**: 2 weeks (phases 6–7 + test coverage).
- **Regression testing + edge cases**: 2 weeks (visual corpus, known issues, special cases).

**Total: ~9 weeks for production-ready reimplementation.**

