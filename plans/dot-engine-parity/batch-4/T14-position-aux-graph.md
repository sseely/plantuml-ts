# T14 — position.ts: auxiliary-graph x-coordinate assignment

> **Java source is the spec.** Before writing any code, read the relevant Java
> source in `~/git/plantuml`. The upstream code is 15+ years old and encodes
> accumulated knowledge as special cases and subtle tweaks that exist nowhere
> else. The Java code IS the requirement — not a reference. Reproduce every
> edge case faithfully.

## Context

plantuml-js TypeScript port. Coordinate assignment currently does
a linear x-assignment from node order with fixed nodeSep gaps
(~154 lines). The C original builds an auxiliary constraint graph,
runs another rank-assignment pass to derive x-coordinates, enforces
nodeSep as minimum-length constraints, and centers virtual nodes
between their real endpoints.

Porting rules: port faithfully, preserve function names
(dot_position, set_xcoords, set_ycoords, create_aux_edges,
contain_nodes), bug-for-bug compat.

## Task

Read `plans/dot-engine-parity/batch-1/T3-position-findings.md` and
implement the auxiliary-graph x-coordinate assignment per position.c.

Key changes per findings:
1. **create_aux_edges** — build left-right ordering constraints as
   edges in an auxiliary graph; nodeSep becomes minLen on these edges
2. **set_xcoords** — run rank assignment on the aux graph; the
   resulting "ranks" are x-coordinates
3. **Virtual node centering** — aux graph constraints that pull
   virtual nodes toward the horizontal midpoint of their real endpoints
4. **set_ycoords** — verify y-coordinate assignment matches position.c;
   fix any discrepancies
5. **Preserve API** — `assignCoordinates(graph)` signature unchanged

## Write-set

- `src/core/dot/position.ts`
- `tests/unit/dot/position.test.ts`

## Read-set

- `plans/dot-engine-parity/batch-1/T3-position-findings.md` (primary)
- `src/core/dot/position.ts`
- `src/core/dot/types.ts`
- `src/core/dot/rank.ts` (aux graph reuses rank assignment)
- `~/git/graphviz/lib/dotgen/position.c` (if findings ambiguous)
- `tests/unit/dot/position.test.ts`

## Acceptance Criteria

- Given two nodes at the same rank with order 0 and 1 and
  `nodeSep=50`, when `assignCoordinates()`, then
  `node[1].x ≥ node[0].x + node[0].width + 50`
- Given a virtual node chain spanning two real nodes, when
  `assignCoordinates()`, then each virtual node's x is between
  the x-coordinates of the two real endpoints
- Given a wide node (width=200) next to a narrow node (width=40)
  with `nodeSep=36`, when `assignCoordinates()`, then they do not
  visually overlap
- All existing position.test.ts tests continue to pass

## Quality Bar

`npm test` passes. `npm run typecheck` clean. 90/90/90 coverage
for position.ts.
