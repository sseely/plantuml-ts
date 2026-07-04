# Timing Diagrams — Deep Dive

This document supplements the mission-guide entry for Phase 4b (Timing
Diagrams). Read it before drafting any agent prompt for this phase.

## Prerequisite: Track SI-2 (datetime.ts)

Timing is blocked until `src/core/datetime.ts` exists. Time references in
timing diagrams include `@` absolute positions, `+` relative offsets, and
clock cycle counts.

## Java source scale

| Package | What it contains |
|---------|-----------------|
| `timingdiagram/` | 25 files: diagram state, player (lane) model, time tick model |
| `timingdiagram/command/` | 24 files: all command parsers |
| `timingdiagram/graphic/` | 17 files: per-mode rendering panels |
| **Total** | **66 files** |

## Core concept: Players and Modes

A "player" is a named participant row in a timing diagram. Each player
independently declares its rendering mode. The six modes are:

| Mode | Java class | Rendering |
|------|-----------|-----------|
| `concise` | `PlayerConcise` | State-change diagram with text boxes at transition points |
| `robust` | `PlayerRobust` | Like concise but with distinct step-change waveform |
| `analog` | `PlayerAnalog` | Continuous numeric value plotted as a line graph |
| `digital` | *(uses binary panels)* | Binary waveform (high/low with 0/1 labels) |
| `binary` | `PlayerBinary` | Strict 0/1 binary waveform |
| `clock` | `PlayerClock` | Regular square-wave clock waveform |

Each mode produces a different SVG row. The diagram is a vertical stack of
these rows, all sharing the same horizontal time axis.

## Time reference model

### `@` absolute time

```
@0
@1
@5
```

Positions along the time axis at integer or decimal values.

### `+` relative time

```
@0
Player is A
+3
Player is B
```

`+3` means "3 time units after the current position." The current position
advances after each state change.

### `UseDateFormat` directive

```
@starttime 1000
clock myClock cycles 5
```

When `printscale` is set, dates (formatted as ISO strings) instead of
integers serve as the time axis labels.

### `@date` references in Gantt-style

If `useDateFormat` is declared, time references use the date format strings
from `src/core/datetime.ts` rather than numeric indices.

## Critical per-mode details

### Concise mode

Renders as horizontal boxes spanning the time range while the player holds
that state. Label text is centered in each box. State changes are vertical
lines at transition points. This is the most common mode.

```
robust "Web Browser" as WB
@0
WB is Idle
@100
WB is Processing
@200
WB is Idle
```

### Robust mode

Like concise, but each state box has a trapezoidal shape at the transition
boundary to indicate that the transition takes non-zero time.

### Analog mode

Plots a continuous numeric value. Between declared values, the line
interpolates linearly. The Y axis is auto-scaled to the min/max of all
declared values for this player.

```
analog "Voltage" as V
@0
V is 0
@1
V is 5
@2
V is 3.2
```

### Binary / Digital mode

High and low states render as square waves. `is 1` → high; `is 0` → low.
Digital mode adds `0` and `1` text labels at transitions.

### Clock mode

A `clock` declaration generates a regular square wave. The `cycles` parameter
sets how many full cycles to render. The clock period is derived from the
overall diagram time range divided by `cycles`.

```
clock "CLK" with period 20
@0
CLK is high
```

The period and initial phase are configurable.

## Time axis

The horizontal time axis at the bottom of the diagram shows tick marks and
labels. The scale is derived from the union of all declared time positions
across all players. `scale N` sets pixels-per-time-unit. `hide time-axis`
suppresses the axis row.

## Timing constraints (arrows between players)

```
WB -> APP : request
@50
WB -> APP@50 : response
```

Constraints are horizontal (or diagonal) arrows connecting a time position
on one player's row to a time position on another. Labels appear on the arrows.

## Highlight bands

```
highlight 10 to 30 #Yellow : testing phase
highlight 50 to 80
```

Highlight bands render as colored rectangles spanning all player rows between
the declared time positions. The label appears above the band.

## Notes

```
note top of WB : this is a note
note bottom of WB : another note
```

Notes attach to a specific player at the current time position.

## `hide time-axis`

Suppresses the time axis row at the bottom of the diagram. Other content is
unchanged.

## Watch-outs

- **Each player declares its mode independently** — a single diagram can have
  a concise player, a binary player, and a clock player simultaneously. The
  renderer must dispatch to the correct panel renderer per row.
- **Time position ordering** — `@` declarations that appear out of order in
  the source are sorted before rendering; the diagram always renders in
  chronological order.
- **State persistence** — a player's state persists from one `@` position to
  the next until explicitly changed. If player A is declared at `@0` and then
  no further state changes appear, it holds its initial state for the full
  diagram width.
- **Compound players** (`robust` with multiple sub-states) — the `is not
  working` form; states can have spaces in their names and are quoted or
  delimited by `is` keyword context. Parse carefully.
- **Clock phase** — `clock X with period 20 pulse 5` sets a non-50% duty
  cycle. The `pulse` parameter specifies the high-time width within the period.
- **`is` vs. bare value** — analog mode accepts `V is 3.2` (numeric); concise/
  robust accept `WB is Idle` (named state). Binary/digital accept `CLK is 1`
  (literal 0/1). The parser must dispatch correctly.
- **Multiple concurrent clocks** — multiple `clock` declarations are allowed.
  Each is an independent player row.
- **Pixel height per row** — default row height is configurable via
  `CommandPixelHeight.java`. Read it before hardcoding any row height constant.
- **Time message arrows can cross rows** — arrows from player A at time T1
  to player B at time T2 are diagonal when T1 ≠ T2. The geometry is:
  `x1 = timeToX(T1)`, `x2 = timeToX(T2)`, `y1 = rowY(A)`, `y2 = rowY(B)`.

## Architecture decisions

**SyncPlugin.** All layout is arithmetic.

**Per-mode panel renderers** — mirror the Java `Panels*` class structure:
`src/diagrams/timing/panels/concise.ts`, `robust.ts`, `analog.ts`,
`binary.ts`, `clock.ts`. Each panel receives the player's state list and
returns an SVG row.

**Shared time axis** — a single `TimeAxis` object is constructed from the
union of all declared time positions. Each panel renderer receives the
`TimeAxis` and calls `timeAxis.toX(t)` for coordinate mapping.

**Horizontal lane layout** — consider whether this lane-stacking pattern
warrants a shared module with Git Graph (both produce horizontal-lanes
diagrams). After building this phase and Phase 5a, evaluate extracting
`src/core/lane-layout.ts`.

## Files to create

```
src/diagrams/timing/
  ast.ts            — TimingDiagramAST, Player, StateChange, TimeConstraint, etc.
  parser.ts         — parseTiming(source): TimingDiagramAST
  time-axis.ts      — TimeAxis: toX, tick computation
  layout.ts         — layoutTiming(ast, measurer): TimingGeometry
  panels/
    concise.ts      — concise/robust row renderer
    analog.ts       — analog row renderer
    binary.ts       — binary/digital row renderer
    clock.ts        — clock row renderer
  renderer.ts       — renderTiming(geo, theme): SVG string (orchestrator)
  index.ts          — timingPlugin: SyncPlugin
tests/unit/timing/
  parser.test.ts
  time-axis.test.ts
  panels/concise.test.ts
  panels/analog.test.ts
  panels/binary.test.ts
  panels/clock.test.ts
```

## Suggested batch structure

**Batch 1:** Track SI-2 (datetime.ts) — if not already built

**Batch 2:** AST + parser (all command types, player declarations, state
changes, `@`/`+` time references, clocks, constraints, highlights)

**Batch 3:** TimeAxis + layout (row geometry, time-to-x mapping, tick
positions, row heights)

**Batch 4:** Concise and robust panel renderers (most common modes; validates
the row layout contract)

**Batch 5:** Analog + binary + digital + clock panel renderers (parallel)

**Batch 6:** Time constraint arrows + highlight bands + notes + axis rendering

**Batch 7:** Integration tests against upstream fixtures from
`tests/corpus/timing/`
