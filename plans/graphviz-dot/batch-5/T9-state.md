# T9 — Migrate State Layout to dot

> **Java source is the spec.** Before writing any code, read the relevant Java
> source in `~/git/plantuml`. The upstream code is 15+ years old and encodes
> accumulated knowledge as special cases and subtle tweaks that exist nowhere
> else. The Java code IS the requirement — not a reference. Reproduce every
> edge case faithfully.

## Context

plantuml-js renders PlantUML diagrams to SVG. The state diagram layout
currently calls `await runLayout(elkGraph)` from `src/core/elk-adapter.ts`.
This task replaces that with a synchronous call to `layout(dotGraph)` from
`src/core/dot/index.ts`.

**Stack:** TypeScript 5 strict mode, Vitest, ESLint 9. No Jest.

## Task

1. Rewrite `src/diagrams/state/layout.ts` to use dot layout instead of ELK.
2. Update `tests/integration/state.test.ts` if async assumptions need fixing.

## Write-set

```
src/diagrams/state/layout.ts        (modify)
tests/integration/state.test.ts     (modify if needed)
```

## Read-set

- `src/diagrams/state/layout.ts` — current ELK-based implementation (full file)
- `src/core/dot/index.ts` — `layout()` signature and DotLayoutResult
- `src/core/dot/types.ts` — DotInputGraph, DotInputNode, DotInputEdge
- `src/core/elk-adapter.ts:54-85` — ElkLayoutResult shape
- `plans/graphviz-dot/decisions.md` — D5, D7, D8
- `plans/graphviz-dot/batch-5/overview.md` — ELK→dot attribute mapping

## Architecture Decisions

- **D5**: Same output shape — renderers unchanged
- **D7**: Do NOT remove elkjs or elk-adapter.ts in this task
- **D8**: Node measurement logic unchanged

## Migration Pattern

Same pattern as T6/T7/T8. Remove `async`/`await` from `layoutState()`.

Composite/nested states: flatten to root level for this phase, compute
parent state bounds from children positions post-layout.

Initial/final pseudostates ([*]) are regular DotInputNodes with fixed
small dimensions (they're already measured as such by the layout module).

## Acceptance Criteria

- **Given** a state diagram with initial, 2 states, final, and transitions, **when** `layoutState()`, **then** all nodes at non-overlapping positions
- **Given** the same diagram, **when** `renderSync()`, **then** SVG starts with `<svg`
- **Given** a composite state with nested states, **when** `layoutState()`, **then** composite bounds contain nested states

## TDD Workflow

Same as T6: confirm baseline green with ELK, migrate layout.ts, fix any
tests broken by the sync API change, confirm all green before committing.
Log any test assertion changes in decision-journal.md.

## Quality Bar

```
npm test && npm run typecheck && npm run lint
```
