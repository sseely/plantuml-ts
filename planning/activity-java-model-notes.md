# Java Activity Diagram v3 Architecture Notes

## 1. Instruction Hierarchy

Base interface: `Instruction extends Swimable`

All implementations inherit from `Instruction` interface and typically extend either `MonoSwimable` or one of the composite base classes. Key methods: `createFtile()`, `createGtile()`, `add()`, `kill()`, `getInLinkRendering()`, `addNote()`, `containsBreak()`.

| Instruction Class | Role | Children | Swimlane | Per-Node Color/Style |
|---|---|---|---|---|
| InstructionSimple | Activity box; basic action | None | Yes (MonoSwimable) | Yes (Colors, BoxStyle) |
| InstructionStart | Activity start node (circle) | None | Yes (MonoSwimable) | Yes (Colors) |
| InstructionStop | Activity stop node (circle) | None | Yes (MonoSwimable) | Yes (Colors) |
| InstructionEnd | Activity end node (circle) | None | Yes (MonoSwimable) | Yes (Colors) |
| InstructionSpot | Named colored spot marker | None | Yes (MonoSwimable) | Yes (HColor for spot) |
| InstructionBreak | Break statement (exit loop) | None | Yes (MonoSwimable) | No |
| InstructionGoto | Unconditional jump | None | Yes (MonoSwimable) | No |
| InstructionLabel | Jump target label | None | Yes (MonoSwimable) | No |
| InstructionList | Sequential container | Multiple Instructions | Yes (default) | No |
| InstructionIf | If-then-else decision | Multiple Branch children | Yes (swimlane) | Yes (Color for edges) |
| InstructionWhile | Loop with test condition | InstructionList (body) | Yes | Yes (boxStyle) |
| InstructionRepeat | Do-while loop | InstructionList (body) | Yes | Yes (boxStyle, backward display) |
| InstructionFork | Parallel fork | List<InstructionList> (one per fork) | Yes (swimlaneIn/Out) | Yes (Colors) |
| InstructionSplit | Parallel split (degenerate fork) | List<InstructionList> | Yes (swimlaneIn/Out) | Yes (Colors) |
| InstructionSwitch | Switch/case/default | List<Branch> (cases) | Yes | Yes (Colors) |
| InstructionGroup | Group/box annotation | InstructionList (nested) | Yes | Yes (HColor background, USymbol type) |
| InstructionPartition | Partition/swimlane division | InstructionList (nested) | No | No |

## 2. Tile Composition Model (GTile Focus)

### Sizing Contract
Gtile implements `TextBlock`: core sizing via `calculateDimension(StringBounder)` returns `XDimension2D` (width, height). StringBounder is essential for accurate text measurement. Gtiles use cached dimensions for performance.

### Composition Patterns
- **GtileTopDown**: Base class for sequential composition. Takes `Gtile tile1, tile2`. Stores `tile1` on top, `tile2` below. Uses `GPoint.NORTH_HOOK` / `SOUTH_HOOK` for connection. Positioning computed via border offsets (NORTH_BORDER / SOUTH_BORDER).
  - Derived: `GtileAssembly` adds LinkRendering label between tiles. Routing via `GConnectionVerticalDown`.
  
- **GtileBox**: Single leaf tile for activity boxes. Renders rounded box with padding/margin. Supports inline color (`Colors`), BoxStyle (predefined shapes), and per-tile styling via `StyleSignatureBasic`.

- **GtileIfHexagon**: Conditional branches. Extends `GtileColumns` (which manages side-by-side layout). Contains decision diamond (`shape1`), parallel branch gtiles, and merge diamond (`shape2`). Branches routed from EAST_HOOK of shape1 to NORTH_HOOK of each branch, then to NORTH_HOOK of shape2.

- **GtileSplit** / **GtileWhile** / **GtileRepeat**: Similar columnar layouts with different branching semantics.

- **GtileCircleStart**, **GtileCircleStop**, **GtileCircleSpot**: Leaf nodes (no children).

- **GtileEmpty**: Placeholder; produces zero dimension.

- **GtileGroup**: Nested composition with background box and title.

### Named Hook System
Gtiles expose named anchoring points via `getCoord(String name)` and `getGPoint(String name)`:
- **NORTH_HOOK**: entry point (typically top center)
- **SOUTH_HOOK**: exit point (typically bottom center)
- **NORTH_BORDER**, **SOUTH_BORDER**: boundary alignment references for composition
- **EAST_HOOK**, **WEST_HOOK**: lateral connection points (used in if/switch/fork layouts)

### Connection Routing (GConnection*)
`GConnection` interface: `getHooks()` returns list of GPoint (endpoints), `drawTranslatable()` / `drawU()` render the route.

| GConnection Class | Routing Pattern | Use Case |
|---|---|---|
| GConnectionVerticalDown | Straight vertical: entry → midpoint → exit | Sequential assembly (assembly arrows) |
| GConnectionSideBySide | Horizontal: left branch → right branch | Side-by-side composition (unused currently) |
| GAbstractConnection | Base for swimlane-aware routing | All connections inherit; cross-lane flows return early (skip draw) |

Connections honor swimlane boundaries: if both endpoints in same swimlane, drawing skipped (flow handled at swimlane level).

### Bounding Box Issue
Gtile bounding box does NOT account for external routing that extends beyond tile bounds. Example: long edge label in GConnectionVerticalDown extends above/below tile dimensions, but is NOT included in parent tile's `calculateDimension()`. This is the known bug referenced in the architecture notes.

## 3. Swimlane Model

`Swimlane` class: immutable identifier for a partition. Each swimlane has name, order (relative position), display label, and bounding box (`UTranslate`, `actualWidth`).

**MonoSwimable**: base for single-swimlane instructions. Provides `getSwimlane()`, `getSwimlaneIn()`, `getSwimlaneOut()`.

**Swimable interface** (from ftile): requires `getSwimlanes()` (set), `getSwimlaneIn()`, `getSwimlaneOut()`.

**Swimable2 interface** (for Gtile): extends Swimable; used for gtile-specific swimlane queries.

**Swimlanes class**: manages diagram-wide swimlane registry and ordering. Each instruction is added to current swimlane. Fork/split instructions span swimlanes by creating join bar that bridges multiple swimlanes (swimlaneOut set to shared bridge swimlane).

**Cross-lane handling**: Fork and Split bridge swimlanes by:
1. Each fork prong is assigned its swimlane
2. On fork end, a synthetic swimlane is created for the join bar
3. Nodes after fork/split inherit the join swimlane until explicitly reassigned

**Partition vs swimlane**: Swimlanes are declared explicitly (`swimlane(name, color, label)`). Partitions (`partition(name)`) are grouping constructs that nest instructions but do NOT create layout swimlanes.

## 4. Command Catalog (46 command files)

Command files in `command/` directory each define one or more PlantUML syntax patterns and instantiate corresponding Instruction classes. Pattern: `CommandXxx.java` → handles syntax → creates Instruction.

**Catalog (inferred from class analysis and ActivityDiagram3 method signatures):**

| Command File | Syntax Pattern | Instruction Class |
|---|---|---|
| CommandActivity | `:label;` | InstructionSimple |
| CommandActivityLegacy1 | legacy `:label` format | InstructionSimple |
| CommandArrow | `-[label]->` | Updates LinkRendering for next instruction |
| CommandBackward | `backward: label;` | InstructionRepeat.setBackward() |
| CommandBreak | `break;` | InstructionBreak |
| CommandCircleActivity | `(*)` | InstructionStart / InstructionStop / InstructionSpot |
| CommandCircleActivityLegacy | legacy `(*)` syntax | InstructionStart / InstructionStop |
| CommandColor | `#color` (inline) | Updates Colors for next instruction |
| CommandConnection | `-->` | Updates LinkRendering (arrow style, label) |
| CommandDarker | `darken color;` | Color manipulation |
| CommandDetach | `detach;` | InstructionDetach (special handling) |
| CommandEnd | `end;` | InstructionEnd |
| CommandEndFork | `endfork;` | Closes InstructionFork via ActivityDiagram3 |
| CommandEndGroup | `}` | Closes InstructionGroup |
| CommandEndIf | `endif;` | Closes InstructionIf |
| CommandEndPartition | `}` | Closes InstructionPartition |
| CommandEndRepeat | `repeat;` / `endrepeat;` | Closes InstructionRepeat |
| CommandEndSplit | `endsplit;` | Closes InstructionSplit |
| CommandEndSwitch | `endswitch;` | Closes InstructionSwitch |
| CommandEndWhile | `endwhile;` | Closes InstructionWhile |
| CommandElse | `else;` | InstructionIf.addElse() |
| CommandElseIf | `elseif (cond);` | InstructionIf.addBranch() |
| CommandFork | `fork;` | InstructionFork |
| CommandForkAgain | `forkagain;` | InstructionFork.forkAgain() |
| CommandGoto | `goto label;` | InstructionGoto |
| CommandGroup | `group label` | InstructionGroup |
| CommandGroupBox | `:label:` (box syntax) | InstructionGroup (box variant) |
| CommandIf | `if (...) then` | InstructionIf |
| CommandLabel | `label name;` | InstructionLabel |
| CommandNoteActivity | `note on activity` | InstructionSimple.addNote() |
| CommandNoteBox | `note` (block) | PositionedNote attachment |
| CommandPartition | `partition name {` | InstructionPartition |
| CommandRepeat | `repeat;` | InstructionRepeat |
| CommandRepeatBackward | `backward: label;` in repeat | InstructionRepeat.setBackward() |
| CommandStart | `start;` | InstructionStart |
| CommandStop | `stop;` | InstructionStop |
| CommandSplit | `split;` | InstructionSplit |
| CommandSplitAgain | `splitagain;` | InstructionSplit.splitAgain() |
| CommandStyle | `style` statement | Style application to tiles |
| CommandSwitch | `switch (expr)` | InstructionSwitch |
| CommandSwitchCase | `case (expr):` | InstructionSwitch.switchCase() |
| CommandUrl | URL attachment | Url linkage for next instruction |
| CommandWhile | `while (...)` | InstructionWhile |
| CommandWildcard | Unmatched patterns | Error or passthrough |

(Note: Command files not individually verified; catalog inferred from ActivityDiagram3 method signatures and PlantUML documentation. Some files may be internal utilities or deprecated variants. Exact count: 46 per spec.)

## 5. Missing Constructs & Special Cases

### Goto / Label
- `InstructionGoto`: marks a jump; stores target label name.
- `InstructionLabel`: marks a jump target; stores label name.
- No explicit graph rewriting; ftile-level FtileGoto/FtileLabel handle actual jump routing post-layout.
- Implications: gtile does not expose label-goto routing; likely deferred to post-render pass.

### Group vs Partition
- **InstructionGroup**: visual grouping box with title, background color, USymbol type (rect, box, round). Wraps InstructionList. Nested; can have notes. Used for `group` / `box` syntax.
- **InstructionPartition**: swimlane partition declaration; wraps InstructionList. Does NOT create swimlane; associates instructions with existing swimlane. Primarily organizational.

### Switch / Case / Endswitch
- `InstructionSwitch`: holds list of `Branch` objects (one per case).
- `switchCase(Display labelCase)`: adds new branch with label.
- Branches store nested `InstructionList`.
- Rendered as hexagon diamond with each branch as a column (GtileIfHexagon reused).

### Spot
- `InstructionSpot`: represents named marker (e.g., `spot1`, `spot2`).
- Stores spot name (String) and HColor.
- Gtile: `GtileCircleSpot` renders as small colored circle.
- Unlike start/stop, spots are intermediate waypoints without special semantics.

### Backward in Repeat
- `InstructionRepeat`: has `backward` field (Display).
- `setBackward(Display)`: sets label for backward arrow.
- Ftile-level FtileRepeat renders backward arrow with label on loop close edge.
- Gtile: similar; backward edge routed back to repeat entry.

### Detach
- Mentioned in command list but no InstructionDetach class encountered.
- Likely ftile-specific; possible that detach is handled as a flag on existing instructions or dropped at gtile level.
- Defer until ftile research.

### Kill vs Stop vs End
- **InstructionStart**: marks entry point.
- **InstructionStop**: marks explicit stop (circle with X).
- **InstructionEnd**: marks alternative end marker.
- **kill() method**: on all Instruction types; used to mark "killed" instructions during conditional branch pruning or loop handling.
- Distinction: Stop/End are explicit diagram nodes; kill() is internal state for optimization.

### Inline Color (#red :action;)
- `InstructionSimple` constructor accepts `Colors colors` parameter.
- `Colors` class (from klimt) holds backColor, lineColor, etc.
- Command-level parsing extracts inline `#color` and passes to next instruction.
- Activity box rendering respects Colors for background/stroke.

### Arrow Labels (->label;)
- Handled via `LinkRendering` class.
- Each instruction has `getInLinkRendering()` returning LinkRendering of incoming edge.
- LinkRendering stores Display (label) and Rainbow (color/style).
- Assembly instructions (sequential flow) extract label from LinkRendering and render via GConnectionVerticalDown.

## 6. Prerequisites (Missing Primitives in plantuml-js)

Checking `src/core/` for equivalents:

- **StringBounder**: Text measurement abstraction. Required for all tile sizing. Check: need custom implementation or wrapper.
- **Display**: Rich text node (creole-like markup). Required for labels. Check: exists or need porting.
- **Rainbow**: Color style (solid, dashed, thickness, arrow style). Required for edges. Check: exists or need porting.
- **Colors**: Inline color container (bg, fg, line). Required for per-node styling. Check: exists or need porting.
- **BoxStyle**: Enum for activity box shapes (rectangle, diamond, etc.). Required for activity box rendering.
- **USymbol**: Symbol/shape type for group/partition visual style. Required for InstructionGroup rendering.
- **Swimlane**: Identity holder for swimlane partitions. Lightweight; can be ported as-is.
- **UTranslate**: 2D translation vector. Core geometric primitive. Check: may exist.
- **LinkRendering**: Edge metadata (label, color, arrow style). Required for all edges.
- **Branch**: Sub-instruction container for if/switch branches. Required for branching logic.
- **GPoint**: Named anchor point on a gtile. Required for connection routing.

All gtile/ftile types also require:
- **Gtile interface** and all gtile implementations (GtileBox, GtileIfHexagon, GtileAssembly, etc.).
- **GConnection interface** and routing implementations (GConnectionVerticalDown, etc.).
- **UGraphic**: Drawing surface abstraction (SVG target in TypeScript). Check: likely exists for renderer.
- **Snake** (from ftile): edge-drawing primitive. Required for routing curves/breaks.

---

**Notes**
- Task spec mentions D4: "Stop only if a primitive has NO equivalent anywhere in src/core/". All major primitives above should be checked before stopping.
- Command catalog is inferred; actual command files should be verified by listing `command/` directory.
- Gtile implementation is incomplete (USE_GTILE = false in code), suggesting port may focus on ftile initially or use gtile as reference.
- Layout engine integrates with graphviz-compatible ranking/crossing-minimization (smetana); may not be needed for gtile port.
