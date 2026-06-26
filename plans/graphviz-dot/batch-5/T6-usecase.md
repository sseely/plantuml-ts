# T6 — Migrate Use Case Layout to dot

> **Java source is the spec.** Before writing any code, read the relevant Java
> source in `~/git/plantuml`. The upstream code is 15+ years old and encodes
> accumulated knowledge as special cases and subtle tweaks that exist nowhere
> else. The Java code IS the requirement — not a reference. Reproduce every
> edge case faithfully.

## Context

plantuml-js renders PlantUML diagrams to SVG. The use case diagram layout
currently calls `await runLayout(elkGraph)` from `src/core/elk-adapter.ts`.
This task replaces that with a synchronous call to `layout(dotGraph)` from
`src/core/dot/index.ts`. The renderers are unchanged (D5: same output shape).

**Stack:** TypeScript 5 strict mode, Vitest, ESLint 9. No Jest.

## Task

1. Rewrite `src/diagrams/usecase/layout.ts` to use dot layout instead of ELK.
2. Update `tests/integration/usecase.test.ts` if async assumptions need fixing.

## Write-set

```
src/diagrams/usecase/layout.ts        (modify)
tests/integration/usecase.test.ts     (modify if needed)
```

## Read-set

- `src/diagrams/usecase/layout.ts` — current ELK-based implementation (full file)
- `src/core/dot/index.ts` — `layout()` signature and DotLayoutResult
- `src/core/dot/types.ts` — DotInputGraph, DotInputNode, DotInputEdge
- `src/core/elk-adapter.ts:54-85` — ElkLayoutResult shape (for comparison)
- `plans/graphviz-dot/decisions.md` — D5 (output shape), D7 (ELK stays in package.json), D8 (pre-measured nodes)
- `plans/graphviz-dot/batch-5/overview.md` — ELK→dot attribute mapping table

## Architecture Decisions

- **D5**: `DotLayoutResult` has the same shape as `ElkLayoutResult` — no renderer changes needed
- **D7**: Do NOT remove `elkjs` from package.json or delete `elk-adapter.ts` in this task (that's T10)
- **D8**: Node measurement logic in `layout.ts` is unchanged — only the layout call changes

## Migration Pattern

**Before:**
```typescript
import { runLayout } from '../../core/elk-adapter.js';
// ...
const elkGraph = buildElkGraph(ast, theme, measurer);
const elkResult = await runLayout(elkGraph);
// extract positions from elkResult
```

**After:**
```typescript
import { layout } from '../../core/dot/index.js';
import type { DotInputGraph } from '../../core/dot/types.js';
// ...
const dotGraph = buildDotGraph(ast, theme, measurer);
const dotResult = layout(dotGraph);
// extract positions from dotResult (same field names)
```

The function `layoutUseCase()` can become synchronous (remove `async`/`await`).

### ELK → dot attribute mapping
- `elk.direction: 'RIGHT'` → `rankDir: 'LR'`
- `elk.spacing.nodeNode: '40'` → `nodeSep: 40`
- `elk.layered.spacing.nodeNodeBetweenLayers: '60'` → `rankSep: 60`

### Compound nodes (containers)
The current ELK implementation uses compound nodes for package/rectangle
containers. For this migration, **flatten compound nodes**: place all child
nodes at the root level of the DotInputGraph. The container's bounding box
can be derived from the positions of its children after layout. Container
rendering still works — the renderer receives the same UCNodeGeo tree.

For the flattened layout, omit container nodes from the DotInputGraph nodes
list (they have no intrinsic size in the flat model). After layout, compute
container bounds from min/max of children positions.

## Acceptance Criteria

- **Given** a use case diagram with actor + 2 use cases, **when** `layoutUseCase()`, **then** result has all nodes at non-overlapping positions with `totalWidth > 0`
- **Given** the same diagram, **when** `renderSync()` (public API), **then** SVG string starts with `<svg` (no error SVG)
- **Given** a use case diagram with a container (rectangle), **when** `layoutUseCase()`, **then** container's children appear inside the container bounds
- **Given** an edge with stereotype, **when** `layoutUseCase()`, **then** edge has non-empty `points` array

## TDD Workflow

For migration tasks the red/green cycle applies to the integration tests:
1. Read `tests/integration/usecase.test.ts` — identify which tests exercise layout
2. Run `npm test` to confirm current baseline (all green with ELK)
3. Migrate `layout.ts` — tests may go red if async assumptions changed
4. Fix any broken tests to match the synchronous API (remove `await` if needed)
5. All tests green before committing

If a test was asserting on ELK-specific behavior (e.g., edge routing style),
update the assertion to match dot output. Log the change in decision-journal.md.

## Quality Bar

```
npm test && npm run typecheck && npm run lint
```

All pre-existing unit tests for use case renderer must still pass.
Integration test `tests/integration/usecase.test.ts` must pass.
