# T2 — Research: mincross.c vs mincross.ts

> **Java source is the spec.** Before writing any code, read the relevant Java
> source in `~/git/plantuml`. The upstream code is 15+ years old and encodes
> accumulated knowledge as special cases and subtle tweaks that exist nowhere
> else. The Java code IS the requirement — not a reference. Reproduce every
> edge case faithfully.

## Context

Same project context as T1. The crossing minimization step uses
WMEDIAN + transpose. The C original also handles flat edges
(same-rank connections), cluster-aware ordering, and BFS-based
rank array construction vs our topological approach.

## Task

Compare `~/git/graphviz/lib/dotgen/mincross.c` against
`src/core/dot/mincross.ts` and produce a findings report.

Cover:
1. **Flat edge handling** — how mincross.c detects same-rank edges,
   breaks flat-edge cycles (`flat_breakcycles`), and reorders nodes
   to respect flat edges (`flat_reorder`); what our code does instead
2. **build_ranks** — mincross.c uses BFS from sources to build rank
   arrays; we use topological sort; document the behavioral difference
   and any cases where they diverge
3. **Virtual node weighting** — how mincross.c weights virtual nodes
   differently in the median calculation
4. **Iteration count and convergence** — how many passes mincross.c
   runs, what its termination condition is vs ours
5. **Cluster handling** — what mincross.c does for subgraphs/clusters;
   note whether plantuml uses this (likely not, but confirm)
6. **Corpus coverage** — scan `tests/corpus/` for diagrams with
   same-rank edges (flat edges); list examples found
7. **Function mapping** — major functions in mincross.c vs mincross.ts

## Write-set

`plans/dot-engine-parity/batch-1/T2-mincross-findings.md`

## Read-set

- `~/git/graphviz/lib/dotgen/mincross.c` (full file)
- `src/core/dot/mincross.ts` (full file)
- `src/core/dot/types.ts`

## Quality Bar

Specific enough that T13 can be implemented without re-reading
mincross.c. Include line references.
