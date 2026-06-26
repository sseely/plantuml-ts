# T5 — rank.ts refactor

## Context

plantuml-js is a TypeScript port of PlantUML dot layout. rank.ts currently
contains inline virtual chain creation (~lines 1367-1407) that belongs in
class2.ts (T4). This task refactors rank.ts to delegate to class1 and decomp,
and removes the inline code that T4 replaces.

Stack: TypeScript, vitest, project root `~/git/plantuml-js`.

## Task

Modify `src/core/dot/rank.ts`:

1. **Remove** the inline virtual node chain creation block (~lines 1367-1407).
   This code will be handled by class2.ts (already written in T4) called from
   index.ts (T7).

2. **Import and call** `class1` from `./class1.js` at the correct point in
   `assignRanks` — after the network simplex loop, to finalize tree edge
   classification.

3. **Import and call** `decompose` from `./decomp.js` at the start of
   `assignRanks` — before rank assignment, to handle disconnected graphs
   by decomposing into components and ranking each independently.

Read rank.ts carefully to identify where class1 and decomp plug in relative
to the existing code. Do not restructure the network simplex logic itself.

## Write-set

- `src/core/dot/rank.ts` (modify)

## Read-set

- `src/core/dot/rank.ts` — full file (current implementation)
- `src/core/dot/class1.ts` — interface contract from T3
- `src/core/dot/decomp.ts` — interface contract from T2
- `~/git/graphviz/lib/dotgen/rank.c:1-100` — see where class1/decomp are called in C
- `tests/unit/dot/acyclic.test.ts` and `tests/unit/dot/mincross.test.ts` — verify these still pass

## Stop condition

If removing the inline virtual chain block changes coordinate output for any
existing passing test, STOP. Document the discrepancy in the decision journal
before proceeding.

## Acceptance criteria

- Given the existing test suite, when T5 is complete, then `npm test` passes
  without modification to any existing test.
- Given a graph with a disconnected component, when `assignRanks` runs after
  T5, then both components receive valid rank assignments.
- Given a graph with long edges, when `assignRanks` runs after T5 (without
  class2 yet being called), then no virtual nodes are created by rank.ts itself.

## Quality bar

`npm test && npm run typecheck && npm run lint` must pass.
All pre-existing tests for acyclic, mincross, renderer must still pass.
