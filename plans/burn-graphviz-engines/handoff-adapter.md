# Hand-off seed: graphviz-ts adapter mission

Produced by `burn-graphviz-engines`. The burn removed the in-house engines and
stubbed the seam; this seed is the adapter mission's work-list, grounded in what
the burn actually found (not predictions). Feed it to `/plan-mission`.

## 1. Throw-site — the one place to wire

`src/core/graph-layout.ts` → `layoutGraph(input: DotInputGraph, opts?: { engine?: string })`
currently `throw new PendingGraphvizError()`. Wiring this single function to
`graphviz-ts` lights every consumer back up. Consumers (all import only
`core/graph-layout.js`):

- `src/diagrams/class/layout.ts`      (alias `layout`)
- `src/diagrams/component/layout.ts`  (alias `layout`)
- `src/diagrams/state/layout.ts`      (alias `layout`)
- `src/diagrams/usecase/layout.ts`    (alias `layout`)
- `src/diagrams/dot/layout.ts`        (alias `layout`)
- `src/diagrams/json/layout.ts`       (alias `dotLayout`)

**Transitive consumers (no own layout.ts — discovered by the burn):**
`object` renders via the **class** layout; `yaml` and `hcl` render via the
**json** layout. Wiring the six above also restores object/yaml/hcl. The seam's
real blast radius is 9 diagram types, not 6.

## 2. Skipped tests to restore

Authoritative list (file + describe/it block, grouped) is in
`decision-journal.md` → "T4 skip list". Summary:

- **Deleted (engine-internal):** `tests/unit/{circo,fdp,neato,osage,pack,patchwork,pathplan,sfdp,twopi,label}/`, the `tests/unit/dot/*` algorithm tests, `tests/unit/auto-layout.test.ts`. These are **gone**, not skipped — graphviz-ts has its own tests; do not restore.
- **Whole-file `describe.skip`:** unit `{class,component,state,usecase}/{layout,renderer}`, `dot/{index,renderer}`, `json/{layout,renderer,plugin}`; integration `{class,component,state,usecase,json-corpus,json-style,json-e2e}`. Unskip the file (remove the banner + `.skip`) once layout works.
- **Partial skip (transitive — unskip specific blocks):** `object/{layout,renderer}`, `yaml/{highlight-styleclass,parser-highlight-exact,plugin-style}`, `integration/yaml-style`, `hcl/plugin`, `integration/index`. Each skipped block carries the `pending graphviz-ts adapter` marker — grep it to find every restore point:
  `rg "pending graphviz-ts adapter" tests`

## 3. Renderer-shape migration (the real work after wiring)

The 6 renderers today read **`DotLayoutResult`** (in `core/graph-layout.types.ts`):
`{ nodes: [{ id, x, y, width, height, xlabelX?, xlabelY? }],
   edges: [{ id, points:[{x,y}], labelX?, labelY?, labelWidth?, labelHeight?, spline?, reversed? }],
   width, height }` — origin top-left, content normalized to (0,0), `+margin` canvas.

graphviz-ts emits **`LayoutSnapshot`**: `{ bounds, nodes: NodeGeometry[], edges: EdgeGeometry[] }`
with `name` (not `id`), graphviz point/`y`-conventions, and no built-in (0,0)
normalization or margin. **Decide once:** adapt graphviz-ts output → `DotLayoutResult`
inside `layoutGraph` (renderers untouched — fastest path to green), **or** switch
the chokepoint return type to `LayoutSnapshot` and migrate all 6 renderers' field
reads (`id`→`name`, y-flip, re-add normalize+margin). The burn deliberately kept
`DotLayoutResult` unchanged (decisions.md#d4) so this is the adapter's call.

## 4. Type-adoption plan

- **Output:** if adopting graphviz-ts geometry, re-export `LayoutSnapshot`,
  `NodeGeometry`, `EdgeGeometry`, `BoundsGeometry` from `graphviz-ts/api`
  (verify exact export names against the package). Otherwise keep
  `DotLayoutResult` and convert internally.
- **Input:** keep `DotInputGraph` as the consumer vocabulary. The adapter
  serializes it to DOT text for graphviz-ts (graphviz-ts builder types are not
  our input vocab — decisions.md#d4). All node/edge attributes the engines read
  (rank, weight, minLen, tailportY, labels, xlabels, clusters via id prefixes)
  must survive serialization.

## 5. Oracle gate

Verify the adapter against `oracle/` — see `oracle/README.md`. Staged fail-fast:
**DOT gate first** (structural attrs exact, metric attrs tolerant) for Svek types
(class, component, state, object, usecase, activity), **then tolerant SVG gate**.
Get DOT parity before chasing SVG pixels; a DOT mismatch guarantees a bad SVG.

## 6. Open question for the adapter mission

Engine selection. `auto-layout.ts`'s BFS-depth heuristic (`selectEngine` /
`analyzeTopology`) was **dropped** (decisions.md#d2). Decide: reconstruct a
heuristic, or pass an explicit `opts.engine` per diagram type (class/component/
state/usecase/dot/object/yaml/hcl → `'dot'`; json → `'dot'`). graphviz-ts may
select differently; class & component previously called `autoLayout` with no
explicit engine, so there is no hardcoded choice to preserve.
