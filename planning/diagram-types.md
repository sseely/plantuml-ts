# Diagram Types — Priority & Layout Strategy

## Priority Matrix

| Type | Phase | Layout | Complexity | Popularity |
|------|-------|--------|------------|------------|
| Sequence | 1 | Built-in (linear) | Medium | ★★★★★ |
| Class | 2 | ELK | High | ★★★★★ |
| Component | 2 | ELK | Medium | ★★★★☆ |
| State | 2 | ELK | Medium | ★★★★☆ |
| Use Case | 2 | ELK | Low | ★★★☆☆ |
| Activity | 3 | Built-in (hierarchical) | High | ★★★★☆ |
| Object | 4a | ELK (reuse class) | Low | ★★★☆☆ |
| Timing | 4b | Built-in (timeline) | Medium | ★★★☆☆ |
| Mind Map | 4c | ELK (tree) | Low | ★★★☆☆ |
| Gantt | 4d | Built-in (timeline) | Medium | ★★★☆☆ |
| WBS | 4e | ELK (tree) | Low | ★★☆☆☆ |
| Network (nwdiag) | 4f | Built-in (rows) | Medium | ★★☆☆☆ |
| C4 (Context/Container/Component/Code) | 4g | dot / auto-layout | High | ★★★★☆ |

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
**Layout:** ELK — use `layered` algorithm (top-down hierarchy).

### ELK configuration
```json
{
  "algorithm": "layered",
  "elk.direction": "DOWN",
  "elk.layered.spacing.nodeNodeBetweenLayers": 50,
  "elk.spacing.nodeNode": 30,
  "elk.edgeRouting": "ORTHOGONAL"
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
**Layout:** ELK — `layered` algorithm.

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
**Layout:** ELK — `layered` with `elk.direction: DOWN`.

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
- Fork/join nodes need to span all parallel paths — require special ELK
  port configuration.

---

## Use Case Diagrams

**Java source:** `descdiagram/` (shared with component)
**Layout:** ELK — `force` or `stress` algorithm gives natural spread.

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

### Why not ELK?
Activity diagrams look wrong when ELK treats them as generic graphs. The
structured semantics (sequential flow, merge points) require a dedicated
top-down pass:

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
**Layout:** ELK — reuse class diagram adapter unchanged.

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
**Layout:** ELK with `mrtree` (tree) algorithm.

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
**Layout:** ELK with `mrtree` (tree, vertical orientation).

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
