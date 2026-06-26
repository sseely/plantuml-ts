# T2 — R-4 TB_balance

## Context

Project: TypeScript port of PlantUML's Graphviz dot layout engine.
Working directory: /Users/scottseely/git/plantuml-js
Stack: TypeScript, vitest. Commit style: Conventional Commits.

`src/core/dot/rank.ts` runs network simplex to assign ranks to nodes. NS
naturally places each node at the earliest feasible rank. For hub nodes with
equal in_degree and out_degree, this produces asymmetric layouts — the node
clusters near the top rather than the middle of the diagram.

`TB_balance` (C: rank.c:314–360) is a post-NS quality pass that shifts
equal-degree nodes toward a more centered rank without violating any constraints.

Read `src/core/dot/rank.ts` in full before changing anything. It is 1386 lines.
The insertion point is after `scan_and_normalize` at line ~1311 inside
`assignRanks`.

## Task

1. Add `TB_balance(graph: DotWorkingGraph): void` as a private function
   (before `assignRanks`):

   ```typescript
   // C: TB_balance() rank.c:314-360
   // Post-NS quality pass: shift equal-degree nodes toward rank midpoint.
   function TB_balance(graph: DotWorkingGraph): void {
     const { nodes, edges } = graph;
     const ranks = nodes.map((n) => n.rank);
     const minRank = Math.min(...ranks);
     const maxRank = Math.max(...ranks);
     const span = maxRank - minRank;
     if (span === 0) return;

     // Count nodes per rank for population-based tie-breaking.
     const rankPop = new Map<number, number>();
     for (const n of nodes) rankPop.set(n.rank, (rankPop.get(n.rank) ?? 0) + 1);

     for (const node of nodes) {
       if (node.virtual) continue;

       // Count non-flat (cross-rank) in and out edges.
       const inDeg  = edges.filter((e) => e.to   === node && e.from.rank !== e.to.rank).length;
       const outDeg = edges.filter((e) => e.from === node && e.from.rank !== e.to.rank).length;
       if (inDeg !== outDeg) continue;

       // C: prefer less-populated rank; bias toward midpoint.
       const mid = minRank + span / 2;
       if (node.rank >= mid) continue; // already at or past midpoint

       // Find the next feasible rank: max rank of predecessors + 1.
       const predMaxRank = edges
         .filter((e) => e.to === node && e.from.rank < node.rank)
         .reduce((m, e) => Math.max(m, e.from.rank), minRank - 1);
       const earliest = predMaxRank + 1;
       // And the rank just before the first successor.
       const succMinRank = edges
         .filter((e) => e.from === node && e.to.rank > node.rank)
         .reduce((m, e) => Math.min(m, e.to.rank), maxRank + 1);
       const latest = succMinRank - 1;

       // Try each rank from latest down to current+1; pick less-populated.
       for (let r = latest; r > node.rank; r--) {
         if (r < earliest) break;
         const pop = rankPop.get(r) ?? 0;
         const curPop = rankPop.get(node.rank) ?? 0;
         if (pop < curPop) {
           rankPop.set(node.rank, curPop - 1);
           rankPop.set(r, pop + 1);
           node.rank = r;
           break;
         }
       }
     }
   }
   ```

2. Call `TB_balance(graph)` inside `assignRanks`, after `scan_and_normalize`
   and **before** the virtual node insertion block (the big `for (const edge
   of graph.edges)` loop starting at line ~1322). The call goes here:

   ```typescript
   scan_and_normalize(graph.nodes);

   // C: TB_balance() rank.c:512 — post-NS rank quality improvement
   TB_balance(graph);

   // ---- virtual node insertion for long edges ----
   const edgesToAdd: DotEdge[] = [];
   ```

## Write-set

- `src/core/dot/rank.ts`
- `tests/unit/dot/rank.test.ts`

## Read-set

- `src/core/dot/rank.ts` — full file; focus on `assignRanks` (line ~1286)
  and `scan_and_normalize` (line ~1202)
- `src/core/dot/types.ts` — `DotWorkingGraph`, `DotNode`, `DotEdge`
- `decisions.md` — D-4 (nothing in D-4 affects rank.ts, but note D-5 does not apply here)

## Acceptance criteria

- Given a symmetric diamond (A→B, A→C, B→D, C→D) where A,D have equal
  in/out and are placed at ranks 0 and 3, when `TB_balance` runs,
  then B and C (equal in/out, rank 1) are candidates to shift toward rank 2
- Given a node with inDeg ≠ outDeg, when `TB_balance` runs,
  then its rank is unchanged
- Given a node already at or past the diagram midpoint, when `TB_balance`
  runs, then it is not shifted
- All existing rank.test.ts tests continue to pass

## Quality bar

```sh
npm run typecheck && npm run lint && npm run build
npm test  # all N tests pass, 0 failing
```

One commit: `fix(dot): R-4 TB_balance post-NS rank quality`
