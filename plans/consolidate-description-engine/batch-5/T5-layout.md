# T5 — Symbol-aware layout

## Context

`component/layout.ts` (421 LOC) sizes boxes + lollipop interfaces + nesting;
`usecase/layout.ts` (591 LOC) sizes actor stick-figures + ellipses + nesting.
Both already feed the graph-layout seam (`src/core/graph-layout.ts`
`layoutGraph(DotInputGraph)`). Upstream has one layout. Unify into one module
whose per-element sizing switches on `symbol` (D4).

## Task

Create `src/diagrams/description/layout.ts` exporting
`layoutDescription(ast, theme, measurer): DescriptionGeometry` plus the
`DescriptionGeometry` type. Build the `DotInputGraph` from `DescriptionDiagramAST`
(nodes → sized `DotInputNode`s, containers → clusters, links → edges), call the
seam, and map results back to geometry the renderer consumes. Size each node by
`symbol`:
- `actor`/`actor-business` → stick-figure metrics
- `usecase`/`usecase-business` → ellipse metrics
- containers (`package`/`node`/`folder`/`frame`/`cloud`/`rectangle`/…) → label +
  padded child bbox
- everything else → box metrics (the rect default also serves D2 fallback
  symbols)

Reuse the seam-building and back-mapping patterns already proven in the two
source layouts; do not reimplement the seam.

## Read-set

- `src/diagrams/component/layout.ts`, `src/diagrams/usecase/layout.ts` (merge
  source — sizing + seam-build + back-map patterns).
- `src/core/graph-layout.ts` (seam API: `layoutGraph`, `DotInputGraph`,
  `DotLayoutResult`), `src/core/graph-layout.types.ts`.
- `src/diagrams/description/ast.ts` (T3), `src/diagrams/description/parser.ts`
  (T4 — AST it produces).
- `tests/unit/component/layout.test.ts`, `tests/unit/usecase/layout.test.ts`
  (cases to migrate).

## Architecture decisions

D4 (one symbol-aware layout). Locked.

## Interface contract (consumed by T6, T7)

```ts
export interface DescriptionGeometry { /* node boxes + routed links + canvas */ }
export function layoutDescription(
  ast: DescriptionDiagramAST, theme: Theme, measurer: StringMeasurer,
): DescriptionGeometry;
```
Mirror the field shape of the existing `ComponentGeometry`/`UseCaseGeometry` so
the renderer port (T6) stays mechanical; document the unified shape in the file.

## Acceptance criteria

- Given an `actor` node, when laid out, then stick-figure dimensions (not box).
- Given a `usecase` node, when laid out, then ellipse sizing.
- Given `package P { node N }`, when laid out, then `N`'s box is contained within
  `P`'s bbox.
- Given two linked nodes, when laid out, then a routed link with ≥2 points.

## Observability

N/A — layout. Correctness via migrated unit tests.

## Rollback

Reversible — delete the file; old layouts live until Batch 8.

## Quality bar

`npm run typecheck && npm run lint && npm test` green; 90/90/90. One commit:
`feat(T5): add symbol-aware descriptive layout`.
