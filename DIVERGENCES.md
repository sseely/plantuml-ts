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

## Preprocessor

### External `!import` / `!include` deferred (scope)

**Upstream:** `!include`/`!import` resolve local files, URLs, and the
PlantUML stdlib inline during preprocessing.

**This port:** external import/include functionality is not included at
this time. Deferred past v1.0 by maintainer decision (2026-07-10): a
faithful port needs a TypeScript/JavaScript-friendly resolution design
(no synchronous filesystem access in a browser library) rather than a
mechanical translation. An opt-in async seam for URL-based `!include`
exists (`resolveIncludes()` + caller-supplied fetcher in
`src/core/include-resolver.ts`); filesystem and stdlib resolution ship
in no form. The `!procedure`/`!function` macro family (TIM subsystem)
IS in scope and being ported.

**Reason:** scope control for v1.0; the design question (how a JS/TS
consumer supplies includable sources) deserves its own decision rather
than an implicit port.

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

<!--
RESOLVED 2026-06-26 — "Descriptive diagrams — edge routing": an earlier draft
of the merged description engine routed edges center-to-center (2-point lines).
This was rebuilt to the faithful upstream model — one DOT graph with cluster_*
subgraphs, a single graphviz pass, real bezier splines, and container-endpoint
edges clipped to the cluster rectangle (mirroring svek's simulateCompound). No
longer a divergence; entry removed.
-->


## Default element skin — grey (`#F1F1F1`), not legacy yellow (`#FEFECE`)

**Upstream:** PlantUML carries two default fills for class/object/descriptive
elements — the legacy `ColorParam` default (`#FEFECE` pale yellow) and the
newer Style-system default (`#F1F1F1` grey, `resources/skin/plantuml.skin`).
Which one renders depends on the code path/version; the current reference jar
(`plantuml-1.2026.7beta3`) renders the Style-system grey.

**This port:** adopts `#F1F1F1` fill / `#181818` border / black font as the
default element skin (`classBackground`, `enumBackground`, and every
per-element default via `resolveElementPaint` → `nodeBackground`). Note
elements keep their distinct pale-yellow default; only the general element
skin changed.

**Category:** aesthetic (alignment with the authoritative modern default).

**Rationale:** matches what current upstream actually renders, so a
default-colored diagram looks like the reference jar rather than the legacy
yellow. Deliberate, maintainer-approved — see `decisions.md#D2`
(planning/mission-render-fidelity). Reversible by reverting the two default
values in `src/core/theme.ts`.
