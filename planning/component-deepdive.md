# Component Diagrams — Greenfield Deep Dive (G-5)

This document supplements the mission-guide entry for G-5 (Component Diagram
Greenfield Rebuild). Read it before drafting any agent prompt for this phase.

## Scale of the Java source

There is no `componentdiagram/` Java package. Component diagrams share their
entire implementation with use case diagrams through the description diagram
infrastructure.

| Sub-package | File count | What it contains |
|-------------|-----------|-----------------|
| `descdiagram/` | 9 | `DescriptionDiagram.java`, `DescriptionDiagramFactory.java`, domain/machine/requirement image renderers, `BoxedCharacter.java` |
| `descdiagram/command/` | 12 | `CommandCreateElementFull.java`, `CommandCreateElementMultilines.java`, `CommandLinkElement.java`, `CommandPackageWithUSymbol.java`, `CommandTogether.java`, archimate commands, `CommandNewpage.java` |
| `cucadiagram/` | ~50 | Shared entity model: `ILeaf`, `IGroup`, `EntityUtils`, `EntityType`, `Link`, `LinkArg`, `CucaDiagram` |
| `svek/` | ~73 | Layout pipeline: dot bridge, entity positioning, edge routing |
| `svek/image/` | ~60 | Entity renderers: `EntityImageDescription.java` (primary), `EntityImageLollipopInterface.java`, `EntityImageLollipopInterfaceEye1.java`, `EntityImageLollipopInterfaceEye2.java`, `EntityImageNote.java`, `EntityImageGroup.java` |

The `DescriptionDiagram.java` and `DescriptionDiagramFactory.java` classes are
the shared runtime base for BOTH component and use case diagrams.
`DescriptionDiagramFactory` registers a single command set; dispatching to
different renderers happens at the entity level based on the entity's `USymbol`.

**Prerequisite:** Track SI-1 (`src/core/cucadiagram/`) must be complete before
this phase begins. The entity model, link model, and svek layout bridge are all
consumed here, not reimplemented.

## Entity types

`CommandCreateElementFull.java` accepts these keywords in component diagrams:

**Primary component types:**
- `component [Name]` or `[Name]` — box with component notch icon in top-right corner
- `interface Name` or `() Name` or `(Name)` — provided interface (lollipop circle)
- `interface [()]` form — required interface (socket / half-circle)

**Container types** (parsed by `CommandPackageWithUSymbol.java`):
- `package Name { }` — folder-tab rendering
- `node Name { }` — plain box with label
- `folder Name { }` — folder-tab rendering (same shape as package)
- `frame Name { }` — box with a frame border accent
- `cloud Name { }` — cloud shape
- `database Name { }` — cylinder
- `storage Name { }` — cylinder variant
- `rectangle Name { }` — plain rectangle
- `component Name { }` — component box used as a container
- `card Name { }`, `queue Name { }`, `stack Name { }` — specialty containers

**Leaf entity types** (also parsed by `CommandCreateElementFull.java`):
- `artifact Name` — document shape
- `agent Name` — plain box
- `file Name` — document with folded corner
- `hexagon Name` — hexagonal polygon
- `boundary Name`, `control Name`, `entity Name` — UML SysML shapes
- `collections Name` — stacked rectangle
- `action Name`, `process Name` — process shapes

The shorthand forms are part of the syntax — not optional:
- `[Name]` is equivalent to `component [Name]`
- `() Name` and `(Name)` are equivalent to `interface Name`
- `"Name"` is a quoted identifier for names containing spaces or keywords

## Lollipop vs. box interface rendering

This is the most complex visual distinction in component diagrams.

**Provided interface (lollipop):**
- `interface IFoo` or `() IFoo` or `(IFoo)` — renders as a filled circle on
  a stick; `EntityImageLollipopInterface.java`; `SIZE = 10` px diameter
- Label appears below the circle
- When a component links to it: `ComponentA -- IFoo`, the connector terminates
  at the circle edge

**Required interface (socket):**
- `interface [()]` or `[(IFoo)]` — renders as a half-circle open to the
  connecting component; `EntityImageLollipopInterfaceEye1.java`
- Semantically means "this component requires an interface"

**Assembly connector (both together):**
- `EntityImageLollipopInterfaceEye2.java` — lollipop circle plus socket
  half-circle facing each other; the "ball-and-socket" assembly notation

**When `interface` appears inside a container definition:**
```
component "MyComp" {
  interface IInternal
}
```
The interface renders as a lollipop positioned inside the component's boundary.

## Relationship arrow types

`CommandLinkElement.java` parses these link styles:

| Syntax | Style | Notes |
|--------|-------|-------|
| `-->` | Dashed arrow | Dependency |
| `..>` | Dotted arrow | Usage/dependency variant |
| `->` | Solid arrow | Direct association |
| `-` | Solid line, no head | Plain link |
| `.` | Dotted line, no head | Dotted link |
| `--` | Solid line, no head | Assembly / bidirectional |
| `==>` | Thick dashed arrow | Strong dependency |
| `..` | Dotted, no head | Loose coupling |
| `-0)-` | Middle circle | Socket connector |
| `-(0-` | Middle circle variant | Assembly connector |
| `-(0)-` | Middle circle both sides | Full assembly |

Labels and stereotypes attach to any arrow:
```
ComponentA --> ComponentB : uses
ComponentA ..> IFoo : <<use>>
```

Color modifiers: `[#color]` on the line, e.g. `ComponentA -[#red]-> ComponentB`.

## Container nesting and the dot cluster model

Container types produce dot clusters in the layout graph. Nesting is arbitrary:

```
node "ExternalSystem" {
  package "Core" {
    component [ServiceA]
    component [ServiceB]
  }
  database "Store" {
  }
}
```

The layout bridge in `src/core/cucadiagram/` must handle:
- Containers with children → dot cluster with `cluster_` prefix on the graph
  node ID
- Containers without children → leaf node (same rule as the existing
  `CONTAINER_KINDS` convention in the spike implementation)
- Edges that cross cluster boundaries — dot handles these via `ltail`/`lhead`
  cluster edge attributes

**Package vs. folder rendering distinction:** Both `package` and `folder`
keywords produce the folder-tab shape. `node`, `frame`, and `rectangle` produce
a plain box with a label. `cloud` produces a cloud polygon. The spike
implementation used the folder-tab shape for `package` only — the greenfield
must apply it to `folder` too.

## Component notch icon

The component "notch" icon is the two-small-rectangle badge in the top-right
corner of a component box. The spike (`renderComponentNode`) renders it
correctly with these values:
- Icon badge: two rectangles, each `8×5` px, stacked with a 2px gap
- Position: `x = node.x + node.width - iconW - 8`, `y = node.y + 6`
- Fill: `theme.colors.background` (cutout from the box)
- Stroke: `theme.colors.border`

The greenfield must preserve this geometry. Upstream `USymbolComponent.java`
uses the same two-rectangle pattern.

**Business component variant:**
`component "Name" <<business>>` — applies a different border color/style.
`USymbolComponent.java` has a `specialBusiness()` branch. The stereotype
`<<business>>` must be detected and trigger the alternate border treatment.

## Notes

Notes use the same syntax as class and sequence diagrams:

```
note "text" as N1
component [Foo] .. N1
note left of [Bar] : inline note
note right of [Bar]
  multi-line note
end note
```

The note entity type is `EntityType.NOTE`; rendered by `EntityImageNote.java`.
Notes attach to entities via dashed note-link edges; the layout engine handles
their placement.

## Stereotypes

Stereotypes appear on any entity and modify rendering:

```
component [Foo] <<service>>
component [Bar] <<database>>
```

Guillemets (`«stereotype»`) appear below the entity name.
`<<business>>` triggers the business-component border variant.

## skinparam interactions

Key skinparam keys for component diagrams (from `SkinParam.java`):
- `ComponentBackgroundColor` — fill for component boxes
- `ComponentBorderColor` — border for component boxes
- `ComponentFontColor`, `ComponentFontSize`, `ComponentFontStyle`
- `InterfaceBackgroundColor`, `InterfaceBorderColor`
- `PackageBackgroundColor`, `PackageBorderColor`
- `NodeBackgroundColor`, `NodeBorderColor`
- `DatabaseBackgroundColor`, `DatabaseBorderColor`

These resolve through `resolveSkinparam()` in `src/core/skinparam.ts`, which
already exists. The greenfield renderer must consume the resolved `Theme`.

## Watch-outs

**Square bracket syntax is part of the spec:** `[Name]` is not an error or
shorthand — it is the canonical component syntax. The parser must handle names
with spaces: `[My Component]`.

**Parenthesis syntax for interfaces:** `() IFoo` and `(IFoo)` are both valid.
Anonymous: `()` with no name creates an unnamed interface that still renders.

**Container type names conflict with leaf type names:** `component` is both a
leaf type and a container keyword in `CommandPackageWithUSymbol`. A component
with children renders as a container box; without children it renders as a
leaf with the notch icon.

**`together {}` grouping:** `CommandTogether.java` forces co-located layout
for a set of nodes. This passes as a layout hint to the dot engine, not as a
visible grouping box.

**Lollipop SIZE is fixed at 10px diameter upstream.** The spike used the node's
`width`/`height` from layout — the greenfield must enforce the fixed 10px
diameter from `EntityImageLollipopInterface.java` and let the label determine
the bounding box height.

**Arrow heads for lollipop connections:** when an edge terminates on a lollipop
interface, upstream uses `lhead`/`ltail` cluster attributes and positions the
arrowhead at the circle boundary, not at the center. The layout bridge must
compute the correct endpoint.

**`rectangle` container without `{ }`:** `rectangle "System Boundary"` without
a brace block is a valid leaf element (a plain rectangle), not a container. The
parser must distinguish by whether a block follows.

**`boundary`, `control`, `entity` in component context:** These are SysML
shapes (boundary = circle+line, control = circle+arrow, entity = circle+bar).
They appear in component diagrams rarely but must render correctly.

## Files to create

```
src/diagrams/component/
  ast.ts           ← ComponentDiagramAST, ComponentNode, ComponentEdge
  parser.ts        ← parseComponent(source) → ComponentDiagramAST
  layout.ts        ← layoutComponent(ast, measurer) → ComponentGeometry
  renderer.ts      ← renderComponent(geo, theme) → string
  index.ts         ← componentPlugin registration
```

Replace all five files from the spike. Do not extend the spike.

## Suggested batch structure for the brief

**Batch 1:** AST types + parser
- `ast.ts` — all node kinds, edge types, container nesting, stereotype fields
- `parser.ts` — handles all entity keywords, shorthand forms, arrow types,
  container blocks, notes, stereotypes, skinparam directives, `together {}`
- Test coverage: all syntactic forms; no rendering yet

**Batch 2:** Layout
- `layout.ts` — consumes `src/core/cucadiagram/` layout bridge (SI-1);
  maps `ComponentDiagramAST` → `DotInputGraph`; handles cluster containment
  for container nodes; lollipop node sizing (fixed 10px); retrieves
  `DotLayoutResult` → `ComponentGeometry`
- Verify cluster edges for cross-boundary links

**Batch 3:** Entity renderers
- `renderer.ts` partial — all node renderers: component (notch icon),
  lollipop interface (fixed diameter circle), socket interface (half-circle),
  assembly connector, database (cylinder), cloud, folder/package (folder-tab),
  frame, node/rectangle (plain box), artifact, file, hexagon, boundary/control/entity
- Business component variant (<<business>> border)
- Note box rendering

**Batch 4:** Relationship renderers + integration + tests
- Edge renderer: all arrow styles, color modifiers, label placement, stereotype
  on edge, middle-circle connectors
- Full plugin wiring (`index.ts`)
- Integration tests against corpus fixtures
- Quality gates: `npm test && npm run typecheck && npm run lint && npm run build`

**Quality gates between every batch:**
```sh
npm test && npm run typecheck && npm run lint && npm run build
```

## DOT engine gaps that affect this diagram type

This diagram feeds `DotInputGraph` through the dot layout engine. Before implementing
Batch 2 (layout) and Batch 4 (relationship renderers), read
**`planning/dot-layout-deepdive.md`** in full.

The most relevant gaps for component diagrams:
- **Gaps R-1/R-2** (`rank.ts:1317–1319`): Plain and label virtual nodes have wrong
  widths — edge labels on dependency/usage arrows overlap adjacent components.
- **Gap P-1** (`position.ts`): Label-node ranks use full `nodeSep` instead of 5px —
  labeled component diagrams are wider than needed.
- **Gap P-2** (`position.ts:237–249`): `centerVirtualNodes` overwrites label node x —
  labels drift away from the reserved gap in dense diagrams.
- **Gap S-2** (`splines.ts`): Edges route around their own label virtual node —
  causes visual artifacts on labeled dependency edges.
- **Gap S-1** (`splines.ts`): `tailportY` is ignored — relevant for lollipop
  interface connections that should attach to a specific component face.

Apply **Fix Batches A–B** from `dot-layout-deepdive.md` before Batch 4 of this
mission.
