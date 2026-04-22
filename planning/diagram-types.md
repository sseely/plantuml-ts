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
