# T13 — aspect.ts + index update

## Context

plantuml-js is a TypeScript port of PlantUML dot layout. `aspect.c` implements
aspect ratio adjustment — iteratively re-running rank assignment with different
parameters to approach a target aspect ratio. This is D6.

Stack: TypeScript, vitest, project root `~/git/plantuml-js`.

## Task

1. **Create `src/core/dot/aspect.ts`**: port
   `~/git/graphviz/lib/dotgen/aspect.c`.
   
   Key function: `setAspect(g, asp)` — given a target aspect ratio, measure
   the current layout's aspect ratio, decide whether to compress ranks
   (reduce rankSep) or expand (add ranks), and iterate until the ratio is
   within tolerance. Returns a new `rankSep` and possibly a modified rank
   assignment.

2. **Update `src/core/dot/index.ts`**: call `setAspect(graph, targetAspect)`
   after `assignCoordinates` if the input has an `aspect` attribute set.
   The `DotInputGraph` may need an optional `aspect?: number` field — add it
   to types.ts as well.

## Write-set

- `src/core/dot/aspect.ts` (create)
- `src/core/dot/index.ts` (modify)
- `tests/unit/dot/aspect.test.ts` (create)

## Read-set

- `~/git/graphviz/lib/dotgen/aspect.c`
- `~/git/plantuml/src/main/java/net/sourceforge/plantuml/core/smetana/gen/lib/dotgen/aspect.java`
- `src/core/dot/index.ts` — where to insert the setAspect call
- `src/core/dot/types.ts` — add `aspect?: number` to DotInputGraph if needed

## Architecture decisions

- D6: aspect.c is ported in full — do not skip or stub the iterative loop.

## Interface contracts

Export:
```typescript
export function setAspect(graph: DotWorkingGraph, targetAspect: number): void;
```

Modifies `graph.rankSep` and may re-run portions of rank assignment in-place.

## Acceptance criteria

- Given a graph with `aspect: 1.0`, when the pipeline runs, then the output
  width/height ratio is within 20% of 1.0.
- Given a graph with no `aspect` setting, when the pipeline runs, then
  `setAspect` is not called and layout is unchanged.
- Given the full test suite, when T13 is complete, then all tests pass.

## Visual QA gate

Run `pnpm visual:compare` then invoke `plantuml-visual-qa` agent. Any new
Tier 1 failure in the dot section must be fixed before Batch F-A.

## Quality bar

All four quality gates: `npm test && npm run typecheck && npm run lint && npm run build`.
