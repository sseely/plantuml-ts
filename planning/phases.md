# Delivery Phases

Each phase ships a working, tested increment. Later phases extend without
breaking earlier ones. Diagram parsers/renderers are isolated so they can be
developed and merged independently within a phase.

See [tdd-plan.md](tdd-plan.md) for the full Red/Green test sequence for each
layer. Write the listed tests before writing any implementation code.

See [demo-app.md](demo-app.md) for the canonical demo app. Each phase adds its
diagram type's `demo/examples/<type>/canonical.puml` **before** writing the
parser — the canonical file is the visual acceptance criterion (red until
implementation is complete, green once it renders correctly).

## Building Block Prerequisites

Three cross-cutting foundations are not diagram types themselves but gate
progress on later phases. Build them before the phases that depend on them.

| Building Block | Delivered in | Required by |
|----------------|-------------|-------------|
| **Creole (partial)** — bold, italic, underline, strikethrough, `<color:>` | Phase 1 | All phases |
| **Preprocessor (partial)** — `!define`, `!ifdef`/`!endif` | Phase 1 | Phase 4g (C4), Phase 5 |
| **Creole (full)** — `<size:>`, `<img:>`, `<U+NNNN>`, HTML tags | Phase 4h | Phase 5 diagram types requiring full label richness |
| **Preprocessor (full)** — `!procedure`/`!endprocedure`, `!include <stdlib>` | Phase 4g | Phase 4g (C4), Phase 5 macro-heavy diagrams |
| **Sprite registry** | Phase 4h | Phase 4g (C4 icons), Phase 5, PlantUML stdlib icon packs |

> Rule: do not start a phase until all building blocks it depends on are
> complete and passing their own quality gates.

## Diagram Types by Phase

| Phase | Diagram Types | Layout Engine | Notes |
|-------|---------------|---------------|-------|
| **1** | Sequence | Built-in (linear) | Delivers partial Creole + partial preprocessor |
| **2** | Class, Component, State, Use Case | dot engine (Sugiyama layered) | First use of graph layout engines |
| **3** | Activity | Built-in (hierarchical) | Fork/join bars need custom layout |
| **4a** | Object | dot engine (reuse class layout) | Shares class diagram layout config |
| **4b** | Timing | Built-in (timeline) | Waveform / step-line rendering |
| **4c** | Mind Map | twopi engine (radial/tree) | Tree layout |
| **4d** | Gantt | Built-in (timeline) | Date arithmetic required |
| **4e** | WBS | twopi engine (tree layout) | Tree layout, shares mind map layout |
| **4f** | Network (nwdiag) | Built-in (row-based) | Boxes-in-boxes |
| **4g** | C4 (Context / Container / Component / Deployment / Dynamic) | dot / auto-layout | Requires full preprocessor (`!procedure` + `!include <stdlib>`) |
| **4h** | *(building blocks)* Full Creole + Sprite registry | — | Prerequisite for Phase 5 |
| **5a** | Git Graph | Built-in (DAG lanes) | `@startgitgraph` |
| **5b** | JSON | Built-in (tree) | `@startjson` |
| **5c** | YAML | Built-in (tree, reuse JSON) | `@startyaml` — shares JSON renderer |
| **5d** | DOT passthrough | dot direct | `@startdot` — trivial if dot engine is integrated |
| **5e** | Salt (wireframe) | Built-in (grid) | `@startsalt` |
| **5f** | EBNF railroad | Built-in (railroad) | `@startebnf` — shares renderer with 5m |
| **5g** | DITAA | Built-in (ASCII grid) | `@startditaa` — high complexity |
| **5h** | Chen EER | dot engine (autoLayout) | `@startchen` |
| **5i** | Board (kanban) | Built-in (columns) | `@startboard` |
| **5j** | Chronology | Built-in (timeline) | `@startchronology` |
| **5k** | Packet | Built-in (bit fields) | `@startpacket` |
| **5l** | Wire | Built-in (schematic) | `@startwire` |
| **5m** | Regex railroad | Built-in (railroad, reuse 5f) | `@startregex` |
| **6** | Markdown Integration | — | autoload, markdown-it, remark, `renderSync()` |

---

---

## Phase 1 — Foundation + Sequence Diagrams

**Goal:** `plantuml("@startuml\nAlice -> Bob: hi\n@enduml")` returns a valid
SVG in a browser.

### Deliverables

| Area | Details |
|------|---------|
| Toolchain | Vite build, Vitest tests, TypeScript strict mode, ESLint |
| Core | Preprocessor, block extractor, dispatcher, plugin registry |
| Text measurement | Canvas + formula fallback |
| SVG primitives | rect, line, text, path, arrowhead, group |
| Creole markup | bold, italic, underline, strikethrough, color |
| Theme system | `default` and `dark` built-in themes |
| Public API | `render()`, `renderAll()`, `RenderOptions` |
| Sequence parser | Participants, messages (sync/async/reply/lost/found) |
| Sequence layout | Lifelines, activation boxes, arrow routing |
| Sequence renderer | Full SVG output |

### Sequence diagram feature checklist

#### Participants
- [x] `participant`, `actor`, `boundary`, `control`, `entity`, `database`, `collections`, `queue`
- [x] Aliases (`as`)
- [x] Participant order (declaration order)
- [x] Participant creation mid-diagram (`create`)
- [x] Colored participants
- [x] Custom participant icons (basic shapes only)

#### Messages
- [x] Synchronous (`->`)
- [x] Asynchronous (`->>`)
- [x] Reply (`-->`, `-->>`)
- [x] Self-message (`A -> A`)
- [x] Lost/found (`?-> A`, `A ->?`)
- [x] Message labels (including multi-line)
- [x] Autonumbering (`autonumber`)
- [x] Return (`return`)

#### Notes
- [x] `note left of`, `note right of`, `note over`
- [x] Multi-participant `note over A, B`
- [x] Multi-line notes
- [x] Note color

#### Grouping
- [x] `loop`, `alt`, `opt`, `par`, `break`, `critical`, `group`
- [x] Nested groups
- [x] Group labels

#### Dividers & Layout
- [x] `== divider text ==`
- [x] `...` (delay)
- [x] `|||` (space)
- [x] `newpage`
- [x] `hide footbox`
- [x] `skinparam sequenceMessageAlign` (left, center, right)

#### Activation
- [x] `activate` / `deactivate`
- [x] `++` / `--` shorthand
- [x] Activation colors
- [x] `destroy`

### Quality gates
- 90%+ line/branch/function coverage
- All PlantUML sequence example files in `tests/fixtures/sequence/` render
  without throwing
- Visual regression: rendered SVG matches reference snapshots (via pixelmatch or
  SVG structure comparison)

---

## Phase 2 — Graph Diagrams (Class, Component, State, Use Case)

**Goal:** The four most-used graph diagram types working via the dot engine layout.

### Deliverables

| Area | Details |
|------|---------|
| Graph layout integration | Wire AST nodes/edges into `DotInputGraph`, extract geometry from `DotLayoutResult` |
| Class diagrams | Full parser + layout + renderer |
| Component diagrams | Full parser + layout + renderer |
| State diagrams | Full parser + layout + renderer |
| Use case diagrams | Full parser + layout + renderer |

### Class diagram feature checklist

#### Elements
- [x] `class`, `abstract class`, `interface`, `enum`, `annotation`
- [x] Generic type parameters (`class Foo<T>`)
- [x] Attributes: visibility (`+/-/#/~`), type, name, default value
- [x] Methods: visibility, return type, parameters, static, abstract
- [x] Dividers in class body (`--`, `==`, `..`, `__`)

#### Relationships
- [x] Extension (`<|--`)
- [x] Implementation (`<|..`)
- [x] Composition (`*--`)
- [x] Aggregation (`o--`)
- [x] Dependency (`..>`, `-->`)
- [x] Association (`--`)
- [x] Realization (`<|..`)
- [x] Multiplicity labels
- [x] Link labels and direction labels

#### Layout & Style
- [x] `together { }` grouping
- [x] `hide`, `show` directives
- [x] `namespace` / `package`
- [x] `skinparam classBackgroundColor`, `classBorderColor`, etc.
- [x] Stereotypes (`<<interface>>`, custom)
- [x] Notes on links and classes

### Component diagram feature checklist
- [x] `component`, `[name]` shorthand
- [x] `interface`, `()` shorthand, `portin`, `portout`
- [x] `package`, `node`, `folder`, `frame`, `cloud`, `database`, `storage`
- [x] Relationships: `-->`, `..>`, `-`, `..`
- [x] Notes

### State diagram feature checklist
- [x] State declarations (`state "name" as alias`)
- [x] Simple transitions (`A --> B`)
- [x] Transitions with guards (`A --> B : guard`)
- [x] Transitions with actions
- [x] Initial (`[*] --> A`) and final (`A --> [*]`) pseudostates
- [x] Nested states (composite)
- [x] Concurrent regions (`--`)
- [x] History pseudostates (`[H]`, `[H*]`)
- [x] Fork / join
- [x] Notes

### Use case diagram feature checklist
- [x] `actor`, `:actor:`
- [x] `usecase`, `(use case)`
- [x] `package`, `rectangle`, `node`, `folder`, `frame`, `cloud`, `database`
- [x] Relationships: `-->`, `..`, `--`, `-left->`, etc.
- [x] `<<include>>`, `<<extend>>` stereotypes
- [x] Notes

### Quality gates
- Same coverage targets as Phase 1
- dot engine layout does not produce overlapping nodes for any fixture

---

## Phase 3 — Activity Diagrams

**Goal:** Activity diagrams with fork/join, if/else/while, swimlanes.

Activity diagrams deserve their own phase because their layout is neither
purely linear (like sequence) nor a generic graph (like class). They require
a hierarchical top-down layout with special handling for fork/join bars.

### Feature checklist
- [x] `:action;` syntax
- [x] `start` / `stop` / `end` / `kill`
- [x] `if ... then ... else ... endif`
- [x] `elseif`
- [x] `while ... is ... endwhile`
- [x] `repeat ... repeatwhile`
- [x] Fork/join: `fork` / `fork again` / `end fork`
- [x] Split: `split` / `split again` / `end split`
- [x] Swimlanes (`|lane|`)
- [x] Detachable arrows (`detach`)
- [x] Notes
- [x] Colors on actions

### Quality gates
- Same coverage targets
- Fork/join bars aligned correctly

---

## Phase 4 — Specialized Diagram Types

Ordered by rough popularity. Each can be developed independently.

### 4a — Object Diagrams
Very similar to class diagrams. Share the dot engine layout. Only differences are
object instance syntax and no method members.

### 4b — Timing Diagrams
Linear timeline, no graph layout needed. Complex rendering (waveforms, state
transitions, clocks).

### 4c — Mind Map
Radial or hierarchical layout. Use the twopi engine (BFS radial/tree). Markdown-like
syntax (`*` bullets).

### 4d — Gantt Charts
Timeline rendering. No graph layout. Date parsing and bar rendering.

### 4e — WBS (Work Breakdown Structure)
Tree layout similar to mind map. Uses twopi engine; shares the mind map layout adapter.
`+` bullet syntax.

### 4f — Network Diagram (nwdiag)
Custom box-in-box layout. Rows of nodes per network.

### 4g — C4 Diagrams

C4 is a macro library on top of PlantUML, not a native diagram type.
Three layers must ship together as a single phase:

**Layer 1 — Preprocessor extensions**
- `!procedure` / `!endprocedure` with positional `$param` expansion and
  default values
- `!include <stdlib>` resolving angle-bracket names to bundled assets
  (HTTP `!include` remains blocked)

**Layer 2 — Bundled C4 stdlib**
- Bundle `C4_Context.puml`, `C4_Container.puml`, `C4_Component.puml`,
  `C4_Deployment.puml`, `C4_Dynamic.puml` from a pinned C4-PlantUML
  release as TypeScript string constants
- Preprocessor resolves `!include <C4Context>` → bundled content

**Layer 3 — C4 parser + renderer**
- Parser accepts stereotype-annotated rectangles produced by macro
  expansion (`<<person>>`, `<<system>>`, `<<container>>`, `<<boundary>>`)
- Renderer produces canonical C4 visuals: stick-figure persons, coloured
  rounded rectangles, dashed boundary boxes, technology-labelled arrows
- Layout via `autoLayout()` — typically `dot` TB for context/container
  diagrams

See [diagram-types.md](diagram-types.md#c4-diagrams) for full details.

---

## Phase 4h — Full Creole + Sprite Registry

**Prerequisite for:** Phase 5 (all new diagram types require full label
rendering to achieve rendering parity).

**Goal:** Complete the two building blocks that Phase 1 left partial.

### Full Creole

Extend the Phase 1 Creole parser to cover the remaining markup:

| Markup | Meaning |
|--------|---------|
| `<size:N>text</size>` | Font size override |
| `<img:url{scale=N}>` | Inline image (URL or sprite reference) |
| `<U+NNNN>` | Unicode code point |
| `<b>`, `<i>`, `<u>`, `<s>`, `<w>` | HTML-style inline tags |
| `<back:color>text</back>` | Background highlight |
| `<font color="…">` | Font color (HTML tag form) |
| `<plain>text</plain>` | Strip all markup (escape hatch) |
| Nested markup | e.g. `**<color:red>bold red</color>**` |

### Sprite Registry

| Deliverable | Detail |
|-------------|--------|
| `SpriteRegistry` interface | `register(name, svgOrPixels)` + `resolve(name)` |
| Inline rendering | `<$spriteName>` in labels renders the registered icon |
| Standard library bundles | Ship built-in icon packs for the PlantUML stdlib (C4, AWS, Azure, GCP, Kubernetes) as optional side-loaded modules |

### Quality gates
- All Phase 1–4g tests still pass (no regressions)
- Full Creole round-trips: every markup form parses and renders correctly
- Sprite resolution: `<$person>` in a sequence note renders the expected icon

---

## Phase 5 — Additional Diagram Types

**Prerequisite:** Phase 4h (Full Creole + Sprite registry) complete.

Order within Phase 5 is by popularity. Each sub-phase is independent and
can be developed in parallel with others that don't share write targets.

### 5a — Git Graph
`@startgitgraph`. Built-in DAG-lane layout. See
[diagram-types.md](diagram-types.md#git-graph) for AST and algorithm.

### 5b — JSON Visualization
`@startjson`. Built-in tree renderer. Low complexity.

### 5c — YAML Visualization
`@startyaml`. Reuses the JSON renderer with a YAML parser front-end.
**Must be developed after 5b** (depends on JSON renderer).

### 5d — DOT Passthrough
`@startdot`. If the dot layout engine is already integrated (Phase 4g),
this is a thin passthrough parser. Estimated effort: very low.

### 5e — Salt (Wireframe / UI Mockup)
`@startsalt`. Built-in grid layout. Widget vocabulary is broad but
individually simple. See [diagram-types.md](diagram-types.md#salt-wireframe--ui-mockup).

### 5f — EBNF Railroad
`@startebnf`. Built-in railroad renderer. Shares output renderer with
5m (Regex). **Develop 5f before 5m** — 5m reuses 5f's renderer.

### 5g — DITAA
`@startditaa`. ASCII-art to SVG conversion. Highest complexity in Phase
5 — schedule last within the phase or as a standalone effort.

### 5h — Chen EER
`@startchen`. dot engine (autoLayout dispatch). Low complexity; niche demand.

### 5i — Board (Kanban)
`@startboard`. Built-in column layout. Very simple.

### 5j — Chronology
`@startchronology`. Built-in horizontal timeline. Low complexity.

### 5k — Packet
`@startpacket`. Built-in bit-field grid. Low complexity.

### 5l — Wire
`@startwire`. Built-in schematic. Niche; schedule after all others.

### 5m — Regex Railroad
`@startregex`. Reuses the EBNF railroad renderer (5f). Parser front-end
only.

### Quality gates (per sub-phase)
- 90%+ line/branch/function coverage for the new diagram type
- Canonical `.puml` fixture renders without error
- No regressions in Phase 1–4h tests

---

## Phase 6 — Markdown Integration

**Goal:** Drop a `<script>` tag into any page and PlantUML fenced code blocks
render automatically. Also provide first-class plugins for markdown-it and
remark so framework users get a one-liner integration.

See [markdown-integration.md](markdown-integration.md) for the full spec,
code sketches, and TDD test list.

### Deliverables

| Deliverable | Entry point | Consumers |
|-------------|-------------|-----------|
| Auto-init | `plantuml-js/autoload` | Plain HTML, CDN |
| markdown-it plugin | `plantuml-js/markdown-it` | VitePress, Docusaurus |
| remark plugin | `plantuml-js/remark` | Astro, Next.js MDX, Gatsby |
| `renderSync()` | main package export | Plugins (sync transform step) |
| Demo Markdown tab | `demo/markdown.html` | Visual smoke test |

### Quality gates
- All existing phase tests still pass
- `renderSync()` produces output equal to `await render()` for every fixture
- `canonical-examples.test.ts` covers all demo `.puml` files
- markdown-it and remark integration tests pass in jsdom

---

## What We Skip (permanently)

| Feature | Reason |
|---------|--------|
| PNG / PDF / EPS output | Not needed; browser renders SVG natively |
| External Graphviz binary | No process spawning in browser |
| `!include` from HTTP URLs | SSRF / security — `!include <stdlib>` for bundled assets is supported |
| Math / LaTeX rendering | Adds MathJax/KaTeX dependency — out of scope |
| TeaVM / Java transpilation | Not our approach |
| `jcckit` charts | Deprecated upstream; no user demand |
| `bpm` diagrams | Extremely niche; no active upstream development |
