# T7 — index.ts cleanup + delete edgelabels

## Context

plantuml-js is a TypeScript port of PlantUML dot layout. After T5 and T6,
class2.ts exists and rank.ts is refactored. This task wires class2 into the
pipeline (index.ts) and deletes the dead edgelabels.ts code.

Stack: TypeScript, vitest, project root `~/git/plantuml-js`.

## Task

1. **Update `src/core/dot/index.ts`**: add `import { class2 } from './class2.js'`
   and call `class2(graph)` between `assignRanks(graph)` and
   `minimizeCrossings(graph)`. This is D1.

2. **Delete `src/core/dot/edgelabels.ts`**: this file is dead code — it exports
   `placeEdgeLabels()` which is never imported anywhere in `src/`. The actual
   label placement happens via `labelNode` virtual nodes created by class2 and
   read by `extractResult` in index.ts. Delete both the file and its test.

3. **Delete `tests/unit/dot/edgelabels.test.ts`**: remove the test file for
   the deleted module.

Also remove the `_r` edge deduplication block in index.ts if T5's decomp
integration makes it redundant — but only if you can verify via tests that
removing it doesn't break anything. If in doubt, leave it.

## Write-set

- `src/core/dot/index.ts` (modify)
- `src/core/dot/edgelabels.ts` (DELETE)
- `tests/unit/dot/edgelabels.test.ts` (DELETE)

## Read-set

- `src/core/dot/index.ts` — full current pipeline
- `src/core/dot/class2.ts` — T4 output (import contract)
- `src/core/dot/edgelabels.ts` — read before deleting to confirm it's dead

## Architecture decisions

- D1: class2 called between assignRanks and minimizeCrossings in index.ts

## Acceptance criteria

- Given the pipeline is run end-to-end on a graph with a long edge, when T7
  is complete, then virtual chain nodes appear in the layout result.
- Given `edgelabels.ts` is deleted, when `npm test` runs, then no test
  references the deleted module.
- Given a labeled edge in a graph, when the pipeline runs, then `edge.labelX`
  and `edge.labelY` are set in the result via the class2 labelNode path.
- Given the full test suite, when T7 is complete, then all tests pass.

## Visual QA gate (runs after this task)

Run `pnpm visual:compare` then invoke the `plantuml-visual-qa` agent to
evaluate the dot section. Use committed reference PNGs in
`tests/visual/reference/dot/` as the baseline. Any new Tier 1 failure in
the dot section must be fixed before moving to Batch D.

## Quality bar

All four quality gates: `npm test && npm run typecheck && npm run lint && npm run build`.
