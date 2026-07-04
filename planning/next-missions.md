# Next Missions (in order)

## 1. Text Measurement

Improve `FormulaMeasurer` accuracy and overall text measurement consistency
between browser (CanvasMeasurer) and Node.js environments. Correct box sizing
is the foundation everything else depends on.

Status: ✅ complete

## 2. Preprocessor

Recognize and strip `<style>...</style>` blocks before the diagram parser sees
the input. Handle `!include`, `!define`, and other preprocessor directives.
Surface skinparam directives in a structured form for the theming layer.

Prerequisite for theming — the preprocessor is what extracts the style
directives that the themer applies.

Status: ✅ complete

## 3. Skinparam / Theming

Apply `skinparam` directives and `<style>` block rules to diagram elements
(colors, fonts, line styles, stereotypes). Depends on preprocessor correctly
surfacing those directives.

Status: ✅ complete (global skinparam wired; scoped `<style>` blocks deferred to Mission 5)

## 5. Scoped `<style>` Block Rendering + Business Element Variants

### Why this is next

Two gaps found during Mission 3 (skinparam) manual testing with fixture
`baleji-17-reru445`:

1. **Scoped `<style>` blocks are not applied.** The current `parseStyleBlock`
   does flat extraction only — it strips all selector lines, so every
   `BackGroundColor` inside `actor { }` or `usecase { }` is silently discarded.
   Colours never reach the renderers.

2. **Business element variants (`/` suffix) are not rendered.** `:joe2:/`
   (business actor) and `(run)/` (business use case) are silently dropped by
   the parser. Only the plain variants appear in output.

### What must be delivered

**Part A — Style block parser**

Replace the flat `parseStyleBlock` with a hierarchical parser that produces a
typed style map keyed by selector path:

```
Map<selectorPath: string, Map<property: string, value: string>>
```

Example: `actor { BackGroundColor blue; business { BackGroundColor red } }`
produces:
- `actor` → `{ backgroundcolor: 'blue' }`
- `actor.business` → `{ backgroundcolor: 'red' }`

Selector paths are lowercased, dot-separated. The parser must handle one level
of nesting (element type) and two levels (element type + stereotype).

**Part B — Style lookup in the render pipeline**

Pass the parsed style map alongside `Theme` into the render pipeline. Provide
a lookup helper:

```typescript
function lookupStyle(
  styles: StyleMap,
  elementType: string,
  stereotype?: string,
): Map<string, string>
```

More-specific rules (element + stereotype) override less-specific ones
(element only), which override the top-level Theme.

**Part C — Renderer integration**

Update the renderers for element types that appear in `<style>` blocks:
- Use case diagram: actor, usecase (head/body colours, border)
- Class diagram: class, interface, enum, package (already partially covered by
  skinparam mapping — extend to scoped style)
- Other diagram types: as needed to match fixture corpus

**Part D — Business element parser fix**

Add `/` suffix recognition to the use case diagram parser:
- `:name:/` → business actor
- `(name)/` → business use case

Render business actors with the standard business-actor visual (head circle
with additional line crossing, as upstream does).

### Java source to read first (mandatory)

- `~/git/plantuml/src/main/java/net/sourceforge/plantuml/style/StyleLoader.java`
  — how `<style>` blocks are parsed into the style tree
- `~/git/plantuml/src/main/java/net/sourceforge/plantuml/style/StyleSignature.java`
  — how selector paths are matched against element types and stereotypes
- `~/git/plantuml/src/main/java/net/sourceforge/plantuml/style/PName.java`
  — property name enum (maps CSS-like names to rendering properties)
- `~/git/plantuml/src/main/java/net/sourceforge/plantuml/style/SName.java`
  — element type name enum (actor, usecase, class, etc.)
- `~/git/plantuml/src/main/java/net/sourceforge/plantuml/usecasediagram/`
  — business actor/use case parsing and rendering

The Java source is the specification. Every selector format, property name, and
specificity rule must be verified against the upstream before implementation.

### Reference fixture

`~/git/pdiff/dbhum/b_al/baleji-17-reru445.puml` — the exact fixture that
exposed both gaps (actor/usecase style scoping + business element variants).

Status: 🔲 not started

## 4. LaTeX Math Rendering

`<latex>...</latex>` tags appear in labels across activity, class, and sequence
diagrams (20 pdiff fixtures, corpus entry bigobe-53-denu394 is the canonical
activity example). Without rendering, those label boxes size incorrectly and
display raw LaTeX source.

Approach: integrate **KaTeX** — browser-safe, synchronous, no server round-trip.
KaTeX renders LaTeX to SVG; the output SVG can be embedded directly in the
diagram SVG as a nested `<svg>` or inlined.

Key decisions:
- KaTeX renders to HTML or SVG. Use SVG mode — avoids foreignObject browser
  quirks and keeps the output self-contained.
- Text measurement: KaTeX SVG has a viewBox with known dimensions — extract
  width/height from the rendered SVG rather than running through the string
  measurer.
- `<latex>` may appear mid-label alongside plain text (e.g. `<back:gray>
  <latex>...</latex></back>`). The Creole parser needs to treat `<latex>...</latex>`
  as a leaf token; layout must measure it correctly.
- `phases.md` listed LaTeX as "out of scope" — this decision overrides that.
  Update phases.md when this mission is planned.

Upstream reference:
- `~/git/plantuml/src/main/java/net/sourceforge/plantuml/klimt/creole/atom/AtomImg.java`
  (LaTeX atoms are rendered as images via JLatexMath in upstream)
- Fixture: `~/git/pdiff/dbhum/b_ig/bigobe-53-denu394.puml`

Status: 🔲 not started
