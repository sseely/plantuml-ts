# T2 — Layout + Layout Tests

## Context

plantuml-js is a TypeScript port of PlantUML. The DOT passthrough diagram
(`@startdot`) needs a layout step that converts `DotDiagramAST` (produced
by T1's parser) into `DotGeometry` by calling the existing Sugiyama layout
engine at `src/core/dot/`.

Test framework: **vitest**. Run tests with `npm test`.

## Task

Create `src/diagrams/dot/layout.ts` exporting `layoutDot(ast, measurer, theme)`.
Write unit tests in `tests/unit/dot/layout.test.ts`.

## Write-set

- `src/diagrams/dot/layout.ts` (create)
- `tests/unit/dot/layout.test.ts` (create)

## Read-set

- `src/diagrams/dot/ast.ts` — DotDiagramAST, DotGeometry, DotNodeGeo, DotEdgeGeo (from T1)
- `src/core/dot/types.ts` — DotInputGraph, DotInputNode, DotInputEdge, DotLayoutResult
- `src/core/dot/index.ts` — `layout(input: DotInputGraph): DotLayoutResult` export
- `src/core/measurer.ts` — StringMeasurer interface and FormulaMeasurer
- `src/core/theme.ts` — Theme interface
- `src/diagrams/component/layout.ts` — reference for dot engine usage pattern
- `plans/dot-passthrough/decisions.md#d4` — node sizing rules
- `plans/dot-passthrough/decisions.md#d8` — undirected graph handling

## Interface contract

```typescript
// Export from layout.ts:
export function layoutDot(
  ast: DotDiagramAST,
  measurer: StringMeasurer,
  theme: Theme,
): DotGeometry;
```

## Implementation notes

**Step 1 — Measure nodes:**
For each `DotNodeDef` in `ast.nodes`:
- If `widthIn` is non-null: `width = widthIn * 72` (D4)
- Else: `width = measurer.measure(node.label, { family: theme.fontFamily, size: theme.fontSize }).width + 16`
- Same logic for height (use `measurer.measure(...).height + 12`)
- For `shape='circle'`: after measuring, set `width = height = Math.max(width, height)` so it's square

**Step 2 — Build DotInputGraph:**
```typescript
const inputGraph: DotInputGraph = {
  nodes: ast.nodes.map(n => ({
    id: n.id,
    width: measuredWidth[n.id],
    height: measuredHeight[n.id],
    attributes: n.rank ? { rank: n.rank } : undefined,
  })),
  edges: buildEdges(ast),  // see below
  rankDir: ast.rankDir ?? undefined,
  nodeSep: ast.nodeSep ?? undefined,
  rankSep: ast.rankSep ?? undefined,
};
```

**Step 3 — Build edges (D8 — undirected handling):**
For `digraph`: add one `DotInputEdge` per `DotEdgeDef`.
For `graph` (undirected): add BOTH `a→b` AND `b→a` as separate `DotInputEdge`
entries (this gives the layout engine bidirectional information). Edge ids:
use `edgeDef.id` for the forward edge, `${edgeDef.id}_r` for the reverse.

**Step 4 — Run layout:**
```typescript
import { layout } from '../../core/dot/index.js';
const result = layout(inputGraph);
```

**Step 5 — Map result to DotGeometry:**
- For each node in `result.nodes`, find the matching `DotNodeDef` for label/shape.
- For each edge in `result.edges`:
  - For `digraph`: include all edges, `directed: true`.
  - For `graph`: include only the forward edge (filter out `_r` suffix ids), `directed: false`.
- Populate `DotGeometry.title` from `ast.title`.

## Acceptance criteria

```
Given a 3-node chain AST (a→b→c):
  layout returns 3 positioned nodes and 2 edges with point arrays

Given undirected graph AST (a--b):
  DotInputGraph passed to layout contains edges a→b AND b→a
  DotGeometry.edges contains 1 edge with directed=false

Given node with widthIn=2.0:
  node width in DotGeometry is 144 (2.0 × 72)

Given node with label 'Hello' and no width attr:
  node width derives from StringMeasurer measurement + 16px padding

Given ast.rankDir='LR':
  DotInputGraph.rankDir is 'LR'

Given ast with title 'My Graph':
  DotGeometry.title is 'My Graph'
```

## Quality bar

Run `npm test` before finishing — all tests must pass including 90/90/90
coverage. Run `npm run typecheck` and `npm run lint` — zero errors.
