# T6 — mincross.ts + flat.ts

## Context

plantuml-js is a TypeScript port of PlantUML dot layout. mincross.ts has
`flat_breakcycles` and `flat_reorder` inlined (from flat.c), and is missing
the call to class2 at its entry point. This task extracts flat.ts and wires
class2 in.

Stack: TypeScript, vitest, project root `~/git/plantuml-js`.

## Task

1. **Create `src/core/dot/flat.ts`**: extract `flat_breakcycles` and
   `flat_reorder` from mincross.ts into this new file. Port against
   `~/git/graphviz/lib/dotgen/flat.c` — verify the extracted code matches
   the C source, filling any gaps.

2. **Update `src/core/dot/mincross.ts`**: remove the inlined flat functions
   and import them from `./flat.js`. Then add a `class2(graph)` call at the
   very start of `minimizeCrossings` (before any crossing minimization work).
   Import class2 from `./class2.js`.

**Note:** After this task, class2 is called inside minimizeCrossings AND index.ts
will also call it (T7). The T7 call is the canonical one; T6's call is a
safety net that will be removed or kept depending on T7. Read index.ts to
understand the current pipeline ordering before deciding where class2 belongs.
If class2 is more naturally called from index.ts (between assignRanks and
minimizeCrossings), don't add a duplicate call in mincross.ts — just import
it in index.ts (T7). Use the decision journal to note this choice.

## Write-set

- `src/core/dot/flat.ts` (create)
- `src/core/dot/mincross.ts` (modify)
- `tests/unit/dot/flat.test.ts` (create)

## Read-set

- `src/core/dot/mincross.ts` — full current file
- `~/git/graphviz/lib/dotgen/flat.c` — authoritative flat source
- `~/git/plantuml/src/main/java/net/sourceforge/plantuml/core/smetana/gen/lib/dotgen/flat.java`
- `src/core/dot/class2.ts` — T4 output (import contract)
- `tests/unit/dot/mincross.test.ts` — verify these tests still pass

## Architecture decisions

- D1: class2 is called between assignRanks and minimizeCrossings. If you add
  a class2 call in minimizeCrossings, log in decision journal.
- D5: flat.ts must be a separate file matching upstream's flat.c structure.

## Acceptance criteria

- Given `flat.ts` exists, when any function in flat.ts is called, then it
  produces the same output as the previously-inlined version.
- Given an existing mincross test, when T6 is complete, then all mincross
  tests pass without modification.
- Given a graph with flat edges (same-rank), when `minimizeCrossings` runs,
  then flat edges are handled by flat.ts functions (not inline code).

## Quality bar

`npm test && npm run typecheck && npm run lint` must pass.
