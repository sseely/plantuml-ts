# Architecture Decisions

## D-1: S-4 — Delete `adjustEndpoints`, do not integrate

**Decision:** Delete the `adjustEndpoints` export from `splines.ts`.

**Rationale:** The function is unreachable from `routeEdges` — it was
never wired into the routing pipeline. The port is also incomplete:
it snaps to the node face but not to the rank-band bottom as C's
`makeregularend` does. Integrating half-correct code creates a silent
regression risk. The correct integration belongs in Mission 2's
splines rewrite (S-1, S-3, S-4 together).

**Implication:** Remove the `export` keyword and the function body.
Update `splines.test.ts` if any test imports it directly.

---

## D-2: M-6 — ~60-line wrap, not a full `decomp()`/`recomp()` port

**Decision:** Detect weakly-connected components with a simple BFS/DFS
adjacency walk, solve each independently using the existing sweep loop,
then merge orders back. Do not port C's full `decomp.c` data structures.

**Rationale:** C's `decomp.c` uses graph-level bookkeeping that doesn't
map to the TypeScript working graph shape. The behavioral goal — prevent
disconnected subgraph nodes from cross-pollinating median values — is
fully achievable with the simpler wrap. The C source is 130 lines; the
wrap IS the functional equivalent.

**Implication:** Add a `findWeaklyConnectedComponents` helper inside
`mincross.ts`. For single-component graphs (the common case) the function
returns immediately after one component is found, adding zero overhead.

---

## D-3: No public API changes

**Decision:** Do not modify any exported types or function signatures in
`types.ts`, `rank.ts`, `splines.ts`, or `mincross.ts`.

**Rationale:** All three fixes are internal algorithm improvements.
`sortLayerByMedian` is not exported; its signature change (adding
`flatMatrix` parameter) is internal. `minmax_edges2` is a new private
function. `adjustEndpoints` is removed entirely.

---

## D-4: One commit per batch

**Decision:** Each batch lands as exactly one commit using Conventional
Commits format. Quality gates must pass before the commit is made.

**Format:**
- Batch 1: `fix(dot): M-2 flat guard, R-3 minmax_edges2, S-4 dead export`
- Batch 2: `fix(dot): M-5 BFS-seeded initial ordering in mincross`
- Batch 3: `fix(dot): M-6 WCC decomposition in minimizeCrossings`
