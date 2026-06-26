# T3 — Research: position.c vs position.ts

> **Java source is the spec.** Before writing any code, read the relevant Java
> source in `~/git/plantuml`. The upstream code is 15+ years old and encodes
> accumulated knowledge as special cases and subtle tweaks that exist nowhere
> else. The Java code IS the requirement — not a reference. Reproduce every
> edge case faithfully.

## Context

Same project context as T1. The coordinate assignment step currently
does a simple linear x-assignment from node order. The C original
builds an auxiliary constraint graph, runs another rank-assignment
pass to derive x-coordinates, and handles cluster containment and
sibling separation.

## Task

Compare `~/git/graphviz/lib/dotgen/position.c` against
`src/core/dot/position.ts` and produce a findings report.

Cover:
1. **Auxiliary graph approach** — how `create_aux_edges` builds
   left-right ordering constraints and how `set_xcoords` extracts
   ranks from the aux graph as x-coordinates; contrast with our
   linear assignment
2. **Node separation enforcement** — how position.c guarantees
   nodeSep; where our code may violate it for wide nodes
3. **Virtual node centering** — how position.c places virtual nodes
   horizontally between their real endpoints; what we do
4. **Cluster containment** — `contain_nodes` and
   `separate_subclust`; note if plantuml uses subgraph clusters
   (probably not, but confirm)
5. **y-coordinate assignment** — `set_ycoords`, rankSep, any special
   handling for cluster label heights
6. **Corpus coverage** — scan `tests/corpus/` for wide nodes or
   dense same-rank groups that would expose x-overlap bugs
7. **Function mapping** — major functions in position.c vs position.ts

## Write-set

`plans/dot-engine-parity/batch-1/T3-position-findings.md`

## Read-set

- `~/git/graphviz/lib/dotgen/position.c` (full file)
- `src/core/dot/position.ts` (full file)
- `src/core/dot/types.ts`

## Quality Bar

Specific enough that T14 can be implemented without re-reading
position.c. Include line references.
