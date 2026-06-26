# T4 — Brandes-Köpf Coordinate Assignment

> **Java source is the spec.** Before writing any code, read the relevant Java
> source in `~/git/plantuml`. The upstream code is 15+ years old and encodes
> accumulated knowledge as special cases and subtle tweaks that exist nowhere
> else. The Java code IS the requirement — not a reference. Reproduce every
> edge case faithfully.

## Context

plantuml-js is a TypeScript library rendering PlantUML diagrams to SVG.
This task implements the fourth stage of the Graphviz dot pipeline: assigning
pixel x/y coordinates to nodes using the Brandes-Köpf algorithm. Nodes
arrive with `.rank` and `.order` set; this stage sets `.x` and `.y`.

**Stack:** TypeScript 5 strict mode, Vitest, ESLint 9. No Jest.

**Reference:** `~/git/plantuml/src/smetana/core/dot15/position__c.java` (1,954 lines).
Do NOT port `smetana/core/` C runtime emulation — use native TypeScript.

**Prerequisites:** T1 (types.ts), T2 (rank.ts), T3 (mincross.ts). Nodes have
`.rank` and `.order`. This task sets `.x` and `.y`. T3 and T4 are parallel
— this task does NOT depend on T3's code, only on types.ts being available.
Set up test graphs manually with pre-assigned `.rank` and `.order`.

## Task

Create:
1. **`src/core/dot/position.ts`** — implements `assignCoordinates(graph)`.
2. **`tests/unit/dot/position.test.ts`** — unit tests.

## Write-set

```
src/core/dot/position.ts           (create)
tests/unit/dot/position.test.ts    (create)
```

## Read-set

- `src/core/dot/types.ts` — DotWorkingGraph, DotNode (has `.rank`, `.order`, `.virtual`)
- `~/git/plantuml/src/smetana/core/dot15/position__c.java` — reference impl
- `plans/graphviz-dot/decisions.md` — D3, D4

## Interface Contract

```typescript
export function assignCoordinates(graph: DotWorkingGraph): void
```

After this call, every node has `node.x >= 0` and `node.y >= 0`.
- Nodes in the same rank have non-overlapping bounding boxes
  (x separation ≥ `graph.nodeSep`)
- Adjacent ranks have y separation ≥ `max(nodeHeight) + graph.rankSep`
- For `rankDir='LR'`: x and y roles are swapped throughout

## Algorithm Notes

### y-coordinate assignment (simple)
```
rankY[0] = 0
rankY[r] = rankY[r-1] + maxHeightInRank(r-1) + graph.rankSep
node.y = rankY[node.rank] + (maxHeightInRank(node.rank) - node.height) / 2
```
For `rankDir='LR'`, compute `rankX` instead and assign to `node.x`;
use order-based positioning for `node.y`.

### x-coordinate assignment (Brandes-Köpf)

Four alignment passes: (top-left, top-right, bottom-left, bottom-right).

For each pass:

1. **Mark type-1 conflicts**: A type-1 conflict is a non-inner-segment
   that crosses an inner segment. Inner segments connect two virtual nodes.
   Scan pairs of edges between adjacent layers; mark the leftmost crossing
   non-inner edge as conflicted. Conflicted edges are excluded from alignment.

2. **Vertical alignment**: Build blocks. Each block has a root node.
   - top-left: for each node v (left to right), find its leftmost upper
     neighbor u that is not conflicted. If u is the median upper neighbor,
     merge v's block with u's block.
   - Repeat symmetrically for the other three passes.

3. **Horizontal compaction**: For each block root, assign x by placing
   it as far left as possible given `graph.nodeSep` between adjacent nodes
   in the same rank. Use a "class" structure to propagate x assignments.

4. **Balance**: The final x for each node is the mean of its four
   alignment x values (after normalizing each to x≥0).

5. **Shift to x≥0**: Translate all node.x values so min = 0.

**Simplification:** If the full Brandes-Köpf is complex to implement
correctly, a valid fallback is: assign x = `node.order × (maxNodeWidth + nodeSep)`.
This is simpler and still satisfies the acceptance criteria (non-overlapping
bounding boxes). Document the deviation in decision-journal.md.

## Acceptance Criteria

- **Given** 2 nodes same rank, **when** `assignCoordinates()`, **then** bounding boxes don't overlap (x gap ≥ nodeSep)
- **Given** adjacent ranks TB, **when** `assignCoordinates()`, **then** y differs by ≥ `maxHeight + rankSep`
- **Given** single node, **when** `assignCoordinates()`, **then** `node.x ≥ 0` and `node.y ≥ 0`
- **Given** `rankDir='LR'`, **when** `assignCoordinates()`, **then** higher-rank nodes have strictly greater x values
- **Given** `rankDir='TB'`, **when** `assignCoordinates()`, **then** higher-rank nodes have strictly greater y values
- **Given** diamond (ranks 0,1,1,2), **when** `assignCoordinates()`, **then** all 4 bounding boxes non-overlapping

## TDD Workflow

Write tests BEFORE implementation — strictly red/green:
1. Write `position.test.ts` with one `it()` per acceptance criterion — all fail
2. Run `npm test` to confirm they fail (red)
3. Write minimum `position.ts` to pass the first test (green)
4. Continue test-by-test until all pass

Set up test graphs manually (pre-assign `.rank` and `.order` values).
Do not call `assignRanks()` or `minimizeCrossings()` from tests — unit test only.

## Quality Bar

```
npm test && npm run typecheck && npm run lint
```
