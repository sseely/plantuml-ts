# Sequence Diagrams — Greenfield Deep Dive

This document supplements the mission-guide entry for G-1 (Sequence Diagram
Greenfield Rebuild). Read it before drafting any agent prompt for this phase.

## Scale of the Java source

| Sub-package | File count | What it contains |
|-------------|-----------|-----------------|
| `sequencediagram/` | 42 | AST nodes, events, diagram state |
| `sequencediagram/graphic/` | 52 | All rendering: participants, messages, notes, groups, activation boxes, autonumbering, newpage |
| `sequencediagram/command/` | 36 | Every parser command |
| **Total** | **130** | |

This is the most complex diagram type in PlantUML by file count. Budget
accordingly — this is a multi-batch mission by itself.

## Architectural layers

### Layer 1 — Events (sequencediagram/)

The diagram accumulates a list of `Event` objects in parse order. Each event
type (Message, Note, Divider, Delay, Grouping, LifeEvent, etc.) maps to a
Java interface in this package. Key types:

- `Message` — a lifeline-to-lifeline arrow; carries `MessageExoType` for
  messages entering/leaving from the boundary
- `Note` / `Notes` — one or two participant slots; rendered differently from
  notes in other diagram types
- `Grouping` / `GroupingLeaf` / `GroupingStart` — combined fragments
  (loop, alt, opt, par, break, critical, group)
- `Newpage` — a page break; each page segment is an independent SVG
- `LifeEvent` — activation (activate / deactivate / destroy); records
  depth at each participant independently
- `Divider` — horizontal separator bar
- `Delay` — `...` or `... N miliseconds ...`
- `HSpace` — blank horizontal gap (spacer message)
- `AutoNumber` — numbering scheme; can be started, incremented, resumed,
  stopped mid-diagram

### Layer 2 — Rendering (sequencediagram/graphic/)

The graphic/ package does all geometry and SVG output. Key files:

- **`ParticipantEnglober.java`** — participant box placement with spacer
  logic for box groups
- **`LifeLineInitializer.java`** — lifeline width computation; participant
  labels are measured and widths padded for centering
- **`DrawableSet.java`** / **`DrawableSetInitializer.java`** — the set of
  all drawn elements; `init()` computes all Y positions in a single pass
- **`MessageArrow.java`** — actual arrow rendering; handles sync/async/reply/
  lost/found/create/destroy variants
- **`GraphicalElement.java`** — abstract base for all renderable elements;
  each has a `drawU()` method
- **`GroupingHeader.java`** / **`GroupingTail.java`** — combined fragment
  rendering; each fragment has a header box and optional tail box
- **`NoteBox.java`** — note rendering with proper fold corner
- **`ActivationBox.java`** — the thin rectangle overlay on a lifeline showing
  activation depth; multiple boxes stack at increasing x offsets for nested
  activations
- **`Doll.java`** — participant head rendering (actor=stick figure,
  participant=box, boundary=circle-line, control=circle-arrow, entity=
  circle-bar, database=cylinder, collections=stacked-rect)

### Layer 3 — Commands (sequencediagram/command/)

36 command files. Every grammar production is a separate command class. Notable
ones beyond the basic arrow/participant:

- `CommandActivate.java` / `CommandActivate2.java` — `activate X` and
  `X ++` shorthand
- `CommandAutonumber.java` / `CommandAutonumberIncrement.java` /
  `CommandAutonumberResume.java` / `CommandAutonumberStop.java`
- `CommandBoxStart.java` / `CommandBoxEnd.java` — `box` / `end box` grouping
  of participants into a labeled rectangle
- `CommandGrouping.java` — `group` / `loop` / `alt` / `opt` / etc.
- `CommandExoArrowLeft.java` / `CommandExoArrowRight.java` — arrows from `[`
  (left boundary) and `]` (right boundary)
- `CommandAutoNewpage.java` — automatic newpage at `\n` in note text (rare)

## Critical interactions (bugs-per-line in the corpus)

These are the interaction zones where the test corpus has the most fixtures:

### Activation depth stacking

Every `activate X` increments a depth counter for participant X; every
`deactivate X` decrements it. The activation box renders with an x-offset
proportional to depth so boxes do not overlap. `++` shorthand on an arrow
auto-activates the target; `--` on the return auto-deactivates. Mismatched
activate/deactivate pairs do not error — they produce a visible extra box.

### Autonumbering with groups

Autonumber state persists through grouping frames. The number increments on
each message arrow but not on notes, dividers, or delays. `autonumber stop`
pauses without resetting; `autonumber resume` continues from the current
value. The format string uses `<b>` for padding and `#` for the sequence
number: `autonumber "(<b>##</b>)"`.

### Newpage

`newpage` splits the diagram into multiple SVG outputs. Each page shares the
same set of participants (with their headers re-rendered at the top of each
page) but activation boxes from the previous page do not carry over. The
`renderAll()` API returns one SVG per page.

### Box (participant grouping)

`box "title" #color` groups participants into a labeled rectangle. The box
rectangle spans from the leftmost to the rightmost participant in the box, and
the box title appears above. Box rendering must happen after participant widths
are resolved.

### Combined fragments with multiple guards

`alt` blocks have multiple sections separated by `else`. Each section has a
guard label in the top-left corner. The full frame rectangle spans all sections;
each section boundary is a dashed horizontal line.

### Lost / Found messages

`[<- X` (found — arriving from outside) and `X ->]` (lost — going to
outside). These use a filled circle at the external end, not an arrowhead.
`MessageExo.java` handles both; the `MessageExoType` enum has LOST, FOUND,
LOST_SHORT, FOUND_SHORT variants.

## Watch-outs

- `create X` places a new participant's head inline at the message position
  rather than at the top — participant heads are not all at y=0
- `destroy X` renders an X mark at the end of the lifeline
- `return` is syntax sugar for a reply arrow + deactivate
- `ref over X, Y : text` renders a reference frame box spanning two
  participants
- Participant types and their head shapes: `actor`, `boundary`, `control`,
  `entity`, `database`, `collections`, `participant` — each has distinct
  SVG rendering
- `skinparam responseMessageBelowArrow true` places the reply label below
  the arrow instead of above
- `delay` renders as a diagonal break in all lifelines simultaneously
- Header/footer notes: `note left of X`, `note right of X`, `note over X, Y`
  all have different geometry; `note over X, Y` must span between the two
  participant lifelines
- Multi-line note text uses `\n` escapes; the note box height grows

## Known layout gaps in the existing spike (do not repeat in rebuild)

The existing spike code in `src/diagrams/sequence/` has the following confirmed gaps.
These are NOT bugs to fix in the spike — they are requirements the rebuild must get
right from the start. Read these before writing Batch 2 (participant geometry) and
Batch 3 (message rendering) agent prompts.

### Gap SQ-1: Notes do not push participant columns apart

**File in spike:** `src/diagrams/sequence/layout.ts:73–89`
**Root cause:** `scanMsgLabels` only scans `MessageEvent` entries when computing
`adjMaxLabelW`. `NoteEvent` width is never attributed to column-pair gaps.
**Requirement:** For each note over participant `A` (or spanning `A, B`), the note's
rendered width must widen the gap between `A` and its neighbors. Java ref:
`TailEdgeLayout.java` / `DrawSequence.java` — note widths feed the min-gap computation.

### Gap SQ-2: Frame boxes always span all participants

**File in spike:** `src/diagrams/sequence/layout.ts:451–459`
**Root cause:** `participantCenterXBounds(participantMap)` returns the min/max across
ALL participants. A `loop` covering only participants A and B in a [A, B, C, D] diagram
spans the full diagram width.
**Requirement:** Each combined fragment must track which participants are referenced
by events inside its branches and compute its bounds from only those participants.
Java ref: `ParticipantEnglober.java`.

### Gap SQ-3: Non-adjacent message labels don't widen intermediate column gaps

**File in spike:** `src/diagrams/sequence/layout.ts:77–82`
**Root cause:** Width widening only applied when `Math.abs(fi - ti) === 1`. Long labels
on arrows spanning multiple participants clip into intermediate column space.
**Requirement:** Distribute required label width proportionally across all intermediate
column gaps for non-adjacent messages.

### Gap SQ-4: Nested activations overwrite each other

**File in spike:** `src/diagrams/sequence/layout.ts:154–157`
**Root cause:** `activationStart` is a flat `Map<participantId, {y, color}>`. A second
`activate` call on the same participant overwrites the first entry; the inner activation
is never rendered.
**Requirement:** Use a stack (`Map<id, Array<{y, color}>>`) per participant. Java ref:
`ParticipantBox.java` uses a `Deque` of activation records.

### Gap SQ-5: Self-message loop width is a hard-coded 40px constant

**File in spike:** `src/diagrams/sequence/layout.ts:321–323`
**Root cause:** `loopWidth = 40` is not derived from label text width. Long self-message
labels overflow the loop stub.
**Requirement:** `loopWidth = max(40, measuredLabelWidth + some_margin)`. Propagate
through `MessageGeo` to the renderer.

## Suggested batch structure for the brief

**Batch 1:** AST events + parser commands + block-extractor wiring
(all event types; all 36 command parsers; no rendering yet)

**Batch 2:** Participant geometry — width computation, column positions,
box grouping bounds

**Batch 3:** Message rendering — all arrow types, label placement, lost/found

**Batch 4:** Activation boxes + autonumbering + lifeline rendering

**Batch 5:** Notes (all forms) + dividers + delays + gaps

**Batch 6:** Combined fragments (alt/loop/opt/par/break/critical/group/ref)

**Batch 7:** Newpage splitting + per-page SVG output via renderAll()

**Quality gates between every batch:**
```sh
npm test && npm run typecheck && npm run lint && npm run build
```
