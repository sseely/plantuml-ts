# State Diagrams — Greenfield Deep Dive (G-3)

This document supplements the mission-guide entry for G-3 (State Diagram
Greenfield Rebuild). Read it before drafting any agent prompt for this phase.
The previous state diagram implementation was a learning spike; this rebuild
starts from scratch and properly consumes `src/core/cucadiagram/` (Track SI-1)
and the svek-equivalent layout pipeline.

## Scale of the Java source

| Sub-package | File count | What it contains |
|-------------|-----------|-----------------|
| `statediagram/` | 5 | StateDiagram.java, StateDiagramFactory.java, StateDiagramDescription.java, state enum types |
| `statediagram/command/` | 10 | All parser commands |
| `cucadiagram/` | 29 | Shared entity model (ILeaf, IGroup, Link, EntityType) — shared with class, component, usecase, object |
| `svek/` | 73 | Dot-based layout orchestration, DotStringFactory, GroupMakerState |
| `svek/image/` | 48 | EntityImageState, EntityImageState2, EntityImageSynchroBar, EntityImagePseudoState, EntityImageCircleStart, EntityImageCircleEnd, EntityImageArcCircle, EntityImageStateBorder, EntityImageStateCommon, EntityImageStateEmptyDescription |
| **Total** | **~165** (mostly shared) | |

State diagrams are smaller than class diagrams by file count but share the
same svek pipeline. The unique complexity is the pseudostate zoo and the
composite/concurrent state nesting. Most of `cucadiagram/` and `svek/` is
already accounted for by Track SI-1; the state-specific work is in
`statediagram/`, `statediagram/command/`, and the `svek/image/EntityImage*`
files listed above.

## The svek pipeline for state diagrams

The pipeline is identical to class diagrams: parse → cucadiagram entity model
→ DotStringFactory → dot layout → svek rendering. State diagrams plug into
the same pipeline with different entity types; no new pipeline stages exist.

The relevant steps:

1. **Parse** — `statediagram/command/` commands populate a `StateDiagram`
   (a `UmlDiagramType.STATE` subclass of `AbstractEntityDiagram`) with
   `ILeaf` entities and `Link` edges via the cucadiagram API.

2. **Entity model** — each state is an `ILeaf` with `EntityType.STATE`
   (plain state), `EntityType.STATE_EMPTY` (no description, subject to
   `hide empty description`), `EntityType.CIRCLE_START`,
   `EntityType.CIRCLE_END`, `EntityType.PSEUDO_STATE`, or
   `EntityType.SYNCHRO_BAR`. Composite states are `IGroup` nodes.

3. **DotStringFactory** — translates the cucadiagram entity graph to a DOT
   string. Composite states become DOT `subgraph cluster_*` blocks.
   `GroupMakerState.java` (in `svek/`) is responsible for this translation;
   it recurses into composite states and emits clusters.

4. **Dot layout** — runs through `src/core/dot/` (the existing TypeScript
   dot engine). The cluster handling in dot is the main difference from flat
   diagrams; composite states must be passed as proper DOT clusters so the
   layout engine positions their children inside the cluster bounding box.

5. **Svek rendering** — each positioned `ILeaf` / `IGroup` is handed to its
   `EntityImage*` renderer to produce an SVG fragment. Edges are rendered
   with the transition label (event, guard, action) placed near the midpoint.

## Pseudostate types and rendering

PlantUML state diagrams have eight distinct pseudostate kinds. Each maps to
a specific renderer.

| Syntax | `EntityType` | Renderer | Visual |
|--------|-------------|----------|--------|
| `[*]` as transition source | `CIRCLE_START` | `EntityImageCircleStart` | Filled black circle, no label |
| `[*]` as transition target | `CIRCLE_END` | `EntityImageCircleEnd` | Filled circle inside a ring |
| `[H]` | `PSEUDO_STATE` | `EntityImagePseudoState` | Small circle with `H` label |
| `[H*]` | `PSEUDO_STATE` | `EntityImagePseudoState` | Small circle with `H*` label |
| `<<choice>>` stereotype | `PSEUDO_STATE` | `EntityImagePseudoState` | Diamond shape |
| `<<fork>>` stereotype | `SYNCHRO_BAR` | `EntityImageSynchroBar` | Horizontal filled black bar |
| `<<join>>` stereotype | `SYNCHRO_BAR` | `EntityImageSynchroBar` | Same as fork |
| `<<end>>` stereotype | `CIRCLE_END` | `EntityImageCircleEnd` variant | Same as final state |

`[*]` is ambiguous at parse time: the parser does not know whether it is an
initial or final state until it sees which side of a transition it appears on.
The resolution is covered in Watch-outs below.

`EntityImageSynchroBar` renders a fixed-height, variable-width horizontal
bar. The width is proportional to the number of edges incident on the bar.
Incoming edges arrive at the top face; outgoing edges leave from the bottom
face. Upstream computes bar width from the maximum of the incoming-edge span
and the outgoing-edge span; the bar is never narrower than a minimum constant.

`EntityImagePseudoState` for the choice diamond uses a rotated square (45°),
with no text label. For history pseudostates it draws a small circle
(approximately the same radius as `EntityImageCircleStart`) with the `H` or
`H*` label centered inside.

`EntityImageArcCircle` is used for entry and exit points on the border of a
composite state (declared via `state X : <<entryPoint>>` / `<<exitPoint>>`).
These are small circles on the composite state's bounding rectangle, not
inside it.

## Composite states and concurrent regions

### Composite state declaration

```
state Outer {
  A --> B
  B --> C
}
```

`Outer` becomes an `IGroup` in the cucadiagram model. Its children are the
`ILeaf` nodes `A`, `B`, `C` and the transition edges between them.
`GroupMakerState.java` emits `Outer` as a DOT `subgraph cluster_Outer {}`
block. The cluster's label is the composite state name; its border style is
controlled by `EntityImageStateBorder`.

### Concurrent regions

The `--` separator inside a composite state creates concurrent sub-regions:

```
state Outer {
  [*] --> A
  A --> B
  --
  [*] --> X
  X --> Y
}
```

`CommandConcurrentState.java` handles the `--` line. It inserts a
`ConcurrentStateBreak` marker into the composite state's child list.
Each region separated by `--` is a sub-group that is laid out as a
vertical column within the outer cluster. The `--` divider itself renders
as a horizontal line spanning the full width of the composite state border.

`ConcurrentStates.java` (in `svek/`) handles the column partitioning during
layout. Each region becomes its own DOT subgraph within the outer cluster,
with a `rank=same` constraint used to force the regions into parallel columns.
The divider lines between regions are synthetic SVG edges drawn after layout;
they are not actual DOT edges.

Concurrent regions share the outer composite state as their entry and exit
boundary. A transition into the outer state activates all regions
simultaneously; a transition out exits all regions simultaneously.

## Transition label syntax

Transitions have up to three components beyond the arrow itself:

```
Source --> Target : event [guard] / action
```

All three components are optional and independent. The `/` before the action
is required when an action is present; it is the only mandatory punctuation
separator. Combinations:

| Syntax | Meaning |
|--------|---------|
| `A --> B` | Bare transition, no label |
| `A --> B : event` | Event trigger only |
| `A --> B : [guard]` | Guard condition only (no event) |
| `A --> B : / action` | Action only (no event, no guard) |
| `A --> B : event [guard]` | Event + guard |
| `A --> B : event / action` | Event + action |
| `A --> B : event [guard] / action` | All three |

`CommandLinkState.java` and `CommandLinkStateCommon.java` share the parsing
logic. `CommandLinkStateReverse.java` handles `<--` (reverse direction).

Multi-line transition labels use `\n` in the label text. The rendered label
wraps at `\n` boundaries; the label box height adjusts accordingly.

Label placement: upstream positions the label at the midpoint of the edge
spline, offset slightly to the left of the edge direction. Do not place it
at a fixed fraction of the path — follow the spline midpoint logic in
`DotMaker.java`.

## `hide empty description` directive

`CommandHideEmptyDescription.java` processes the `hide empty description`
directive. Effect: states whose lower compartment (description) is empty are
rendered without the divider line and lower box. Default behavior is to show
the compartment structure (name box + divider + empty description box) even
when the description is absent.

This affects `EntityImageState` and `EntityImageState2`. Both renderers
receive a flag from the `StateDiagram` context indicating whether the directive
is active. When active, `EntityType.STATE` entities with no description lines
are treated identically to `EntityType.STATE_EMPTY` for rendering purposes.

The directive is per-diagram, not per-state. It cannot be toggled on and off
mid-diagram.

## State note syntax

Notes in state diagrams follow the same three forms as other cucadiagram
types:

```
note left of X : text
note right of X : text
note on link : text
```

`note left of X` and `note right of X` anchor to the named state. The note
box renders with the standard fold-corner shape and is connected to the
state with a dashed line. Position (left/right) is a hint to the dot layout;
it is not always honored when layout constraints conflict.

`note on link` attaches to the most recently declared transition in source
order. The note box is positioned near the transition label midpoint. This
is handled by tracking the last-inserted `Link` in `StateDiagram` state and
associating the note entity with that link's midpoint.

Multi-line note text uses `\n` in the note body. The note box grows
vertically to accommodate all lines.

## State description (lower compartment)

```
state A : first line
state A : second line
```

Each `:` line appends a line to the state's description compartment. Multiple
consecutive `state X :` declarations accumulate into a list; the compartment
renders one line per entry with a fixed line-height spacing. This is the
mechanism behind `EntityImageState` showing a two-compartment box (name + body).

`EntityImageState2` is used when the description is long enough to require
wrapping or when the description contains embedded markup (`<b>`, `<i>`,
`<color:...>` tags). The distinction between `EntityImageState` and
`EntityImageState2` is in `EntityImageStateCommon.java`, which selects the
renderer based on description length and content.

## State alias syntax

```
state "Long Name" as alias
```

`CommandCreatePackageState.java` handles this form. The quoted string is the
display label; `alias` is the identifier used in all subsequent transition
declarations. The alias is resolved to the display name at render time.
Without `as`, the state name is both the identifier and the display label.

## Entry/exit point sub-states

```
state Outer {
  state entryPt <<entryPoint>>
  state exitPt <<exitPoint>>
  entryPt --> A
  B --> exitPt
}
```

`<<entryPoint>>` and `<<exitPoint>>` are stereotypes that mark a child state
as an arc-circle connection point on the composite state's border.
`EntityImageArcCircle` renders these as small circles positioned on the
composite state's bounding rectangle edge. They are placed by `GroupMakerState`
after the cluster bounding box is known from the layout pass.

## Key watch-outs

### `[*]` resolution: initial vs. final

`[*]` is context-dependent. The parser must track all transitions involving
`[*]` and determine at resolution time whether a given `[*]` node is an
initial state or a final state based on its role:

- `[*] --> X` — `[*]` is a transition **source** → initial pseudostate
  (`EntityType.CIRCLE_START`)
- `X --> [*]` — `[*]` is a transition **target** → final pseudostate
  (`EntityType.CIRCLE_END`)

A diagram can have multiple `[*]` nodes — one initial and one final are
common. They are treated as distinct entities in the cucadiagram model even
though they share the same source syntax. The entity ID for the initial
state is distinct from the entity ID for the final state.

Inside a composite state, `[*]` nodes are scoped to that composite state and
do not collide with `[*]` nodes at the top level or in sibling composite
states.

### Fork/join bar width

`EntityImageSynchroBar` computes its width from the incident edges, not from
a fixed value. The bar must be wide enough to visually span all edges
connecting to it. Edges are positioned equidistantly along the bar face.
If the bar is too narrow, overlapping edge attachments will produce an
incorrect diagram. Read `EntityImageSynchroBar.java` carefully for the
width calculation formula before implementing.

### `<<fork>>` / `<<join>>` as pseudostate type, not visual stereotype

When `state Foo <<fork>>` appears in source, `<<fork>>` is not a visual
stereotype annotation to render in a box corner — it is a pseudostate type
declaration. The entity is created as `EntityType.SYNCHRO_BAR` and rendered
as `EntityImageSynchroBar`, not as a box with a `<<fork>>` label. The same
applies to `<<join>>`, `<<choice>>`, `<<end>>`, `<<entryPoint>>`,
`<<exitPoint>>`, and `<<inputPin>>` / `<<outputPin>>`.

The stereotype-to-entity-type mapping is in `EntityUtils.java`. Port it
exactly; do not handle stereotype strings inline in the parser.

### Transitions on composite states

```
Outer --> X
X --> Outer
```

A transition to/from a composite state (`IGroup`) is legal. The transition
attaches to the composite state's cluster border, not to any specific child.
DotStringFactory handles this by emitting the edge with the cluster name as
the DOT node ID. The layout engine routes the edge to the cluster boundary.

### History pseudostate as transition target

```
A --> [H]
```

`[H]` can appear as a transition target. It means "restore the most recently
active sub-state of the enclosing composite state." For layout purposes `[H]`
is a normal node inside the composite state. For rendering, it uses
`EntityImagePseudoState`.

### Concurrent region dividers are synthetic

The horizontal `--` divider lines between concurrent regions are not DOT
edges. They are computed post-layout by measuring the bounding boxes of
adjacent region clusters and drawing a horizontal line at the boundary.
They must be emitted as SVG after the main layout pass, not before.

### `CommandConcurrentState` inserts a marker, not a state

The `--` line does not create a state entity. It inserts a structural marker
into the composite state's child list that `GroupMakerState` uses to partition
children into region groups. The marker has no `ILeaf` representation and must
not appear in the cucadiagram entity graph as a renderable node.

### Composite state label vs. body

A composite state can have both a quoted display name and a description:

```
state "My State" as MS {
  ...
}
state MS : some description
```

The description lines added via `:` apply to the composite state's header
compartment (above the cluster contents), not to a child node. This is an
interaction between `CommandCreatePackageState` and `CommandAddField` that
must be handled correctly — the `CommandAddField` handler must detect that
the target entity is an `IGroup` (composite state) and add the description
to the group's header, not create a new `ILeaf`.

## Files to create

```
src/diagrams/state/
  ast.ts          — StateDiagramAST, StateNode, StateTransition, PseudostateKind
  parser.ts       — parseState(source: string): StateDiagramAST
  layout.ts       — layoutState(ast: StateDiagramAST, measurer: TextMeasurer): StateGeometry
  renderer.ts     — renderState(geo: StateGeometry, theme: Theme): string
  index.ts        — statePlugin: SyncPlugin

tests/unit/state/
  parser.test.ts
  renderer.test.ts
```

`ast.ts` must define `PseudostateKind` as an enum (or const enum) covering all
eight pseudostate types listed in the pseudostate table above. `StateNode`
covers both plain states and pseudostates; a `kind` discriminant field on
`StateNode` selects the pseudostate rendering path. Composite states are
represented as a `StateNode` with a non-empty `children` array and an optional
`regions` array (each region being a `StateNode[]`).

## Suggested batch structure

**Batch 1 — AST and parser**

Scope: `ast.ts`, `parser.ts`, `tests/unit/state/parser.test.ts`

All state declarations (plain, aliased, with description), all pseudostate
kinds, transitions with full event/guard/action label syntax, composite state
nesting, concurrent region `--` parsing, `hide empty description` directive,
`note left/right/on link` syntax. No rendering. Parser output is a fully
typed `StateDiagramAST`.

Tests must cover: `[*]` resolution (initial vs. final), alias resolution,
nested composite states (two levels deep), concurrent regions (two and three
regions), all pseudostate stereotype forms, multi-line transition labels,
multi-line note text, the `hide empty description` directive, entry/exit
point sub-states.

**Batch 2 — Layout**

Scope: `layout.ts`

Translate `StateDiagramAST` to `DotInputGraph`. Composite states become DOT
clusters. Concurrent regions become nested sub-clusters within the composite
cluster with region partitioning as described under GroupMakerState. Wire
into `src/core/dot/` for layout. Output: `StateGeometry` — positioned nodes
(with bounding boxes), positioned edges (with spline control points),
concurrent region divider line coordinates.

The layout function must handle: flat diagrams, composite states, concurrent
regions, fork/join bar width computation from incident edge count, pseudostate
nodes (same pipeline, different size hints), entry/exit point placement on
cluster borders.

**Batch 3 — Entity renderers**

Scope: `renderer.ts` (entity rendering section)

Implement all eight pseudostate renderers, plain state two-compartment box
(`EntityImageState` / `EntityImageState2`), fork/join synchro bar
(`EntityImageSynchroBar`), composite state border (`EntityImageStateBorder`),
and concurrent region divider lines. Each renderer takes a positioned
`StateNode` from `StateGeometry` and returns an SVG fragment string.

The `hide empty description` flag must be plumbed from the AST through to the
entity renderer for plain states.

**Batch 4 — Transition rendering, notes, and integration**

Scope: `renderer.ts` (transition and note rendering), `index.ts`,
`tests/unit/state/renderer.test.ts`

Transition edge rendering with spline paths, arrowhead selection, label
placement at spline midpoint. Note boxes (left/right/on-link) with dashed
connector lines. Full integration: wire `statePlugin` into the render
pipeline. Integration tests covering at least: a flat state machine, a
composite state with concurrent regions, a fork/join, the `hide empty
description` directive, and a `note on link`.

**Quality gates between every batch:**

```sh
npm test && npm run typecheck && npm run lint && npm run build
```

## DOT engine gaps that affect this diagram type

This diagram feeds `DotInputGraph` through the dot layout engine. Before implementing
Batch 3 (entity rendering) and Batch 4 (transition rendering), read
**`planning/dot-layout-deepdive.md`** in full.

The most relevant gaps for state diagrams:
- **Gaps R-1/R-2** (`rank.ts:1317–1319`): Plain and label virtual nodes have wrong
  widths — transition labels on long spanning edges overlap adjacent states.
- **Gap P-2** (`position.ts:237–249`): `centerVirtualNodes` overwrites the label
  node's constraint-solved x — transition labels can land outside the reserved gap.
- **Gap P-1** (`position.ts`): Label-node ranks use full `nodeSep` instead of 5px —
  state diagrams with transition labels are wider than needed.
- **Gap S-1** (`splines.ts`): `tailportY` is ignored — relevant for `[*]` initial
  pseudostate connections where the exit port matters for direction.
- **Gap M-2** (`mincross.ts`): Flat constraints can be scrambled by the median sort —
  concurrent region `--` divider ordering may be disturbed in the crossing
  minimization pass.

Apply **Fix Batches A–B** from `dot-layout-deepdive.md` before Batch 4 of this
mission. Transition label placement is the primary visible symptom.
