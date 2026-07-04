# Activity Diagram — Greenfield Deep Dive (G-4)

This document supplements the mission-guide entry for G-4 (Activity Diagram
Greenfield Rebuild). Read it before drafting any agent prompt for this phase.
The previous implementation was a learning spike and is being replaced entirely.

## Scale of the Java source

| Sub-package | File count | What it contains |
|-------------|-----------|-----------------|
| `activitydiagram3/` | 34 | AST nodes, diagram state, factory wiring |
| `activitydiagram3/command/` | 46 | Every parser command (one per grammar production) |
| `activitydiagram3/ftile/` | 53 | Ftile interface, geometry, edge routing, swimlane wrappers |
| `activitydiagram3/ftile/vcompact/` | 32 | Composite tile builders (if, while, repeat, fork, split, switch, group) |
| `activitydiagram3/ftile/vertical/` | 20 | Leaf tile renderers (box, diamond, start, stop, kill, note) |
| `activitydiagram3/gtile/` | 38 | Independent swimlane layout system |
| **Total** | **~223** | |

This is the second-largest diagram type by file count after sequence. The two
layout systems (ftile and gtile) are each the size of a mid-complexity diagram
type on their own. Budget at least 7 batches.

## Note on shared infrastructure

Activity diagrams do NOT use `src/core/cucadiagram/` (Track SI-1). The Java
source does not use the cucadiagram/svek pipeline — it has its own tile-based
layout system. Do not add cucadiagram as a dependency. The only shared
infrastructure this phase consumes is `src/core/svg.ts` and `src/core/skinparam.ts`.

## Architectural layers

### Layer 1 — Commands and AST (activitydiagram3/command/)

46 command files. Each command parses one grammar production and appends one
or more instruction objects to the diagram's instruction list. The instruction
list is the AST — it is a flat sequence of typed instruction objects in parse
order (not a tree). The tree structure is recovered during tile construction,
not during parsing.

Key command files:

| Command | What it handles |
|---------|----------------|
| `CommandActivity3.java` | `:action text;` — basic action box |
| `CommandActivityLong3.java` | Multi-line action text |
| `CommandArrow3.java` | `->` arrow (with optional label) |
| `CommandArrowLong3.java` | Multi-line arrow label |
| `CommandIf2.java` / `CommandIf4.java` | `if (cond) then (yes)` — two forms |
| `CommandElse3.java` | `else (label)` |
| `CommandElseIf2.java` / `CommandElseIf3.java` | `elseif (cond) then (yes)` |
| `CommandEndif3.java` | `endif` |
| `CommandWhile3.java` | `while (cond) is (yes)` |
| `CommandWhileEnd3.java` | `endwhile (exit-label)` |
| `CommandRepeat3.java` | `repeat` |
| `CommandRepeatWhile3.java` | `repeat while (cond) is (yes)` |
| `CommandBackward3.java` | `backward:text;` (loop back-edge label) |
| `CommandFork3.java` | `fork` |
| `CommandForkAgain3.java` | `fork again` |
| `CommandForkEnd3.java` | `end fork` / `end merge` |
| `CommandSplit3.java` | `split` |
| `CommandSplitAgain3.java` | `split again` |
| `CommandSplitEnd3.java` | `end split` |
| `CommandSwitch.java` | `switch (cond)` |
| `CommandCase.java` | `case (label)` |
| `CommandEndSwitch.java` | `endswitch` |
| `CommandPartition3.java` | `partition "name" { ... }` |
| `CommandCloseGroup3.java` | `}` — closes partition/group |
| `CommandNote3.java` | `note left / right : text` |
| `CommandStart3.java` | `start` |
| `CommandStop3.java` | `stop` |
| `CommandEnd3.java` | `end` |
| `CommandKill3.java` | `kill` / `detach` |
| `CommandBreak.java` | `break` — exits the enclosing while |
| `CommandGoto.java` | `goto label` |
| `CommandLabel.java` | `label label` |
| `CommandSwimlane.java` | `\|lane\|` or `\|=lane\|` (first lane) |
| `CommandSwimlane2.java` | `\|#color\|lane\|` (lane with color) |
| `CommandLink3.java` | Hyperlink `[[url]]` on an action |
| `CommandCircleSpot3.java` | `<&icon>` — OpenIconic spot on action |

### Layer 2 — Ftile system (no swimlanes)

The ftile system is the layout engine used when the diagram has no swimlane
declarations. It is a recursive tile compositor.

**`Ftile` interface** (`ftile/Ftile.java`): Every renderable element is an
Ftile. The interface has one geometrically critical method: `getFtileGeometry()`
returns an `FtileGeometry` describing the tile's total width, height, and the
x-offset of the connection point at the top and bottom. Connection points are
not necessarily centered — the x-offset locates where arrows enter and exit.

**`FtileGeometry`** (`ftile/FtileGeometry.java`): Immutable value type. Fields:
`width`, `height`, `left` (x of top-center connection), `x2` (optional second
x for tiles with two outputs, e.g. diamonds), `pointOut` (y of bottom
connection). FtileGeometry instances compose via `FtileGeometryMerger`.

**`FtileFactory`** (`ftile/FtileFactory.java`): Interface for constructing
tiles. The factory has one method per construct type: `activity()`, `start()`,
`stop()`, `diamond()`, `addNote()`, `createWhile()`, `createIf()`, etc.

**`FtileFactoryDelegator`** (`ftile/FtileFactoryDelegator.java`): Abstract
base for decorator-chain factories. Each delegator wraps an inner factory and
overrides one or more construction methods to intercept specific construct
types. All unhandled calls pass through to the inner factory.

**Delegator chain (wrapping order from `ActivityDiagramFactory3.java`):**

The factory is wrapped outermost-to-innermost as follows. The outermost
delegator is called first; it may call the inner factory, which may call the
next inner factory, and so on.

```
FtileFactoryDelegatorAssembly       ← outermost (vertically sequences)
  FtileFactoryDelegatorIf            ← handles if/elseif/else/endif
    FtileFactoryDelegatorWhile       ← handles while/endwhile
      FtileFactoryDelegatorRepeat    ← handles repeat/backward/repeat-while
        FtileFactoryDelegatorCreateParallel  ← handles fork/split
          FtileFactoryDelegatorCreateGroup   ← handles partition/group
            FtileFactoryDelegatorAddNote     ← wraps tiles to add side notes
              <base FtileFactory>    ← innermost: creates leaf tiles
```

Wrapping order matters: the outermost delegator sees the fully-decorated
inner factory. Agents must replicate this exact order.

**`FtileAssemblySimple`** (`ftile/FtileAssemblySimple.java`): The vertical
sequence combinator. Given two Ftiles, it stacks them vertically, computes the
combined geometry, and records the connection to draw between them (a Snake
from the bottom of tile A to the top of tile B). This is the primary workhorse
of the layout — almost every compound tile reduces to a sequence of
FtileAssemblySimple stacks.

### Layer 3 — Leaf tiles (ftile/vertical/)

| Java class | Renders |
|-----------|---------|
| `FtileBox.java` | `:action text;` rectangle with rounded corners |
| `FtileBoxEmoji.java` | Action box with OpenIconic/emoji in the label |
| `FtileDiamond.java` | Diamond shape (used by if/while as the decision node) |
| `FtileDiamondInside.java` | Diamond with label inside (elseif variant) |
| `FtileDiamondInside2.java` | Diamond with two inside labels |
| `FtileDiamondSquare.java` | Square diamond variant (skinparam `conditionStyle`) |
| `FtileCircleStart.java` | Filled circle (start node) |
| `FtileCircleStop.java` | Filled circle with outer ring (stop node) |
| `FtileCircleEndCross.java` | Circle with X (end node for `end` keyword) |
| `FtileBlackBlock.java` | Solid rectangle (fork/join bar) |
| `FtileThinSplit.java` | Thin horizontal bar (split join) |
| `FtileCircleSpot.java` | Spot icon on action |
| `FtileDecorate.java` | Adds border decoration (group/partition border) |

### Layer 4 — Composite tiles (ftile/vcompact/)

These assemble leaf tiles and recursive sub-diagrams into compound tiles.

**`FtileIfDown.java`**: Normal if/else. Layout: diamond at top; two branches
descend (yes-branch left, no-branch right); branches rejoin at a hidden merge
point below. The two branch widths are measured and the combined width is
`max(yes-width, no-width) + inter-branch-gap`. Branch connection arrows come
out of the diamond's left and right corners.

**`FtileIfLongHorizontal.java`** / **`FtileIfLongVertical.java`**: Long-form
if (`if (cond) is (yes)`). Horizontal places branches side-by-side; vertical
stacks diamonds for elseif chains. `FtileIfLongVertical` is the primary path
for chains of `elseif` — each elseif adds another diamond below the previous
one, with the no-branch continuing downward and the yes-branch going right.

**`FtileWhile.java`**: While loop. Layout: entry diamond at top; loop body
below the diamond; exit diamond (or same diamond) at bottom. The back-edge
goes from the bottom of the loop body back up to the top diamond. `endwhile`
label appears on the exit arrow.

**`FtileRepeat.java`**: Repeat-while loop. Layout: loop body at top; condition
diamond at bottom. Entry is straight down into the body. Back-edge goes from
the diamond back up to the top of the body. `backward:text;` label appears on
the back-edge. The condition diamond has the yes-branch going left (back up)
and the no-branch going down (exit).

**`FtileSwitch.java`**: Switch/case. Layout: one diamond per case, arranged
horizontally. Each case branch descends from its diamond and merges at the
bottom. Similar geometry to FtileIfDown but with N branches.

**`FtileGroup.java`**: Group / partition. Wraps a sub-diagram in a titled
border rectangle. The inner tiles are shifted by the border inset. Used for
both `group` (no border style difference) and `partition` (box border).

**`ParallelBuilderFork.java`** / **`ParallelBuilderMerge.java`** /
**`ParallelBuilderSplit.java`**: Fork and split constructs. Fork has a solid
black bar at entry and exit; Split has a thin bar. Each branch is a
sub-sequence of tiles. Branches are laid out side-by-side; widths are summed;
heights are max of all branch heights. The bottom bar is placed at `y = max
branch height`.

### Layer 5 — Snake edge routing (ftile/Snake.java)

`Snake.java` routes the orthogonal polyline connection between any two tiles.
Input: source point (x, y), target point (x, y), optional label text, optional
label position. Output: an SVG polyline (sequence of horizontal and vertical
segments).

Key cases Snake handles:

- **Straight down**: source and target share the same x. Single vertical segment.
- **Offset**: source x differs from target x. Snake routes down, across, down
  using three segments. The horizontal segment is placed at a y that avoids
  passing through other tiles (collision detection).
- **Back-edge (upward)**: used for while and repeat back-edges. Snake routes
  down, out to the side (past the tile bounding box), up, and back in to the
  target. The horizontal extent is determined by the enclosing tile width plus
  a margin.

`SnakeDirection.java`: Enum tracking the current direction of the snake as it
routes. Used internally by Snake to determine which segments to emit.

`CollisionDetector.java`: Given a set of tile bounding rectangles, determines
whether a proposed horizontal segment at a given y would intersect any tile.
If so, adjusts y to clear the tile.

`MergeStrategy.java`: Controls how branch endpoints are merged back to a single
point after a fork/split/if. Two strategies: `NONE` (no merge bar), `STRAIGHT`
(direct vertical merge).

### Layer 6 — Swimlane support

**Detection**: If any `CommandSwimlane` instruction appears in the instruction
list, the diagram uses the gtile system instead of ftile. This decision is made
once after parsing, before tile construction begins.

**`FtileWithSwimlanes.java`**: Used during ftile rendering when a single tile
spans a lane boundary. Wraps the inner tile and adds the lane divider lines and
labels.

**`Swimlane.java`**: Represents one named lane. Carries color and display name.

**`LaneDivider.java`**: Renders the vertical divider line between lanes,
including the lane header box at the top.

### Layer 7 — Gtile system (gtile/)

The gtile system is an entirely separate layout engine used when swimlanes are
present. It does NOT share code with the ftile system. Each Gtile corresponds
roughly to its Ftile counterpart but adds column-awareness.

**`Gtile` interface** (`gtile/Gtile.java`): Analogous to Ftile. Has
`getRibbon()` returning the Gtile's swimlane column span, and `getGeo()`
returning geometry.

**`GtileColumns.java`**: The central data structure for multi-lane layout.
Maintains the current x-position of each column (lane). When a tile is placed
in a specific lane, `GtileColumns` updates that lane's y-position. Tiles that
span all lanes (fork bars, group borders) force all lanes to the same y before
placement.

**Gtile implementations:**

| Class | Corresponds to |
|-------|---------------|
| `GtileBox.java` | FtileBox |
| `GtileCircleStart.java` | FtileCircleStart |
| `GtileHexagonInside.java` | FtileDiamond (condition node in swimlane) |
| `GtileHexagonInsideLabelled.java` | FtileDiamondInside |
| `GtileIfAlone.java` | FtileIfDown (single branch in one lane) |
| `GtileIfHexagon.java` | FtileIfDown (swimlane-spanning if) |
| `GtileRepeat.java` | FtileRepeat |
| `GtileSplit.java` | ParallelBuilderSplit |
| `GtileGroup.java` | FtileGroup |
| `GtileBreak.java` | Break within a swimlane context |
| `GtileGoto.java` | FtileGoto |
| `GtileLabel.java` | FtileLabel |
| `GtileEmpty.java` | FtileEmpty (spacer) |
| `GtileAssembly.java` | FtileAssemblySimple (vertical sequence) |
| `GtileTopDown.java` | Top-level gtile compositor |

**`GConnection` types** (6 classes): Separate connection-drawing classes for
swimlane edges. Because lanes can be at different y-positions, the connection
routing logic differs from Snake's orthogonal routing.

## Control flow constructs — tile mapping

| Syntax | Tile class | Notes |
|--------|-----------|-------|
| `:action text;` | FtileBox | Color via `#color:action;` |
| `if (c) then (y) ... else (n) ... endif` | FtileIfDown | Normal form |
| `if (c) is (y) ... else (n) ... endif` | FtileIfLongHorizontal | Long form |
| `elseif (c) is (y)` chains | FtileIfLongVertical | Diamond cascade |
| `while (c) is (y) ... endwhile` | FtileWhile | Back-edge goes up left side |
| `repeat ... backward:t; repeat while (c)` | FtileRepeat | Backward label on back-edge |
| `fork ... fork again ... end fork` | ParallelBuilderFork | Solid bar |
| `fork ... fork again ... end merge` | ParallelBuilderMerge | Merge variant |
| `split ... split again ... end split` | ParallelBuilderSplit | Thin bar |
| `switch (c) ... case (l) ... endswitch` | FtileSwitch | N-way diamond |
| `group "name" ... end group` | FtileGroup | Labeled border |
| `partition "name" { ... }` | FtileGroup + FtileDecorate | Box border |
| `kill` | FtileKilled | No exit connection |
| `detach` | FtileKilled variant | No exit connection |
| `break` | (special instruction) | Exits enclosing while |
| `goto label` | FtileGoto | Back-edge via GotoInterceptor |
| `label label` | FtileLabel | Target of goto |
| `note left / right : text` | FtileFactoryDelegatorAddNote | Side box |

## Key watch-outs

### `backward:` label placement

The `backward:text;` instruction in a `repeat` loop labels the back-edge
arrow, not the forward edge. The back-edge goes from the bottom of the loop
body back up to the entry point. The label is placed along this upward segment.
Do not place it on the forward arrow from `repeat` to the first action.

### Swimlane declarations mid-control-flow

`|lane|` syntax can appear anywhere in the instruction stream, including inside
a while loop body or inside one branch of an if/else. The tile system handles
this by associating each instruction with the currently active swimlane at
parse time. Do not assume lane declarations only appear at the top level.

### `kill` in a fork

When `kill` appears inside one branch of a `fork`, it terminates that branch
without emitting an exit arrow. The other fork branches continue normally and
do join at the fork-end bar. The fork-end geometry must account for branches
of differing heights, including branches that terminate with `kill` (height
extends to the point of the kill tile).

### `goto` and back-edge routing

`goto label` creates a backward jump that may span multiple tile heights. The
`GotoInterceptor.java` in the Java source intercepts goto instructions after
tile placement and routes the back-edge around the bounding boxes of all
intervening tiles. The edge exits the goto tile to the right or left, travels
upward outside the tile column, and enters the label tile from the side. This
is distinct from the while/repeat back-edge, which is handled by FtileWhile
and FtileRepeat directly.

### `detach` vs `kill`

Both produce a tile with no bottom connection point. `detach` is stylistically
used inside fork branches to indicate that the branch runs indefinitely (no
join). `kill` is used to terminate a branch explicitly. In the Java source,
both map to the same tile implementation; the distinction is syntactic only.

### Arrow label placement

`-> label;` places a label on the connecting arrow between two actions, not
inside either action box. The label is associated with the Snake connection
between the two tiles, not with either tile's FtileGeometry.

### Note placement (left vs right)

`note left / note right` after an action wraps the action tile via
`FtileFactoryDelegatorAddNote`. The note box is placed at the same y as the
action tile, horizontally adjacent. `FtileFactoryDelegatorAddNote.addNote()`
computes the combined width (`action-width + gap + note-width`) and shifts the
action tile's x-position to center the combined block.

### `elseif` cascade geometry

A chain of `elseif` uses `FtileIfLongVertical` to stack diamonds vertically.
Each diamond's no-branch continues downward to the next diamond. The yes-branch
exits to the right and becomes the branch body. All branch bodies merge at the
bottom. The geometry computation must account for branch bodies of different
heights.

### `conditionStyle` skinparam

`skinparam conditionStyle` controls whether condition nodes render as diamonds
(`diamond`) or squares (`square`). `FtileDiamondSquare.java` handles the square
variant. Read the skinparam before constructing condition tiles.

### `conditionEndStyle` skinparam

`skinparam conditionEndStyle` controls whether the merge point at the bottom
of an if/else renders as a diamond (`diamond`) or is invisible (`hline`).
Affects FtileIfDown merge rendering.

### gtile system is not a thin wrapper

The gtile system is a full reimplementation of the layout logic, not a
decorator on top of ftile. Agents must treat it as a separate implementation
effort. Do not attempt to unify the two systems — the Java source does not, and
the differences are structural (column-based layout vs recursive tile geometry).

## Files to create

```
src/diagrams/activity/
  ast.ts                    — all instruction types
  parser.ts                 — parseActivity(source): ActivityDiagramAST
  ftile/
    types.ts                — Ftile interface, FtileGeometry, Connection types
    factory.ts              — FtileFactory base interface + FtileFactoryDelegator
    assembly.ts             — FtileAssemblySimple + FtileGeometryMerger
    snake.ts                — Snake edge routing + SnakeDirection + CollisionDetector
    vertical/
      box.ts                — FtileBox, FtileBoxEmoji
      diamond.ts            — FtileDiamond, FtileDiamondInside, FtileDiamondInside2, FtileDiamondSquare
      terminals.ts          — FtileCircleStart, FtileCircleStop, FtileCircleEndCross
      block.ts              — FtileBlackBlock, FtileThinSplit
      decorate.ts           — FtileDecorate
      spot.ts               — FtileCircleSpot
    vcompact/
      if.ts                 — FtileIfDown, FtileIfLongHorizontal, FtileIfLongVertical
      while.ts              — FtileWhile
      repeat.ts             — FtileRepeat
      fork.ts               — ParallelBuilderFork, ParallelBuilderMerge, ParallelBuilderSplit
      switch.ts             — FtileSwitch
      group.ts              — FtileGroup
      note.ts               — FtileFactoryDelegatorAddNote
    delegator-chain.ts      — All FtileFactoryDelegator implementations + buildFactory()
  gtile/
    types.ts                — Gtile interface, GtileColumns, GConnection types
    tiles.ts                — All Gtile implementations
  renderer.ts               — renderActivity(ast, theme): SVG string
  index.ts                  — activityPlugin: SyncPlugin

tests/unit/activity/
  parser.test.ts
  ftile/assembly.test.ts
  ftile/snake.test.ts
  ftile/vcompact/if.test.ts
  ftile/vcompact/while.test.ts
  ftile/vcompact/repeat.test.ts
  ftile/vcompact/fork.test.ts
  ftile/vcompact/switch.test.ts
  gtile/columns.test.ts
```

## Suggested batch structure

**Batch 1: AST types + parser + all command parsers**

Parse all 46 command forms into typed instruction objects. No rendering. Output
is `ast.ts` and `parser.ts` with full test coverage for every command syntax.
Include `CommandSwimlane` detection — `parseActivity` must return a flag
indicating whether swimlanes are present.

**Batch 2: Ftile interface + FtileGeometry + leaf tiles**

`ftile/types.ts`, `ftile/assembly.ts` (geometry only, no Snake yet), and all
files under `ftile/vertical/`. Tests verify that each leaf tile returns the
correct FtileGeometry for given input dimensions.

**Batch 3: Composite tiles — if/elseif/else and while/repeat**

`ftile/vcompact/if.ts`, `ftile/vcompact/while.ts`, `ftile/vcompact/repeat.ts`.
Tests verify geometry computation for each composite (width, height, connection
point positions). Use FtileAssemblySimple from Batch 2. Snake edge routing is
stubbed (straight lines only) for this batch.

**Batch 4: Fork/split parallel builders + switch**

`ftile/vcompact/fork.ts`, `ftile/vcompact/switch.ts`. Tests verify N-branch
geometry for fork and switch. ParallelBuilderMerge variant included.

**Batch 5: Snake edge routing + group/partition + goto/label + delegator chain**

`ftile/snake.ts` (full orthogonal routing + CollisionDetector), `ftile/vcompact/group.ts`,
`ftile/vcompact/note.ts`, `ftile/delegator-chain.ts`. Tests verify Snake
routing for straight, offset, and back-edge cases. Tests verify delegator chain
produces the correct factory for each construct.

## Known gaps in the existing spike (do not repeat in rebuild)

The existing spike code in `src/diagrams/activity/` has the following confirmed gaps.
These are NOT bugs to fix in the spike — they are requirements the rebuild must get
right from the start. Read these before writing Batch 3 (if/while/repeat tiles) and
Batch 4 (fork/switch) agent prompts.

### Gap AC-1: Branch labels ([yes]/[no]/custom) are silently discarded

**Files in spike:** `src/diagrams/activity/tiles/gtile-if.ts:30`,
`src/diagrams/activity/layout/tile-coordinates.ts:138–141`
**Root cause:** `GtileIf`, `GtileWhile`, `GtileRepeat` receive label parameters prefixed
`_` and never store them. `tile-coordinates.ts` never writes a `label` field on any edge.
**Requirement:** Store branch labels in tile constructors; emit them on edges in the
coordinate pass. Java ref: `GtileIfAlone.java`, `GtileWhile.java` —
`getTile().getLinks()` carries branch label text.
**This is the most impactful missing feature.** All `if/else`, `while`, and `repeat`
condition labels are invisible in the spike.

### Gap AC-2: `arrow-label` nodes are dropped in tile layout

**File in spike:** `src/diagrams/activity/layout/tile-layout.ts:64–65`
**Root cause:** `case 'arrow-label': return null` — the AST node is discarded entirely.
The old `layout.old.ts` (line 354–441) used a `pendingLabel` mechanism to attach it to
the next edge.
**Requirement:** Pass `arrow-label` text down to the connecting edge between the current
tile and the next. Implement a `pendingLabel` state in the tile-walk or thread it
through `GtileTopDown`. Java ref: any `CommandActivityArrowLabel` consumer.

### Gap AC-3: Fork/join branch column allocation ignores branch-exit label widths

**File in spike:** `src/diagrams/activity/tiles/gtile-fork.ts:33–35`
**Root cause:** Branch column widths account for tile content but not for branch-exit
label text (e.g., the `[yes]`/`[no]` labels on if-branches that sit outside the tile
bounding box).
**Requirement:** In `GtileIf` and `GtileFork`, measure each branch label and add it to
that branch's column allocation in `xOffsets`. Java ref: `GtileIfAlone.java` —
`StringBounder.getDimension(label)` is added to each branch X offset.

**Batch 6: Swimlane support — gtile system**

`gtile/types.ts` and `gtile/tiles.ts`. All Gtile implementations including
GtileColumns. Tests verify column position tracking for multi-lane diagrams.

**Batch 7: Renderer orchestrator + plugin wiring + integration tests**

`renderer.ts` and `index.ts`. Selects ftile vs gtile path based on swimlane
flag. Walks the instruction list, dispatches to the appropriate factory, and
calls Snake to emit all connections. Produces a complete SVG string. Integration
tests use upstream `.puml` fixtures from `tests/corpus/activity/`.

**Quality gates between every batch:**
```sh
npm test && npm run typecheck && npm run lint && npm run build
```
