# T3 — Synthesize Architectural Brief

## Context

You are writing the architectural brief for a PlantUML activity diagram
reimplementation in TypeScript. Two research agents have already read the
Java source (T1) and our current TypeScript source (T2). Your job is to
synthesize their notes into a single actionable document.

This is a **write-only synthesis task** — do not re-read the original
sources. Work from the notes.

The project is at `/Users/scottseely/git/plantuml-js`. The brief will be
used as input to `/plan-mission` for the reimplementation. It must be
specific enough that the reimplementation plan can be decomposed into
tasks without further research.

## Task

Read both notes files. Write `plans/activity-review/brief.md`.

## Write-set

`plans/activity-review/brief.md`

## Read-set

- `plans/activity-review/batch-1/java-model-notes.md`
- `plans/activity-review/batch-1/ts-current-notes.md`
- `plans/activity-review/decisions.md`

## Required Sections in brief.md

### 1. Executive Summary (≤ 10 lines)
One paragraph: what is structurally wrong with our current implementation,
and what is the correct approach for the reimplementation.

### 2. Gap Table
Side-by-side comparison of every Java construct vs. our support:

| Construct | Java class | We have it? | Gap severity | Notes |
|---|---|---|---|---|
| Simple action | InstructionSimple | Yes | — | |
| If/else | InstructionIf | Partial | Medium | Missing elseif chains |
| ... | ... | ... | ... | |

Severity: **None** / **Minor** (aesthetic) / **Medium** (wrong topology) /
**Critical** (crashes or completely absent).

### 3. Structural Mismatches
List the architectural differences between Java's tile-composition model
and our single-pass coordinate assignment. For each:
- What the Java model does
- What we do
- Why it causes problems (or why it doesn't matter)

### 4. Prerequisites
Primitives needed for the reimplementation that we don't fully have yet.
For each:

| Primitive | What it is | We have? | Gap | Effort |
|---|---|---|---|---|
| StringBounder | Text measurement for tile sizing | Partial (`src/core/measurer.ts`) | Needs richer API | S |
| Skinparam (activity-specific) | Per-element style resolution | Partial (`src/core/skinparam.ts`) | Missing activity keys | S |
| GConnection routing | Named routing pattern classes | No | Need 4-6 routing primitives | M |
| ... | ... | ... | ... | ... |

Effort: **S** (< 1 day) / **M** (1-3 days) / **L** (> 3 days)

### 5. Keep / Extend / Replace Verdict
For each current file:

| File | Verdict | Reason |
|---|---|---|
| `src/diagrams/activity/ast.ts` | Keep with extension | ... |
| `src/diagrams/activity/parser.ts` | Keep with extension | ... |
| `src/diagrams/activity/layout.ts` | Replace | ... |
| `src/diagrams/activity/renderer.ts` | Keep with extension | ... |

### 6. Recommended Architecture for Reimplementation
Describe the correct structure for the new implementation. Be specific:
- What are the new modules and their responsibilities?
- What is the tile/connection model in TypeScript terms?
- How should swimlanes work?
- What is the correct order of construction (what to build first)?

### 7. Rename Plan
What gets renamed to `*Old` (or `*Legacy`) so the new implementation can
use the canonical names? Which names can be reused directly?

## Acceptance Criteria

- brief.md exists and is ≤ 500 lines
- Gap table covers every Instruction* class from T1's notes
- Prerequisites table has effort estimates for each item
- Keep/extend/replace verdict covers all 4 current files
- Recommended architecture section names specific modules and their interfaces
- Rename plan is concrete (specific filenames)

## Quality Bar

Write-set file only. No source changes.
