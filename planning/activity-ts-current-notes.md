# T2 — TypeScript Activity Implementation Audit

## 1. Parser Inventory

### Recognized Constructs

| Syntax | AST Node | Notes |
|--------|----------|-------|
| `:label;` | ActivityAction | Single or multiline; supports `\n` escapes |
| `:label; #color` | ActivityAction | Color applied to node |
| `:label; <<stereotype>>` | ActivityAction | Stereotypes: `input`, `output`, `save` (lowercase normalized) |
| `start` | ActivityStart | Terminal leaf node |
| `stop` | ActivityStop | Terminal leaf node |
| `end` | ActivityEnd | Terminal leaf node (distinct from stop) |
| `kill` | ActivityKill | Terminal leaf node |
| `detach` | ActivityDetach | Maps to stop during layout |
| `break` | ActivityBreak | Flow control; signals loop exit |
| `if (cond) then (label)` | ActivityIf | Condition and optional then-label |
| `elseif (cond) then (label)` | ActivityElseIf | Nested in if node's elseIfBranches array |
| `else (label)` | part of ActivityIf | Optional else-label on elseBranch |
| `while (cond) [is (label)]` | ActivityWhile | Optional yesLabel |
| `endwhile (label)` | part of ActivityWhile | Captures exitLabel |
| `repeat` ... `repeatwhile (cond)` | ActivityRepeat | Loop body + condition |
| `repeat while (cond)` | ActivityRepeat | Space-separated variant of repeatwhile |
| `fork` ... `fork again` ... `end fork` | ActivityFork | Parallel branch container |
| `split` ... `split again` ... `end split` | ActivitySplit | Parallel branch container (alt to fork) |
| `note right : text` | ActivityNote | Single-line; position defaults to `right` |
| `note left : text` | ActivityNote | Single-line |
| `note` ... `end note` | ActivityNote | Multiline; position defaults to `right` when omitted |
| `-> label ;` | ActivityArrowLabel | Edge annotation (no AST node; consumed as pending label) |
| `-><back:color> label ;` | ActivityArrowLabel | Color tag variant |
| `-><color:color> label ;` | ActivityArrowLabel | Alternative color syntax |
| `\|name\|` | (swimlane header) | Sets currentSwimlane; collected into ast.swimlanes |

### Silently Dropped

**Unknown lines (no parser match):**
- Any line that fails all regex matchers falls through to line 609 in parser.ts (`// Unknown line: skip silently`) and increments the index without creating an AST node.
- **No console.warn or logging** — failures are silent.
- **Implicit tolerance** — if upstream PlantUML has a construct that isn't covered by one of the regexes above, it is silently dropped.

**Partially implemented constructs:**
- None identified as partially implemented (either the regex matches and the node is created, or it doesn't).

**TODO/FIXME comments:**
- None found in parser.ts.

---

## 2. AST Node Inventory

| Type | Represents | Key Fields | Unused/Partial Fields |
|------|-----------|-----------|----------------------|
| **ActivityStart** | Begin marker | `kind: 'start'`, `swimlane?: string` | None |
| **ActivityStop** | Terminator (bullseye) | `kind: 'stop'`, `swimlane?: string` | None |
| **ActivityEnd** | Terminator (crossed circle) | `kind: 'end'`, `swimlane?: string` | None |
| **ActivityKill** | Terminator variant | `kind: 'kill'`, `swimlane?: string` | None |
| **ActivityDetach** | Detach signal (rendered as stop) | `kind: 'detach'`, `swimlane?: string` | None |
| **ActivityBreak** | Loop break signal | `kind: 'break'`, `swimlane?: string` | None |
| **ActivityAction** | Work step / action box | `kind: 'action'`, `label`, `color?`, `stereotype?`, `swimlane?` | None evident |
| **ActivityArrowLabel** | Edge annotation | `kind: 'arrow-label'`, `label`, `color?`, `swimlane?` | `swimlane` is set but may be unused (label is transient) |
| **ActivityIf** | Conditional branching | `kind: 'if'`, `condition`, `thenLabel?`, `elseLabel?`, `thenBranch[]`, `elseBranch[]`, `elseIfBranches[]`, `swimlane?` | `swimlane` on if node vs. branches — mismatch with Java tile model (branches inherit swimlane implicitly) |
| **ActivityWhile** | Loop construct | `kind: 'while'`, `condition`, `yesLabel?`, `exitLabel?`, `body[]`, `swimlane?` | `swimlane` applies to loop header, not body — asymmetric with fork/split |
| **ActivityRepeat** | Do-while variant | `kind: 'repeat'`, `body[]`, `condition`, `swimlane?` | `condition` captures from `repeatwhile`; body may have inline action from `repeat :foo;` |
| **ActivityFork** | Parallel join (tight sync) | `kind: 'fork'`, `branches[][]`, `swimlane?` | `swimlane` at fork level; branches inherit implicitly |
| **ActivitySplit** | Parallel join (async variant) | `kind: 'split'`, `branches[][]`, `swimlane?` | Same as fork — visual distinction unclear in renderer |
| **ActivityNote** | Annotation | `kind: 'note'`, `text`, `position: 'left'\|'right'`, `swimlane?` | `swimlane` set but may be unused (notes float beside, not in swimlane) |
| **ActivityElseIf** | Nested condition | `condition`, `label?`, `body[]` | Not a top-level node; only in if node's elseIfBranches |

**Structural observations:**
- **Swimlane propagation**: Swimlane is attached at composite node level (if, while, fork) and leaf level (action, start). Branches inherit the parent's swimlane implicitly (no swimlane on branch arrays). This mismatch with tile-based layout becomes apparent in layout.ts (see Q4).
- **ActivityArrowLabel**: Transient annotation; not laid out as a node, but consumed as a style property for the next edge.
- **ActivityElseIf**: Embedded struct within ActivityIf; no separate Union member.

---

## 3. Layout Inventory

### Layout Functions and Structure

#### `layoutSequence(nodes[], startY, centerX, ctx) → BranchResult`
- **Purpose**: Lay out a linear sequence of nodes top-to-bottom.
- **Handles**: Chains of actions, control structures, notes. Entry point for all composite node bodies.
- **Structural properties**:
  - Nodes stack vertically; each node placed at `currentY`, which advances after each node.
  - `arrow-label` nodes are intercepted and converted to pending edge properties (not laid out).
  - Notes float beside the previous main-flow node rather than appearing inline.
  - `lastExitIds` tracks multiple exit points from composite nodes (if/fork branches with multiple open exits).
  - Accumulates `breakGeos` from child nodes for repeat-body break handling.

#### `layoutStart() / layoutStop() / layoutAction() / layoutBreak()`
- **Leaf node layouts**: Simple; return geometry + firstId/lastId for edge wiring.
- **layoutBreak**: Special case — sets `lastId: undefined` to prevent outgoing flow edges, signals `kind: 'break-stop'` to layoutSequence.

#### `layoutIf(node, startY, centerX, ctx) → BranchResult`
- **Handles**: Conditional splits with then, zero+ elseif, else branches.
- **Key structural feature**: Measures all branch widths recursively and lays them side-by-side.
- **Short-circuit optimization** (lines 769–842): When exactly 2 branches and one is terminal-only (single stop/end/kill), routes terminal horizontally to the right and main branch downward. This is a **special-case heuristic** that violates the general side-by-side layout model.
- **Exit tracking**: Collects `exitIds` from all branches (only non-terminal branches contribute). If > 1 exit, propagates as `exitIds[]` to parent so next node wires to multiple predecessors.
- **Known issue**: The short-circuit path does not use tile composition; it routes terminal nodes horizontally, which may produce visually different layouts than upstream.

#### `layoutFork() / layoutSplit() / layoutParallelBranches()`
- **Handles**: Parallel branching (fork vs. split distinction is visual only in renderer).
- **Structure**:
  - Top bar (fork-bar or split-bar) — zero-height placeholder.
  - Branches laid out side-by-side in columns.
  - Bottom bar (join-bar) — synchronization point.
- **Edges**: Fork bar → branch starts; branch ends → join bar. Orthogonal routing.
- **Issue**: Branches are always synchronized (both bars span the same width). No async/join support within a fork, unlike some upstream variants.

#### `layoutWhile(node, startY, centerX, ctx) → BranchResult`
- **Handles**: Loop with condition check at top, back-edge from body to header.
- **Key routing**:
  - Header → body: straight down (yesLabel on edge).
  - Body bottom → condition hexagon below.
  - Condition hexagon → back-edge: exits right vertex, routes right then up to right margin, then up and left to header's east vertex (with midArrow at midpoint).
  - No-exit path: header west vertex → left margin → down → synthetic `if-merge` zero-height node at loop bottom.
- **Structural mismatch with tiles** (see Q4): Back-edge routing is hardcoded with absolute coordinates (halfW = max(header, body width) / 2 + margin). Tile model would compose back-edge geometry as a property of the while tile itself.

#### `layoutRepeat(node, startY, centerX, ctx) → BranchResult`
- **Handles**: Do-while: body, then condition, then back-edge to start diamond.
- **Start diamond** → body → condition hexagon → back edge (right vertex of condition hexagon, routes right/up/left to left vertex of start diamond, with midArrow).
- **Break handling** (lines 1315–1352): Drains `breakGeos` from body result. If breaks present, creates synthetic `break-exit` diamond below condition, wires each break geo to it, exposes break-exit diamond as `lastId` so subsequent nodes wire to it.
- **Known issue**: `break-exit` node is artificially positioned; no back-edge from break-exit to loop start (breaks exit the loop entirely). This simplification may diverge from upstream for complex repeat/break combinations.

#### `measureNodeWidth() / measureSubtreeWidth()`
- **Purpose**: Recursively measure column widths for composite nodes before layout.
- **Composite nodes**: Return sum of branch widths + inter-branch margins.
- **Leaf nodes**: Return rendered width from shape-sizing functions (actionSize, diamondSize, etc.).
- **For if/fork/split**: Calculates total branch width as `sum(branch widths) + NODE_MARGIN_X * (numBranches - 1)`.

#### `nodeCenterX(swimlane, fallbackCenterX, ctx) → number`
- **Swimlane alignment**: When swimlanes are active and a node has a swimlane, attempts to place the node in its lane's center. If the fallback X is strictly inside the lane, uses fallback; otherwise snaps to lane center.
- **Limitation**: Simple lane snapping; does not compose swimlane-constrained layout (tile model would have per-lane layout contexts).

### Known Layout Issues

| Issue | Impact | Symptom |
|-------|--------|---------|
| **Short-circuit if/terminal routing** | Terminal branches routed horizontally, main branch downward; asymmetric vs. general side-by-side model. | If layout may differ from upstream for 2-branch if with one terminal. |
| **While back-edge hardcoded routing** | Back-edge coordinates computed as `(rightX, headerCenterY)` using measured widths, not from tile composition. | Width overflows if body wider than measured (rare but possible with complex nesting). |
| **Break exit synthetic node** | `break-exit` diamond placed below condition, wired from all break geos. No back-edge from break to loop. | Break in repeat exits loop cleanly but may diverge from upstream if loop has complex post-break flow. |
| **Swimlane simple snapping** | Nodes snap to lane center if fallback is outside. No per-lane sub-layout. | Multi-swimlane diagrams may have less precise column layout than upstream (which uses per-lane tile contexts). |
| **Note positioning** | Notes float beside preceding main-flow node; if no preceding node, placed at `centerX ± gap`. | First note in sequence has no reference node; may position arbitrarily. |

---

## 4. Structural Mismatches with Tile-Based Layout

The Java implementation uses **tile composition**: each diagram element (action, if, while, etc.) is a self-sizing tile that knows its width and height. Tiles compose vertically and horizontally, with each composite tile (if, fork) calculating its child layout and returning a bounding box to its parent.

Our implementation uses **absolute coordinate assignment in a single pass**: nodes are laid out with explicit (x, y) coordinates computed bottom-up from measured widths.

**Specific mismatches:**

### 1. **Width Measurement Decoupling**
- **Tile model**: Each node measures itself; composite nodes query children's widths, compose, and return total width. Width is intrinsic to the tile.
- **Our model**: Two-phase: first `measureSubtreeWidth()` to get column widths, then `layoutSequence()` to assign coordinates. Measurements are not cached on nodes; recomputed for every branch.
- **Problem**: If a node's width is used in edge routing (e.g., while back-edge right margin `centerX + bodyResult.width / 2 + NODE_MARGIN_X`), a width change in the body requires recalculating routing coordinates. No single source of truth.

### 2. **Swimlane Geometry Decoupling**
- **Tile model** (Java GtileSwimLane): Each swimlane has its own lane context. Nodes inside a swimlane are laid out relative to the lane's origin, not the canvas origin.
- **Our model**: Swimlane is an attribute on nodes; layout still computes canvas-relative (x, y). `nodeCenterX()` snaps nodes to lane centers post-hoc. Swimlane headers are rendered separately.
- **Problem**: A fork spanning multiple swimlanes would lay out each branch in its own lane (Java), but our fork lays out all branches side-by-side in canvas space, then snaps them to lane centers. Multi-swimlane forks may produce visually different column alignment.

### 3. **Back-Edge and Exit Routing**
- **Tile model** (GConnectionVerticalDownThenBack, GConnectionSideThenVertical): Routing is computed as deltas from tile boundaries. Upstream and downstream tiles don't know routing coordinates; they only care about connection points (top-center, left-center, right-center, etc.).
- **Our model**: layoutWhile and layoutRepeat explicitly compute waypoints: `rightX = centerX + halfW + margin`, `leftX = centerX - halfW - margin`. These are absolute coordinates.
- **Problem**: If body width changes, routing points don't automatically adjust. The while loop's right margin is computed once (line 1173) and used for both the back-edge and the exit path. Adding a new node type or layout variant requires manually recalculating routing coordinates.

### 4. **Composite Node Composition**
- **Tile model**: An if tile composes child tiles vertically (yes-branch, no-branch), measures their widths, lays them side-by-side within the if tile's bounding box, and returns a single tile to the parent.
- **Our model**: layoutIf returns a BranchResult with flat arrays of nodes and edges. Callers (layoutSequence) wire these to parent nodes via `exitIds`. Multiple open exits from an if are tracked as an array and wired individually, not as a single composed tile.
- **Problem**: No strict layering between diagram levels. An if node's exitIds can span multiple branches; a parent node wiring to exitIds must understand that it's connecting to multiple predecessors, not a single composed tile. This complicates exit handling when nesting composites (e.g., if inside repeat).

### 5. **Note Placement Coupling**
- **Tile model**: Notes are rendered as separate tiles or decorations tied to action tiles. They are part of the action tile's composed layout.
- **Our model**: Notes are separate nodes in the sequence (kind: 'note'). They don't advance the main flow's `lastId`, so the next main-flow node connects to the last *non-note* node. But notes are measured and positioned relative to the preceding main-flow node, not as a child of that node.
- **Problem**: A note followed by a branching construct (if, fork) may position incorrectly because the branching construct's layout doesn't know about the preceding note's geometry.

### 6. **Edge Label Transience**
- **Tile model**: Edge properties (labels, colors) are computed alongside tiles and are part of tile composition.
- **Our model**: `arrow-label` nodes are intercepted in layoutSequence and converted to a `pendingLabel` property that is consumed by the next edge created. The label is not tied to a node.
- **Problem**: If an arrow-label is followed by a branching construct with multiple branches, the label is attached to the *first* edge from the split diamond, but the intended edge may be to a specific branch. The parser doesn't know which branch an arrow-label is meant for; it's ambiguous.

### 7. **Swimlane Implicitness**
- **Tile model**: Swimlanes are explicit composition contexts. A node in swimlane "Alice" is laid out in Alice's column, not the canvas column.
- **Our model**: Swimlane is an optional attribute on nodes. Composition (layoutSequence) is agnostic to swimlanes; only when placing individual nodes does nodeCenterX snap to a lane center.
- **Problem**: If a composite node (if, fork) has children in different swimlanes, the branch layout still computes canvas-relative widths, not per-lane widths. A fork spanning swimlanes may produce columns that don't align with lane boundaries.

---

## 5. Keep / Extend / Replace Assessment

### ast.ts
**Verdict: KEEP (with minor extensions)**

- AST types are well-structured and cover all recognized constructs.
- ActivityElseIf is embedded; could be extracted to a separate top-level type if needed, but current nesting is acceptable.
- Swimlane attachment is appropriate for leaf nodes; could be improved for composite nodes (e.g., separate swimlane context per branch), but current model is usable.
- **Recommendation**: Keep as-is. If swimlane handling is redesigned, no changes needed here; the extension belongs in layout/renderer.

### parser.ts
**Verdict: KEEP (tested, no structural issues)**

- Recursive descent is clean and correct.
- Regex matchers are well-documented and handle all recognized constructs.
- Stop-keyword matching is robust.
- Unbalanced parenthesis joining is correct.
- Silent failure on unknown lines is intentional (matches upstream behavior of ignoring unparseable lines).
- Test coverage is comprehensive (18 describe blocks, 60+ test cases).
- **Recommendation**: Keep as-is. No refactoring needed.

### layout.ts
**Verdict: REPLACE (architectural mismatch with tile model)**

- Absolute coordinate computation works but is fragile and hard to extend.
- Width measurement is decoupled from layout; width changes require manual edge routing updates.
- Swimlane geometry is ad-hoc; post-hoc snapping vs. intrinsic layout.
- Back-edge routing is hardcoded per construct (while, repeat); no general routing framework.
- Short-circuit if/terminal optimization is a special case that diverges from general model.
- **Recommendation**: Redesign as a tile-based layout engine. Each node/composite returns a self-contained tile with width, height, and internal geometry. Swimlane contexts are explicit. Routing is computed from tile boundary points, not canvas coordinates.
- **Scope**: Significant refactor; would affect all composite node layout functions and edge routing.

### renderer.ts
**Verdict: EXTEND (working rendering, minor coverage gaps)**

- SVG rendering is pure and fast.
- Node shape functions are correct (circles, diamonds, hexagons, parallelograms, notes).
- Edge rendering is simple; polyline + arrowhead.
- Swimlane rendering is correct.
- **Gaps**:
  - No rendering for synthetic `if-merge` nodes (correct; they should be invisible).
  - No rendering for `break` nodes (correct; breaks are flow markers, not visible glyphs).
  - **Missing**: Stereotypes `input` and `output` have renderers (chevrons), but not tested in renderer tests. `save` (parallelogram) is implemented but may not match upstream's shear angle exactly.
  - **Missing**: Edge label background color pill is implemented (line 421–430) but only if color is provided; no test coverage for colored pills.
- **Recommendation**: Keep structure; add test coverage for edge label pills, verify chevron and parallelogram rendering against upstream. No structural changes needed; rendering is decoupled from layout.

---

## 6. Test Coverage Gaps

**Parser tests** (60+ cases in parser.test.ts):
- ✅ Excellent coverage: actions, start/stop/end/kill/detach/break, if/elseif/else, while with labels, repeat/repeatwhile variants, fork/split, swimlanes, colors, stereotypes, notes, arrow-labels.
- ⚠️ Gap: No tests for **error cases** (invalid syntax, unbalanced parentheses that fail to join, malformed action labels).
- ⚠️ Gap: No tests for **interaction cases** (e.g., if with nested repeat and break, fork with swimlane-specific branches).
- ⚠️ Gap: No tests for **edge arrow-label placement** (arrow-label before a composite node with multiple branches).

**Layout tests** (none found in current file listing; may be in a separate file):
- ❌ No unit tests for layout functions.
- ❌ No tests for swimlane layout.
- ❌ No tests for while back-edge routing.
- ❌ No tests for repeat/break handling.
- ❌ No tests for note positioning.
- ❌ No tests for coordinate bounds (viewBox overflow).

**Renderer tests** (none found):
- ❌ No tests for SVG output.
- ❌ No tests for node shape rendering.
- ❌ No tests for edge rendering.
- ❌ No tests for edge label pills.
- ❌ No tests for swimlane rendering.

**Visual/integration tests**:
- Likely exist in `tests/visual/` as capture-corpus and build-pages scripts (per recent commits).
- These would provide regression detection for layout and rendering changes, but individual unit-level behavior is not tested.

**Recommendation**: Add layout and renderer unit tests before refactoring layout.ts. Visual regression tests (corpus) are present; unit tests would provide faster feedback during development.

---

## Summary

**Parser & AST**: Solid. Keep as-is.

**Layout**: Structurally mismatched with tile-based composition. Absolute coordinate model works for simple diagrams but is fragile for complex nesting, swimlanes, and edge routing. Worth replacing with a tile-based framework.

**Renderer**: Working. Keep; add test coverage.

**Test coverage**: Parser is well-tested. Layout and renderer have no unit tests; rely on visual regression.

