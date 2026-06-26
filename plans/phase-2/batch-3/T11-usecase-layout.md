# T11 — Use Case Diagram Layout

> **Java source is the spec.** Before writing any code, read the relevant Java
> source in `~/git/plantuml`. The upstream code is 15+ years old and encodes
> accumulated knowledge as special cases and subtle tweaks that exist nowhere
> else. The Java code IS the requirement — not a reference. Reproduce every
> edge case faithfully.

## Context

Takes a `UseCaseDiagramAST` (T7), pre-measures nodes, runs ELK layout via
`elk-adapter.ts` (T2), and returns `UseCaseGeometry` for the renderer (T15).

Stack: TypeScript 5 strict, Vitest, ESM. Layout is async.

## Task

Create `src/diagrams/usecase/layout.ts` and unit tests.

## Write-Set

- `src/diagrams/usecase/layout.ts`
- `tests/unit/usecase/layout.test.ts`

## Read-Set

- `src/diagrams/usecase/ast.ts` — full file
- `src/core/elk-adapter.ts` — full file
- `src/core/measurer.ts` — StringMeasurer interface
- `src/core/theme.ts` — Theme interface
- `decisions.md#D3`, `decisions.md#D4`, `decisions.md#D5`

## Interface Contracts

```typescript
export interface UCNodeGeo {
  id: string;
  kind: UCNodeKind;
  display: string;
  x: number;
  y: number;
  width: number;
  height: number;
  children: UCNodeGeo[];
  stereotype?: string;
}

export interface UCEdgeGeo {
  id: string;
  from: string;
  to: string;
  points: Array<{ x: number; y: number }>;
  label?: { text: string; x: number; y: number };
  stereotype?: string;
  dashed: boolean;
}

export interface UseCaseGeometry {
  totalWidth: number;
  totalHeight: number;
  nodes: UCNodeGeo[];
  edges: UCEdgeGeo[];
}

export async function layoutUseCase(
  ast: UseCaseDiagramAST,
  theme: Theme,
  measurer: StringMeasurer,
): Promise<UseCaseGeometry>;
```

### Node sizing
- `actor`: width=50 height=70 (stick figure)
- `usecase`: ellipse — width = max(120, textWidth + 20), height=40
- Containers: ELK compound nodes (D5)

### ELK options
```json
{
  "algorithm": "stress",
  "elk.spacing.nodeNode": "40"
}
```

`stress` gives a natural spread for use case diagrams without forcing
top-down hierarchy.

## Acceptance Criteria

- Given 2 actors and 3 use cases, when layout resolves, then all
  UCNodeGeo entries have x, y, width, height > 0
- Given an `<<include>>` link, when layout resolves, then UCEdgeGeo
  has dashed=true and stereotype="include"
- Given a rectangle container with 2 use cases, when layout resolves,
  then container node encompasses both children

## Quality Bar

`pnpm typecheck && pnpm lint && pnpm test` — zero errors, ≥ 90% coverage.
