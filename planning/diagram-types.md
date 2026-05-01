# Diagram Types — Priority & Layout Strategy

## Priority Matrix

| Type | Phase | Layout | Complexity | Popularity |
|------|-------|--------|------------|------------|
| Sequence | 1 | Built-in (linear) | Medium | ★★★★★ |
| Class | 2 | `dot` (layered hierarchy) | High | ★★★★★ |
| Component | 2 | `autoLayout` (usually `dot`; `osage` for disconnected) | Medium | ★★★★☆ |
| State | 2 | `dot` (DAG hierarchy) | Medium | ★★★★☆ |
| Use Case | 2 | `dot` (LR layered) | Low | ★★★☆☆ |
| Activity | 3 | Built-in (hierarchical) | High | ★★★★☆ |
| Object | 4a | `dot` (reuse class layout) | Low | ★★★☆☆ |
| Timing | 4b | Built-in (timeline) | Medium | ★★★☆☆ |
| Mind Map | 4c | `twopi` (radial tree) | Low | ★★★☆☆ |
| Gantt | 4d | Built-in (timeline) | Medium | ★★★☆☆ |
| WBS | 4e | `twopi` (vertical tree) | Low | ★★☆☆☆ |
| Network (nwdiag) | 4f | Built-in (rows) | Medium | ★★☆☆☆ |
| C4 (Context/Container/Component/Code) | 4g | `dot` / `autoLayout` | High | ★★★★☆ |
| Git Graph | 5a | Built-in (DAG lanes) | Medium | ★★★★☆ |
| JSON | 5b | Built-in (tree) | Low | ★★★☆☆ |
| YAML | 5c | Built-in (tree, reuse JSON) | Low | ★★★☆☆ |
| DOT passthrough | 5d | `dot` direct | Low | ★★★☆☆ |
| Salt (wireframe) | 5e | Built-in (grid) | Medium | ★★☆☆☆ |
| EBNF (railroad) | 5f | Built-in (railroad) | Medium | ★★☆☆☆ |
| DITAA | 5g | Built-in (ASCII grid) | High | ★★☆☆☆ |
| Chen EER | 5h | `neato` or `fdp` (undirected) | Low | ★★☆☆☆ |
| Board (kanban) | 5i | Built-in (columns) | Low | ★☆☆☆☆ |
| Chronology | 5j | Built-in (timeline) | Low | ★☆☆☆☆ |
| Packet | 5k | Built-in (bit fields) | Low | ★☆☆☆☆ |
| Wire | 5l | Built-in (circuit) | Low | ★☆☆☆☆ |
| Regex (railroad) | 5m | Built-in (railroad) | Low | ★☆☆☆☆ |

---

## Implementation Ordering (next up, easiest → hardest)

Activity diagram has a long tail of structural fixes (goto/label,
while back-edges, fork alignment, if/elseif nesting) that make it
a poor vehicle for fast iteration. Decision: pause activity, ship
simpler standalone types, return to activity later.

| # | Type | Effort | Rationale |
|---|------|--------|-----------|
| 1 | **JSON** | XS | `JSON.parse` + tree renderer; no layout engine |
| 2 | **YAML** | XS | Same renderer as JSON; only parser differs — use [`yaml`](https://www.npmjs.com/package/yaml) npm package |
| 3 | **WBS** | S | `+`/`++` bullet syntax → top-down tree; no edge routing |
| 4 | **Mindmap** | S | Same tree model as WBS; adds radial layout via twopi |
| 5 | **Gantt** | M | Date parsing + bar chart; self-contained, no graph theory |
| 6 | **Timing** | M | State-change timelines; specialized but regular rendering |
| 7 | **Salt** | M | Many widget types but each is purely local; no global layout |
| 8 | **Network (nwdiag)** | M-H | Node-link graph; needs layout pass like class/component |
| 9 | **ER (Chen)** | H | neato/fdp layout + Chen shapes; cardinality rendering |
| 10 | **Deployment** | H | Component diagram with nested nodes + edge routing combo |
| — | **Activity** (resume) | H | Return after simpler types are done |

### Dependency notes
- YAML (2) depends on JSON renderer (1) being complete — they share it
- Mindmap (4) can start in parallel with WBS (3) once the tree layout
  primitive exists
- `yaml` npm package: add as runtime dependency when starting (2)

---

### Cross-cutting building blocks (prerequisites, not standalone diagram types)

| Block | DiagramType | Why it matters |
|---|---|---|
| Creole rich text | `CREOLE` | Text markup (`**bold**`, `//italic//`, `<color:>`, `<img:>`) used in labels/notes across **every** diagram type. plantuml-js has a partial `RichText` type; full Creole is a gap. |
| Preprocessor | `DEFINITION` | `!define`, `!procedure`/`!endprocedure`, `!include`, `!ifdef`. Required for C4 (Phase 4g) and any macro-heavy diagram. Partial spec already in the C4 section. |
| Sprites | `SPRITES` | Custom icon sheets embedded via `<$sprite>`. Needed to support PlantUML stdlib icon packs (AWS, Azure, C4 icons, etc.). |

---

## Sequence Diagrams

**Java source:** `sequencediagram/`
**Layout:** Custom pure-TypeScript. No external dependency.

### Layout algorithm
1. Assign each participant a column index (first-appearance order).
2. Measure participant label widths. Column widths = max(label, min-width).
3. Column x-positions are prefix sums of widths + padding.
4. Walk events top-to-bottom. Each event gets a y-position based on
   cumulative height.
5. Activation boxes: track activation stack per participant. Render as
   filled rectangles overlapping the lifeline.
6. Self-arrows: route as two horizontal + one vertical segment, offset right.
7. Notes: measure label, place beside the relevant participant column.
8. Frames (alt/loop/etc.): encompass the y-range of contained messages.

### Key AST nodes

```typescript
type Participant = {
  id: string;
  display: RichText;
  type: 'participant' | 'actor' | 'boundary' | 'control'
       | 'entity' | 'database' | 'collections' | 'queue';
  color?: string;
};

type Message = {
  from: string;
  to: string;
  label: RichText;
  style: 'sync' | 'async' | 'reply' | 'lost' | 'found';
  activate?: 'on' | 'off' | null;
};

type Note = {
  position: 'left' | 'right' | 'over';
  participants: string[];
  text: RichText;
  color?: string;
};

type Frame = {
  type: 'loop' | 'alt' | 'opt' | 'par' | 'break' | 'critical' | 'group';
  label: string;
  children: SequenceEvent[];
  // alt frames have multiple branches (else clauses)
  branches?: { guard: string; children: SequenceEvent[] }[];
};

type Divider = { text: string };
type Delay   = { text?: string };
type Space   = { pixels: number };

type SequenceEvent = Message | Note | Frame | Divider | Delay | Space;
```

---

## Class Diagrams

**Java source:** `classdiagram/`, `cucadiagram/`, `abel/`
**Layout:** dot engine — Sugiyama layered, top-down hierarchy (`rankDir: 'TB'`).

### dot engine configuration
```typescript
// DotInputGraph options
{
  rankDir: 'TB',
  rankSep: 50,
  nodeSep: 30,
}
```

### Key AST nodes

```typescript
type Classifier = {
  id: string;
  display: string;
  kind: 'class' | 'abstract' | 'interface' | 'enum' | 'annotation';
  typeParams?: string[];
  members: Member[];
  stereotype?: string;
  color?: string;
  namespace?: string;
};

type Member = {
  visibility: '+' | '-' | '#' | '~';
  name: string;
  type?: string;        // return type for methods
  params?: string[];    // null = attribute
  isStatic: boolean;
  isAbstract: boolean;
};

type Relationship = {
  from: string;
  to: string;
  type: 'extension' | 'implementation' | 'composition' | 'aggregation'
       | 'dependency' | 'association' | 'usage';
  fromMultiplicity?: string;
  toMultiplicity?: string;
  label?: string;
};
```

### Parser notes
- PlantUML class syntax allows members in the class body (`{ }`) OR via
  standalone `ClassName : member` lines. Both must be supported.
- `skinparam` lines modify theme colors per classifier or globally.
- `hide empty members` suppresses the member compartment when empty.

---

## Component Diagrams

**Java source:** `descdiagram/`
**Layout:** dot engine — Sugiyama layered.

### Key AST nodes

```typescript
type ComponentNode = {
  id: string;
  display: string;
  kind: 'component' | 'interface' | 'node' | 'package' | 'folder'
       | 'frame' | 'cloud' | 'database' | 'storage';
  children?: ComponentNode[];   // for containers
  stereotype?: string;
  color?: string;
};

type ComponentLink = {
  from: string;
  to: string;
  label?: string;
  style: 'solid' | 'dashed';
  arrowHead?: ArrowDecor;
};
```

### Notes
Component and deployment diagram share the same parser.
`[component]` square-bracket shorthand = component kind.
`()interface` parenthesis shorthand = interface kind.

---

## State Diagrams

**Java source:** `statediagram/`
**Layout:** dot engine — Sugiyama layered, top-down (`rankDir: 'TB'`).

### Key AST nodes

```typescript
type State = {
  id: string;
  display: string;
  kind: 'normal' | 'initial' | 'final' | 'history' | 'deepHistory'
       | 'fork' | 'join' | 'choice' | 'junction';
  concurrent?: ConcurrentRegion[];
  children?: State[];   // composite state
  color?: string;
};

type Transition = {
  from: string;
  to: string;
  guard?: string;
  action?: string;
  label?: string;
};
```

### Layout notes
- Concurrent regions within a composite state are rendered as horizontal
  divisions separated by dashed lines.
- Fork/join nodes need to span all parallel paths — their width is set to
  cover all branches at the same rank.

---

## Use Case Diagrams

**Java source:** `descdiagram/` (shared with component)
**Layout:** dot engine — `autoLayout()` dispatch (typically neato/fdp for natural spread).

### Key AST nodes

```typescript
type UCNode = {
  id: string;
  display: string;
  kind: 'actor' | 'usecase' | 'package' | 'rectangle' | 'node'
       | 'folder' | 'frame' | 'cloud' | 'database';
  children?: UCNode[];
  stereotype?: string;
};

type UCLink = {
  from: string;
  to: string;
  label?: string;
  stereotype?: string;  // <<include>>, <<extend>>
  style: 'solid' | 'dashed';
};
```

---

## Activity Diagrams

**Java source:** `activitydiagram3/`
**Layout:** Custom hierarchical — top-down, with special fork/join bars.

### Why not a generic graph layout engine?
Activity diagrams look wrong when a generic graph layout engine treats them as
free graphs. The structured semantics (sequential flow, merge points) require a
dedicated top-down pass:

1. Build a control-flow graph from the AST.
2. Topological sort nodes.
3. Assign rows by longest-path layering.
4. Within each row, pack horizontally (swimlanes constrain column).
5. Fork bars span the x-range of all forked branches at the same layer.
6. Route edges as straight vertical lines, with angled connectors for
   merges coming from multiple rows.

### Key AST nodes

```typescript
type ActivityNode =
  | { kind: 'action';   label: RichText; color?: string }
  | { kind: 'start' | 'stop' | 'end' | 'kill' }
  | { kind: 'if';    condition: string;
      thenBranch: ActivityNode[]; elseBranch: ActivityNode[] }
  | { kind: 'while';   condition: string; body: ActivityNode[] }
  | { kind: 'repeat';  body: ActivityNode[]; condition: string }
  | { kind: 'fork';    branches: ActivityNode[][] }
  | { kind: 'split';   branches: ActivityNode[][] }
  | { kind: 'note';    text: RichText; position: 'left' | 'right' }
  | { kind: 'detach' };

type Swimlane = {
  name: string;
  nodes: ActivityNode[];
};
```

---

## Object Diagrams

**Java source:** class diagram code, different parser entry
**Layout:** dot engine — reuse class diagram layout unchanged.

Differences from class diagrams:
- Objects use instance syntax: `object "name" as alias`
- Members are field = value pairs (no methods)
- Relationships: same arrow syntax, different semantic labels

---

## Timing Diagrams

**Java source:** `timingdiagram/`
**Layout:** Built-in timeline (horizontal time axis).

### Layout algorithm
1. Each participant gets a horizontal row.
2. Time axis runs left-to-right. Units are either abstract or real dates.
3. State transitions are rendered as waveforms (digital) or step lines (analog).
4. Messages between participants are diagonal arrows.

---

## Mind Map

**Java source:** `mindmap/`
**Layout:** twopi engine (BFS radial/tree).

Input syntax: Markdown-style headings or `* bullet` lists. The root node is
the `@startmindmap` keyword / first heading.

---

## Gantt Charts

**Java source:** `project/`
**Layout:** Built-in. Fixed columns: task name, bar chart, milestone markers.

Dates can be relative ("3 days") or absolute (ISO 8601). The renderer needs
a date arithmetic layer.

---

## WBS (Work Breakdown Structure)

**Java source:** `wbs/`
**Layout:** twopi engine (tree, vertical orientation).

Syntax is `+` / `++` / `+++` bullets for depth.

---

## C4 Diagrams (Context, Container, Component, Code)

**Reference:** [C4-PlantUML stdlib](https://github.com/plantuml-stdlib/C4-PlantUML)
**Layout:** `dot` via `autoLayout()` (hierarchical for most C4 diagrams).

C4 is not a native PlantUML diagram type. It is implemented as a macro
library on top of PlantUML's existing primitives. Supporting it requires
three layers, each a prerequisite for the next:

### Layer 1 — Preprocessor: `!procedure` and `!include <stdlib>`

The existing preprocessor handles `!define` (token substitution) and
`!ifdef`/`!endif` (conditionals), but not parameterized macros or stdlib
includes. Two additions are required:

**`!procedure` / `!endprocedure`**

```
!procedure $Person($alias, $label, $description="")
  rectangle "==$label\n\n<size:13>$description</size>" <<person>> as $alias
!endprocedure
```

- Parameters are positional, prefixed with `$`
- Default values (`$param="value"`) must be supported
- Call sites: `Person(alice, "Alice", "A customer")` — note: C4 uses
  `!procedure` names without the leading `$` at the call site
- Expansion replaces the call with the procedure body, substituting
  arguments for `$param` references

**`!include <C4Context>` stdlib resolution**

- The angle-bracket form (`<Name>`) resolves to a bundled asset, not
  a filesystem path
- The five C4 files to bundle:
  `C4_Context.puml`, `C4_Container.puml`, `C4_Component.puml`,
  `C4_Deployment.puml`, `C4_Dynamic.puml`
- HTTP `!include` (URLs) remains blocked for security

### Layer 2 — Bundled C4 stdlib files

Ship the five C4-PlantUML macro files as bundled TypeScript string
constants (or imported text assets). The preprocessor resolves
`!include <C4Context>` → `C4_Context.puml` content, processes it,
and inlines the resulting procedure definitions before the diagram body.

Keep the bundled versions pinned to a specific C4-PlantUML release tag
and document the version in `planning/architecture.md`.

### Layer 3 — C4 renderer

After macro expansion, C4 calls become PlantUML rectangle/actor
declarations with C4-specific stereotypes (`<<person>>`, `<<system>>`,
`<<container>>`, `<<boundary>>`). A dedicated C4 renderer translates
these into the canonical C4 visual style:

| Element | Visual |
|---------|--------|
| `Person` / `Person_Ext` | Stick-figure icon + label + description |
| `System` / `System_Ext` | Blue / grey filled rounded rectangle |
| `SystemDb` / `Container_Db` | Database cylinder |
| `Boundary` | Dashed border box with label |
| `Rel` / `Rel_*` | Arrow with label, optional technology tag |

The renderer follows the same `parse → layout → render` pipeline as
existing diagram types. Layout uses `autoLayout()` (typically `dot` TB
for Context and Container diagrams; `neato` for flat system landscapes).

### Parser notes

The C4 macro expansion output uses a subset of component-diagram syntax
with stereotype annotations. The C4 parser should:
- Accept the expanded stereotype-annotated rectangles
- Map stereotypes to C4 element kinds
- Extract label, description, and technology tag from the expanded text
- Build a flat node/edge graph (no deep nesting beyond `Boundary`)

### Diagram types covered

| Diagram | Macro file | `@startuml` tag |
|---------|------------|-----------------|
| System Context | `C4_Context.puml` | `@startuml` (any) |
| Container | `C4_Container.puml` | same |
| Component | `C4_Component.puml` | same |
| Deployment | `C4_Deployment.puml` | same |
| Dynamic | `C4_Dynamic.puml` | same |

---

## Git Graph

**Java source:** `gitlog/`
**Layout:** Built-in — horizontal or vertical DAG with swimlane columns per branch.
**Keyword:** `@startgitgraph`
**Prerequisites:** Phase 4h (full Creole for commit labels and tags)

### Layout algorithm
1. Commits are ordered chronologically on the main axis (left-to-right by default).
2. Each branch occupies a horizontal lane (row). Commits are placed in their branch's lane.
3. Merge commits draw an arc from the source lane to the target lane.
4. Cherry-pick arrows are dashed.

### Key AST nodes

```typescript
type GitCommit = {
  id?: string;        // optional label
  tag?: string;
  type: 'normal' | 'reverse' | 'highlight';
};

type GitBranch = {
  name: string;
  order?: number;     // explicit lane ordering
};

type GitCheckout = { branch: string };
type GitMerge    = { branch: string; id?: string; tag?: string; type?: string };
type GitCherryPick = { id: string; parent?: number };

type GitEvent = GitCommit | GitBranch | GitCheckout | GitMerge | GitCherryPick;
```

---

## JSON Visualization

**Java source:** `jsondiagram/`
**Layout:** Built-in tree — top-down, indented.
**Keyword:** `@startjson`
**Prerequisites:** Phase 4h (full Creole for value labels)

Input is a raw JSON literal between the start/end tags. The renderer
converts the JSON value tree into a two-column table (key | value),
with nested objects/arrays as indented sub-tables.

---

## YAML Visualization

**Java source:** `yaml/`
**Layout:** Built-in tree — reuse JSON renderer with YAML parser front-end.
**Keyword:** `@startyaml`
**Prerequisites:** Phase 5b (JSON renderer) — YAML shares it

Structurally identical to JSON visualization. Only the parser differs
(YAML → same internal value tree → same renderer).

---

## DOT Passthrough

**Java source:** `directdot/`, `dot/`
**Layout:** GraphViz `dot` directly.
**Keyword:** `@startdot`
**Prerequisites:** dot layout engine integration (Phase 4g)

The diagram body is passed verbatim to the dot layout engine. No
plantuml-js AST — the dot source is the AST. Output is the SVG
produced by dot layout applied to the input graph.

This is a low-effort, high-value feature: if the dot engine is
already integrated (which it is, via the graphviz layout work),
the only addition is a passthrough parser that hands the raw source
to dot unchanged.

---

## Salt (Wireframe / UI Mockup)

**Java source:** `salt/`
**Layout:** Built-in grid — table-based layout similar to HTML tables.
**Keyword:** `@startsalt`
**Prerequisites:** Phase 4h (full Creole for widget labels; Sprite registry for icons)

Salt uses a `{` / `}` block syntax with `|`-delimited rows to describe
UI widgets (buttons, text fields, checkboxes, trees, tabs). The renderer
maps each widget token to an SVG representation.

### Widget vocabulary (partial)

| Token | Widget |
|-------|--------|
| `"text"` | Text label |
| `[button]` | Button |
| `"^combo^"` | Combo box |
| `()` / `(X)` | Radio button |
| `[]` / `[X]` | Checkbox |
| `{T` ... `}` | Tree widget |
| `{/tab1/tab2/}` | Tab bar |
| `--` / `==` | Horizontal separator |

---

## EBNF / Regex Railroad Diagrams

**Java source:** `ebnf/`, `regexdiagram/`
**Layout:** Built-in railroad (horizontal sequence + vertical alternation).
**Keywords:** `@startebnf`, `@startregex`
**Prerequisites:** Phase 4h (full Creole for terminal/non-terminal labels). Build EBNF (5f) before Regex (5m) — they share the railroad renderer.

Both diagram types render grammar rules as railroad/syntax diagrams.
EBNF takes Extended Backus-Naur Form grammar rules; Regex takes a
regular expression string. The output is a set of horizontal tracks
with branches for alternation and loops for repetition.

These share the same renderer — only the parser front-end differs.

---

## DITAA

**Java source:** `ditaa/`
**Layout:** Built-in — ASCII grid to SVG conversion.
**Keyword:** `@startditaa`
**Prerequisites:** None beyond Phase 4h. Schedule last within Phase 5 — highest complexity, lowest demand ratio.

DITAA converts ASCII art box-and-line drawings into clean SVG. The
algorithm:
1. Parse the character grid into cells.
2. Identify box boundaries (lines of `-`, `|`, `+` corners).
3. Detect fill color hints (`{c}`, `{d}`, `{io}`, etc.).
4. Convert to SVG rectangles and paths with rounded or sharp corners.

This is a significant standalone implementation (~2K lines in Java).
Complexity is high relative to user demand — phase last.

---

## Chen EER (Entity-Relationship)

**Java source:** `cheneer/`
**Layout:** dot engine — `autoLayout()` dispatch (neato/fdp for natural spread).
**Keyword:** `@startchen`
**Prerequisites:** Phase 4h (full Creole); dot engine (Phase 2)

Chen notation uses specific shapes: rectangles (entities), ellipses
(attributes), diamonds (relationships), double-outline for weak
entities/relationships.

### Key AST nodes

```typescript
type EEREntity = {
  id: string;
  display: string;
  weak?: boolean;
};

type EERAttribute = {
  id: string;
  display: string;
  entityId: string;
  kind: 'simple' | 'key' | 'multivalued' | 'derived' | 'composite';
};

type EERRelationship = {
  id: string;
  display: string;
  weak?: boolean;
  participants: { entityId: string; cardinality: string }[];
};
```

---

## Board (Kanban)

**Java source:** `board/`
**Layout:** Built-in column layout.
**Keyword:** `@startboard`
**Prerequisites:** Phase 4h (full Creole for card text)

A simple kanban-style board. Columns are declared with `+` headings;
cards are `*` bullet items within a column. Low complexity, low demand.

---

## Chronology

**Java source:** `chronology/`
**Layout:** Built-in horizontal timeline.
**Keyword:** `@startchronology`
**Prerequisites:** Phase 4h (full Creole for event labels)

Similar to Gantt but simpler — a horizontal time axis with labeled
events placed at absolute or relative dates. No dependency arrows.

---

## Packet

**Java source:** `packet/`
**Layout:** Built-in bit-field grid.
**Keyword:** `@startpacket`
**Prerequisites:** Phase 4h (full Creole for field labels)

Renders network packet / binary protocol field diagrams. Each field
declaration specifies a name and bit width; the renderer draws a
grid of labeled boxes sized proportionally to their bit count.

---

## Wire

**Java source:** `wire/`
**Layout:** Built-in schematic.
**Keyword:** `@startwire`
**Prerequisites:** Phase 4h. Schedule after all other Phase 5 types — lowest demand.

Renders simple electrical/logical circuit schematic diagrams. Niche
use case; very low user demand.

---

## Cross-cutting Building Blocks

These are not standalone diagram types but are prerequisites for
complete rendering across multiple diagram types.

### Creole Rich Text

**Java source:** `creole/` (under `skin/`)

Creole is PlantUML's inline markup language, used in labels, notes,
and titles across every diagram type.

| Markup | Meaning |
|--------|---------|
| `**text**` | Bold |
| `//text//` | Italic |
| `""text""` | Monospace |
| `--text--` | Strikethrough |
| `<color:red>text</color>` | Color |
| `<size:14>text</size>` | Font size |
| `<b>`, `<i>`, `<u>` | HTML-style tags |
| `<img:url>` | Inline image |
| `\n` | Line break within label |
| `<U+1F600>` | Unicode code point |

plantuml-js already has a partial `RichText` type. Full Creole
support is required before any diagram type can claim rendering
parity with the Java implementation.

### Preprocessor

**Java source:** `preproc/`, `preproc2/`

Runs before diagram-type detection. Required for C4 and any
diagram using macro libraries.

| Directive | Status |
|-----------|--------|
| `!define NAME value` | Partial |
| `!ifdef` / `!ifndef` / `!endif` | Partial |
| `!procedure` / `!endprocedure` | Needed for C4 |
| `!include <stdlib>` | Needed for C4 |
| `!include path` | Blocked (filesystem access) |
| `!include URL` | Blocked (security) |

### Sprites

**Java source:** `sprite/`, `openiconic/`

Sprites are small raster or vector icons embedded in diagrams via
`<$spriteName>` in labels. The PlantUML standard library ships
hundreds of sprites for AWS, Azure, GCP, Kubernetes, C4, and more.

Supporting sprites requires:
1. A sprite registry (name → SVG or pixel data)
2. Inline rendering of the sprite at the label position
3. Bundling the standard library sprite sets (or loading on demand)
