# Graphviz Layout Engine — Mission Prompts

Two sequential missions derived from `planning/graphviz-audit.md`.
Run Mission 1 first; Mission 2 depends on it being complete.

---

## Mission 1: Graphviz layout engine hardening — salvageable fixes (Phases A–C)

```
Harden the TypeScript graphviz dot layout engine in `src/core/dot/`
by applying the salvageable algorithm gaps identified in
`planning/graphviz-audit.md`. Read that document in full before
designing anything. Also read `planning/dot-layout-deepdive.md` for
the gap reference codes (M-2, M-5, M-6, R-3, S-4).

## C source reference

Authoritative source: `~/git/graphviz/lib/dotgen/`
- `mincross.c` — passes 0/1 (lines 1762–1830), decomp call (1748–1758)
- `rank.c` — minmax_edges2 (lines 421–444)
- `decomp.c` — decomp() / recomp() (all 130 lines)

## What exists — read before changing anything

- `src/core/dot/mincross.ts` (417 lines) — skeleton is sound;
  `minimizeCrossings` starts the sweep loop at line 375 with no BFS seed
- `src/core/dot/rank.ts` (1363 lines) — `assignRanks` function;
  `minmax_edges2` is missing; call site would be after `minmax_edges()`
- `src/core/dot/splines.ts` (536 lines) — `adjustEndpoints` is exported
  at line 101 but never called from `routeEdges`; either integrate or
  remove the dead export
- `src/core/dot/types.ts` (134 lines) — working graph and node types

## Changes required (read the audit for full implementation details)

### Batch 1 — Small immediate fixes (one commit)

**M-2: `left2right` guard in `sortLayerByMedian`** (`mincross.ts:67`)

The `sortLayerByMedian` function sorts by wmedian value only. It must
check flat-edge ordering constraints before comparing medians, the same
way `transpose()` already does. The flat constraints are computed in
`flat_breakcycles` and stored in `flatMatrix`. The `sortLayerByMedian`
function must accept `flatMatrix` as a parameter and the two call sites
at lines ~382 and ~390 must thread it through.

C reference: `mincross.c:1430–1433` — `reorder()` inner loop.

**R-3: `minmax_edges2`** (`rank.ts`)

Add and call this after the existing `minmax_edges()` call in
`assignRanks`. Adds zero-weight constraint edges from the min/source
set to nodes with no incoming edges, and from nodes with no outgoing
edges to the max/sink set. See `planning/dot-layout-deepdive.md` Gap
R-3 for the TypeScript implementation.

C reference: `rank.c:421–444`.

**S-4: Remove dead `adjustEndpoints` export** (`splines.ts`)

`adjustEndpoints` is exported but unreachable from `routeEdges`. Either:
(a) delete it, or (b) call it correctly from `routeShortEdge` after
`fitBezier` (it snaps first/last points to the rank-facing node boundary).
Option (b) matches C's `makeregularend` intent. If integrating, verify
the snap direction is correct per `rankDir`.

### Batch 2 — BFS initial ordering (M-5) (one commit)

Add BFS-seeded passes 0 and 1 before the existing `for (let iter = 0)`
loop in `minimizeCrossings` (`mincross.ts:375`).

Pass 0: BFS from source nodes (those at `minRank`), assign layer orders
top-down using average position of neighbors in the layer above.

Pass 1: BFS from sink nodes (those at `maxRank`), assign layer orders
bottom-up.

After each pass, call `flat_reorder(layers, flatMatrix)` to impose
flat constraints. Snapshot the crossing count after both passes as the
starting best.

C reference: `mincross.c:1762–1830` — `do_mincross()` passes 0 and 1;
`mincross_step(g, 0)` and `mincross_step(g, 1)`.

### Batch 3 — Component decomposition (M-6) (one commit)

Wrap the main loop in `minimizeCrossings` to detect weakly connected
components and process each independently. Merge results back before
returning.

Two graphs with no edges between them should not influence each other's
within-rank ordering. Currently they do because wmedian returns -1 for
isolated nodes and the sort mixes them with connected-component nodes.

C reference: `decomp.c` (130 lines) — `decomp()` builds component
partition; `recomp()` merges back.

Scope estimate: ~60 lines wrapping the existing sweep logic.

## Files to modify

- `src/core/dot/mincross.ts` — M-2, M-5, M-6
- `src/core/dot/rank.ts` — R-3
- `src/core/dot/splines.ts` — S-4

## Files to read as context only (do not modify)

- `src/core/dot/types.ts` — working graph types
- `src/core/dot/index.ts` — pipeline entry point
- `src/core/dot/position.ts` — understand the data shape
- `planning/graphviz-audit.md` — full audit with verdicts
- `planning/dot-layout-deepdive.md` — gap reference codes and fix snippets

## Architecture decisions (pre-made)

- No new files needed — all changes are in-place edits to existing
  dot engine files
- One commit per batch; quality gates must pass after each commit
- Do not change any public API or type signatures in `types.ts`
- Do not touch any diagram-specific code outside `src/core/dot/`

## Quality gates (after every batch)

```sh
npm test && npm run typecheck && npm run lint && npm run build
```

## Suggested batch structure

Batch 1 (M-2 + R-3 + S-4): single agent, one commit, ~80 lines of changes
Batch 2 (M-5 BFS ordering): single agent, one commit, ~100 lines added
Batch 3 (M-6 component decomp): single agent, one commit, ~60 lines added
```

---

## Mission 2: `splines.ts` long-edge routing rewrite (Phase D)

Run this after Mission 1 is complete and all quality gates pass.

```
Rewrite the long-edge routing function in `src/core/dot/splines.ts`
to use box-corridor routing instead of the current Catmull-Rom waypoint
approach. Read `planning/graphviz-audit.md` (splines section) and
`planning/dot-layout-deepdive.md` (gaps S-1, S-3, S-5, S-6) in full
before designing anything.

## C source reference

- `~/git/graphviz/lib/dotgen/dotsplines.c` — `maximal_bbox()` lines
  2168–2225, `make_regular_edge()` lines 1783–1845,
  `clip_and_install()` lines 1560–1650, `edge_normalize()` lines 1650–1720
- `~/git/graphviz/lib/common/routespl.c` — `Pshortestpath()`,
  `Proutespline()` (simplified: walk corridor midpoints)
- `~/git/graphviz/lib/common/splines.c` — `beginpath()` lines 378–573
  (tailportY -> start point)

## What to replace vs. keep

REPLACE only: `routeLongEdge` (lines 180–198 in current splines.ts)

KEEP unchanged:
- `fitBezier`, `smoothPolyline`, `ellipseEdgePoint`
- `routeShortEdge`, `routeSelfLoop`, `routeParallelEdge`
- `routeFlatEdge` (extend it for labeled flat edges — S-5)
- `buildObstaclePolygons` (already correctly excludes virtual nodes)

## New functions to add

```typescript
// C: maximal_bbox() dotsplines.c:2168-2225
// Per virtual node: compute allowed horizontal band from sibling positions
function makeBBoxCorridors(
  edge: DotEdge,
  graph: DotWorkingGraph,
): BoxCorridor[]   // { rank, xLeft, xRight, yTop, yBottom }

// C: make_regular_edge() dotsplines.c:1783-1845 (simplified)
//    + routesplines_() routespl.c (walk corridor midpoints)
//    + clip_and_install() (face-snap simplified)
//    + edge_normalize() (reverse control points for reversed edges)
function routeLongEdgeInCorridor(
  edge: DotEdge,
  corridors: BoxCorridor[],
  rankDir: DotWorkingGraph['rankDir'],
): void

// C: beginpath() splines.c:392 — tailportY -> start point on node face
function tailStartPoint(edge: DotEdge, rankDir: DotWorkingGraph['rankDir']): Point
```

Also add: labeled flat edge routing (`make_flat_labeled_edge` port,
gap S-5), and multi-edge fanning for parallel long edges (Multisep
offset, gap S-6).

## Architecture decisions (pre-made)

- `BoxCorridor` is a local type in `splines.ts` — do not add it to
  `types.ts`
- Simplified corridor routing: walk through midpoints of corridor boxes
  rather than implementing full Pshortestpath polygon routing
- Keep Catmull-Rom bezier fitting via `fitBezier` for the final curve
- `tailportY` is a ratio (-0.5 to +0.5) relative to node height center;
  a value of 0 exits at the node vertical midpoint

## Suggested batch structure

Batch 1: `makeBBoxCorridors` + `routeLongEdgeInCorridor` replacing
         `routeLongEdge`; quality gates pass; no tailport or fanning yet
Batch 2: `tailStartPoint` wired into `routeLongEdgeInCorridor` and
         `routeShortEdge` (gap S-1); integrate or remove `adjustEndpoints`
         (gap S-4)
Batch 3: Labeled flat edge routing in `routeFlatEdge` (gap S-5);
         multi-edge long-edge fanning (gap S-6)

## Files to modify

- `src/core/dot/splines.ts` only

## Files to read as context only (do not modify)

- `src/core/dot/types.ts` — DotEdge, DotNode, DotWorkingGraph shapes
- `src/core/dot/rank.ts:1295–1363` — virtual node creation; understand
  what fields are populated on `edge.virtualNodes` and `edge.labelNode`
- `src/core/dot/position.ts` — understand that virtual node x/y are
  already solved when `routeEdges` is called
- `planning/graphviz-audit.md` — splines section and implementation plan
- `planning/dot-layout-deepdive.md` — gaps S-1, S-3, S-4, S-5, S-6

## Quality gates (after every batch)

```sh
npm test && npm run typecheck && npm run lint && npm run build
```
```
