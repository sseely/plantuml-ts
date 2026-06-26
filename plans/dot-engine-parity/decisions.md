# Architecture Decisions

## D1 — Network simplex scope: full algorithm

**Decision:** Implement the full graphviz network simplex algorithm
(feasible spanning tree, enter/leave edge pivots, slack/cut-value
maintenance), not an iterative approximation.

**Rationale:** Same lesson as Bezier splines — every simplification
eventually requires the full version. The complexity in rank.c exists
for valid reasons: degenerate graphs, spanning tree cycles, and
negative-slack detection all require the full machinery.

## D2 — Font width table: both DejaVu Sans and Arial/Helvetica

**Decision:** Ship per-glyph width tables for both DejaVu Sans
(plantuml.com's font) and Arial/Helvetica (browser default).
`FontSpec` already carries the font name; selection is free.

**Rationale:** Omitting either font means one environment always
measures wrong. Both tables together are ~200 lines of data.

## D3 — `hide`/`show` timing: AST flag, not parser filter

**Decision:** Hidden members/nodes enter the AST with a
`hidden: boolean` field; layout and renderer skip flagged items.

**Rationale:** A library consumer may want to inspect the full model
even when rendering hides members. The flag costs almost nothing.

## D4 — Spline task decomposition: three sequential sub-tasks

**Decision:** Split `dotsplines.c` into three tasks:
1. T16 — Obstacle polygon construction (node bbox → polygon)
2. T17 — Free-space channel routing + shortest path
3. T18 — Bezier control point fitting + endpoint adjustment

**Rationale:** 2309 lines is too much for one agent. Each piece has
a clear interface and is independently testable.

## D5 — Creole table rendering: pure SVG rect + text grid

**Decision:** Render Creole tables as hand-laid SVG `<rect>` and
`<text>` elements, not `<foreignObject>` HTML tables.

**Rationale:** The project is a pure SVG renderer (no DOM, no
foreignObject). All other elements use this approach.
