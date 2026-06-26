# T2 — Read Our TypeScript Activity Implementation

## Context

You are auditing the current TypeScript activity diagram implementation
in `/Users/scottseely/git/plantuml-js`. The goal is structured notes that
a synthesis agent (T3) will use to write an architectural brief for a
reimplementation.

This is a **read-only research task**. No code changes.

Background: the activity diagram was built incrementally ("hacked at a
little at a time"). It has accumulated fixes on top of a shaky foundation.
The question is not "is it broken" but "what is its structural shape and
what is worth keeping vs. rebuilding."

## Task

Read all four source files and produce structured notes answering the
questions below.

## Write-set

`plans/activity-review/batch-1/ts-current-notes.md`

## Read-set

- `src/diagrams/activity/ast.ts` — all of it
- `src/diagrams/activity/parser.ts` — all of it
- `src/diagrams/activity/layout.ts` — all of it
- `src/diagrams/activity/renderer.ts` — all of it
- `tests/unit/activity/` — skim for coverage gaps
- `src/core/skinparam.ts` — lines 1-50 (interface only)
- `src/core/theme.ts` — lines 1-50 (interface only)

## Questions to Answer

### 1. Parser inventory
What does the parser currently recognize? Produce two lists:

**Recognized:**
| Syntax | AST node produced |
|---|---|
| `:label;` | ActivityAction |
| `if (cond) then` | ActivityIf |
| ... | ... |

**Silently dropped (falls to "unknown line"):**
List every construct the parser hits but does not produce an AST node for.
Check for TODO/FIXME comments and any `console.warn`/unknown-line branches.

### 2. AST node inventory
List every type in `ast.ts` with:
- What it represents
- Key fields (especially optional ones that may be partially implemented)
- Any fields that exist in the type but are never populated by the parser

### 3. Layout inventory
For each layout function (`layoutIf`, `layoutWhile`, `layoutRepeat`,
`layoutFork`, `layoutSplit`, etc.):
- What it handles
- Known structural problems (e.g. the viewBox overflow bug fixed recently)
- Cases it handles correctly vs. cases it approximates vs. cases it ignores

### 4. Structural mismatches with tile-based layout
Identify where our approach is fundamentally different from a tile
composition model:
- We compute absolute coordinates bottom-up in a single pass
- Java tiles are self-sizing objects that compose
- List specific places where this mismatch causes or would cause problems

### 5. What's worth keeping
For each file, assess:
- **Keep as-is**: works correctly, no structural issues
- **Keep with extension**: correct structure, just needs more cases
- **Replace**: structurally wrong, causes cascading problems

### 6. Test coverage gaps
Skim `tests/unit/activity/`. What constructs have zero test coverage?
What constructs have tests that only cover the happy path?

## Acceptance Criteria

- Notes contain the recognized/dropped parser inventory tables
- Notes contain the AST node inventory
- Notes identify at least 3 structural mismatches with tile-based layout
- Notes have a clear keep/extend/replace verdict for each of the 4 files
- Notes are ≤ 400 lines

## Quality Bar

Write-set file only. No source changes.
