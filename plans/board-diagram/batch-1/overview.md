# Batch 1 — AST Types + Block Extractor

Two independent tasks with no write-set conflicts. Run in parallel.

## Tasks

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T1 | Define board AST + geometry types | typescript-pro | `src/diagrams/board/ast.ts` | — | [ ] |
| T2 | Add 'board' to block-extractor | typescript-pro | `src/core/block-extractor.ts` | — | [ ] |

## Contracts produced by T1 (consumed by T3, T4, T5)

```typescript
// ast.ts exports:
export interface BoardNode {
  name: string;
  stage: number;
  children: BoardNode[];
}

export interface BoardActivity {
  name: string;
  root: BoardNode;  // stage=0, the column header
}

export interface BoardDiagramAST {
  activities: BoardActivity[];
}

export interface CardGeometry {
  label: string;
  dx: number;   // pixels from activity left edge (node.x * 170)
  dy: number;   // pixels from top (node.stage * 90)
}

export interface ActivityGeometry {
  xOffset: number;    // pixels from diagram left edge (cumulative)
  fullWidth: number;  // (maxX + 1) * 170
  cards: CardGeometry[];
}

export interface BoardGeometry {
  activities: ActivityGeometry[];
  totalWidth: number;
  maxStage: number;
}
```

## Contract produced by T2 (consumed by tests + block-extractor users)

`DiagramType` union gains `'board'` literal.
`START_SUFFIX_MAP['board']` maps to `'board'`.
