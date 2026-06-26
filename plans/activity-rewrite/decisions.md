# Architecture Decisions

## D1 — Tile coordinate frame: tile-relative

Tiles carry intrinsic width and height only. No x/y is stored on a tile during
construction. Canvas-absolute coordinates are assigned in a single pass by
`tile-coordinates.ts` after the tile tree is fully built.

**Rationale:** Matches Java gtile model. Tiles can be composed into parent tiles
without knowing their canvas position. Only the coordinate-assignment phase
touches absolute positions.

**Impact:** All tile sizing uses `this.width` / `this.height`. No tile constructor
receives or stores x/y.

---

## D2 — GConnection output: Point[] waypoints

Each GConnection implementation returns `Point[]` (array of `{x, y}` in
canvas-absolute space, computed after coordinate assignment). The renderer
draws these as polylines, identical to what it does for edges today.

**Rationale:** Keeps the renderer unchanged. The bridge in tile-coordinates.ts
converts `GConnection.getPoints()` calls into `ActivityEdgeGeo` objects.

**Impact:** GConnection classes have a `getPoints(from: GPoint, to: GPoint): Point[]`
method. Waypoints include the start and end points.

---

## D3 — Tile sizing: construction-time with measurer

Each tile receives a `StringBounder` (from `src/core/measurer.ts`) in its
constructor and computes `width` and `height` eagerly at construction time.

**Rationale:** Matches Java `calculateDimension(StringBounder)` pattern. Width
is cached on the tile; no re-measurement on composition.

**Impact:** All tile constructors accept `(node: ActivityXxx, bounder: StringBounder)`
or `(children: Tile[], bounder: StringBounder)`. Tests pass a stub measurer.

---

## D4 — One file per tile / routing concept

Each tile class lives in its own file under `src/diagrams/activity/tiles/`.
Each routing class lives in its own file under `src/diagrams/activity/routing/`.
No bundling of unrelated tile types into one file.

**Rationale:** Mirrors Java's 38 gtile files. Keeps each file small and
independently testable. Matches upstream naming for traceability.

**Impact:** ~17 tile files + ~6 routing files. `tiles/index.ts` and
`routing/index.ts` re-export all public types.

---

## D5 — Renderer bridge: flat arrays via tile-coordinates.ts

`tile-coordinates.ts` walks the tile tree and produces `ActivityNodeGeo[]` and
`ActivityEdgeGeo[]` — the same flat arrays the existing renderer already
consumes. The renderer (`renderer.ts`) is unchanged except that it imports from
`tile-layout.ts` instead of `layout.ts` after T14 lands.

**Rationale:** Zero renderer rewrite. The bridge is the only place that knows
both tile geometry and the renderer's data contract.

**Impact:** After T13 + T14, `renderer.ts` import changes from `layout.ts` to
`tile-layout.ts`. No other renderer changes.

---

## D6 — layout.ts renamed to layout.old.ts in T1; deleted after T14 verified

T1 renames `layout.ts` → `layout.old.ts` and updates all imports to point at
the old file. T14 rewires the renderer to `tile-layout.ts`. After T14's quality
gates pass, `layout.old.ts` is safe to delete (separate cleanup commit,
not part of this mission).

**Rationale:** The old implementation is a useful reference during reimplementation.
Keeping it as `.old.ts` avoids a name conflict with the new `tile-layout.ts`.
