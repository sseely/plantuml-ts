# T7 — Migrate Class Layout to dot

> **Java source is the spec.** Before writing any code, read the relevant Java
> source in `~/git/plantuml`. The upstream code is 15+ years old and encodes
> accumulated knowledge as special cases and subtle tweaks that exist nowhere
> else. The Java code IS the requirement — not a reference. Reproduce every
> edge case faithfully.

## Context

plantuml-js renders PlantUML diagrams to SVG. The class diagram layout
currently calls `await runLayout(elkGraph)` from `src/core/elk-adapter.ts`.
This task replaces that with a synchronous call to `layout(dotGraph)` from
`src/core/dot/index.ts`.

**Stack:** TypeScript 5 strict mode, Vitest, ESLint 9. No Jest.

## Task

1. Rewrite `src/diagrams/class/layout.ts` to use dot layout instead of ELK.
2. Update `tests/integration/class.test.ts` if async assumptions need fixing.

## Write-set

```
src/diagrams/class/layout.ts        (modify)
tests/integration/class.test.ts     (modify if needed)
```

## Read-set

- `src/diagrams/class/layout.ts` — current ELK-based implementation (full file)
- `src/core/dot/index.ts` — `layout()` signature and DotLayoutResult
- `src/core/dot/types.ts` — DotInputGraph, DotInputNode, DotInputEdge
- `src/core/elk-adapter.ts:54-85` — ElkLayoutResult shape
- `plans/graphviz-dot/decisions.md` — D5, D7, D8
- `plans/graphviz-dot/batch-5/overview.md` — ELK→dot attribute mapping table

## Architecture Decisions

- **D5**: Same output shape — renderers unchanged
- **D7**: Do NOT remove elkjs or elk-adapter.ts in this task
- **D8**: Node measurement logic unchanged

## Migration Pattern

Same pattern as T6. Remove `async`/`await` from `layoutClass()`.

ELK → dot attribute mapping:
- `elk.direction` → `rankDir`
- `elk.spacing.nodeNode` → `nodeSep`
- `elk.layered.spacing.nodeNodeBetweenLayers` → `rankSep`

Namespaces/packages (compound nodes): flatten children to root level,
compute namespace bounding box from children positions post-layout.

## Acceptance Criteria

- **Given** a class diagram with 3 classes and relationships, **when** `layoutClass()`, **then** all nodes at non-overlapping positions
- **Given** the same diagram, **when** `renderSync()`, **then** SVG starts with `<svg`
- **Given** a class with namespace, **when** `layoutClass()`, **then** namespace bounds contain its member classes

## TDD Workflow

Same as T6: confirm baseline green with ELK, migrate layout.ts, fix any
tests broken by the sync API change, confirm all green before committing.
Log any test assertion changes in decision-journal.md.

## Quality Bar

```
npm test && npm run typecheck && npm run lint
```
