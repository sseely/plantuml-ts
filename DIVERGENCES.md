# Intentional Divergences from Upstream PlantUML

Upstream behavior is preserved by default. Entries here are deliberate
exceptions — places where this port produces different output for a
documented reason. Each entry records what changed, why, and the category
of divergence so reviewers can judge whether to adopt, revert, or escalate.

Categories:
- **clarity** — same information, presented more clearly
- **aesthetic** — visual improvement with no semantic change
- **limitation** — upstream has a known gap; we fill it

---

## JSON diagrams

### Array index keys (clarity)

**Upstream:** array elements have no key label in the key column — the
left column is blank for every array entry.

**This port:** array elements show their zero-based index (`0`, `1`, `2`,
…) in the key column.

**Reason:** a blank key column makes nested array diagrams unreadable.
Without index labels you cannot tell which child node corresponds to which
array position. Showing the index is strictly more informative and imposes
no cost on the value column. The upstream behavior is most likely a gap
rather than a deliberate design choice.

**Affects:** all `@startjson` diagrams whose root or any nested value is an
array.

---

### Primitive root — empty key cell (clarity)

**Upstream:** a scalar root value (number, string, boolean, null) is
rendered differently from object/array roots; the key column behavior is
not well-defined.

**This port:** scalar roots are wrapped in a synthetic single-row node
with an empty key (`""`) and the scalar as the value. The two-column
layout is preserved and the key cell is simply blank.

**Reason:** keeping a uniform two-column layout avoids special-casing
both the layout engine and the renderer for a rare edge case. The empty
key cell is visually harmless and maintains consistency with object nodes.

**Affects:** `@startjson` diagrams whose root value is a primitive scalar.

---

### Value text — per-type colors (aesthetic)

**Upstream:** all value cell text uses `FontColor black` (the `jsonDiagram.node`
skin default). Every value — string, number, boolean, null — renders in black.

**This port:** value text is colored by type:
- strings → `#3A6E96` (blue)
- numbers → `#A67F52` (amber)
- booleans → `#BE5D47` (red-orange)
- nulls → `#767676` (gray)

**Reason:** type-based coloring is a common IDE convention for JSON and makes
values scannable at a glance without changing the information conveyed.
Colors are applied via the theme layer and can be overridden with
`jsonDiagram { node { FontColor ... } }`.

**Affects:** all `@startjson` diagrams using the default theme.

---

## HCL diagrams

### Style selector support (limitation)

**Upstream:** `HclDiagramFactory.java` has `styleExtractor.applyStyles()`
commented out. `<style>` blocks inside `@starthcl` are stripped from the
content but never applied — HCL diagrams always render with default styling.

**This port:** Full `hcldiagram.*` style selector support is implemented,
mirroring the `yamldiagram.*` block in `src/index.ts`. Users can write
`<style> hclDiagram { node { BackgroundColor "#eee" } } </style>` inside
an `@starthcl` block and it will be applied.

**Reason:** The Java omission appears to be an incomplete implementation
rather than a deliberate design choice. Style support is expected by users
and consistent with how `@startyaml` and `@startjson` behave.

**Affects:** all `@starthcl` diagrams using `<style>` blocks.

---

## Packet diagrams

### Spanning field — no spurious stub at row boundary (bug fix)

**Upstream:** when a spanning field (one that overflows across multiple
rows) fills a row exactly to the boundary, plantuml.com inserts a spurious
empty block at the end of that row. For example, with `colwidth=16` and
`Header (8 bits)` followed by `Payload (32 bits)`, row 1 shows
`Header | Payload (8 bits) | [empty stub]` instead of the correct
`Header | Payload (8 bits)`.

**This port:** no stub is inserted. A row that fills exactly to `colWidth`
closes cleanly; the next row starts with the continuation block.

**Reason:** the stub conveys no information and misrepresents the field
layout. The correct split is `8 + 16 + 8 = 32 bits` across three rows with
no remainder. The upstream behavior is a rendering bug, not an intentional
design choice.

**Affects:** `@startpacketdiag` diagrams where a spanning field begins
mid-row and its first chunk fills the remaining columns exactly.

---

## @startdot — title and skinparam support

Upstream Java (`PSystemDot`) ignores `title` and `skinparam` directives
inside `@startdot` blocks (both are present in the source but never
applied). This port parses and applies both, consistent with all other
diagram types.

**Rationale:** DOT diagrams frequently appear alongside other PlantUML
content in the same document. Ignoring directives that work everywhere
else creates confusing inconsistency for users.

---

## Descriptive diagrams — edge routing (PROVISIONAL — under review)

**Category:** aesthetic / provisional — pending visual-QA review against
plantuml.com.

**Upstream / prior port:** the old `component` layout consumed graphviz
spline points (`dotEdge.points`, multi-point) from the dot seam, so edges
in nested component diagrams routed *around* container clusters.

**This port (merged `description` engine, T5):** every edge is routed
center-to-center as a straight 2-point line between node geometries, the
strategy the old `usecase` layout already used. The merged layout is
two-level (outer graph + per-container inner sub-layouts), which makes
composing the seam's spline coordinates across levels non-trivial — the
same reason `usecase` chose center-to-center.

**Status:** accepted for the consolidation merge (decision: maintainer,
2026-06-26) so the engine merge can proceed. Routing fidelity for nested
component diagrams is to be re-evaluated during the visual-QA pass; if
spline routing matters there, restoring it is a follow-up task (likely
needs the layout to thread inner-graph spline points through the outer
placement, or a single-level layout for spline-eligible cases).

**Affects:** `component`/deployment diagrams with nested containers and
edges that previously routed around them. Simple (flat) diagrams are
visually unaffected since their splines were already ~2 points.
