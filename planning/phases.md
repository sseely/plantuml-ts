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

## Diagram Types by Phase

| Phase | Diagram Types | Layout Engine | Notes |
|-------|---------------|---------------|-------|
| **1** | Sequence | Built-in (linear) | No external layout dependency |
| **2** | Class, Component, State, Use Case | ELK.js | First use of ELK adapter |
| **3** | Activity | Built-in (hierarchical) | Fork/join bars need custom layout |
| **4a** | Object | ELK.js (reuse class adapter) | Shares class diagram ELK config |
| **4b** | Timing | Built-in (timeline) | Waveform / step-line rendering |
| **4c** | Mind Map | ELK.js (`mrtree` algorithm) | Tree layout |
| **4d** | Gantt | Built-in (timeline) | Date arithmetic required |
| **4e** | WBS | ELK.js (`mrtree` algorithm) | Tree layout, shares mind map adapter |
| **4f** | Network (nwdiag) | Built-in (row-based) | Boxes-in-boxes |

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

**Goal:** The four most-used graph diagram types working via ELK.js layout.

### Deliverables

| Area | Details |
|------|---------|
| ELK adapter | Wrap `elkjs`, translate AST edges/nodes → ELK graph, extract geometry |
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
- ELK layout does not produce overlapping nodes for any fixture

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
Very similar to class diagrams. Share the ELK adapter. Only differences are
object instance syntax and no method members.

### 4b — Timing Diagrams
Linear timeline, no graph layout needed. Complex rendering (waveforms, state
transitions, clocks).

### 4c — Mind Map
Radial or hierarchical layout. Use ELK with tree algorithm. Markdown-like
syntax (`*` bullets).

### 4d — Gantt Charts
Timeline rendering. No graph layout. Date parsing and bar rendering.

### 4e — WBS (Work Breakdown Structure)
Tree layout similar to mind map. `+` bullet syntax.

### 4f — Network Diagram (nwdiag)
Custom box-in-box layout. Rows of nodes per network.

---

---

## Phase 5 — Markdown Integration

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

## What We Skip (forever)

| Feature | Reason |
|---------|--------|
| PNG / PDF / EPS output | Not needed; browser renders SVG natively |
| External Graphviz binary | No process spawning in browser |
| `!include` from HTTP | SSRF / security |
| Math / LaTeX rendering | Adds MathJax/KaTeX dependency — out of scope |
| Ditaa | ASCII-art to image — separate problem |
| DOT pass-through | Graphviz-only |
| Salt (UI mockup) | Very niche; can be added later |
| Wire diagrams | Very niche |
