# T1 — Create the layout chokepoint (stubbed)

## Context
plantuml-ts is dropping its in-house graphviz port in favor of `graphviz-ts`.
This task creates the single seam consumer that the adapter mission will later
wire to graphviz-ts. For now it throws.

## Task
1. Create `src/core/graph-layout.types.ts` with the **consumer-facing** types,
   copied verbatim (names + shapes) from `src/core/dot/types.ts`:
   `DotInputNode`, `DotInputEdge`, `DotInputGraph`, `DotLayoutResult`.
   Do **not** copy engine-internal types (`DotNode`, `DotEdge`, `DotWorkingGraph`).
2. Create `src/core/graph-layout.ts`:
   - `export class PendingGraphvizError extends Error` (set `name`).
   - `export function layoutGraph(input: DotInputGraph, opts?: { engine?: string }):
     DotLayoutResult { throw new PendingGraphvizError(...) }` with a message
     pointing at the adapter mission.
   - Re-export the four types from `./graph-layout.types.js`.

## Write-set
- `src/core/graph-layout.ts` (create)
- `src/core/graph-layout.types.ts` (create)

## Read-set
- `src/core/dot/types.ts` — copy the 4 consumer types (see `decisions.md#d4`)
- `decisions.md#d1`, `decisions.md#d3`, `decisions.md#d4`

## Interface contract (consumed by T2)
```ts
export class PendingGraphvizError extends Error {}
export function layoutGraph(input: DotInputGraph, opts?: { engine?: string }): DotLayoutResult
export type { DotInputNode, DotInputEdge, DotInputGraph, DotLayoutResult }
```

## Acceptance criteria
- Given the new module, when `tsc --noEmit` runs, then it compiles with no errors.
- Given any `DotInputGraph`, when `layoutGraph(g)` is called, then it throws
  `PendingGraphvizError`.
- Given `PendingGraphvizError`, when inspected, then `err.name ===
  'PendingGraphvizError'` and the message references the adapter mission.

## Observability
N/A — no new observable operations (library, no I/O).

## Rollback
Reversible — delete the two new files.

## Quality bar
`npm run typecheck` passes. Commit: `refactor(layout): add graph-layout
chokepoint stubbing the dot seam`.
