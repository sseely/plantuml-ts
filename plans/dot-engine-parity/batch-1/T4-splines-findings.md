# T4 — dotsplines.c vs splines.ts: Findings

> **Java source is the spec.** Before writing any code, read the relevant Java
> source in `~/git/plantuml`. The upstream code is 15+ years old and encodes
> accumulated knowledge as special cases and subtle tweaks that exist nowhere
> else. The Java code IS the requirement — not a reference. Reproduce every
> edge case faithfully.

## Verdict

**Major divergence.** splines.ts routes straight-line segments with spread ports.
dotsplines.c implements full Bezier spline routing through box channels around obstacle
polygons, flat edge routing with label awareness, and endpoint adjustment to node boundaries.
The actual Bezier fitting is in `libpathplan` (external to dotsplines.c).

---

## Section A — Obstacle Polygon Construction (T16)

### A.1 Core Data Structures (dotsplines.c:64–70)

```c
typedef struct spline_info_t {
    boxf    LeftBound, RightBound;    // rank extent boxes
    double  Splinesep, Multisep;      // clearance margins
    boxf    *Rank_box;                // per-rank inter-rank space boxes
} spline_info_t;
```

Obstacle polygons are NOT stored as explicit vertex lists. They are represented as
`boxf` structs (lower-left + upper-right corners) in a `path *P` array of `nbox` boxes.

### A.2 Node Bounding Box → Obstacle Polygon

`maximal_bbox()` (lines 2168–2225) computes the bounding box an edge should avoid:
- Input: node `v`, spline_info, rank bounds, neighbor info.
- Uses `ND_lw(v)`, `ND_rw(v)` (left/right widths), `ND_ht1(v)`, `ND_ht2(v)` (half-heights).
- Expands by `FUDGE = 4` (line 2166) plus `Splinesep` clearance.
- Accounts for neighbor interference via `neighbor()` (lines 2227–2249).
- Accounts for cluster boundaries via `cl_bound()` (lines 2129–2157).

**Virtual nodes** (`width=0`): `maximal_bbox()` is still called but produces zero/near-zero
width boxes used for label positioning. They do not block routing.

### A.3 DotNode Missing Fields

Current `DotNode` is missing:
```typescript
lw?: number;   // left half-width (default: width/2)
rw?: number;   // right half-width (default: width/2)
ht1?: number;  // height above baseline (default: height/2)
ht2?: number;  // height below baseline (default: height/2)
```

For symmetric nodes (all current PlantUML nodes): `lw = rw = width/2`, `ht1 = ht2 = height/2`.
These can default without adding to DotInputNode.

### A.4 Port/Endpoint Coordinates

dotsplines.c uses `ED_tail_port(e).p` and `ED_head_port(e).p` — pre-assigned port
coordinates (lines 346, 361). splines.ts uses `spreadFacePoint()` to fan edges across
node faces. The spread approach approximates port assignment; it is retained in T16.

`clip_and_install()` (lines 1970–1972 area) adjusts spline endpoints to lie exactly
on the node boundary face — this is T18's responsibility.

### A.5 Interface Contract for T16

```typescript
export type ObstaclePolygon = {
  x: number;      // bounding box left edge (ND_coord.x - lw - Splinesep)
  y: number;      // bounding box top edge (ND_coord.y - ht2 - Splinesep)
  width: number;  // total width including clearance
  height: number; // total height including clearance
};

export function buildObstaclePolygons(nodes: DotNode[]): ObstaclePolygon[];
```

Virtual nodes (`width === 0 && height === 0`) produce no polygon.

---

## Section B — Free-Space Routing (T17)

### B.1 Core Routing: make_regular_edge (dotsplines.c:1700–1910)

Main entry for regular (non-self, non-flat) edges.

**Box path construction**:
1. `beginpath(P, e, REGULAREDGE, &sinfo, ...)` (line 1765) — adds tail node's obstacle box.
2. While `ND_node_type(hn) == VIRTUAL` (line 1773): walk virtual chain.
   - Call `rank_box()` (line 1774) for inter-rank space box.
   - Optionally detect straight segments via `straight_len()`.
   - Add virtual node's `maximal_bbox` (line 1783).
3. `endpath(P, e, REGULAREDGE, &sinfo, ...)` (line 1838) — adds head node's obstacle box.
4. `adjustregularpath(P, ...)` (line 1945) — enforce minimum box width `MINW = 16` (line 37).

**Algorithm**: NOT a visibility graph with shortest-path. Instead it is **channel routing**:
- The box array `P->boxes` defines corridors between obstacles.
- `routesplines()` (external — libpathplan) navigates through these box corridors and
  returns a polyline then fits Bezier curves.

### B.2 rank_box (dotsplines.c:2009–2021)

```c
boxf rank_box(spline_info_t *sp, graph_t *g, int r)
{
    boxf  rv;
    rank_t  *rk = GD_rank(g);
    rv.LL.y = rk[r].ht1 + GD_ranksep(g)/2;
    rv.UR.y = rk[r + 1].ht2 + GD_ranksep(g)/2;
    ...
}
```

Cached in `sd.Rank_box[r]`; computed once per rank.

### B.3 Flat Edge Routing: make_flat_edge (dotsplines.c:1502–1615)

Three strategies:
1. **Adjacent nodes** (line 1528): Calls `make_flat_adj_edges()` which builds a 2-node
   rotated subgraph and calls `dot_splines_` recursively.
2. **With labels** (line 1531): Calls `make_flat_labeled_edge()` (lines 1314–1416) —
   routes around a label rectangle box.
3. **Non-adjacent, no label** (line 1542+): Calls `makeSimpleFlat()` or
   `makeSimpleFlatLabels()` — adds two waypoints above (TB/BT) or beside (LR/RL) the
   nodes to create a detour, then calls `routesplines()`.

All strategies ultimately produce Bezier control points via `routesplines()`.

### B.4 Self-Loop Handling

dotsplines.c calls `makeSelfEdge()` (line 404), which is **not defined in dotsplines.c**
— it is in a separate module. Parameters: `sizey` (available vertical space from rank
context), `Multisep` spacing.

Current `routeSelfLoop()` (splines.ts:50–57) uses 4 hardcoded control points. The control
point structure (`[start, cp1, cp2, end]`) matches SVG cubic Bezier convention. **T17 should
preserve this function** — it is structurally correct.

### B.5 Interface Contract for T17

```typescript
export function routePolyline(
  start: Point,
  end: Point,
  obstacles: ObstaclePolygon[],
): Point[];   // waypoints through free space; [start, end] if no obstacles block

export function routeFlatEdge(
  edge: DotEdge,
  obstacles: ObstaclePolygon[],
  rankDir: DotWorkingGraph['rankDir'],
): Point[];
```

---

## Section C — Bezier Fitting (T18)

### C.1 completeregularpath (dotsplines.c:1914–1946)

Finalizes the box path. Calls `adjustregularpath()` to enforce `MINW = 16` minimum
box width. Then calls `routesplines()` (external — libpathplan) which:
- Takes the box array as channel constraints.
- Returns Bezier control points in `bezier *bz` struct:
  `bz->list` — flat array of `pointf`, `bz->size` — number of points.

### C.2 adjustregularpath (dotsplines.c:1974–2007)

Enforces a minimum box width of `MINW = 16` and `HALFMINW = 8` on each box in the path.
If a box is too narrow, widens it symmetrically. Prevents routesplines from failing on
near-zero-width channels.

### C.3 Endpoint Adjustment to Node Boundaries

`makeregularend()` (dotsplines.c:1952–1958): creates the final box connecting the node's
face to the inter-rank space. Sets `UR.y` and `LL.y` to align with the node bounding box.

`clip_and_install()` (referenced near lines 1970–1972): adjusts the first/last Bezier
control points so they land exactly on node boundary faces (not floating near them).

### C.4 SVG Control Point Convention

dotsplines.c uses SVG **cubic Bezier** format: every segment is `(CP1, CP2, anchor)`.
The full path stored in `edge.points` should be:
```
[P0, CP1a, CP2a, P1, CP1b, CP2b, P2, ...]
```
Where `P0` = start anchor, `P1 ... Pn` = subsequent anchors, each preceded by two
control points.

**Current `routeSelfLoop()`** (splines.ts:50–57) stores `[start, cp1, cp2, end]` —
4 points, one cubic Bezier segment. **This is correct and compatible.**

### C.5 Interface Contract for T18

```typescript
export function fitBezier(polyline: Point[]): Point[];
// Input: N-point polyline from routePolyline
// Output: Bezier control points in SVG C-command format:
//   [P0, CP1, CP2, P1, CP1, CP2, P2, ...]
// Degenerate: 2-point polyline → returns [P0, P1] unchanged.

export function adjustEndpoints(
  points: Point[],
  fromNode: DotNode,
  toNode: DotNode,
  rankDir: DotWorkingGraph['rankDir'],
): Point[];
// Moves first and last control points to lie on node boundary face.
```

---

## Section D — Integration

### D.1 Call Sequence in dot_splines_ (lines 228–472)

```
dot_splines_(g, ...)
  ├─ Initialize: spline_info_t, Splinesep = nodesep/4, Multisep = nodesep  (lines 264–279)
  ├─ Allocate path P and sd.Rank_box array                                 (lines 331–332)
  ├─ routesplinesinit()                                                     (line 267)
  ├─ Group equivalent edges via edgecmp()                                   (lines 342–379)
  └─ For each edge group:
       ├─ self-loop → makeSelfEdge()                                        (line 404)
       ├─ flat edge → make_flat_edge()                                      (line 411)
       └─ regular → make_regular_edge()                                     (line 419)
  ├─ Place virtual node labels                                              (lines 422–427)
  └─ edge_normalize() — swap back-edge spline control points               (line 432)
```

### D.2 Data Flow

```
T16 (ObstaclePolygon[]) ─────────────────────────────────────────────→ T17
  buildObstaclePolygons(nodes)
  Used by: beginpath(), endpath(), maximal_bbox() during path construction

T17 (routePolyline → Point[]) ────────────────────────────────────────→ T18
  Waypoints through free space / around obstacles
  Used by: fitBezier() as input polyline

T18 (fitBezier + adjustEndpoints → Point[]) ──────────────────────────→ edge.points
  Final Bezier control points stored in edge.points
  Used by: SVG renderer (M ... C ... path commands)
```

### D.3 DotEdge Fields Needed

```typescript
// Currently missing:
lw?: number;     // left half-width for obstacle bbox
rw?: number;     // right half-width for obstacle bbox
ht1?: number;    // height above center for obstacle bbox
ht2?: number;    // height below center for obstacle bbox
spline?: boolean; // true when edge.points is Bezier (C-format), not polyline (L-format)
```

The `spline` flag is needed so the renderer knows to emit `C` commands instead of `L`
commands for multi-point edges.

### D.4 Initialization Sequence

1. Call `routesplinesinit()` (from libpathplan) — T18 must provide a TS equivalent or
   a no-op if the fitting algorithm is self-contained.
2. Set `Splinesep = nodeSep / 4`, `Multisep = nodeSep`.
3. Pre-compute per-rank boundary boxes (`Rank_box[r]`) from graph rank structure.
4. Process edges grouped by source node, then type (self → flat → regular).

---

## Section E — Corpus Coverage

### E.1 Long Edges (Obstacle Avoidance Required)

Straight-line routing for edges spanning 2+ ranks will visually pass through
intermediate-rank nodes whenever those nodes are horizontally aligned with the edge.

Common in:
- Class diagrams with 3+ inheritance levels (tests/corpus/class/ — most large diagrams)
- State diagrams with multi-hop transitions (tests/corpus/state/)
- Component diagrams with nested packages (tests/corpus/component/)

Any graph with rank span ≥ 2 and intervening nodes needs obstacle avoidance.

### E.2 Flat Edges (Same-Rank Routing Required)

Flat edges appear in:
- Class diagrams using `together {}` (9+ files in tests/corpus/class/)
- Sequence diagrams using `{rank=same; ...}` (5+ files in tests/corpus/sequence/)
- State diagrams with self-transitions between parallel states

---

## Key Constants

| Constant | Value | Line | Purpose |
|----------|-------|------|---------|
| `NSUB` | 9 | 35 | Spline subdivisions |
| `MINW` | 16 | 37 | Minimum box channel width |
| `HALFMINW` | 8 | 38 | Half of MINW |
| `FUDGE` | 4 | 2166 | Node bbox expansion factor |
| `LBL_SPACE` | 6 | 937 | Space between flat edge labels |

---

## Critical Implementation Notes

1. **routesplines() is external**: The Bezier fitting lives in `libpathplan`, not in
   dotsplines.c itself. T18 must implement a TS equivalent. For a two-point polyline
   (no obstacles) return the points unchanged. For multi-point, fit cubic Bezier segments.

2. **Channel routing, not visibility graph**: dotsplines.c uses box corridors as channels.
   T17 should represent obstacles as axis-aligned rectangles and route around them using
   the channel approach (build corridor between each obstacle pair), NOT an explicit
   visibility graph.

3. **Reversed edges**: `edge_normalize()` (line 432) swaps the spline control points for
   reversed edges so they always flow tail → head. T18 must handle this.

4. **Rank boxes are cached**: Compute `Rank_box[r]` once before routing all edges.
