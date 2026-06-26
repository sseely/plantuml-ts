# T1 — Research: rank.c vs rank.ts

> **Java source is the spec.** Before writing any code, read the relevant Java
> source in `~/git/plantuml`. The upstream code is 15+ years old and encodes
> accumulated knowledge as special cases and subtle tweaks that exist nowhere
> else. The Java code IS the requirement — not a reference. Reproduce every
> edge case faithfully.

## Context

plantuml-js is a TypeScript port of PlantUML. It has a custom dot
layout engine at `src/core/dot/`. The rank assignment step currently
uses a longest-path forward pass plus a backward normalization pass.
The graphviz C original uses network simplex, which is a min-cost
flow algorithm on a feasible spanning tree. We need to know exactly
what is missing before implementing T12.

Stack: TypeScript, Vitest. Project root: `~/git/plantuml-js`.

Porting rules (from CLAUDE.md): port faithfully, preserve names,
bug-for-bug compatibility, prefer corpus fixtures over synthesized tests.

## Task

Compare `~/git/graphviz/lib/dotgen/rank.c` against
`src/core/dot/rank.ts` and produce a findings report.

Cover:
1. **Algorithm gaps** — what rank.c does that rank.ts does not
   (network simplex steps, feasible tree, pivot operations, etc.)
2. **Rank constraint support** — same/min/max rank, how rank.c
   implements union-find ranksets, what fields types.ts would need
3. **Edge cases** — disconnected components, self-loops, minLen > 1,
   zero-node graphs, graphs with only virtual nodes
4. **Data structures** — what new fields DotNode/DotEdge/DotWorkingGraph
   would need to support network simplex
5. **Corpus coverage** — scan `tests/corpus/class/` and
   `tests/corpus/component/` for diagrams that use `together` or
   rank-constraint syntax; list any found
6. **Function mapping** — for each major function in rank.c, state
   whether rank.ts has an equivalent and how faithful it is

## Write-set

`plans/dot-engine-parity/batch-1/T1-rank-findings.md`

## Read-set

- `~/git/graphviz/lib/dotgen/rank.c` (full file)
- `src/core/dot/rank.ts` (full file)
- `src/core/dot/types.ts` (full file)
- `tests/corpus/class/*.puml` (scan for rank constraints)

## Quality Bar

The findings report must be specific enough that a typescript-pro
agent can implement T12 without reading rank.c again. Include exact
line references from rank.c for any algorithm step you describe.
