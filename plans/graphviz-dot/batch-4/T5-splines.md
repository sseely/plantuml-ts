# T5 — Spline Routing + Complete layout()

> **Java source is the spec.** Before writing any code, read the relevant Java
> source in `~/git/plantuml`. The upstream code is 15+ years old and encodes
> accumulated knowledge as special cases and subtle tweaks that exist nowhere
> else. The Java code IS the requirement — not a reference. Reproduce every
> edge case faithfully.

## Context

plantuml-js is a TypeScript library rendering PlantUML diagrams to SVG.
This task implements the final pipeline stage (edge routing) and wires all
five stages into the complete `layout()` entry point. After this task, the
dot layout engine is fully functional end-to-end.

**Stack:** TypeScript 5 strict mode, Vitest, ESLint 9. No Jest.

**Reference:** `~/git/plantuml/src/smetana/core/dot15/dotsplines__c.java` (2,391 lines).
Do NOT port `smetana/core/` C runtime emulation.

**Prerequisites:** T1 (types.ts), T2 (rank.ts, index.ts stub), T3 (mincross.ts),
T4 (position.ts). All nodes have `.rank`, `.order`, `.x`, `.y` set.

## Task

1. **`src/core/dot/splines.ts`** — `routeEdges(graph)`. Sets `edge.points`
   for every original (non-virtual) edge.
2. **`src/core/dot/index.ts`** (update stub → complete) — wire all stages,
   add `buildWorkingGraph()` and `extractResult()` helpers.
3. **`tests/unit/dot/splines.test.ts`** — unit tests for splines.ts.
4. **`tests/unit/dot/layout.test.ts`** — end-to-end tests for `layout()`.

## Write-set

```
src/core/dot/splines.ts            (create)
src/core/dot/index.ts              (update — replace stub with full implementation)
tests/unit/dot/splines.test.ts     (create)
tests/unit/dot/layout.test.ts      (create)
```

## Read-set

- `src/core/dot/types.ts` — all types
- `src/core/dot/acyclic.ts`, `rank.ts`, `mincross.ts`, `position.ts` — stage functions
- `src/diagrams/usecase/renderer.ts:169-199` — existing `buildEdgePath()` for smooth polyline reference
- `~/git/plantuml/src/smetana/core/dot15/dotsplines__c.java` — reference impl
- `plans/graphviz-dot/decisions.md` — D2, D3, D5

## Interface Contracts

### `src/core/dot/splines.ts`

```typescript
export function routeEdges(graph: DotWorkingGraph): void
```

Mutates `edge.points` for every edge in `graph.edges` that is NOT virtual.
Points run from `edge.from` to `edge.to` in the original (pre-reversal)
direction. For reversed edges, the points array is reversed before assignment.
Virtual edges (chain segments for long edges) are consumed, not exposed.

### `src/core/dot/index.ts` (complete)

```typescript
export function layout(input: DotInputGraph): DotLayoutResult
```

Internal helpers (not exported):
```typescript
function buildWorkingGraph(input: DotInputGraph): DotWorkingGraph
function extractResult(graph: DotWorkingGraph): DotLayoutResult
```

`buildWorkingGraph` converts each `DotInputNode` → `DotNode` (rank=-1,
order=-1, x=0, y=0, virtual=false) and each `DotInputEdge` → `DotEdge`
(resolves from/to by id, weight=attr.weight??1, minLen=attr.minLen??1,
reversed=false, points=[]).

`extractResult` filters out virtual nodes/edges, reads final x/y/width/height
per node, reads edge.points, computes total width/height with 12px margin.

Pipeline composition:
```typescript
const wg = buildWorkingGraph(input);
if (wg.nodes.length === 0) return { nodes: [], edges: [], width: 0, height: 0 };
removeAcyclic(wg);
assignRanks(wg);
minimizeCrossings(wg);
assignCoordinates(wg);
routeEdges(wg);
return extractResult(wg);
```

## Routing Algorithm

### Short edges (adjacent ranks, span = minLen = 1)

TB direction:
- Start: `{ x: from.x + from.width/2, y: from.y + from.height }`
- End: `{ x: to.x + to.width/2, y: to.y }`
- If nearly collinear: `points = [start, end]`
- Otherwise: `points = [start, midpoint, end]` (quadratic bezier control)

LR direction: use right/left midpoints instead of bottom/top.

### Long edges (via virtual node chain)

The original edge has `edge.virtualNodes = [vn1, vn2, ...]`.
Collect: `[exitPoint(from), vn1.center, vn2.center, ..., entryPoint(to)]`
Use the smooth-polyline technique (quadratic beziers through midpoints):
- This matches the existing implementation in `src/diagrams/usecase/renderer.ts:169-199`

### Self-loops (edge.from === edge.to)

Emit a cubic bezier arc to the upper-right of the node:
```
start = { x: from.x + from.width, y: from.y + from.height/2 }
cp1   = { x: from.x + from.width + 30, y: from.y + from.height/2 }
cp2   = { x: from.x + from.width + 30, y: from.y - 10 }
end   = { x: from.x + from.width/2, y: from.y }
points = [start, cp1, cp2, end]
```

### Reversed edges

After computing points for the working direction, if `edge.reversed`:
`edge.points = computedPoints.reverse()`

## Acceptance Criteria

### Splines
- **Given** A→B (adjacent ranks), **when** `routeEdges()`, **then** `edge.points.length >= 2`
- **Given** A→B TB, **when** `routeEdges()`, **then** start point is at bottom-center of A, end at top-center of B (±1px)
- **Given** long edge A→virtual→B, **when** `routeEdges()`, **then** path is smooth (no right-angle bends)
- **Given** reversed edge, **when** `routeEdges()`, **then** points run from original `from` to original `to`
- **Given** self-loop A→A, **when** `routeEdges()`, **then** `edge.points` starts and ends on A's boundary

### layout() end-to-end
- **Given** empty graph, **when** `layout()`, **then** `{ nodes:[], edges:[], width:0, height:0 }`
- **Given** single node 80×36, **when** `layout()`, **then** 1 node, x≥0, y≥0, 0 edges
- **Given** A→B→C, **when** `layout()`, **then** 3 nodes, 2 edges, all edges have points
- **Given** `rankDir='LR'` A→B→C, **when** `layout()`, **then** B.x > A.x and C.x > B.x
- **Given** diamond graph, **when** `layout()`, **then** all 4 bounding boxes non-overlapping
- **Given** graph with reversed edge, **when** `layout()`, **then** output edge IDs match input IDs

## TDD Workflow

Write tests BEFORE implementation — strictly red/green:

**splines.test.ts first:**
1. Write one `it()` per splines acceptance criterion — all fail
2. Run `npm test` — confirm red
3. Implement `splines.ts` test-by-test until all splines tests pass

**layout.test.ts second (end-to-end):**
4. Write one `it()` per layout() acceptance criterion — all fail
5. Run `npm test` — confirm red (index.ts still throws)
6. Complete `index.ts` (wire all stages) — tests go green one by one

Set up splines tests manually: build a `DotWorkingGraph` with nodes that
already have `.x`, `.y`, `.rank`, `.order` set. Do not call the full pipeline.

## Quality Bar

```
npm test && npm run typecheck && npm run lint
```
