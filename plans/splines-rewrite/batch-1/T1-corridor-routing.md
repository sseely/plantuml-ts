# T1 — Box-Corridor Routing Core

## Context

Project: TypeScript port of PlantUML's Graphviz dot layout engine.
Stack: TypeScript, vitest, `npm test` / `npm run typecheck` / `npm run lint` / `npm run build`.
All test files use vitest (`describe`, `it`, `expect`). No jest.

The file `src/core/dot/splines.ts` currently routes long edges (span > 1)
using virtual node centers as Catmull-Rom waypoints. There is no per-rank
horizontal band (corridor) constraint, so curves can visually pass through
unrelated nodes in dense diagrams.

## Task

Replace `routeLongEdge` with corridor-based routing:

1. Add a local type at the top of the file (after imports, before first function):
```typescript
type BoxCorridor = { rank: number; xLeft: number; xRight: number; yTop: number; yBottom: number };
```

2. Add `makeBBoxCorridors` (private, before `routeEdges`):
   - C reference: `maximal_bbox()` `dotsplines.c:2168–2225`
   - For each virtual node in `edge.virtualNodes`:
     - Find the node at the same rank to the left: the rightmost sibling node
       whose x+width < vn.x. Set `xLeft = sibling.x + sibling.width` or `0`.
     - Find the node at the same rank to the right: the leftmost sibling node
       whose x > vn.x + vn.width. Set `xRight = sibling.x` or large sentinel.
     - `yTop = vn.y`, `yBottom = vn.y + vn.height`
   - Return array of `BoxCorridor` — one per virtual node

3. Add `routeLongEdgeInCorridor` (private):
   - C reference: `make_regular_edge()` `dotsplines.c:1783–1845` + midpoint walk
   - Parameters: `edge: DotEdge`, `corridors: BoxCorridor[]`, `rankDir: DotWorkingGraph['rankDir']`
   - Compute `start = ellipseEdgePoint(edge.from, center(firstVirtual))`
   - Compute `end   = ellipseEdgePoint(edge.to,   center(lastVirtual))`
   - Build waypoints: `[start]`, then for each corridor push the midpoint
     `{ x: (xLeft + xRight) / 2, y: (yTop + yBottom) / 2 }`, then `[end]`
   - `const bezier = fitBezier(smoothPolyline(waypoints))`
   - Snap: `bezier[0] = start; bezier[bezier.length - 1] = end`
   - `edge.points = bezier; edge.spline = waypoints.length >= 3`

4. In `routeEdges` (lines 499–504), replace:
   ```typescript
   routeLongEdge(edge, rankDir);
   ```
   with:
   ```typescript
   const corridors = makeBBoxCorridors(edge, graph);
   routeLongEdgeInCorridor(edge, corridors, rankDir);
   ```
   Keep the `if (edge.reversed)` reversal block unchanged.

5. Delete the old `routeLongEdge` function (lines 149–167).

## Write-set

- `src/core/dot/splines.ts`
- `tests/unit/dot/splines.test.ts`

## Read-set

- `src/core/dot/splines.ts` — current implementation
- `src/core/dot/types.ts` — `DotEdge`, `DotNode`, `DotWorkingGraph` shapes
- `decisions.md` — D-1 through D-5

## Architecture decisions

- D-1: `BoxCorridor` is local to `splines.ts`
- D-2: Walk corridor midpoints — do NOT implement `Pshortestpath`
- D-3: Keep `fitBezier` + `smoothPolyline` for final curve

## Interface contracts

```typescript
// Local type — do NOT export
type BoxCorridor = { rank: number; xLeft: number; xRight: number; yTop: number; yBottom: number };

function makeBBoxCorridors(edge: DotEdge, graph: DotWorkingGraph): BoxCorridor[]
function routeLongEdgeInCorridor(edge: DotEdge, corridors: BoxCorridor[], rankDir: DotWorkingGraph['rankDir']): void
```

`DotEdge.virtualNodes` is `DotNode[] | undefined` — guard with `edge.virtualNodes!`
(the long-edge path always has virtual nodes).

## Acceptance criteria

- Given a long edge with 2 virtual nodes (ranks 1 and 2),
  when `makeBBoxCorridors` is called,
  then the returned array has length 2 and each corridor's yTop/yBottom
  contains the corresponding virtual node's y coordinate.

- Given a long edge with no adjacent siblings at its virtual node ranks,
  when `makeBBoxCorridors` is called,
  then `xLeft = 0` and `xRight` is a large sentinel (≥ 10000).

- Given a long edge (span > 1),
  when `routeEdges` is called,
  then `edge.points` has at least 4 control points (cubic bezier) and
  `edge.spline === true`.

- Given a reversed long edge (`edge.reversed = true`),
  when `routeEdges` is called,
  then the resulting `edge.points` array has first point near `edge.to`
  and last point near `edge.from`.

## Quality bar

Run `npm test && npm run typecheck && npm run lint && npm run build` before finishing.
All must exit 0. Fix any TypeScript errors before reporting done.
