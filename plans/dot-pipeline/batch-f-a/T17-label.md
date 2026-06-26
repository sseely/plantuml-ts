# T17 — label/

## Context

plantuml-js is a TypeScript port of PlantUML dot layout. The label library
places external labels (xlabels) for nodes and edges using an R-tree spatial
index to avoid overlap with diagram elements.

Stack: TypeScript, vitest, project root `~/git/plantuml-js`.

## Task

Port the Smetana-included label files to `src/core/label/`:

| C source | Output TS file |
|----------|---------------|
| `~/git/graphviz/lib/label/xlabels.c` | `src/core/label/xlabels.ts` |
| `~/git/graphviz/lib/label/index.c` | `src/core/label/rtree-index.ts` |
| `~/git/graphviz/lib/label/priorityq.c` | `src/core/label/priorityq.ts` |
| `~/git/graphviz/lib/label/rand_r.c` | `src/core/label/rand_r.ts` |
| `~/git/graphviz/lib/label/rectangle.c` | `src/core/label/rectangle.ts` |

Also create `src/core/label/index.ts` re-exporting the public API.

Key function: `xlabelPositions(graph)` — compute positions for all `xlabel`
attributes on nodes and edges, placing labels in available space using the
R-tree to detect and avoid conflicts.

**Note:** Rename `index.c` to `rtree-index.ts` (avoid confusion with the
module barrel file `index.ts`).

## Write-set

- `src/core/label/xlabels.ts` (create)
- `src/core/label/rtree-index.ts` (create)
- `src/core/label/priorityq.ts` (create)
- `src/core/label/rand_r.ts` (create)
- `src/core/label/rectangle.ts` (create)
- `src/core/label/index.ts` (create)
- `tests/unit/label/*.test.ts` (create — at least xlabels.test.ts + rtree.test.ts)

## Read-set

- `~/git/graphviz/lib/label/xlabels.c`
- `~/git/graphviz/lib/label/index.c`
- `~/git/graphviz/lib/label/priorityq.c`
- `~/git/graphviz/lib/label/rand_r.c`
- `~/git/graphviz/lib/label/rectangle.c`
- `~/git/plantuml/src/main/java/net/sourceforge/plantuml/core/smetana/gen/lib/label/` (all 5 java files)

## Interface contracts

```typescript
export interface XlabelResult {
  nodeId: string;  // or edgeId
  x: number;
  y: number;
}
export function xlabelPositions(graph: DotWorkingGraph): XlabelResult[];
```

## Acceptance criteria

- Given a node with `xlabel = "note"`, when `xlabelPositions` runs, then it
  returns a position for that label that does not overlap the node's bounding box.
- Given two nodes with xlabels near each other, when `xlabelPositions` runs,
  then the two label positions do not overlap each other.
- Given a graph with no xlabels, when `xlabelPositions` runs, then it returns
  an empty array.

## Quality bar

`npm test && npm run typecheck && npm run lint` must pass.
