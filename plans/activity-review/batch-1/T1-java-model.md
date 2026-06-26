# T1 — Read Java Activity Diagram v3 Architecture

## Context

You are researching the upstream PlantUML Java source to understand how
activity diagrams v3 are structured. The goal is to produce notes that
a synthesis agent (T3) will use to write an architectural brief for a
TypeScript reimplementation.

This is a **read-only research task**. No code changes.

The project being ported is a TypeScript PlantUML renderer at
`/Users/scottseely/git/plantuml-js`. Its value model: the long tail of
special cases IS the deliverable — upstream's accumulated edge cases must
be preserved, not simplified away.

## Task

Read the Java sources listed below and produce structured notes answering
the five questions. Be thorough on architecture; be brief on implementation
details that don't affect design.

## Write-set

`plans/activity-review/batch-1/java-model-notes.md`

## Read-set (primary)

`~/git/plantuml/src/main/java/net/sourceforge/plantuml/activitydiagram3/`

Focus areas:
- `Instruction.java`, `AbstractInstruction.java`, `InstructionList.java` — the composition model
- All `Instruction*.java` files — what constructs exist (InstructionIf, InstructionWhile, InstructionRepeat, InstructionFork, InstructionSplit, InstructionSwitch, InstructionGroup, InstructionPartition, InstructionBreak, InstructionGoto, InstructionLabel, InstructionSimple, InstructionStart, InstructionStop, InstructionEnd, InstructionSpot)
- `ActivityDiagram3.java` — how instructions are built and composed
- `Branch.java`, `LinkRendering.java` — branch and edge model
- `gtile/` — ALL files (38 total): tile composition, sizing, connection routing
- `command/` — catalog only: list each command file's name + what syntax it handles + which Instruction it creates (no deep read)
- `ftile/` — reference only: scan for patterns gtile dropped or that explain unclear gtile behavior

## Read-set (reference — chase as needed)

`~/git/plantuml/src/main/java/net/sourceforge/plantuml/` — look up specific
classes (StringBounder, UGraphic, HColor, Display, etc.) only when needed
to understand architecture. Don't read entire packages.

## Questions to Answer

### 1. Instruction hierarchy
List every `Instruction*` class with:
- Role in the model (what construct it represents)
- Children it can contain (if composite)
- Whether it has a swimlane
- Whether it supports per-node color/style

### 2. Tile composition model (gtile focus)
- How do `Gtile` instances size themselves? (the StringBounder contract)
- How do tiles compose? (parent tiles wrap child tiles — what are the composition patterns?)
- What is `GtileTopDown`, `GtileTopDown3`, etc.?
- How do `GConnection*` classes encode routing? List each `GConnection*` class with its routing pattern.
- How does the gtile bounding box account for routing that extends beyond node bounds? (We have a known bug here)

### 3. Swimlane model
- How are swimlanes declared and associated with nodes?
- How does layout handle nodes that span swimlanes (e.g. fork bars)?
- What is `Swimlane`, `MonoSwimable`?

### 4. Command catalog
Produce a table:

| Command file | Syntax pattern | Instruction class produced |
|---|---|---|
| CommandActivity.java | `:label;` | InstructionSimple |
| ... | ... | ... |

Include ALL 46 files. If a command file handles multiple syntaxes, list each.

### 5. Missing constructs + special cases
List constructs that are non-obvious or likely to be missed:
- `InstructionGoto` / `InstructionLabel` — how does goto work?
- `InstructionGroup` vs `InstructionPartition` — distinction?
- `InstructionSwitch` — how does switch/case/endswitch work?
- `InstructionSpot` — what is a spot?
- `backward` inside repeat — how is it modeled?
- `detach` — what does it do?
- `kill` vs `stop` vs `end` — what are the distinctions?
- Per-node inline color (`#red :action;`) — where is it handled?
- Arrow labels (`->label;`) — how are they modeled?

## Acceptance Criteria

- Notes contain the complete Instruction hierarchy table
- Notes contain the GConnection* routing pattern table
- Notes contain the full command catalog (all 46 entries)
- Notes identify the swimlane model and cross-lane constructs
- Notes have a Prerequisites section: any primitive we'd need that isn't obvious from activitydiagram3/ alone
- Notes are ≤ 400 lines

## Quality Bar

Write-set file only. No source changes.
