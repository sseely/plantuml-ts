# T4 — Research: dotsplines.c vs splines.ts

> **Java source is the spec.** Before writing any code, read the relevant Java
> source in `~/git/plantuml`. The upstream code is 15+ years old and encodes
> accumulated knowledge as special cases and subtle tweaks that exist nowhere
> else. The Java code IS the requirement — not a reference. Reproduce every
> edge case faithfully.

## Context

Same project context as T1. Edge routing currently uses straight-line
segments with spread ports. dotsplines.c implements full Bezier spline
routing with obstacle avoidance, flat edge routing, and port endpoint
adjustment. This is the largest file (2309 lines) and will be
implemented in three sub-tasks (T16, T17, T18).

## Task

Compare `~/git/graphviz/lib/dotgen/dotsplines.c` against
`src/core/dot/splines.ts` and produce a findings report structured
to guide the three implementation sub-tasks.

### Section A — Obstacle polygon construction (for T16)
- How node bounding boxes become obstacle polygons
- How virtual nodes (width=0) are handled (no polygon)
- Data structures used to represent the free-space map
- How port/endpoint coordinates are determined before routing

### Section B — Free-space routing (for T17)
- How `make_regular_edge` finds a path through free space
- The channel-routing or shortest-path algorithm used
- How flat edges (same-rank source and target) are routed differently
  via `make_flat_edge`
- How self-loops are handled

### Section C — Bezier fitting (for T18)
- How `completeregularpath` and `adjustregularpath` fit Bezier
  control points to the routed polyline
- SVG path command output format (C cubic vs Q quadratic)
- How endpoints are adjusted to meet node boundaries precisely

### Section D — Integration (for all three)
- The call sequence: what calls what in what order
- What data flows between the three sections
- What fields DotEdge/DotNode need that they don't have now

### Section E — Corpus coverage
- Scan `tests/corpus/` for diagrams where straight-line routing
  would visually pass through an intermediate node; list examples
- Scan for flat-edge diagrams (same-rank edges)

## Write-set

`plans/dot-engine-parity/batch-1/T4-splines-findings.md`

## Read-set

- `~/git/graphviz/lib/dotgen/dotsplines.c` (full file)
- `src/core/dot/splines.ts` (full file)
- `src/core/dot/types.ts`

## Quality Bar

The report must be detailed enough that T16/T17/T18 agents can each
implement their section without re-reading dotsplines.c. Section
boundaries must include the exact interface contracts between sections.
Include line references throughout.
