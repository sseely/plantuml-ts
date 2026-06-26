# T4 — Board Layout + Layout Tests

## Context

plantuml-js ports PlantUML to TypeScript. We are implementing `@startboard`
(Phase 5i). The layout stage converts a `BoardDiagramAST` (tree structure)
into a `BoardGeometry` (pixel coordinates). No graph engine — purely arithmetic.

Java reference: `BNode.computeX`, `BArray`, `Activity.getFullWidth`,
`Activity.getMaxStage` in `~/git/plantuml/src/main/java/net/sourceforge/plantuml/board/`.

Stack: TypeScript 5, Vitest, no DOM.

## Task

Create `src/diagrams/board/layout.ts` and `tests/unit/board/layout.test.ts`.

## Write-Set

- `src/diagrams/board/layout.ts` (create)
- `tests/unit/board/layout.test.ts` (create)

## Read-Set

- `src/diagrams/board/ast.ts` — `BoardDiagramAST`, `BoardNode`, `BoardGeometry`,
  `ActivityGeometry`, `CardGeometry`

## Java Algorithm to Port

### BNode.computeX (DFS, pre-order)

```java
public void computeX(AtomicInteger count) {
    this.x = count.intValue();           // claim current counter value
    for (int i = 0; i < children.size(); i++) {
        final BNode child = children.get(i);
        if (i > 0) {
            count.addAndGet(1);          // only increment BEFORE child[i>0]
        }
        child.computeX(count);
    }
}
```

**Critical invariant:** A node and its first (leftmost) child share the
same x coordinate. Each subsequent sibling increments the counter by 1
before recursing. This creates the staircase layout.

**Verified trace** (full fixture `gasaxu-65-cipo396`):
```
World(0)  x=0
  Europe(1)  x=0   (i=0, no inc)
    France(2)  x=0  (i=0, no inc)
      Paris(3)   x=0  (i=0, no inc)
      Brest(3)   x=1  (i=1, inc → count=1)
    Espagne(2) x=2  (i=1, inc → count=2)
      Madrid(3)    x=2  (i=0)
      Barcelone(3) x=3  (i=1, inc → count=3)
      Pamplune(3)  x=4  (i=2, inc → count=4)
  America(1) x=5  (i=1, inc → count=5)
    Montreal(3) x=5  (i=0)
maxX=5, maxY=3 → fullWidth=(5+1)×170=1020
```

### Card pixel positions

```
dx = node.x * 170     (PostIt.getWidth() = 170)
dy = node.stage * 90  (PostIt.getHeight() = 90)
```

Card drawn with 10px inset: `(activityOffset + dx + 10, dy + 10)` —
but the inset is the renderer's responsibility. Layout returns (dx, dy).

### Activity fullWidth and maxStage

```
fullWidth = (maxX + 1) * 170
maxStage  = maxY  (largest stage value in the BArray)
```

### Multi-activity layout

Activities are placed left-to-right. Each activity's `xOffset` equals
the sum of all preceding activities' `fullWidth` values.

### Row separator lines

Row lines are computed globally after all activities:
```
for i in 0 .. maxStage-1:
  y = (i + 1) * 90 - 10
```
(The renderer draws these; layout computes only coordinates for cards.)

## TypeScript Implementation Sketch

```typescript
interface NodeWithX {
  node: BoardNode;
  x: number;
}

function computeX(node: BoardNode, count: { value: number }): NodeWithX[] {
  const results: NodeWithX[] = [];
  const thisX = count.value;
  results.push({ node, x: thisX });
  for (let i = 0; i < node.children.length; i++) {
    if (i > 0) count.value += 1;
    results.push(...computeX(node.children[i]!, count));
  }
  return results;
}

export function layoutBoard(ast: BoardDiagramAST): BoardGeometry {
  const activities: ActivityGeometry[] = [];
  let xOffset = 0;
  let globalMaxStage = 0;

  for (const activity of ast.activities) {
    const count = { value: 0 };
    const nodesWithX = computeX(activity.root, count);

    const maxX = Math.max(...nodesWithX.map(n => n.x));
    const maxStage = Math.max(...nodesWithX.map(n => n.node.stage));
    const fullWidth = (maxX + 1) * 170;

    const cards: CardGeometry[] = nodesWithX.map(({ node, x }) => ({
      label: node.name,
      dx: x * 170,
      dy: node.stage * 90,
    }));

    activities.push({ xOffset, fullWidth, cards });
    xOffset += fullWidth;
    globalMaxStage = Math.max(globalMaxStage, maxStage);
  }

  return {
    activities,
    totalWidth: xOffset,
    maxStage: globalMaxStage,
  };
}
```

**Edge case:** If `ast.activities` is empty, return
`{ activities: [], totalWidth: 0, maxStage: 0 }`.

## Acceptance Criteria

1. Given root with 0 children, when `computeX`, then root.x=0.
2. Given root with 1 child, when `computeX`, then both have x=0.
3. Given root with 2 children (A, B), when `computeX`, then A.x=0, B.x=1.
4. Given root → A → B (linear chain), when `computeX`, then all have x=0.
5. Given root → [A → [P, Q], B] where A has children P and Q:
   - root.x=0, A.x=0, P.x=0, Q.x=1, B.x=2.
6. Given activity with maxX=5, `fullWidth === 1020` (6×170).
7. Given 2 activities with fullWidths 170 and 340:
   - activity[0].xOffset=0, activity[1].xOffset=170.
8. Given AST with `maxStage=3`, `BoardGeometry.maxStage === 3`.
9. Given empty AST, `layoutBoard({ activities: [] })` returns
   `{ activities: [], totalWidth: 0, maxStage: 0 }` without throwing.

## Quality Bar

- `npm test` passes with the new test file.
- 90/90/90 coverage for `layout.ts`.
- No `any` types.
- The `computeX` internal function must be deterministic and side-effect-free
  (except for the counter object).
