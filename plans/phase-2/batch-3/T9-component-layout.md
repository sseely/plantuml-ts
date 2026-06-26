# T9 — Component Diagram Layout

> **Java source is the spec.** Before writing any code, read the relevant Java
> source in `~/git/plantuml`. The upstream code is 15+ years old and encodes
> accumulated knowledge as special cases and subtle tweaks that exist nowhere
> else. The Java code IS the requirement — not a reference. Reproduce every
> edge case faithfully.

## Context

Takes a `ComponentDiagramAST` (T5), pre-measures nodes, runs ELK layout via
`elk-adapter.ts` (T2), and returns `ComponentGeometry` for the renderer (T13).

Stack: TypeScript 5 strict, Vitest, ESM. Layout is async.

## Task

Create `src/diagrams/component/layout.ts` and unit tests.

## Write-Set

- `src/diagrams/component/layout.ts`
- `tests/unit/component/layout.test.ts`

## Read-Set

- `src/diagrams/component/ast.ts` — full file
- `src/core/elk-adapter.ts` — full file
- `src/core/measurer.ts` — StringMeasurer interface
- `src/core/theme.ts` — Theme interface
- `decisions.md#D3`, `decisions.md#D4`, `decisions.md#D5`

## Interface Contracts

```typescript
export interface ComponentNodeGeo {
  id: string;
  kind: ComponentKind;
  display: string;
  x: number;
  y: number;
  width: number;
  height: number;
  children: ComponentNodeGeo[];  // nested for containers
  stereotype?: string;
}

export interface ComponentEdgeGeo {
  id: string;
  points: Array<{ x: number; y: number }>;
  label?: { text: string; x: number; y: number };
  dashed: boolean;
}

export interface ComponentGeometry {
  totalWidth: number;
  totalHeight: number;
  nodes: ComponentNodeGeo[];
  edges: ComponentEdgeGeo[];
}

export async function layoutComponent(
  ast: ComponentDiagramAST,
  theme: Theme,
  measurer: StringMeasurer,
): Promise<ComponentGeometry>;
```

### ELK options
```json
{
  "algorithm": "layered",
  "elk.direction": "RIGHT",
  "elk.layered.spacing.nodeNodeBetweenLayers": "40",
  "elk.spacing.nodeNode": "25",
  "elk.edgeRouting": "ORTHOGONAL"
}
```

Container nodes (package, folder, etc.) map to ELK compound nodes (D5).

## Acceptance Criteria

- Given 3 components and 2 edges, when layout resolves, then all
  ComponentNodeGeo entries have x, y, width, height > 0
- Given two disconnected components, when layout resolves, then their
  bounding boxes do not overlap
- Given a package containing 2 components, when layout resolves, then
  the package node bounding box encompasses both children
- Given a dashed link (`..>`), when layout resolves, then EdgeGeo dashed=true

## Quality Bar

`pnpm typecheck && pnpm lint && pnpm test` — zero errors, ≥ 90% coverage.
