# T1 — M-2 flat guard + R-3 minmax_edges2 + S-4 dead export removal

## Context

This is a TypeScript port of PlantUML's graphviz dot layout engine.
The project is GPL-3.0, uses vitest for tests, and has strict 90/90/90
coverage thresholds. All layout code lives in `src/core/dot/`.

Key rule: **do not refactor while porting**. Port the C algorithm
faithfully. Do not rename, reorganize, or simplify beyond what the
gap fix requires.

Quality gate (run before committing):
```sh
npm test && npm run typecheck && npm run lint && npm run build
```

## Task

Apply three small independent gap fixes:

### Fix 1 — M-2: `left2right` guard in `sortLayerByMedian`

**File:** `src/core/dot/mincross.ts`

**C reference:** `mincross.c:1430–1433`

`sortLayerByMedian` sorts a layer's nodes by their wmedian value.
It must also check flat-edge ordering constraints before comparing
medians — the same way `transpose()` already does at line 290.

**Current signature** (mincross.ts:62–66):
```typescript
function sortLayerByMedian(
  layer: DotNode[],
  neighborMap: Map<string, Array<{ node: DotNode; weight: number; portOffset: number }>>,
  reverse: boolean,
): void {
```

**New signature** — add `flatMatrix` as optional 4th parameter:
```typescript
function sortLayerByMedian(
  layer: DotNode[],
  neighborMap: Map<string, Array<{ node: DotNode; weight: number; portOffset: number }>>,
  reverse: boolean,
  flatMatrix?: FlatMatrix,
): void {
```

**Inside the sort comparator** (before the wmedian calls):
```typescript
// C: reorder() mincross.c:1430-1433 — check left2right flat constraint
const rankConstraints = flatMatrix?.get(layer[0]?.rank ?? -1);
if (rankConstraints?.get(a.id)?.has(b.id)) return -1;
if (rankConstraints?.get(b.id)?.has(a.id)) return 1;
```

Note: `layer[0]?.rank` is the rank for the whole layer (all nodes in
the layer have the same rank). Use `a.rank` instead — it's available
directly from the comparator parameters.

**Update the two call sites** in `minimizeCrossings` (lines ~382–390):
```typescript
// Down-sweep call site:
sortLayerByMedian(layer, buildNeighborMap(layer, edges, 'pred'), reverse, flatMatrix);

// Up-sweep call site:
sortLayerByMedian(layer, buildNeighborMap(layer, edges, 'succ'), reverse, flatMatrix);
```

---

### Fix 2 — R-3: Add `minmax_edges2`

**File:** `src/core/dot/rank.ts`

**C reference:** `rank.c:421–444`

Add this private function directly after the `minmax_edges` function
(around line 208):

```typescript
// minmax_edges2 — rank.c:421-444
// Adds zero-weight constraint edges from minSetLeader to nodes with no
// in-edges, and from nodes with no out-edges to maxSetLeader.
function minmax_edges2(graph: DotWorkingGraph): void {
  const minLeader = graph.minSetLeader ? ufFind(graph.minSetLeader) : null;
  const maxLeader = graph.maxSetLeader ? ufFind(graph.maxSetLeader) : null;
  if (!minLeader && !maxLeader) return;
  const slenX = minLeader?.ranktype === 'source' ? 1 : 0;
  const slenY = maxLeader?.ranktype === 'sink'   ? 1 : 0;
  for (const n of graph.nodes) {
    if (ufFind(n) !== n) continue;
    const hasOut = graph.edges.some(e => ufFind(e.from) === n);
    const hasIn  = graph.edges.some(e => ufFind(e.to)   === n);
    if (!hasOut && maxLeader && n !== maxLeader)
      graph.edges.push({ id: `__mm2_max_${n.id}`, from: n, to: maxLeader,
                         weight: 0, minLen: slenY, reversed: false, points: [] });
    if (!hasIn && minLeader && n !== minLeader)
      graph.edges.push({ id: `__mm2_min_${n.id}`, from: minLeader, to: n,
                         weight: 0, minLen: slenX, reversed: false, points: [] });
  }
}
```

**Call it** in `assignRanks` at line ~1280, after `minmax_edges(graph)`:
```typescript
minmax_edges(graph);
minmax_edges2(graph);   // ← add this line
rank1(graph);
```

---

### Fix 3 — S-4: Remove dead `adjustEndpoints` export

**File:** `src/core/dot/splines.ts`

Delete the entire `adjustEndpoints` function (lines 97–127, including
the JSDoc comment above it). It is exported but unreachable from
`routeEdges`. The incomplete port of `makeregularend` creates a
misleading public API.

Also check `tests/unit/dot/splines.test.ts` — if any test imports
or calls `adjustEndpoints`, remove those tests too (they test dead
code that no longer exists).

---

## Write-set

- `src/core/dot/mincross.ts`
- `src/core/dot/rank.ts`
- `src/core/dot/splines.ts`
- `tests/unit/dot/mincross.test.ts`
- `tests/unit/dot/rank.test.ts`
- `tests/unit/dot/splines.test.ts`

## Read-set

- `src/core/dot/types.ts` — `DotWorkingGraph`, `DotEdge`, `DotNode`, `FlatMatrix` (local type in mincross.ts)
- `src/core/dot/mincross.ts` — full file (it's 417 lines, read it)
- `src/core/dot/rank.ts:172–208` — `minmax_edges` function for context
- `src/core/dot/rank.ts:1264–1290` — `assignRanks` call site
- `src/core/dot/splines.ts:95–200` — `adjustEndpoints` + surrounding route functions
- `tests/unit/dot/splines.test.ts` — check for adjustEndpoints usage
- `planning/dot-layout-deepdive.md` (PART 3, Gap M-2; PART 1, Gap R-3; PART 4, Gap S-4)

## Architecture decisions

- See `plans/graphviz-hardening/decisions.md`
- No new files; no public API changes
- `FlatMatrix` is a local type alias in `mincross.ts` (line 4) — do not move it to `types.ts`

## Acceptance criteria

1. **Given** two nodes A and B with a flat constraint (A must be left of B on
   the same rank), **when** `sortLayerByMedian` runs and B has a lower median
   value than A, **then** A still appears left of B in the sorted layer.

2. **Given** a graph with `minSetLeader` set and a node N with no in-edges,
   **when** `minmax_edges2` runs, **then** a zero-weight edge from
   `minSetLeader` to N is present in `graph.edges`.

3. **Given** a graph with `maxSetLeader` set and a node N with no out-edges,
   **when** `minmax_edges2` runs, **then** a zero-weight edge from N to
   `maxSetLeader` is present in `graph.edges`.

4. **Given** `adjustEndpoints` is removed, **when** `npm run typecheck` runs,
   **then** no type errors are reported (no dangling export references).

5. All existing tests continue to pass.

## Quality bar

Run `npm test && npm run typecheck && npm run lint && npm run build`
before finishing. All must pass. Fix any failures before reporting done.

## Commit message

```
fix(dot): M-2 flat guard, R-3 minmax_edges2, S-4 dead export
```
