# Use Case Diagrams — Greenfield Deep Dive (G-6)

This document supplements the mission-guide entry for G-6 (Use Case Diagram
Greenfield Rebuild). Read it before drafting any agent prompt for this phase.

## Scale of the Java source

There is no `usecasediagram/` Java package. Use case diagrams share their
entire implementation with component diagrams through the description diagram
infrastructure — the same `DescriptionDiagram.java` and
`DescriptionDiagramFactory.java` serve both. The distinction between a
component diagram and a use case diagram is a rendering decision made per
entity, not a diagram-level mode switch.

| Sub-package | File count | What it contains |
|-------------|-----------|-----------------|
| `descdiagram/` | 9 | `DescriptionDiagram.java`, `DescriptionDiagramFactory.java`, domain/machine/requirement image renderers, `BoxedCharacter.java` |
| `descdiagram/command/` | 12 | `CommandCreateElementFull.java`, `CommandCreateElementMultilines.java`, `CommandLinkElement.java`, `CommandPackageWithUSymbol.java`, `CommandTogether.java`, archimate commands, `CommandNewpage.java` |
| `cucadiagram/` | ~50 | Shared entity model: `ILeaf`, `IGroup`, `EntityUtils`, `EntityType`, `Link`, `LinkArg`, `CucaDiagram` |
| `svek/` | ~73 | Layout pipeline: dot bridge, entity positioning, edge routing |
| `svek/image/` | ~60 | Entity renderers: `EntityImageDescription.java` (actor + usecase branches), `EntityImageNote.java`, `EntityImageGroup.java` |

`CommandCreateElementFull.java` is the single command class that parses both
actor and usecase syntax. `EntityImageDescription.java` delegates to the
`USymbol` system, which dispatches to `USymbolActor` for actors and
`USymbolUsecase` for use cases.

**Prerequisite:** Track SI-1 (`src/core/cucadiagram/`) must be complete before
this phase begins. The entity model, link model, and svek layout bridge are all
consumed here, not reimplemented.

## Entity types

**Actor:**
- `actor Name` — stick figure with label below
- `:Name:` — colon syntax shorthand for actor; identical rendering
- `actor Name <<business>>` or `actor/ Name` — business actor; stick figure
  with a diagonal line through the head circle

**Use case:**
- `usecase "Use Case Name"` — ellipse with label centered inside
- `(Use Case Name)` — parenthesis shorthand; identical rendering
- `usecase/ "Name"` or `(Name)/` — business use case; ellipse with a diagonal
  line across the interior

**System boundary containers** (also parsed by `CommandPackageWithUSymbol.java`):
- `rectangle "System Name" { }` — plain rectangle; the idiomatic system boundary
- `package "System" { }` — folder-tab rendering
- `node "System" { }` — plain box
- `frame "System" { }` — frame border accent
- `cloud "System" { }` — cloud shape
- `database "System" { }` — cylinder; unusual in use case context but valid

The `rectangle` container is the canonical system boundary in use case
diagrams. Most upstream fixtures use `rectangle` for this purpose.

## Actor rendering

Upstream source: `USymbolActor.java`, `ActorStickMan.java`.
The spike implementation (`renderActor` in `renderer.ts`) is faithful to
upstream. These proportions must be preserved in the greenfield:

```
Head:  circle, r=8, centered at (cx, cy+8)
Body:  vertical line from (cx, cy+16) to (cx, cy+40)
Arms:  horizontal line from (cx-14, cy+28) to (cx+14, cy+28)
Legs:  left: (cx, cy+40) → (cx-12, cy+58)
       right: (cx, cy+40) → (cx+12, cy+58)
Label: centered below figure at cy+70
Bounding box: width=50, height=70 (label adds additional height)
```

**Business actor (`actor/ Name` or `<<business>>`):**
Additional diagonal line across the head circle. From
`ActorStickMan.java specialBusiness()`:
```
alpha  = 21 * PI / 64
angle1 = PI/4 + alpha
angle2 = PI/4 - alpha
r      = 8 (head radius)
p1     = (r * cos(angle1), r * sin(angle1))  -- relative to head center
p2     = (r * cos(angle2), r * sin(angle2))
line from (headCx + p1.x, headCy + p1.y)
       to (headCx + p2.x, headCy + p2.y)
```
The spike implements this correctly in `renderBusinessActor`. Preserve it.
The fill color differs: `theme.colors.graph.businessActorFill` vs.
`theme.colors.graph.actorFill`.

## Use case ellipse rendering

Upstream source: `USymbolUsecase.java`.

**Standard use case:**
- Horizontal ellipse, label centered inside
- Default proportions: width derived from label measurement, height ~50px
- Label anchor: center of the ellipse
- Stereotype (if present) appears in guillemets above the name, inside the ellipse
- Fill: `theme.colors.graph.usecaseFill`; stroke: `theme.colors.border`

**Business use case (`usecase/` or `(Name)/`):**
Same ellipse plus a diagonal line across the interior. From
`USymbolUsecase.java specialBusiness()`, using `RotatedEllipse`:
```
a     = ellipse width/2 (semi-major axis)
b     = ellipse height/2 (semi-minor axis)
beta  = PI/4
theta1 = 20 * PI / 180
theta2 = RotatedEllipse.getOtherTheta(a, b, beta, theta1)
frontier2 = frontier.scale(0.99)  -- slightly inset
p1    = frontier2.getPointAtAngle(-theta1)  -- relative to top-left corner
p2    = frontier2.getPointAtAngle(-theta2)
line from (node.x + p1.x, node.y + p1.y)
       to (node.x + p2.x, node.y + p2.y)
```
The spike implements this faithfully in `renderBusinessUseCaseNode` using
`rotatedEllipsePoint`, `getOtherTheta`, and `ellipsePointAtAngle`. Preserve
the math; it is load-bearing for anyone using business use cases.
Fill: `theme.colors.graph.businessUsecaseFill`.

## Relationship types

`CommandLinkElement.java` parses all link syntax:

| Syntax | Visual | Typical use |
|--------|--------|-------------|
| `-->` | Dashed arrow | Association (actor to use case) |
| `->` | Solid arrow | Direct association (less common) |
| `--` | Solid line, no head | Plain link |
| `-` | Solid line, no head | Short plain link |
| `..>` | Dotted arrow | `<<include>>` or `<<extend>>` dependency |
| `<\|--` | Generalization arrow | Actor specialization, use case inheritance |
| `<\|..` | Dashed generalization | Use case generalization variant |

**Include and extend relationships** are the two most important special cases:

```
ActorA --> (Use Case A)
(Use Case A) ..> (Use Case B) : <<include>>
(Use Case A) ..> (Use Case C) : <<extend>>
```

`<<include>>` and `<<extend>>` are stereotypes on the link — not on the entity.
They render as the stereotype label mid-arrow (`«include»`, `«extend»`).
The arrow is always dashed (dotted `..>` form) for these. The spike renders
them correctly via `edge.stereotype`.

**Generalization/specialization:**
```
actor AdminUser
actor User
AdminUser --|> User
```
Uses the `extension` arrowhead (open triangle). Less common but present in the
corpus.

**Arrow direction:** PlantUML resolves arrow direction from the syntax — `-->`,
`<--`, `<-->` control which end has the head. Both ends can have heads:
`<-->` produces a bidirectional arrow. This passes through the link model
unchanged; the renderer just applies `markerStart`/`markerEnd` per the
resolved direction.

## System boundary containers

`rectangle "System Name" { }` is the canonical form. Children are actors
and use cases placed inside the boundary.

**Rendering in the spike (`renderContainer`):**
- Plain rectangle with solid border
- `package` and `folder` get a dashed border (`strokeDasharray: '4 2'`)
- All others get a solid border
- Label: bold, top-left at `(node.x + 6, node.y + theme.fontSize + 4)`
- Children recursively rendered inside

The greenfield must preserve the `package`/`folder` dashed-border convention
since it is the visual distinction that lets users communicate "external" vs.
"internal" system boundaries.

## Notes

Same syntax as all other diagram types:

```
note "text" as N1
actor Foo .. N1
note left of (Use Case) : inline note
note right of ActorBar
  multi-line note
end note
```

`EntityImageNote.java` renders note boxes. Notes attach via dashed note-link
edges managed by the cucadiagram link model.

## Stereotypes

Stereotypes on entities appear as guillemets inside the shape:
```
actor Bob <<Admin>>
(Login) <<critical>>
```

Stereotypes on links produce the mid-arrow label:
```
(A) ..> (B) : <<include>>
```
The link stereotype is distinct from the entity stereotype in the AST.

## skinparam interactions

Key skinparam keys for use case diagrams:
- `ActorBackgroundColor`, `ActorBorderColor`
- `ActorFontColor`, `ActorFontSize`, `ActorFontStyle`
- `UsecaseBackgroundColor`, `UsecaseBorderColor`
- `UsecaseFontColor`, `UsecaseFontSize`, `UsecaseFontStyle`
- `PackageBackgroundColor`, `PackageBorderColor`
- `RectangleBorderColor`, `RectangleBackgroundColor`

These resolve through `resolveSkinparam()` in `src/core/skinparam.ts`. The
theme interface (`src/core/theme.ts`) must expose:
- `graph.actorFill`, `graph.actorStroke`
- `graph.businessActorFill`
- `graph.usecaseFill`
- `graph.businessUsecaseFill`

The spike already defines these; the greenfield inherits them.

## Watch-outs

**Colon syntax for actors:** `:Name:` uses colons. The parser must handle this
as an actor declaration, not as a label separator or state transition guard. The
colon is consumed on both sides of the name.

**Parenthesis syntax for use cases:** `(Name)` conflicts superficially with
`()` interface notation from component diagrams. In the context of a use case
diagram (or when the entity is followed by a use-case relationship), `(Name)`
is always a use case, never an interface. The parser for G-6 is distinct from
G-5 and does not need to disambiguate — each diagram type has its own plugin.

**Business slash suffix:** `actor/ Name` and `usecase/ "Name"` use a trailing
slash in the keyword. This is different from the stereotype form
`actor Name <<business>>`. Both produce the same visual output but arrive
via different parser paths. `CommandCreateElementFull.java` lists `actor/` and
`usecase/` as separate keywords in its type regex.

**`<<include>>` and `<<extend>>` are on links, not on entities.** A common
mistake is to treat them as entity stereotypes. The AST must carry them as
`edge.stereotype`, not `node.stereotype`. The spike handles this correctly;
preserve it.

**Generalization arrow direction:** `Actor2 --|> Actor1` means Actor2 extends
Actor1. The arrowhead (open triangle) points toward the parent. The layout
bridge must pass this through the `LinkDecor` model without reversing direction.

**`:Name:` is always an actor.** No other entity type uses the colon shorthand.
The parser can use colon presence as a definitive actor signal.

**Use case ellipse sizing:** The ellipse width must accommodate the label text.
`measureNodeLabel` from `src/core/latex.ts` returns the text bounding box;
add padding (16px horizontal, 10px vertical from upstream) to get the ellipse
dimensions. Multi-line use case labels (names with `\n`) widen or taller the
ellipse — the measurement pass must handle multi-line labels.

**Actor width is fixed at 50px regardless of label length.** The label extends
below the stick figure and can overflow. This is upstream behavior — long actor
names simply extend past the bounding box width. Do not auto-widen the stick
figure.

**Business variant fill colors:** `actorFill` and `businessActorFill` are
distinct theme tokens. Upstream uses a yellowish tint for business actors and
a slightly different shade for business use cases. If the theme does not define
separate colors, fall back to `actorFill` and `usecaseFill` respectively.

**Multi-line use case names:** `usecase "Login\nto System"` — the `\n` produces
a two-line label inside the ellipse. The ellipse height must grow to accommodate
both lines.

## Files to create

```
src/diagrams/usecase/
  ast.ts           ← UseCaseDiagramAST, UseCaseNode, UseCaseEdge
  parser.ts        ← parseUseCase(source) → UseCaseDiagramAST
  layout.ts        ← layoutUseCase(ast, measurer) → UseCaseGeometry
  renderer.ts      ← renderUseCase(geo, theme) → string
  index.ts         ← usecasePlugin registration
```

Replace all five files from the spike. Do not extend the spike.

## Suggested batch structure for the brief

**Batch 1:** AST types + parser
- `ast.ts` — `UseCaseNode` (actor, business-actor, usecase, business-usecase,
  container kinds), `UseCaseEdge` (with `stereotype?`, `label?`, `direction`),
  `UseCaseDiagramAST`
- `parser.ts` — handles all entity keywords including colon/paren/slash
  shorthands; all arrow types; container blocks; note syntax; `<<include>>`/
  `<<extend>>` on links; generalization arrows; skinparam directives
- Test coverage: all syntactic forms; no rendering yet

**Batch 2:** Layout
- `layout.ts` — consumes `src/core/cucadiagram/` layout bridge (SI-1);
  maps `UseCaseDiagramAST` → `DotInputGraph`; container nodes become clusters;
  actor bounding box fixed at 50×70; use case ellipse sized from label
  measurement; retrieves `DotLayoutResult` → `UseCaseGeometry`
- Test: actor and use case geometry; container cluster bounds

**Batch 3:** Actor and use case renderers
- `renderer.ts` partial — `renderActor` (faithful stick figure geometry from
  spike), `renderBusinessActor` (diagonal using `ActorStickMan` formula from
  spike), `renderUseCaseNode` (ellipse + centered label), `renderBusinessUseCaseNode`
  (diagonal using `RotatedEllipse` math from spike), `renderContainer` (plain
  rect + dashed for package/folder), note box
- Preserve all math from the spike; these calculations are already verified

**Batch 4:** Relationship renderers + integration + tests
- Edge renderer: all arrow styles, dashed for `..>`, generalization triangle,
  stereotype label mid-arrow for `<<include>>`/`<<extend>>`, label placement,
  bidirectional arrows
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

The most relevant gaps for use case diagrams:
- **Gaps R-1/R-2** (`rank.ts:1317–1319`): Plain and label virtual nodes have wrong
  widths — the `<<include>>`/`<<extend>>` stereotype label rendered mid-arrow can
  overlap adjacent use cases when the edge spans multiple ranks.
- **Gap P-1** (`position.ts`): Label-node ranks use full `nodeSep` instead of 5px —
  diagrams with `<<include>>`/`<<extend>>` labels are wider than upstream.
- **Gap P-2** (`position.ts:237–249`): `centerVirtualNodes` overwrites label node x —
  stereotype labels drift in diagrams with many crossing edges.
- **Gap S-2** (`splines.ts`): Edges route around their own label virtual node —
  the `<<include>>` label may cause its own edge to detour around it.

Apply **Fix Batches A–B** from `dot-layout-deepdive.md` before Batch 4 of this
mission.
