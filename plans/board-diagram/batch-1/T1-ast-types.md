# T1 — Define Board AST + Geometry Types

## Context

plantuml-js is a TypeScript port of PlantUML. We are adding the `@startboard`
diagram type (Phase 5i). The plugin follows a three-stage pipeline:
`parse → layoutSync → render`. Each stage passes a typed value to the next.

This task creates the type definitions consumed by all three stages. It
is the foundation for T3 (parser), T4 (layout), and T5 (renderer).

Stack: TypeScript 5, Vitest, ESLint, Vite library build. No DOM, no async.

## Task

Create `src/diagrams/board/ast.ts` with the types below. No logic — pure
type definitions only.

## Write-Set

- `src/diagrams/board/ast.ts` (create)

## Read-Set

- `src/diagrams/hcl/index.ts` — see how hcl types are structured (reference)
- `src/diagrams/json/ast.ts` — example of an AST type file in this project

## Types to define

```typescript
// Mirrors Java BNode (stage, name, children). No x — x is computed in layout.
export interface BoardNode {
  name: string;
  stage: number;       // 0 = column header, 1+ = card depth
  children: BoardNode[];
}

// Mirrors Java Activity: one kanban column.
export interface BoardActivity {
  name: string;
  root: BoardNode;     // stage=0 node (the column header itself)
}

// The parsed diagram AST.
export interface BoardDiagramAST {
  activities: BoardActivity[];
}

// One rendered card: position relative to its activity's left edge.
export interface CardGeometry {
  label: string;
  dx: number;   // node.x * 170  (170 = PostIt.getWidth())
  dy: number;   // node.stage * 90  (90 = PostIt.getHeight())
}

// Geometry for one Activity column.
export interface ActivityGeometry {
  xOffset: number;    // cumulative x from diagram left (pixels)
  fullWidth: number;  // (maxX + 1) * 170
  cards: CardGeometry[];
}

// Full diagram geometry passed to renderer.
export interface BoardGeometry {
  activities: ActivityGeometry[];
  totalWidth: number;   // sum of all activity fullWidths
  maxStage: number;     // max stage across all activities (for row lines)
}
```

## Acceptance Criteria

- Given any board diagram, `BoardGeometry.activities` contains one entry
  per activity, each with an `xOffset` in pixels.
- Given a leaf node at `stage=3, x=2`, `CardGeometry` has `dx=340, dy=270`.
- `BoardDiagramAST` is importable from `src/diagrams/board/ast.ts` by the
  parser (T3) and layout (T4) without circular references.

## Quality Bar

- `npm run typecheck` passes with no errors after this file is created.
- No implementation logic in this file — types only.
- Export every interface (all are consumed externally).
