# Mission Planning Guide

Per-phase reference for drafting `/plan-mission` prompts. For each phase:
- **Java source** — exact package paths under `~/git/plantuml/src/main/java/net/sourceforge/plantuml/`
- **Reuse** — already-built modules in `src/` to use rather than reimplement
- **Architecture constraint** — structural decisions that must be stated in the brief
- **Watch-outs** — things past agents have cut corners on or missed entirely

The Java source is the spec. Read every file in the listed packages before
designing anything. One task per observable behavior; 5–15 min of AI work each.

Completed phases are tracked in `.claude/catalog.md` (Status: Done). They are
not listed here. If you need to understand a completed implementation, read the
source files directly.

---

## DOT Layout Engine — Known Gaps

**`planning/dot-layout-deepdive.md`** — mandatory reading before any mission that
uses the dot engine (`src/core/dot/`). Contains a function-by-function comparison
of the C source against the TypeScript port, with specific line references and
prioritized fix recommendations. The most impactful gaps:

- `rank.ts:1317–1319` — plain virtual nodes have width 0 (should be `nodeSep`);
  label virtual nodes missing `nodeSep` left-padding (Gap R-1/R-2)
- `position.ts` — label-node ranks should use 5px separation, not full nodeSep
  (Gap P-1, C source: `position.c:230–241`)
- `position.ts:237–249` — `centerVirtualNodes` overwrites label node's
  constraint-solved x position (Gap P-2)
- `splines.ts` — `tailportY` is stored in types but never applied during routing
  (Gap S-1); edge routes around its own label virtual node (Gap S-2)
- `mincross.ts` — flat constraints can be scrambled by median sort (Gap M-2);
  `flat_mval` missing for isolated nodes (Gap M-1)

These are existing bugs in produced diagrams. Fix Batches A–D from the deep-dive
before embarking on new diagram type missions, as the bugs affect every diagram
type using the dot engine.

## Existing Implementation Bugs (files diagram)

Two bugs confirmed in `src/diagrams/files/`:
- `layout.ts:28–35`: Note text measured at 14pt but rendered at 12pt (renderer.ts:9).
  Note boxes are ~17% wider than necessary.
- `layout.ts:24–26`, `49–52`: Emoji icon glyphs (`📂`, `📄`) may be under-measured
  by `StringMeasurer` depending on the canvas implementation. Add a fixed
  `ICON_WIDTH = 20` constant and use it instead of measuring the emoji.

---

## Shared Infrastructure Work Tracks

These are prerequisite modules that multiple diagram phases depend on. Build a
track before starting the phases that need it. Each track is a single mission
that produces a reusable module in `src/core/`.

### Track SI-1 — `src/core/cucadiagram/` (Entity Diagram Shared Base)

**Needed by:** Sequence (G-1), Class (G-2), State (G-3), Activity (G-4),
Component (G-5), Use Case (G-6), Object (G-7)

**Java source:** `cucadiagram/` (~50 files), `svek/` (~100 files), `descdiagram/`

**What it is:** In Java, all entity-based diagrams (class, component, state,
usecase, activity, object) share the `cucadiagram` package for entity
management (ILeaf, IGroup, EntityUtils) and `svek` for dot-based layout and
rendering. The existing TypeScript implementations are independent silos — they
do not share this base. The greenfield rebuilds must converge on this shared
module to avoid diverging forever as upstream evolves.

**Core abstractions to port:**
- `ILeaf` / `IGroup` — the fundamental entity/group model
- `EntityUtils` — entity kind classification
- `EntityType` enum — all entity types across all cucadiagram-based diagrams
- `Link` / `LinkArg` — the unified edge model
- `svek` layout bridge — translates cucadiagram entities to `DotInputGraph`
  and back to positioned entities

**Architecture constraint:** This is a prerequisites mission. Do not start any
greenfield rebuild until this module exists. The output is a typed interface
contract; greenfield agents consume it.

---

### Track SI-2 — `src/core/datetime.ts` (Date/Time Arithmetic)

**Needed by:** Phase 4d (Gantt), Phase 4b (Timing)

**Java source:** `project/time/`, `project/timescale/`, `timingdiagram/`
(DeduceFormat.java, TimingFormat.java)

**What it is:** Both Gantt and Timing need PlantUML date format parsing,
relative time arithmetic, and working-day awareness. Do not use a third-party
date library — PlantUML's date semantics diverge from ISO 8601 in enough ways
that a custom implementation is safer.

**Must handle:**
- `YYYY-MM-DD`, `DD/MM/YYYY`, `MM/DD/YYYY` parsing
- `today` keyword
- `+N days` / `+N weeks` relative offsets
- Working days (`DayStatus.WORKING` vs `DayStatus.NOT_WORKING`)
- Closed periods and named pauses (Gantt-specific)
- Time tick formats for Timing: hours:minutes, clock cycles, numeric integers

---

### Track SI-3 — `src/core/railroad/` (Railroad Diagram Renderer)

**Needed by:** Phase 5f (EBNF), Phase 5m (Regex)

**Java source:** `ebnf/` (~20 files), `regexdiagram/`

**What it is:** Both EBNF and Regex produce railroad diagrams. The intermediate
representation (terminal/non-terminal, sequence, choice, optional, repetition,
group) is shared; only the grammar → IR translation differs. Building the
railroad renderer as a standalone `src/core/railroad/` module lets Phase 5f
produce the renderer and Phase 5m add only a regex-to-IR translation layer.

---

### Track SI-4 — `src/core/golem/` (2D Tile Grid Layout)

**Needed by:** Phase 5p (Flow), evaluate for Phase 5e (Salt), Phase 5l (Wire)

**Java source:** `golem/` (~15 files): TilesField.java, Position.java,
TileGeometry.java, TileUtils.java

**What it is:** The `golem` package is a 2D integer tile grid where each node
occupies a tile position and edges connect tile centers. Flow diagrams use it
directly. Salt and Wire use simpler grid logic but share the concept of
rectangular cells at integer coordinates. Port golem first; evaluate if Salt
and Wire can reuse the infrastructure or need a lighter variant.

---

### Track SI-5 — Preprocessor Completion

**Needed by:** Phase 4g (C4), Phase 4h (Creole sprites)

**Java source:** `preproc/`, `preproc2/`, `tim/`

**What it is:** C4 requires `!include <stdlib>` to resolve the C4-PlantUML
macro library bundled as TypeScript string constants. Phase 4h sprite
registration requires the preprocessor to handle `!define SPRITE_NAME` and
`<$spriteName>` inline expansion. Both phases are blocked until the
preprocessor handles these cases.

---

## Phase 4b — Timing Diagrams

See **`planning/timing-deepdive.md`** for the full brief. This phase is blocked
on Track SI-2 (datetime.ts).

**Java source:** `timingdiagram/` (25 files), `timingdiagram/command/` (24 files),
`timingdiagram/graphic/` (17 files)

**Reuse:** `src/core/datetime.ts` (SI-2); `src/core/svg.ts`; `src/core/theme.ts`;
`src/core/creole.ts` for labels

**Architecture constraint:** Built-in linear layout — do NOT use the dot engine.
Time flows left-to-right; participants are horizontal lanes. Six rendering
modes produce fundamentally different SVG output (see deep-dive doc).

---

## Phase 4c — Mind Map

**Java source:** `mindmap/`

**Reuse:** `src/core/twopi/` layout engine (already built); `src/core/svg.ts`;
`src/core/creole.ts` for labels.

**Architecture constraint:** Uses the `twopi` engine for layout. Feed mind map
nodes as a `DotInputGraph`; the engine returns `DotLayoutResult`.

**Watch-outs:**
- `*` bullet syntax (depth by asterisk count); `**` = depth 2, etc.
- OrgMode syntax variant (`*`, `**` without `@startmindmap`)
- `+` / `-` for right/left branch direction
- `_` suffix removes the box border (detached style)
- Box coloring via `[#color]` inline
- `<` / `>` forced direction overrides per node
- Arithmetic expressions in labels
- `caption` and `header`/`footer` directives
- Creole markup in labels (bold, italic, color)

---

## Phase 4d — Gantt Charts

See **`planning/gantt-deepdive.md`** for the full brief. This phase is blocked
on Track SI-2 (datetime.ts).

**Java source:** `project/` (20 files), `project/core/` (14 files),
`project/time/` (6 files), `project/timescale/` (5 files),
`project/solver/` (2 files), `project/command/`

**Reuse:** `src/core/datetime.ts` (SI-2); `src/core/svg.ts`; `src/core/theme.ts`

**Architecture constraint:** Date arithmetic is central. No graph engine —
built-in timeline layout. The constraint solver (`Solver.java`) resolves task
dependency chains to compute start/end dates.

---

## Phase 4e — WBS (Work Breakdown Structure)

**Java source:** `wbs/`

**Reuse:** Mind map layout from Phase 4c — WBS uses the same `twopi` tree
layout with a different visual style. **Must develop after Phase 4c.**

**Architecture constraint:** The layout algorithm is shared with mind map.
The parser and renderer are distinct (different syntax, different box shapes),
but the layout step should call the same infrastructure.

**Watch-outs:**
- `+` / `-` bullet syntax (depth by count)
- `_` suffix = detached (no box)
- `[#color]` inline coloring
- Direction override: `left side` / `right side` at root
- `<style>` block skinparam for box shapes (rounded, etc.)
- Arithmetic expressions in labels
- `caption` directive

---

## Phase 4f — Network Diagram (nwdiag)

**Java source:** `nwdiag/`

**Reuse:** `src/core/svg.ts`; `src/core/theme.ts`. No graph engine — built-in
row-based layout.

**Architecture constraint:** Networks render as horizontal rows; devices render
as column nodes placed on the network rows they belong to. A device can appear
on multiple networks (vertical connection across rows).

**Watch-outs:**
- `network` blocks with named networks
- `address` attribute per device-per-network
- Devices shared across multiple networks (multi-row placement)
- `group` blocks with color fills
- `color` attribute on networks and devices
- `description` labels on network rows
- `rack` / `rackdiag` variant — a completely separate visual mode
  (rack units, components stacked vertically)
- `packetdiag` prefix shares the same Java package — keep separate

---

## Phase 4g — C4 Diagrams

**Java source:** `tim/` (preprocessor macro engine), `style/` (C4 styling).
There is no dedicated C4 diagram package — C4 is a macro library on top of
PlantUML, not a native diagram type.

**Reuse:** Full preprocessor from Track SI-5 with `!procedure`/`!endprocedure`
and `!include <stdlib>`; `dot`/`auto-layout` for layout.

**Architecture constraint:** Two layers must ship together:
1. Bundle the C4-PlantUML stdlib files as TypeScript string constants;
   preprocessor resolves `!include <C4Context>` to the bundled content.
2. Parser recognises the stereotype-annotated shapes that macro expansion
   produces (`<<person>>`, `<<system>>`, `<<container>>`, `<<boundary>>`).

**Watch-outs:**
- C4-PlantUML has five diagram variants: Context, Container, Component,
  Deployment, Dynamic — each has distinct macro sets and layout conventions
- Person elements render as stick-figure + rounded rect, not plain boxes
- System boundary boxes are dashed
- Arrow labels include technology hints (second label argument)
- `Rel_` macros have directional variants (`Rel_Up`, `Rel_Left`, etc.)
- `SHOW_LEGEND()` and `LAYOUT_*` macros affect rendering

---

## Phase 4h — Full Creole + Sprite Registry

**Java source (Creole):** `klimt/creole/`, `klimt/creole/atom/`,
`klimt/creole/command/`, `klimt/creole/legacy/`

**Java source (Sprite):** `klimt/sprite/`

**Reuse:** Existing `src/core/creole.ts` (partial Creole already done —
bold, italic, underline, strikethrough, color, tables). Extend, do not replace.

**Architecture constraint:** `parseCreole` return type may need to expand to
include icon/sprite refs as inline content. Every diagram renderer that calls
`creoleToSvg` must handle the extended token set without changes to its own
code — the extension must be backward-compatible.

**Watch-outs (Creole):**
- `<size:N>text</size>` — font size override
- `<img:url{scale=N}>` — inline image / sprite reference
- `<U+NNNN>` — Unicode code point by hex
- `<back:color>text</back>` — background highlight
- `<font color="…">` — HTML font tag form
- `<plain>text</plain>` — strip all markup
- `<w>text</w>` — wave underline
- Nested markup (e.g. `**<color:red>bold red</color>**`)
- OpenIconic icon syntax (`<&icon-name>`)

**Watch-outs (Sprite):**
- Sprites are encoded as zlib-compressed base64 pixel data, not raw SVG
- Monochrome by default; color is applied via theme, not the sprite itself
- Sprite names are case-sensitive
- `!define SPRITE_NAME …` directive in preprocessor
- `<$spriteName>` inline in labels
- `scale` parameter: `<$spriteName{scale=2}>`
- Sprite rendering differs from icon rendering (see issue #2569 plan)

---

## Phase 4i — Full skinparam + CSS Class Names

**Java source:** `style/`, `skin/`

**Reuse:** `src/core/skinparam.ts` — `resolveSkinparam` and `parseStyleBlock`
are already implemented. `src/core/theme.ts` — `deepMergeTheme` already exists.
The mission is wiring, not building from scratch.

**Architecture constraint:** This phase touches every diagram renderer to:
1. Add `puml-*` CSS class attributes to all SVG elements.
2. Thread the resolved `Theme` (after skinparam application) into each renderer.

Each renderer is a separate write target — plan tasks so that at most one
renderer is modified per task.

**Watch-outs:**
- Key normalisation in `resolveSkinparam` follows `SkinParam.cleanForKeySlow`
  from upstream — NOT a simple toLowerCase(). The implementation already
  handles this correctly; do not change the normalisation logic.
- `<style>` blocks use CSS-like selectors with different semantics than CSS
  (e.g. `.actor` means all actors, not a DOM class)
- Gradient color specs (`#AAA-white`) must be resolved via `resolveColor()`
  before passing to SVG attributes — this function already exists in `skinparam.ts`
- CSS class naming convention: `puml-{element}` for elements,
  `puml-{element}-{part}` for sub-elements

---

## Phase 5a — Git Graph

**Java source:** `gitlog/`

**Reuse:** `src/core/svg.ts` primitives; `src/core/theme.ts`. No graph
engine — built-in DAG-lane layout.

**Architecture constraint:** Branches render as horizontal lanes; commits
render as circles on lanes; merge commits have two incoming arrows. Layout
is custom, not dot-based. The lane layout pattern is similar to Timing —
consider whether Track SI-4 (golem) or a new `src/core/lane-layout/` module
makes sense after building this phase and Phase 4b.

**Watch-outs:**
- `gitGraph` and `gitGraph LR` / `gitGraph TB` directions
- `commit`, `commit id:"…"`, `commit type: HIGHLIGHT`, `commit type: REVERSE`
- `branch <name>`, `checkout <name>`
- `merge <name>` — renders a merge commit connecting two lanes
- `cherry-pick id:"…"` — copies a commit to the current branch
- `tag "…"` — label attached to the most recent commit
- `order` directive controlling lane order
- `show-commitLabel` / `hide commitLabel`
- `show-branches` / `hide branches` (hide empty branches)
- Commit message truncation at `maxMessageSize`
- Lane colors derived from theme (cycle through a palette)

---

## Phase 5d — DOT Passthrough

**Java source:** `directdot/`

**Reuse:** `src/core/dot/` layout engine (already built). This phase is a
thin parser that accepts raw DOT syntax and feeds it to the existing engine.

**Architecture constraint:** Do not parse full DOT syntax — only enough to
extract nodes, edges, and graph-level attributes (`rankdir`, `nodesep`,
`ranksep`). Attributes not consumed by the layout engine pass through as SVG
element attributes.

**Watch-outs:**
- `@startdot` / `@enddot` delimiters
- `digraph`, `graph`, `subgraph` keywords
- Node shape attribute (`shape=box`, `shape=ellipse`, etc.)
- Node and edge `label` attributes (may contain Creole markup)
- `rankdir=LR|TB|BT|RL`
- Quoted vs unquoted identifiers
- HTML-like labels (`<…>` node labels in DOT syntax)
- `strict` keyword (deduplicates parallel edges)

---

## Phase 5e — Salt (Wireframe / UI Mockup)

**Java source:** `salt/`

**Reuse:** `src/core/svg.ts`; `src/core/theme.ts`. Built-in grid layout.

**Architecture constraint:** Salt uses a grid layout derived from the `{`
block structure. Layout is not graph-based — compute cell positions by
parsing the block nesting. Evaluate whether `src/core/golem/` (Track SI-4)
can serve as the grid substrate, or whether a simpler independent grid is
more appropriate.

**Watch-outs:**
- Border styles: `{` (solid), `{+` (plain), `{#` (dotted), `{!` (line),
  `{-` (dashed), `{^` (framing)
- Widget types: button `[text]`, radio `( )` / `(X)`, checkbox `[ ]` / `[X]`,
  text field `"text"`, dropdown `^text^`, list `{/}`, tree `{T}`, table `{#}`,
  tab `{/tab1|tab2|}`, separator `---`/`===`
- `<b>` and other markup inside widget labels
- Nested `{` blocks for sub-panels
- `*` dummy widget (spacer)
- `if` / `endif` blocks for conditional display
- `...` vertical filler
- Scrollbars on list/tree widgets (visual only)
- `{SI}` for scrollable inner container

---

## Phase 5f — EBNF Railroad Diagrams

**Java source:** `ebnf/`

**Reuse:** `src/core/railroad/` (Track SI-3 — must build first);
`src/core/svg.ts`; `src/core/theme.ts`.

**Architecture constraint:** Phase 5f builds the railroad renderer in
`src/core/railroad/` and then adds the EBNF grammar → railroad IR translation.
Phase 5m adds only a regex-to-railroad-IR translation layer on top.

**Watch-outs:**
- Terminal literals (quoted strings) vs non-terminals (unquoted names)
- Choice (`|`), sequence (concatenation), optional (`[…]`), repetition (`{…}`)
- `+` one-or-more, `*` zero-or-more in extended EBNF
- Named rules separated by `::=` or `=`
- Comments (`(*…*)`)
- The start rule is rendered at the top; referenced rules expand below
- Loop-back arrows for repetition constructs
- Text direction: LR by default; `direction=TB` supported

---

## Phase 5g — DITAA

See **`planning/ditaa-deepdive.md`** for the full brief. This is the
highest-complexity phase in Phase 5.

**Java source:** `ditaa/` (3 files), `asciiart/` (external ditaa library
bundled as Java source)

**Reuse:** `src/core/svg.ts`; `src/core/svg-sanitize.ts`. No graph engine.

**Architecture constraint:** ASCII art grid → SVG. The input is a 2D character
grid; the output is rendered shapes detected by cell pattern analysis.

---

## Phase 5h — Chen EER Diagrams

**Java source:** `cheneer/`

**Reuse:** `dot`/`auto-layout` for layout (already built); `src/core/svg.ts`.

**Architecture constraint:** Uses the `dot` engine for layout. The renderer
draws entity-specific shapes on top of the dot-computed positions.

**Watch-outs:**
- Entity: plain rectangle
- Weak entity: double rectangle
- Attribute: ellipse
- Multi-valued attribute: double ellipse
- Derived attribute: dashed ellipse
- Key attribute: underlined label inside ellipse
- Relationship: diamond
- Identifying relationship (weak): double diamond
- Cardinality notation: `1`, `N`, `M` on edges
- Participation: total (double line) vs partial (single line)
- `[=]` syntax for total participation on both sides

---

## Phase 5l — Wire Diagram

**Java source:** `wire/`

**Reuse:** `src/core/svg.ts`; `src/core/theme.ts`. Built-in schematic layout.

**Architecture constraint:** Components are placed on a 2D grid declared in
the source. Connections are routed as horizontal/vertical segments. No graph
engine. Evaluate whether `src/core/golem/` (Track SI-4) can serve as the
grid substrate.

**Watch-outs:**
- `component` declarations with grid position
- Horizontal (`-`) and vertical (`|`) connection segments
- Junction dots at crossings
- Labels on connections
- `port` declarations with named connection points
- This is the most niche diagram type — the Java source is thin but contains
  all the edge cases

---

## Phase 5m — Regex Railroad Diagrams

**Java source:** `regexdiagram/`, `regex/`

**Reuse:** `src/core/railroad/` (Track SI-3 — already built for Phase 5f);
**Must develop after Phase 5f.** The regex parser produces the same railroad
intermediate representation that the EBNF renderer consumes.

**Architecture constraint:** Phase 5m adds only a regex-to-railroad-IR
translation layer. No new renderer code.

**Watch-outs:**
- Character classes (`[a-z]`, `[^abc]`, `.`)
- Quantifiers: `*`, `+`, `?`, `{n}`, `{n,}`, `{n,m}`
- Groups: capturing `(…)`, non-capturing `(?:…)`, lookahead `(?=…)` / `(?!…)`
- Alternation `|`
- Anchors `^`, `$`, `\b`
- Escape sequences: `\d`, `\w`, `\s`, `\n`, etc.
- Named groups `(?<name>…)`
- Backreferences `\1`, `\k<name>`
- Display of quantifiers as loop-back arcs on the railroad

---

## Phase 5p — Flow Diagram

**Java source:** `flowdiagram/`, `golem/`

**Reuse:** `src/core/golem/` (Track SI-4 — must build first);
`src/core/svg.ts` primitives; `src/core/theme.ts`.

**Architecture constraint:** Built-in grid layout. The `golem` package
implements a 2D integer tile grid (`TilesField`); each node occupies a
tile position. Edges are straight lines between tile center points. Track
SI-4 ports golem as a standalone module before this phase begins.

**Watch-outs:**
- **Alpha-doc only** — not documented on plantuml.com. Reference:
  http://alphadoc.plantuml.com/doc/markdown/en/flow-diagram
- Two commands: `<node-id> <direction>` (creates a node and positions it
  relative to the last tile in that direction) and `link <direction> to
  <node-id>` (draws an edge from the current tile to the named node)
- `TileGeometry` direction values: `NORTH`, `SOUTH`, `EAST`, `WEST`
- Node layout uses a fixed tile size (`SINGLE_SIZE_X=100`,
  `SINGLE_SIZE_Y=35` in upstream) — nodes are centered within their tile
- Edges are drawn as simple lines with a small filled ellipse at the
  destination endpoint (not arrowheads)
- The golem tile system uses integer coordinates; `Position` stores
  `(xmin, ymin, xmax, ymax)` per tile; `TilesField.getPosition(tile)`
  returns the tile's grid position
- A node re-referenced by a `link` command does not create a new tile —
  it uses the existing one; the path connects last-tile to the
  already-placed target tile

---

## Phase 6 — Markdown Integration

**Java source:** None — this is a JS/TS-ecosystem feature with no upstream
Java equivalent. Read the PlantUML web documentation for the expected
rendering behavior; use the existing `render()` / `renderSync()` / `renderAll()`
functions as the integration points.

**Reuse:** `render()`, `renderSync()`, `renderAll()` (already built and exported).

**Architecture constraint:** Three separate deliverables with distinct entry
points and consumers — do not couple them:
1. Auto-init (`plantuml-js/autoload`) — browser `<script>` tag; replaces
   fenced code blocks in the DOM on DOMContentLoaded.
2. markdown-it plugin (`plantuml-js/markdown-it`) — called during server-side
   or build-time rendering.
3. remark plugin (`plantuml-js/remark`) — used in Astro, Next.js MDX, Gatsby.

**Watch-outs:**
- Fenced code block detection: `language-plantuml` (highlight.js) and plain
  `plantuml` (GitHub, Docusaurus) are both in use; handle both
- Auto-init must not break if `renderSync()` is unavailable (async diagram types)
- The remark plugin runs in a sync transform step — use `renderSync()`; flag
  diagram types that require async layout as unsupported or pre-render them
- Encode the SVG safely for inline embedding (xmlns attribute, no bare `&`)
- `<details>` / `<summary>` wrapper is a common pattern for collapsible diagrams
  — support it as a rendering option
- SSR environments (Next.js) have no `document` or `canvas` — `CanvasMeasurer`
  will fail; fall back to `FormulaMeasurer` automatically

---

## Greenfield Rebuilds

The diagram types below were built as early learning spikes. The Java source
was not read in full depth; the implementations cut corners on edge cases and
do not share the `cucadiagram`/`svek` infrastructure that upstream uses. These
are greenfield targets — tear out and replace, do not extend.

**Prerequisite:** Complete Track SI-1 (`src/core/cucadiagram/`) before starting
any of these. Each greenfield rebuild is a consumer of that shared base.

The existing source files in `src/diagrams/{type}/` are available as reference
but should not constrain the new design. Read the Java source first; check the
existing TypeScript second (to understand what the spike got right).

---

### G-1 — Sequence Diagrams (Greenfield)

See **`planning/sequence-deepdive.md`** for the full brief.


**Java source:** `sequencediagram/` (42 files), `sequencediagram/graphic/`
(52 files), `sequencediagram/command/` (36 files) — 130 files total

**Reuse:** `src/core/svg.ts`; `src/core/creole.ts`; `src/core/theme.ts`

**Architecture constraint:** Layout is a custom vertical-time algorithm, not
dot-based. Participants are columns; messages are horizontal arrows at
increasing Y positions. The graphic/ sub-package is the primary complexity:
activation boxes, spanning notes, group boxes, and autonumbering all interact.

---

### G-2 — Class Diagrams (Greenfield)

See **`planning/class-deepdive.md`** for the full brief.

**Java source:** `classdiagram/` (8 files), `classdiagram/command/` (19 files),
`cucadiagram/` (shared entity base), `svek/` (shared layout/render)

**Reuse:** `src/core/cucadiagram/` (SI-1); `src/core/dot/` or `autoLayout`;
`src/core/svg.ts`; `src/core/creole.ts`

**Architecture constraint:** Class diagrams are the primary `cucadiagram`
consumer. Read `ClassDiagram.java` and `ClassDiagramFactory.java` for the
top-level structure, then `cucadiagram/` for entity/link management.

**Watch-outs:**
- All 7 classifier types: class, abstract class, interface, enum, annotation,
  entity, exception — each has distinct rendering
- Generic type parameters `<T, K>` in class names and member types
- Member visibility: `+` public, `-` private, `#` protected, `~` package;
  static (underline) and abstract (italic) modifiers
- All 9 relationship types with multiplicity labels on both ends
- Namespace/package rendering with two modes (folder vs. box)
- `together{}` grouping forces co-located layout
- `hide` / `show` directives that add or remove member sections
- Notes on classes (`note on`, `note "text" as`, floating notes)
- Notes on links (`note on link`)
- Stereotype rendering: guillemets on classifiers, `<<style>>` in `<style>`
  blocks maps to custom rendering

---

### G-3 — State Diagrams (Greenfield)

See **`planning/state-deepdive.md`** for the full brief.

**Java source:** `statediagram/` (2 files), `statediagram/command/` (10 files),
`cucadiagram/` (shared entity base), `svek/` (shared layout/render)

**Reuse:** `src/core/cucadiagram/` (SI-1); `src/core/dot/` or `autoLayout`;
`src/core/svg.ts`

**Architecture constraint:** States are cucadiagram entities; transitions are
cucadiagram links. The same `svek` pipeline serves both class and state diagrams.

**Watch-outs:**
- Initial pseudostate `[*]` is a filled circle; final pseudostate `[*]` at the
  target of a final transition is a filled circle in a circle (different!)
- History pseudostates `[H]` (shallow) and `[H*]` (deep)
- Fork and join pseudo-states (horizontal bar)
- Composite (nested) states: state `A` contains sub-states
- Concurrent regions separated by `--` inside a composite state
- Transition labels: event / guard [condition] / action
- `note on` syntax for state notes
- `<<choice>>` stereotype for choice pseudostates
- `hide empty description` directive

---

### G-4 — Activity Diagrams (Greenfield)

See **`planning/activity-deepdive.md`** for the full brief.

**Java source:** `activitydiagram3/` (34 files), `activitydiagram3/ftile/`
(53 files), `activitydiagram3/gtile/` sub-package

**Reuse:** `src/core/svg.ts`; `src/core/creole.ts`; `src/core/theme.ts`. No
graph engine — custom tile-based layout in `ftile/`.

**Architecture constraint:** The `ftile` (functional tile) system is the
layout heart. Each diagram element is an `Ftile` with geometry; tiles compose
into larger tiles recursively. Do not use dot — the Java never does for
`activitydiagram3`. The `gtile` package handles groups/swimlanes on top of
ftile geometry.

**Watch-outs:**
- Every instruction type has a corresponding `Ftile` class; port them
  individually: FtileIf, FtileWhile, FtileRepeat, FtileFork, FtileSplit,
  FtileGroup, FtilePartition, FtileKill, FtileBreak, FtileGoto, FtileLabel
- Swimlane (`|lane|`) syntax intersects with all control flow constructs —
  a lane boundary can appear inside a while loop; the tile system handles
  this via FtileSwimlane wrappers
- Arrow decorations: colors and labels mid-arrow (`: my label;` after `->`)
- `detach` keyword leaves an activity with no exit arrow
- Note attachment: `note left / right` after an action or transition
- `kill` terminates the current thread in a fork
- `goto` / `label` allows arbitrary branching (rare but in upstream fixtures)
- `repeat ... backward: text; repeat while (cond) is (yes)` asymmetric labels
- Color on actions: `#color: action text;`

---

### G-5 — Component Diagrams (Greenfield)

See **`planning/component-deepdive.md`** for the full brief.

**Java source:** Component diagrams in Java use `cucadiagram/` and `descdiagram/`
(description-based diagrams). There is no separate `componentdiagram/` package —
look in `cucadiagram/command/` and `descdiagram/`.

**Reuse:** `src/core/cucadiagram/` (SI-1); `src/core/dot/` or `autoLayout`;
`src/core/svg.ts`

**Architecture constraint:** Component diagrams share the cucadiagram entity
model. Components, interfaces, packages, and containers are all entities; edges
use the same link model.

**Watch-outs:**
- Component shapes: box with component icon vs. lollipop notation
- Interface notation: `()` circle (required) vs. `[()]` socket (provided)
- All container types: `package`, `node`, `folder`, `frame`, `cloud`,
  `database`, `storage`, `rectangle`, `boundary`
- Relationship arrow variants: `-->` (dependency), `..>` (usage),
  `-` (link), `.` (dotted)
- `<<stereotype>>` on components changes rendering
- Notes on components and on relationships

---

### G-6 — Use Case Diagrams (Greenfield)

See **`planning/usecase-deepdive.md`** for the full brief.

**Java source:** Use case diagrams use `cucadiagram/` and `descdiagram/`.
Look in `cucadiagram/command/` for the commands that parse actor and usecase
syntax.

**Reuse:** `src/core/cucadiagram/` (SI-1); `src/core/dot/` or `autoLayout`;
`src/core/svg.ts`

**Architecture constraint:** Actors and use cases are cucadiagram entities;
system boundaries are groups.

**Watch-outs:**
- Actor rendering: stick figure (default) vs. business actor (stick figure
  with `/` slash, representing a business role)
- Use case rendering: filled ellipse
- `<<include>>` and `<<extend>>` stereotypes on dependency arrows
- Dashed arrow `..>` for `<<include>>`/`<<extend>>`, solid `-->` for others
- `rectangle` and `frame` as system boundary containers
- Inheritance arrows between actors (specialization)
- Notes on actors and use cases

---

### G-7 — Object Diagrams (Greenfield)

See **`planning/object-deepdive.md`** for the full brief.

**Java source:** `objectdiagram/` (shares most infrastructure with classdiagram)

**Reuse:** `src/core/cucadiagram/` (SI-1); class diagram layout and renderer
from G-2 (object diagrams share the rendering infrastructure); `src/core/svg.ts`

**Architecture constraint:** Object diagrams use the same cucadiagram entity
model as class diagrams but with `EntityType.OBJECT` kind. Members are
`field = value` pairs (not typed declarations). The renderer is the class
diagram renderer parameterized for object mode.

**Watch-outs:**
- Object name syntax: `object "display name" as varName` — name and alias are
  separate
- Member syntax: `field = value` (no type annotation, no visibility)
- Map objects: `map "name" as M { key => value }` syntax
- Relationships: same as class diagram (association, dependency, etc.)
- Instantiation relationship: the dashed arrow from object to class

---
