# T6 — Fix acyclic.ts per research findings

> **Java source is the spec.** Before writing any code, read the relevant Java
> source in `~/git/plantuml`. The upstream code is 15+ years old and encodes
> accumulated knowledge as special cases and subtle tweaks that exist nowhere
> else. The Java code IS the requirement — not a reference. Reproduce every
> edge case faithfully.

## Context

plantuml-js TypeScript dot layout engine. Stack: TypeScript, Vitest.
Project root: `~/git/plantuml-js`. Quality gates: `npm test`,
`npm run typecheck`, `npm run lint`, `npm run build`.

Porting rules: port faithfully, preserve upstream names, bug-for-bug
compatibility, no refactoring while porting.

## Task

Read `plans/dot-engine-parity/batch-1/T5-acyclic-findings.md` and
apply any fixes it identifies to `src/core/dot/acyclic.ts`.

If the findings say the implementation is correct, add the missing
edge-case tests and close the task. If fixes are needed, implement
them faithfully per the C source.

## Write-set

- `src/core/dot/acyclic.ts`
- `tests/unit/dot/acyclic.test.ts`

## Read-set

- `plans/dot-engine-parity/batch-1/T5-acyclic-findings.md`
- `src/core/dot/acyclic.ts`
- `src/core/dot/types.ts`
- `~/git/graphviz/lib/dotgen/acyclic.c` (if findings are ambiguous)

## Acceptance Criteria

- Given a graph with cycle A→B→C→A, when `removeAcyclicEdges()`,
  then exactly one edge is reversed, the graph is a DAG, and the
  reversed edge has `reversed: true`
- Given a self-loop A→A, when `removeAcyclicEdges()`, then it is
  handled consistently with graphviz (check findings for exact behavior)
- Given an already-acyclic graph, when `removeAcyclicEdges()`, then
  no edges are modified and no reversed flags are set
- Given a multi-edge A→B (two parallel edges), when
  `removeAcyclicEdges()`, then behavior matches graphviz exactly
  per findings

## Quality Bar

`npm test` passes. `npm run typecheck` clean.
