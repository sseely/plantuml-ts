# Class Diagrams — Greenfield Deep Dive (G-2)

This document supplements the mission-guide entry for G-2 (Class Diagram
Greenfield Rebuild). Read it before drafting any agent prompt for this phase.
The existing `src/diagrams/class/` is a learning spike — do not extend it.
Rebuild from scratch following the Java source and consuming
`src/core/cucadiagram/` (Track SI-1) once that module exists.

## Scale of the Java source

| Sub-package | File count | What it contains |
|-------------|-----------|-----------------|
| `classdiagram/` | 8 | ClassDiagram.java, ClassDiagramFactory.java, FullLayout.java, RowLayout.java |
| `classdiagram/command/` | 19 | Every parser command |
| `cucadiagram/` | 29 | Shared entity model: ILeaf, IGroup, Member, Bodier*, PortionShower |
| `svek/` | 73 | Dot-based layout pipeline and rendering orchestration |
| `svek/image/` | 48 | Per-entity-type image renderers |
| **Total** | **~179** | |

This is the second-largest diagram type after sequence. The `svek/` package
alone is bigger than most diagram types in their entirety.

## The svek pipeline

Every entity-based diagram in PlantUML runs through `svek`. Understanding
this pipeline is the architectural prerequisite for building anything in G-2.

**Stage 1 — Parse.** Parser commands (all 19 in `classdiagram/command/`)
produce a `cucadiagram` entity model: `ILeaf` nodes for classifiers,
`IGroup` nodes for packages/namespaces, and a link list for relationships.
No geometry exists at this stage.

**Stage 2 — DotStringFactory.java.** The factory traverses the entity model
and produces a DOT string. Each `ILeaf` becomes a DOT node with an HTML-like
label; each `IGroup` becomes a DOT subgraph (cluster); each link becomes a
DOT edge with appropriate `arrowhead`/`arrowtail` attributes. The DOT node
labels encode the entity's visual structure — header compartment, method
compartment, field compartment — as an HTML table. The factory is where
hide/show directives are applied: compartments excluded by a `hide` rule
are omitted from the HTML table label before the DOT string is emitted.

**Stage 3 — Graphviz layout.** In TypeScript, this is `src/core/dot/`
(the Sugiyama pipeline) or `autoLayout` from `src/core/auto-layout.ts`.
The DOT string is parsed into a `DotInputGraph`, the layout engine runs,
and a `DotLayoutResult` comes back with x/y positions for every node and
waypoints for every edge.

**Stage 4 — svek rendering.** With positions resolved, each entity's
assigned `EntityImageXxx` draws itself at its computed (x, y). Edge routing
uses the spline waypoints from the `DotLayoutResult`. The output is a
flat SVG string assembled from per-entity and per-edge fragments.

The key insight: the DOT label is a sizing hint, not the final rendering.
The DOT layout engine treats each entity as a box of a given width and
height. `svek` then re-draws each entity from scratch at the DOT-assigned
position using the full SVG rendering pipeline. This means the HTML label
in the DOT string only needs to produce the correct bounding-box size —
visual accuracy lives entirely in Stage 4.

In TypeScript, `DotStringFactory.java` maps to the `layout.ts` module
(building the `DotInputGraph` with correct node widths/heights) and the
`svek` renderer maps to `renderer.ts` (drawing each entity at its
laid-out position).

## Classifier types and their rendering

All classifiers render through `EntityImageClass.java` with variations
controlled by the entity's `LeafType`. Only empty package/namespace groups
get a different renderer.

| PlantUML keyword | LeafType | Header rendering |
|-----------------|----------|-----------------|
| `class` | CLASS | Name in normal weight |
| `abstract class` | ABSTRACT_CLASS | Name in italics |
| `interface` | INTERFACE | «interface» guillemet above name |
| `enum` | ENUM | «enumeration» guillemet above name |
| `annotation` | ANNOTATION | «annotation» guillemet above name |
| `entity` | ENTITY | Circle spot `(E, color)` before name |
| `exception` | EXCEPTION | Circle spot `(!, color)` before name |
| `struct` | STRUCT | Circle spot `(S, color)` before name |
| `(empty package/namespace)` | — | `EntityImageEmptyPackage` — folder-tab rendering |

`EntityImageLollipopInterface*.java` handles the `()InterfaceName`
lollipop syntax (a circle-terminated connector, not a box). This is
a separate visual form, not just a variation of `EntityImageClass`.

The circle spot is drawn by `EntityImageClass` as a small filled circle
with a bold letter inside, positioned to the left of the class name in
the header compartment. Color is either the default for the type or
overridden by the `<<(C, #RRGGBB)>>` spot syntax in the stereotype.

## Member sections (compartments)

A class body has up to three compartments separated by horizontal rules:

1. **Header** — class name (+ optional italic for abstract), stereotype in
   guillemets, circle spot
2. **Fields compartment** — one line per field; rendered by
   `MethodsOrFieldsArea.java`
3. **Methods compartment** — one line per method; same renderer

Which compartments are rendered depends on `PortionShower`, the interface
whose implementation is driven by accumulated `hide`/`show` directives.

Visibility characters appear at the start of each member line:

| Character | Visibility |
|-----------|-----------|
| `+` | public |
| `-` | private |
| `#` | protected |
| `~` | package-private |

Modifiers change rendering:

- `{static}` — the member label is underlined
- `{abstract}` — the member label is italicized
- `{field}` — forces the member to the fields compartment regardless
  of whether it has parentheses
- `{method}` — forces the member to the methods compartment regardless
  of whether it lacks parentheses

`BodyEnhanced1.java` and `BodyEnhanced2.java` apply Creole formatting
within member text. Bold (`**`), italic (`//`), and color (`<color:>`)
markers in a member string must be parsed and rendered as styled
`<tspan>` elements, not emitted as literal text.

The `Bodier` variants handle different member storage models:

- `BodierLikeClassOrObject` — class and object diagrams: two separate
  lists (fields, methods), auto-partitioned by presence of `()`
- `BodierSimple` — state descriptions: single unpartitioned list
- `BodierMap` — key→value pairs for `map` entities
- `BodierJSon` — JSON-valued display object (used by `@startjson`
  entities embedded in other diagrams)

For the class diagram rebuild, only `BodierLikeClassOrObject` is needed.

## Relationship types and arrow rendering

Nine distinct relationship forms. Each has a precise SVG arrow spec.

| PlantUML syntax | Name | Line | Source end | Target end |
|-----------------|------|------|-----------|-----------|
| `A --|> B` | Extension / Generalization | solid | — | open triangle |
| `A ..|> B` | Realization / Implementation | dashed | — | open triangle |
| `A *-- B` | Composition | solid | filled diamond | — |
| `A o-- B` | Aggregation | solid | open diamond | — |
| `A --> B` | Association | solid | — | open arrowhead |
| `A ..> B` | Dependency | dashed | — | open arrowhead |
| `A -- B` | Link (plain) | solid | — | — |
| `A .. B` | Usage | dashed | — | — |
| `A ()- B` | Lollipop | solid (short) | circle | — |

Arrow direction is controlled by which end the arrow syntax appears on.
`A --> B` means arrow at B (target). `A <-- B` means arrow at A (source).
`A <--> B` is bidirectional: arrowheads at both ends. These are not
shorthand for two one-way arrows — `CommandLinkClass.java` parses the
left-end and right-end decorators independently and sets both.

Each relationship can carry labels at three positions:

- **Middle label** — `A --> B : label`
- **Left-end label** — the string in the first quoted position:
  `A "1" --> B`
- **Right-end label** — the string in the second quoted position:
  `A --> "many" B`

The `+` character at the start of a link label is NOT a public visibility
modifier. It is a PlantUML-specific marker meaning "place this label at
the left end of the arrow." `A "+" --> B` is different from `A + --> B`.
This is one of the most common misreads of the syntax.

Multiplicity labels (`"1"`, `"*"`, `"0..1"`, `"1..*"`) are a subset of
end labels. They render in a smaller font, offset from the line terminus.

### Lollipop interfaces

`CommandLinkLollipop.java` handles the `()InterfaceName` / `-(InterfaceName`
forms. The lollipop renders as a small circle at the end of a short stub
line. The interface is not a full `EntityImageClass` box — it is a
`EntityImageLollipopInterface` circle with a label below.

When a class provides a lollipop interface, the short stub connects to the
class border. When a class requires one (socket notation), the stub ends in
a semicircle. The two forms use different `EntityImageLollipop*` renderers.

## Namespace and package rendering

Two distinct rendering modes depending on context:

**Package mode (default for `package` keyword).** Packages render as a
labeled rectangle with a tab in the top-left corner — the folder-tab
style from `EntityImageEmptyPackage.java`. The tab width is bounded by the
package name width. Member entities are positioned inside the rectangle.

**Namespace mode (`namespace` keyword).** Namespaces render as a DOT
cluster (subgraph). In the DOT string, each namespace becomes a
`subgraph cluster_N { ... }` block. The cluster is labeled with the
namespace name. Graphviz places a bounding rectangle around the cluster
automatically; `svek` post-processes the cluster bounds from the layout
result and draws a styled rectangle.

`CommandNamespaceSeparator.java` configures whether `.` or `::` is the
separator for namespace-qualified names. Default is `::`. When separator
is `.`, the name `com.example.Foo` implies namespace `com.example` and
simple class name `Foo`. All name resolution uses the active separator.

Nested namespaces produce nested clusters in the DOT string:

```
subgraph cluster_outer {
  subgraph cluster_inner {
    node_Foo
  }
}
```

`FullLayout.java` controls the top-level diagram direction (TB, LR, RL, BT).
`RowLayout.java` handles the `newline` directive which forces the next
group of entities onto a new layout row.

## `together{}` grouping

```puml
together {
  class A
  class B
  class C
}
```

Forces A, B, and C to appear in adjacent positions in the layout.
`LinkConstraint.java` implements this by injecting invisible, zero-length,
high-weight edges between each pair of grouped entities before the DOT
string is generated. These phantom edges bias the rank assignment and
crossing minimization toward keeping the group members close.

The invisible edges must not appear in the rendered SVG. The DOT edge
attributes `style=invis weight=100` suppress rendering while retaining
layout influence.

In TypeScript: when `layout.ts` encounters a `together` group in the AST,
it adds `DotInputEdge` entries with `invisible: true` between all pairs.
The renderer ignores edges with `invisible: true`.

## `hide` / `show` directive complexity

These directives accumulate in declaration order. The last matching rule
wins. Evaluation happens in `HideOrShow.java` which holds an ordered list
of rules and evaluates each entity + member combination against them.

Key directive forms and what they affect:

| Directive | Effect |
|-----------|--------|
| `hide members` | Suppress both compartments on all classifiers |
| `hide fields` | Suppress fields compartment on all classifiers |
| `hide methods` | Suppress methods compartment on all classifiers |
| `hide empty members` | Suppress a compartment only if it has no content |
| `hide empty fields` | Suppress fields compartment if empty |
| `hide empty methods` | Suppress methods compartment if empty |
| `hide @unlinked` | Hide classifiers with no relationships |
| `hide <<Stereotype>> members` | Suppress members on stereotyped entities |
| `show fields` | Re-enable fields compartment (overrides a previous hide) |
| `remove ClassName` | Delete entity entirely — it does not appear in DOT input |
| `hide ClassName` | Keep entity in DOT input but render it with transparent fill |

`remove` and `hide` are semantically different. `remove` deletes the node
before layout; `hide` keeps it (so it affects layout bounds) but makes it
visually invisible. This distinction is load-bearing: hidden entities still
participate in edge routing.

Rules accumulate. Given:

```puml
hide members
show fields
```

All entities have methods hidden and fields shown. The evaluation is not
"last directive wins for the entity" — it is evaluated per compartment
per entity against the accumulated rule list.

## Notes and note links

Three note attachment forms:

**Floating note with alias:**
```puml
note "text" as N
```
`EntityImageNote.java` renders this as a box with a folded corner.
The note is an entity in the DOT graph and participates in layout normally.

**Note attached to a class:**
```puml
note left of ClassName : text
note right of ClassName : text
note top of ClassName : text
note bottom of ClassName : text
```
The note is a separate entity connected to the target class by a dashed
edge. The `left of` / `right of` constraint is communicated to DOT as an
edge rank constraint so the note appears on the correct side.

**Note on the last link:**
```puml
A --> B
note on link : text
```
The note attaches to the most recently declared relationship. Internally,
this creates a note entity and two dashed edges — one to each endpoint of
the relationship — forming a triangle. The note is positioned at the
midpoint of the relationship edge by the DOT layout.

Notes may contain multi-line text. Line breaks are `\n` in the string or
actual newlines in the multi-line `note ... end note` form.

## Stereotype rendering

Stereotypes appear in guillemets (Unicode `«` and `»`) below the
class name in the header compartment:

```
ClassName
«StereotypeName»
```

Multiple stereotypes on one entity are each on their own line.

The circle spot syntax `<<(C, #RRGGBB) Label>>` encodes a custom spot:
`C` is the spot letter, `#RRGGBB` is the spot background color, and
`Label` is the stereotype text. `EntityImageClass` draws the filled circle
to the left of the class name and the stereotype text below the class name.

Spot rendering for built-in entity types (entity, exception, struct) uses
the same circle rendering with type-specific defaults:
- `entity` → letter `E`, default spot color from theme
- `exception` → letter `!` (or `E` in some upstream versions — check
  `LeafType.java` for the actual default)
- `struct` → letter `S`

`skinparam classAttributeIconSize` controls the spot circle diameter.
When set to 0, circle spots are suppressed entirely.

## Key watch-outs

**Generic type parameters.** `class Foo<T, K>` embeds angle brackets in
the class name. These must be preserved verbatim in the SVG text label —
they are not HTML/XML tag delimiters in this context. The text `Foo<T, K>`
must render as the string `Foo<T, K>`, not as a malformed tag. Escape with
`&lt;` and `&gt;` when injecting into an SVG text element or DOT HTML
label.

**`allowmixing` directive.** `CommandAllowMixing.java` enables placing
entity types from other diagram types (actor, usecase, component) in the
same class diagram. When active, the parser must accept and instantiate
entity types beyond the eight classifier types. Each foreign entity type
uses its own `EntityImageXxx` renderer. This is not optional: corpus
fixtures exercise this regularly.

**Diamond association class.** `CommandDiamondAssociation.java` handles
the `diamond` shape — a filled diamond node representing an association
class. This is distinct from the composition diamond arrowhead. The node
renders as `EntityImageDiamond` (or similar), not `EntityImageClass`.

**Bidirectional arrows.** `A <--> B` renders arrowheads at both ends,
not as two separate one-way arrows. The link has both `arrowhead` and
`arrowtail` set in the DOT edge. Ensure the renderer draws both ends.

**Left-end label `+` prefix.** In `A "1" --> B`, the `"1"` is a
multiplicity label at A's end. In `A "+label" --> B`, the `+` prefix
signals that the label is a role name at the A end (public visibility
character overloaded as positioning hint). This is a parser-level
ambiguity: the `+` is consumed and the label is placed at the left end.
Do not let this `+` propagate into the rendered label text.

**`RowLayout.java` and `newline` directive.** The `newline` keyword in
a class diagram forces a layout row break. This is communicated to DOT
via `rank=same` subgraphs with a `newrank=true` attribute on the graph.
Entities between consecutive `newline` directives are placed in the same
rank group.

**Namespace separator affects name resolution everywhere.** After
`set separator ::`, a class named `com::example::Foo` is resolved as
entity `Foo` inside namespace `com::example`. After `set separator .`,
the same syntax is an entity named `com::example::Foo` with no namespace
inference. Name resolution in links must use the active separator to
expand short names to fully-qualified names.

**`remove` entities must be absent from DOT input entirely.** A removed
entity must not appear as a DOT node, must not be a subgraph member, and
must not have any edges. Edges connecting to a removed entity are also
removed. This is different from `hide`, which keeps the node in the graph
with `style=invis`.

**`BodierMap` entities.** The `map` keyword (e.g., `map "name" as M { key => value }`)
produces a key→value table inside the entity box. This uses `BodierMap`
storage, not `BodierLikeClassOrObject`. The rendering is a two-column
table in the body compartment. This is exercised in the class diagram
command set, not only in object diagrams.

## Files to create

```
src/diagrams/class/
  ast.ts          — ClassDiagramAST, Classifier, ClassifierKind, Member,
                    Visibility, Modifier, Relationship, RelationshipType,
                    Namespace, NoteDecl, HideShowRule, TogetherGroup
  parser.ts       — parseClass(source): ClassDiagramAST
  layout.ts       — layoutClass(ast, measurer): ClassGeometry
                    (builds DotInputGraph, calls dot layout engine,
                    handles clusters for namespaces, injects together edges)
  renderer.ts     — renderClass(geo, theme): string (SVG)
  index.ts        — classPlugin: SyncPlugin

tests/unit/class/
  parser.test.ts  — all classifier types, all relationship types,
                    namespaces, hide/show rules, together groups,
                    generic params, allowmixing, notes, stereotypes
  layout.test.ts  — DotInputGraph shape for each entity type,
                    cluster nesting for namespaces, invisible together edges,
                    removed entities absent from graph
  renderer.test.ts — all 8 classifier renderings, all 9 relationship arrow
                     forms, compartment suppression by hide rules,
                     note rendering, lollipop rendering
```

The object diagram at `src/diagrams/object/` shares `ClassDiagramAST` and
delegates to the class layout and renderer. After rebuilding the class
diagram, verify that the object diagram tests still pass — the delegation
surface is the integration contract.

## Suggested batch structure

**Batch 1 — AST types and parser.**
All AST types in `ast.ts`. All 19 command parsers in
`classdiagram/command/` translated to TypeScript parsing logic. Targets:
all classifier types and keywords, all relationship types with label and
multiplicity parsing, namespace/package declarations with separator
configuration, `hide`/`show`/`remove` directive accumulation, `together{}`
group parsing, `allowmixing`, `note` forms, stereotype and spot syntax,
generic type parameter handling in class names, `newline` directive.
No rendering at this stage.

**Batch 2 — Layout (DotInputGraph translation).**
`layout.ts`: translate `ClassDiagramAST` into a `DotInputGraph`. Entity
nodes with correct bounding-box dimensions (requires measuring member
strings using `StringMeasurer`). Namespace groups as DOT clusters with
correct nesting. `together` phantom edges with `invisible: true`.
`removed` entities absent from graph. `hidden` entities present with an
`invisible` flag. Edge attributes for all 9 relationship types (arrowhead,
arrowtail, style, weight). `RowLayout` rank-same groups for `newline`.
Return `ClassGeometry` with positioned entities and routed edges from the
`DotLayoutResult`.

**Batch 3 — Entity renderers.**
`renderer.ts` entity drawing: header compartment (name, stereotype
guillemets, circle spot, italic for abstract). Fields compartment with
visibility icons and static/abstract modifiers. Methods compartment
(same). Correct suppression when hide rules eliminate a compartment.
All 8 classifier types producing correct header variation.
`EntityImageEmptyPackage` folder-tab for empty package groups.
Lollipop circle renderer.

**Batch 4 — Relationship renderers.**
All 9 arrow types: correct line style (solid/dashed), source decorator
(filled diamond, open diamond, none), target decorator (open triangle,
open arrowhead, none, circle). Bidirectional arrows. Multiplicity and
role-name labels at correct positions (left-end, right-end, middle).
Note-on-link triangle attachment. Note-left/right/top/bottom stub and
dashed connector.

**Batch 5 — Hide/show wiring, notes, and integration tests.**
Wire `HideShowRule` evaluation into the layout stage (entity omission for
`remove`; invisible flag for `hide`; compartment suppression at layout
time for `hide members`/`hide fields`/etc.). Floating notes as entities
in DOT graph. `hide @unlinked` filtering. Full integration tests against
upstream corpus fixtures for class diagrams from `tests/corpus/class/`.
Verify object diagram delegation still passes.

**Quality gates between every batch:**
```sh
npm test && npm run typecheck && npm run lint && npm run build
```

## DOT engine gaps that affect this diagram type

This diagram uses `DotInputGraph` → dot layout engine → SVG. Before implementing
Batch 2 (layout translation) and Batch 4 (relationship renderers), read
**`planning/dot-layout-deepdive.md`** in full.

The most relevant gaps for class diagrams:
- **Gaps R-1/R-2** (`rank.ts:1317–1319`): Plain and label virtual nodes have wrong
  widths — edge-label text in relationships can overlap sibling nodes.
- **Gap S-1** (`splines.ts`): `tailportY` is never applied during routing — port-based
  arrow connections from compartment fields land at wrong y positions.
- **Gap P-1** (`position.ts`): Label-node ranks use full `nodeSep` instead of 5px —
  diagrams with relationship labels are wider than they should be.
- **Gap P-2** (`position.ts:237–249`): `centerVirtualNodes` overwrites the label
  node's constraint-solved x — labels can overlap rank neighbors.
- **Gap S-2** (`splines.ts`): An edge routes around its own label virtual node
  instead of through it.

Apply **Fix Batches A–B** from `dot-layout-deepdive.md` before or alongside
Batch 2 of this mission. Those fixes are small (< 30 lines total) and will
prevent the layout bugs from compounding during integration testing.
