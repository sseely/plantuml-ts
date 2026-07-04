# Phase 4 — plantuml-js Integration (Replace ELK)

## Goal

Wire the dot layout engine into the plantuml-js plugin system, replacing
ELK.js for the four graph diagram types: class, component, state, use case.
After Phase 4, graph diagrams use dot layout, `renderSync()` works for all
diagram types, and ELK.js can be removed from `package.json`.

## Write-set

```
src/diagrams/class/layout.ts       — replace runLayout(elk) with layout(dot)
src/diagrams/component/layout.ts   — replace runLayout(elk) with layout(dot)
src/diagrams/state/layout.ts       — replace runLayout(elk) with layout(dot)
src/diagrams/usecase/layout.ts     — replace runLayout(elk) with layout(dot)
src/core/elk-adapter.ts            — mark deprecated (or delete if no other callers)
package.json                       — remove elkjs dependency
tests/integration/usecase.test.ts  — update integration tests if needed
tests/integration/class.test.ts    — update integration tests if needed
tests/integration/component.test.ts — update integration tests if needed
tests/integration/state.test.ts    — update integration tests if needed
```

Check for other callers of `runLayout` before deleting elk-adapter.ts.

## Read-set

- `src/core/dot/index.ts` — `layout()` function signature and DotLayoutResult
- `src/core/dot/types.ts` — DotInputGraph, DotInputNode, DotInputEdge
- `src/diagrams/usecase/layout.ts` — current ELK-based layout (pattern to replace)
- `src/diagrams/class/layout.ts` — same
- `src/diagrams/component/layout.ts` — same
- `src/diagrams/state/layout.ts` — same
- `src/core/elk-adapter.ts` — ElkLayoutResult shape (to confirm output compatibility)
- `planning/graphviz/decisions.md` — D5 (output format), D7 (replace ELK in Phase 4)

## Architecture Decisions (relevant)

- **D5**: Output format is compatible — `DotLayoutResult` has the same
  shape as `ElkLayoutResult`. Renderers need no changes.
- **D7**: Keep ELK working until Phase 4 is complete and all integration
  tests pass, then replace.
- **D8**: Node sizes are pre-measured inputs — layout.ts files already
  handle measurement; that logic is unchanged.

## Migration Pattern

Each `layout.ts` file currently:
1. Builds an `ElkGraph` (nodes + edges in ELK format)
2. Calls `await runLayout(elkGraph)` → `ElkLayoutResult`
3. Extracts positions from `ElkLayoutResult`

After Phase 4, each `layout.ts` file:
1. Builds a `DotInputGraph` (nodes + edges in dot format)
2. Calls `layout(dotGraph)` (synchronous) → `DotLayoutResult`
3. Extracts positions from `DotLayoutResult`

The extraction step (building NodeGeo from layout result) is the same
structure — just reading from `DotLayoutResult` instead of `ElkLayoutResult`.

### Attribute mapping

| ELK concept | dot equivalent |
|-------------|---------------|
| `elk.direction: 'RIGHT'` | `rankDir: 'LR'` |
| `elk.direction: 'DOWN'` | `rankDir: 'TB'` |
| `elk.spacing.nodeNode` | `nodeSep` |
| `elk.layered.spacing.nodeNodeBetweenLayers` | `rankSep` |
| compound node children | nested subgraphs (Phase 4 simplification: flatten) |

**Compound node simplification for Phase 4**: The dot engine in Phases 1-3
handles flat graphs. Compound nodes (package/namespace containers) require
cluster subgraph support, which is an additional feature on top of the
base algorithm. For Phase 4 initial integration, flatten compound nodes:
place children at the root level with the container's position constraints.
Add compound node support as a follow-up.

## Acceptance Criteria

- **Given** a use case diagram with actor, use cases, and container,
  **when** `layoutUseCase()`, **then** result is a `UseCaseGeometry` with
  non-zero `totalWidth`, `totalHeight`, and all nodes at non-overlapping
  positions.
- **Given** the same use case diagram, **when** `renderSync()` is called
  on the public API, **then** it returns valid SVG (no error SVG).
- **Given** a class diagram, **when** `renderSync()`, **then** returns
  valid SVG.
- **Given** a component diagram, **when** `renderSync()`, **then** returns
  valid SVG.
- **Given** a state diagram, **when** `renderSync()`, **then** returns
  valid SVG.
- **Given** ELK is removed from package.json, **when** `npm install &&
  npm test`, **then** all tests pass (no residual ELK imports).
- **Given** the Vite demo app, **when** loaded in a browser with a use
  case diagram, **then** the diagram renders visibly without errors.

## Quality Bar

- `npm test` — all 993+ tests pass (plus new tests for dot integration)
- `npm run typecheck` — zero errors
- `npm run lint` — zero errors
- `npm run build` — no bundler errors
- Playwright e2e tests pass for all four diagram types

## Implementation Order

1. Update `usecase/layout.ts` first (best-understood diagram type)
2. Run full test suite — fix any integration failures
3. Update `class/layout.ts`, `component/layout.ts`, `state/layout.ts`
4. Run full test suite — fix failures
5. Remove `elkjs` from `package.json` and `elk-adapter.ts` (if no callers)
6. Run `npm install` to update lockfile
7. Run full test suite + Playwright
8. Update demo app if it references ELK configuration directly
