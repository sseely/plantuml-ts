# Architecture Decisions

## D1 — class2.ts called after assignRanks, before minimizeCrossings

Call `class2(graph)` in `index.ts` between `assignRanks()` and
`minimizeCrossings()`.

**Why:** class2.c creates virtual node chains for long edges and label virtual
nodes. It must run after ranks are known (reads `node.rank`) and before
crossing minimization (mincross needs the virtual nodes to exist).

**How to apply:** The inline virtual chain code in rank.ts (~lines 1367-1407)
must be deleted in T5. T6 wires class2 into the mincross entry point, T7
wires it into index.ts.

## D2 — Edge type as string literal union

Edge classification: `type?: 'tree' | 'forward' | 'cross' | 'back'` on
`DotEdge`.

**Why:** Self-documenting, prevents magic-number bugs, no downcast overhead.

**How to apply:** Add the `type` field to `DotEdge` in types.ts during T3
(class1.ts). Do not use a numeric enum or separate subtype.

## D3 — Cluster as DotNode.clusterId + DotWorkingGraph.clusters[]

`DotNode.clusterId?: string` + `DotWorkingGraph.clusters: Map<string, DotNode[]>`.

**Why:** Minimal type additions; avoids a ClusterNode subtype that would
require downcasting throughout the pipeline.

**How to apply:** Add these fields to types.ts in T10 (cluster integration).
T8 (cluster.ts) can use local types internally and export functions that
accept/return `DotWorkingGraph`.

## D4 — pathplan as standalone src/core/pathplan/

Port the 4 Smetana pathplan files to `src/core/pathplan/` with a public
`index.ts` export, separate from `src/core/dot/`.

**Why:** pathplan is a general polygon-routing library; keeping it separate
allows splines.ts and future engines to import it without circular dependencies.

**How to apply:** T14 creates `src/core/pathplan/`. T18 imports from it in
splines.ts using `import { ... } from '../pathplan/index.js'`.

## D5 — flat.ts extracted from mincross.ts

Extract `flat_breakcycles` and `flat_reorder` (currently inlined in mincross.ts)
to `src/core/dot/flat.ts`.

**Why:** Matches upstream dotgen file structure (flat.c is separate from
mincross.c). Makes the code traceable against Graphviz source.

**How to apply:** T6 creates flat.ts and updates mincross.ts to import from it.

## D6 — aspect.c ported (not skipped)

Port `aspect.c` in full, including the iterative re-ranking loop for
aspect ratio adjustment.

**Why:** aspect.c is in Smetana's dotgen, which means PlantUML uses it.
Skipping would cause aspect-ratio-forced diagrams to diverge from upstream.

**How to apply:** T13 creates aspect.ts and wires it into index.ts.
