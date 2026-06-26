# T19 — xlabel wiring

## Context

plantuml-js is a TypeScript port of PlantUML dot layout. The label library
(T17) computes positions for external labels (xlabels). This task wires it
into the pipeline and surfaces the results in `DotLayoutResult`.

Stack: TypeScript, vitest, project root `~/git/plantuml-js`.

## Task

1. **`src/core/dot/types.ts`**: add optional `xlabel?: string` to
   `DotInputNode` and `DotInputEdge`. Add optional `xlabelX?: number`,
   `xlabelY?: number` to the corresponding result types in `DotLayoutResult`.

2. **`src/core/dot/index.ts`**: after `assignCoordinates`, call
   `xlabelPositions(graph)` (from T17). Merge the results into the
   `extractResult` output — for each node/edge with an xlabel, add
   `xlabelX`/`xlabelY` to its result entry.

## Write-set

- `src/core/dot/index.ts` (modify)
- `src/core/dot/types.ts` (modify)

## Read-set

- `src/core/dot/index.ts` — current pipeline (extractResult function)
- `src/core/dot/types.ts` — current type definitions
- `src/core/label/index.ts` — T17 output (xlabelPositions contract)

## Acceptance criteria

- Given a node with `xlabel: "note"` in the input, when the pipeline runs,
  then the result for that node includes `xlabelX` and `xlabelY` set to
  non-zero values outside the node's own bounding box.
- Given an input with no xlabel attributes, when the pipeline runs, then
  no result entries have `xlabelX`/`xlabelY` set.
- Given the full test suite, when T19 is complete, then all tests pass.

## Visual QA gate (final)

Run `pnpm visual:compare` then invoke `plantuml-visual-qa` agent. Evaluate
the full dot section against committed reference PNGs. This is the final
mission gate. Document results in decision-journal.md.

## Quality bar

All four quality gates: `npm test && npm run typecheck && npm run lint && npm run build`.
