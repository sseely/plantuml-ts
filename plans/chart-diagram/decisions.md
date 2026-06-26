# Architecture Decisions

## D1: ChartGeometry granularity — full pixel pre-computation

**Decision:** `layout.ts` computes every bar rect, every line/scatter/area point, every tick
position, and every legend entry bounding box. Sub-renderers receive ready-to-draw coordinates
and call SVG primitives with no data-to-pixel math.

**Why:** Keeps sub-renderers as pure drawing functions (data in, SVG string out). Independently
testable with no math logic. Matches the functional core / imperative shell principle.

**Implication:** `ChartGeometry` is the single source of truth for all pixel coordinates.
If a coordinate is wrong, the bug is in `layout.ts`.

---

## D2: Sub-renderers return SVG strings

**Decision:** Each sub-renderer is a pure function: `drawBar(geo: BarSeriesGeo, theme: Theme): string`.
The orchestrator (`renderer.ts`) concatenates strings.

**Why:** Consistent with `src/core/svg.ts` (everything returns strings). Pure functions are
easy to test. No shared mutable state.

---

## D3: Resolved series colors live in ChartGeometry (set by layout)

**Decision:** `layoutChart()` resolves the default color palette and assigns a concrete hex
color string to every `SeriesGeo` entry. The AST carries the raw color string (or null);
`ChartGeometry` always has a resolved color.

**Why:** Parser shouldn't know about themes. Renderer should just draw. Layout is where
theme-aware geometry is assembled.

**Default palette:** Cycle through `theme.colors.sequence` (the same palette used by
sequence diagrams). If a series has an explicit `#RRGGBB`, use it directly.

---

## D4: Discriminated union for SeriesGeo

**Decision:** `ChartGeometry.series` is `SeriesGeo[]` where `SeriesGeo` is a discriminated
union: `BarSeriesGeo | LineSeriesGeo | AreaSeriesGeo | ScatterSeriesGeo`. Each has a `type`
literal field.

**Why:** TypeScript compile-time proof that each sub-renderer only receives its own geometry
type. Prevents entire class of runtime "wrong renderer called with wrong geo" errors.

---

## D5: ChartGeometry type defined in layout.ts

**Decision:** All geometry interfaces (`ChartGeometry`, `BarSeriesGeo`, `LineSeriesGeo`, etc.)
are exported from `src/diagrams/chart/layout.ts` alongside `layoutChart()`.

**Why:** These are layout output types, not AST input types. Co-locating with the function
that produces them is the most natural grouping. Sub-renderers import from `../layout.js` —
no circular imports since layout never imports renderers.

---

## D6: Line charts use straight line segments (no curve interpolation)

**Decision:** `LineRenderer` draws `<line>` elements between consecutive data points. No
Bézier, no spline, no step interpolation.

**Why:** Bug-for-bug compatibility. Upstream `LineRenderer.java` uses `ULine` (straight
segments) exclusively. No interpolation mode exists in the Java source.
