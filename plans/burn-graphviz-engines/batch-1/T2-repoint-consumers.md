# T2 — Repoint seam consumers to the chokepoint; delete auto-layout

## Context
Seven sites consume the old seam through two entry points. Route them all through
`graph-layout` (T1), so the engines become unreferenced and `core/dot` can die.

## Task
1. In each of the 6 diagram layouts, replace imports of `../../core/dot/index.js`
   (`layout`) and `../../core/dot/types.js` (`DotInput*`, `DotLayoutResult`) with
   imports from `../../core/graph-layout.js` (`layoutGraph` + types). Update call
   sites: `layout(graph)` → `layoutGraph(graph)`.
2. For `class` and `component`, also replace the `../../core/auto-layout.js`
   (`autoLayout`) call with `layoutGraph(graph, { engine })` — pass the engine
   name they previously selected if one was hardcoded, else omit `opts`.
3. Delete `src/core/auto-layout.ts`.

Do **not** change any rendering logic or the diagrams' parsers. Only the layout
call + imports.

## Write-set
- `src/diagrams/class/layout.ts`
- `src/diagrams/component/layout.ts`
- `src/diagrams/state/layout.ts`
- `src/diagrams/usecase/layout.ts`
- `src/diagrams/dot/layout.ts`
- `src/diagrams/json/layout.ts`
- `src/core/auto-layout.ts` (delete)

## Read-set
- `src/core/graph-layout.ts` (T1 interface)
- Each target `layout.ts` — only the import block + the `layout(`/`autoLayout(`
  call sites
- `decisions.md#d1`, `decisions.md#d2`

## Acceptance criteria
- Given the 6 layouts, when grepping, then none import `core/dot` or
  `core/auto-layout`; all import `core/graph-layout`.
- Given `src/core/auto-layout.ts`, when the task completes, then it no longer
  exists and nothing imports it.
- Given `tsc --noEmit`, when run, then it compiles (engines still present but now
  unreferenced by these consumers).

## Observability
N/A.

## Rollback
Reversible — restore imports and `auto-layout.ts` from git.

## Quality bar
`npm run typecheck` passes. Commit: `refactor(layout): route graph diagrams
through graph-layout chokepoint`.
