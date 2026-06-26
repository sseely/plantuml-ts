# Architecture Decisions

## D1: Node shape mapping

Map DOT `shape` attribute to SVG primitive:

| DOT shape | SVG output |
|-----------|-----------|
| `box`, `rect`, `rectangle` | `<rect>` |
| `ellipse` (default — no shape attr) | `<ellipse>` |
| `circle` | `<ellipse>` with equal rx/ry |
| `diamond` | `<polygon>` via `diamond()` primitive |
| `plaintext`, `none` | text only, no border element |
| anything else | `<ellipse>` fallback |

## D2: Directionality

- `digraph` → arrowhead on edges (use `arrowHeadRef('sync')` from svg.ts)
- `graph` → no arrowhead

## D3: `strict` deduplication

When the `strict` keyword is present, deduplicate edges: if multiple edges
share the same `(from, to)` pair, keep only the first encountered.

## D4: Node sizing

1. Measure label text width using `StringMeasurer`.
2. Add 16px horizontal padding (8px each side) + 12px vertical padding (6px each side).
3. If DOT `width` or `height` attributes are present (in inches), convert to pixels
   at 72 dpi (`px = inches × 72`) and use those values instead of the measured size.

## D5: `accepts()` always false

`@startdot` blocks are routed via `START_SUFFIX_MAP['dot'] = 'dot'` in
`block-extractor.ts`. Content probing never applies. `dotPlugin.accepts()`
returns `false`.

## D6: Test location

`tests/unit/dot/` — matching `tests/unit/files/`, `tests/unit/hcl/`, etc.

## D7: Title and skinparam — supported (intentional divergence from upstream)

Upstream Java ignores `title` and `skinparam` directives in `@startdot`
blocks; that is a poor choice given how commonly DOT diagrams appear
alongside other PlantUML content.

**This port supports both:**
- `title <text>` → parse and render as a title above the diagram
- `skinparam …` → parse and apply via `resolveSkinparam` from `src/core/skinparam.ts`

Document in `DIVERGENCES.md`.

## D8: Undirected graph layout

Treat `graph` (undirected) as `digraph` for layout: add both `a→b` and
`b→a` edges to `DotInputGraph`, then suppress arrowheads in the renderer
(D2). This matches Smetana's approach and avoids needing an undirected
mode in the layout engine.
