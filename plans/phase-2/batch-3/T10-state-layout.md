# T10 — State Diagram Layout

> **Java source is the spec.** Before writing any code, read the relevant Java
> source in `~/git/plantuml`. The upstream code is 15+ years old and encodes
> accumulated knowledge as special cases and subtle tweaks that exist nowhere
> else. The Java code IS the requirement — not a reference. Reproduce every
> edge case faithfully.

## Context

Takes a `StateDiagramAST` (T6), pre-measures nodes, runs ELK layout via
`elk-adapter.ts` (T2), and returns `StateGeometry` for the renderer (T14).
Composite states map to ELK compound nodes (D5).

Stack: TypeScript 5 strict, Vitest, ESM. Layout is async.

## Task

Create `src/diagrams/state/layout.ts` and unit tests.

## Write-Set

- `src/diagrams/state/layout.ts`
- `tests/unit/state/layout.test.ts`

## Read-Set

- `src/diagrams/state/ast.ts` — full file
- `src/core/elk-adapter.ts` — full file
- `src/core/measurer.ts` — StringMeasurer interface
- `src/core/theme.ts` — Theme interface
- `decisions.md#D3`, `decisions.md#D4`, `decisions.md#D5`

## Interface Contracts

```typescript
export interface StateNodeGeo {
  id: string;
  kind: StateKind;
  display: string;
  x: number;
  y: number;
  width: number;
  height: number;
  children: StateNodeGeo[];
}

export interface TransitionGeo {
  from: string;
  to: string;
  points: Array<{ x: number; y: number }>;
  label?: { text: string; x: number; y: number };
}

export interface StateGeometry {
  totalWidth: number;
  totalHeight: number;
  states: StateNodeGeo[];
  transitions: TransitionGeo[];
}

export async function layoutState(
  ast: StateDiagramAST,
  theme: Theme,
  measurer: StringMeasurer,
): Promise<StateGeometry>;
```

### Pseudostate sizing
- `initial`: circle, width=height=20
- `final`: bullseye, width=height=24
- `fork`/`join`: thin horizontal bar, width=60 height=8
- `choice`/`junction`: diamond, width=height=20

### ELK options
```json
{
  "algorithm": "layered",
  "elk.direction": "DOWN",
  "elk.layered.spacing.nodeNodeBetweenLayers": "40",
  "elk.spacing.nodeNode": "25",
  "elk.edgeRouting": "POLYLINE"
}
```

## Acceptance Criteria

- Given initial → A → B → final, when layout resolves, then
  `y(initial) < y(A) < y(B) < y(final)` (top-down ordering from ELK)
- Given a composite state with 2 children, when layout resolves, then
  composite node geometry encompasses both children
- Given a fork node, when layout resolves, then width > height (bar shape)
- Given a transition with a guard label, when layout resolves, then
  TransitionGeo has label.text set

## Quality Bar

`pnpm typecheck && pnpm lint && pnpm test` — zero errors, ≥ 90% coverage.
