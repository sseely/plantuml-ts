# T1 — AST Type Definitions

## Context

plantuml-js is a TypeScript port of PlantUML. This task creates the type
definitions for the `@startchronology` diagram type. All other chronology tasks
import from this file. The project uses vitest for tests, tsc for type checking,
eslint for linting, and vite for builds.

## Task

Create `src/diagrams/chronology/ast.ts` containing exactly the interfaces below.
No logic — pure type exports only.

## Write-Set

- `src/diagrams/chronology/ast.ts` (create)

## Read-Set

- `src/diagrams/board/ast.ts` — see how board types are structured (reference only)

## Type Definitions to Export

```typescript
export interface ChronologyEvent {
  name: string;
  timestampMs: number;
}

export interface ChronologyDiagramAST {
  events: ChronologyEvent[];
}

export interface EventGeometry {
  name: string;
  x: number;
  labelAbove: boolean;
}

export interface DayTick {
  x: number;
  label: string;
}

export interface ChronologyGeometry {
  events: EventGeometry[];
  dayTicks: DayTick[];
  totalWidth: number;
  totalHeight: number;
  baselineY: number;
  headerHeight: number;
}
```

## Quality Bar

`npm run typecheck` and `npm run lint` must pass with zero new errors.
No tests needed for a pure-types file.

## Commit

`feat(chronology): add AST and geometry type definitions`
