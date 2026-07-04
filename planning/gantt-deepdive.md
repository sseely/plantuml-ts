# Gantt Charts — Deep Dive

This document supplements the mission-guide entry for Phase 4d (Gantt Charts).
Read it before drafting any agent prompt for this phase.

## Prerequisite: Track SI-2 (datetime.ts)

Gantt is blocked until `src/core/datetime.ts` exists. The date arithmetic
module handles all format parsing, relative date computation, and working-day
logic. Do not inline date logic into the Gantt implementation — it will be
needed again by Timing diagrams.

## Java source scale

| Package | What it contains |
|---------|-----------------|
| `project/` | 20 files: diagram state, tasks, layout, rendering entry points |
| `project/core/` | 14 files: AbstractTask, Task, TaskGroup, Resource, Moment, GSide |
| `project/time/` | 6 files: Instant, TimePoint, DayOfWeekUtils, MonthUtils, WeekNumberStrategy |
| `project/timescale/` | 5 files: TimeScale, PrintScale variants |
| `project/solver/` | 2 files: Solver + ImpossibleSolvingException |
| `project/command/` | Command parsers |
| `project/draw/` | Rendering classes |
| `project/data/` | Data structures |
| `project/lang/` | Locale/format helpers |
| `project/ngm/` | Network graph model for constraint solving |
| **Total** | ~75 files across sub-packages |

## Architectural layers

### Layer 1 — Date/Time (→ src/core/datetime.ts)

All date handling lives in `project/time/`. The key abstractions:

- **`Instant`** — an abstract point in time (implemented by `DayAsDate` and
  `DaysAsDate` in `project/time/`)
- **`TimePoint`** — wraps an Instant; provides arithmetic (`add`, `sub`,
  `compareTo`)
- **`DayStatus`** — enum: `WORKING`, `NOT_WORKING` (weekends, holidays, pauses)
- **`DayOfWeekUtils`** — `isWorkingDay`, day-of-week mapping
- **`MonthUtils`** — month length, leap year handling
- **`WeekNumberStrategy`** — ISO vs. US week numbering

**Date formats to handle:**
- `YYYY-MM-DD` (ISO)
- `DD/MM/YYYY`
- `MM/DD/YYYY`
- `today` (resolved at parse time to current date)
- Relative: `+N days`, `+N weeks`, `+N months` applied to a base date

### Layer 2 — Constraint Solver (project/solver/)

`Solver.java` resolves task dependency chains to compute start/end dates.
Tasks can have explicit start/end or be expressed relative to other tasks:

- `[B] starts at [A]'s end` — B.start = A.end
- `[C] starts at [A]'s end + 2 days` — C.start = A.end + 2 days
- `[D] ends at [E]'s start` — D.end = E.start
- `[A] starts 3 days after [B]'s end`

The solver builds a constraint network (`project/ngm/`) and propagates
constraints until all dates are resolved. `ImpossibleSolvingException` is
thrown if a cycle is detected.

**Key constraint:** Only two constraint types exist in practice — start-after
and end-before relative to another task. The network simplex of the dot engine
is NOT used here; the solver is a simple constraint propagation.

### Layer 3 — Task Model (project/core/)

- **`Task`** — a leaf task with name, color, style, start/end dates,
  completion percentage
- **`TaskGroup`** — a summary bar spanning its children's date range
- **`TaskSeparator`** — a named separator between task groups (rendered as
  a full-width row with a different background)
- **`TaskInstant`** — a milestone (diamond marker at a specific instant)
- **`Resource`** — a resource assigned to a task (renders as a label on the bar)

### Layer 4 — Timeline/Timescale (project/timescale/)

The timescale maps dates to pixel x-coordinates. Scale granularity is:

- `daily` — one column per day
- `weekly` — one column per week
- `monthly` — one column per month
- `quarterly` — one column per quarter
- `yearly` — one column per year

Scale is selected via `printscale` / `ganttscale` directives, or auto-selected
based on the date range width. `scale N` sets pixels-per-day.

### Layer 5 — Layout and Rendering (project/, project/draw/)

`GanttDiagram.java` orchestrates:
1. Resolve all task dates via the constraint solver
2. Compute the timescale (start date, end date, column width)
3. Place tasks in rows (rows = order of declaration; groups are indented)
4. Render: title bar, timescale header, task bars, separator rows, milestone
   diamonds, today marker, closed-period shading, grid lines

## Critical syntax details

### Task declaration forms

```
[Task A] lasts 5 days
[Task A] starts 2021-01-01
[Task A] starts 2021-01-01 and ends 2021-01-10
[Task A] lasts 5 days and is 50% complete
[Task A] is colored in red
[Task A] is colored in #FF0000/Lime
```

### Dependency syntax

```
[Task B] starts at [Task A]'s end
[Task B] starts 3 days after [Task A]'s end
[Task B] starts at [Task A]'s start
[Task B] ends at [Task A]'s end
```

Note: dependency syntax uses the apostrophe-s form (`[A]'s end`); this
is literal text in the grammar, not possessive operator syntax.

### `then` keyword

```
[Task A] lasts 3 days
then [Task B] lasts 2 days
```

`then` is sugar for `starts at [previous-task]'s end`. It applies to the
immediately preceding task declaration.

### Closed periods and pauses

```
Project starts 2021-01-01
2021-01-08 is closed
2021-01-09 is closed
2021-01-10 to 2021-01-12 are closed
```

Closed days are excluded from working-day arithmetic. Working-day-based
`lasts N days` counts only non-closed days; closed-day-based `lasts N`
counts calendar days.

```
-- pause on January 11 --
```

Named separators (via `-- text --`) appear as full-width horizontal rows.

### Milestone syntax

```
[Milestone A] happens at 2021-01-15
[Milestone B] happens at [Task A]'s end
```

Milestones render as diamonds with a label.

### `Project starts` directive

```
Project starts 2021-01-01
```

Sets the baseline. Without it, the project starts on the earliest declared
task start date.

### Colored bars and separators

```
[Task A] is colored in red/Lime
-- Section 1 -- is colored in #AAAAAA
```

Gradient colors (`#AAA/white`) render as horizontal gradients on task bars.

### `hide footbox`

Suppresses the bottom date axis (mirrors sequence diagram footbox convention).

## Watch-outs

- **Working vs. calendar day arithmetic** — tasks declared with
  `.working` count only non-closed days; without `.working` they count
  calendar days. The distinction affects the solver and bar widths.
- **Gantt vs. chronology** — PlantUML has both `@startgantt` and
  `@startchronology`. Gantt is `project/`; chronology is a separate
  simpler diagram. Do not confuse them.
- **`[Task]` syntax collision** — the `[` / `]` delimiters are also used
  in links in other diagram types; the block extractor must correctly
  classify `@startgantt` blocks.
- **Column header rendering** — the column header is a two-row structure:
  the top row shows month labels (spanning multiple day columns); the
  bottom row shows individual day or week labels. The spans must be computed
  from the timescale, not hardcoded.
- **`printscale` vs `ganttscale`** — slight behavioral difference upstream;
  read `GanttStyle.java` before implementing.
- **Resource assignment** — `[Task A] on {Alice:50%}{Bob:50%}` assigns
  percentages of named resources. Resource labels appear on the right edge
  of task bars.
- **Constraint cycle detection** — when the solver cannot resolve a cycle,
  render an error diagram, do not crash.

## Architecture decisions

**No third-party date library.** `src/core/datetime.ts` handles everything.

**SyncPlugin.** Constraint solving and layout are synchronous arithmetic;
no async needed.

**Constraint solver:** A simple iterative propagation (not a full LP solver).
Read `Solver.java` — it is short (< 100 lines) and uses a worklist algorithm.

**Timescale as axis object:** Model the timescale as a pure function
`dateToX(date: TimePoint): number` with inverse `xToDate(x: number): TimePoint`.
This isolates all column-width arithmetic.

## Files to create

```
src/diagrams/gantt/
  ast.ts          — GanttDiagramAST, GanttTask, GanttGroup, GanttMilestone, GanttConstraint
  parser.ts       — parseGantt(source): GanttDiagramAST
  solver.ts       — solveConstraints(tasks, constraints): ResolvedTasks
  timescale.ts    — Timescale class: dateToX, xToDate, column headers
  layout.ts       — layoutGantt(ast, measurer): GanttGeometry
  renderer.ts     — renderGantt(geo, theme): SVG string
  index.ts        — ganttPlugin: SyncPlugin
tests/unit/gantt/
  parser.test.ts
  solver.test.ts
  timescale.test.ts
  renderer.test.ts
```

## Suggested batch structure

**Batch 1:** Track SI-2 (datetime.ts) — prerequisite; may be a standalone
prior mission

**Batch 2:** AST + parser + constraint solver (task declarations,
dependency syntax, date arithmetic)

**Batch 3:** Timescale + layout (column headers, row positions, bar widths)

**Batch 4:** Renderer (title, task bars, milestones, separators, closed
periods, resource labels, grid lines)

**Batch 5:** Integration tests against upstream fixtures from
`tests/corpus/gantt/`
