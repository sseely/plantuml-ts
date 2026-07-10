# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
This project does not yet follow Semantic Versioning releases; entries are
grouped by mission/PR until a first tagged release exists.

## [Unreleased]

### Changed — description diagram SVG output shape (svg-conformance Brief 2, T17 cutover)

**What changed:** the **description** diagram engine (`component`,
`usecase`, and deployment diagrams — everything routed through
`descriptionPlugin`) now renders through plantuml-ts's `klimt` SVG emitter
(`src/core/klimt/**`, ported from upstream's `net.sourceforge.plantuml.
klimt`) instead of the legacy `src/core/svg.ts` primitives. This is a
**deliberate, documented divergence from the port's own pre-cutover SVG
output**, made to reach jar-conformant behavior — not an accidental
regression. See `.claude/CLAUDE.md`'s "friction principle" and
`docs/svg-conformance.md` for the conformance model this change is judged
against; the mechanism-level record is
`planning/mission-svg-conformance-2/decision-journal.md`.

**Why this is a deliberate divergence, not a bug fix:** upstream PlantUML's
real jar output was never `src/core/svg.ts`-shaped to begin with — that
module was always plantuml-ts's own reduced approximation. This change
does not diverge *from* upstream; it converges *toward* upstream, closing
the gap between what this port emitted and what the jar actually emits.
Consumers who built tooling against the port's *previous* SVG shape
(rather than against upstream's jar SVG) will see structural differences
described below.

**Affected consumers:** only the `component`/`usecase`/deployment-keyword
diagram family. No other diagram type (`sequence`, `class`, `state`,
`activity`, `json`, `yaml`, `hcl`, `board`, `chronology`, `files`,
`packetdiag`, `chart`) is affected — they still render through
`src/core/svg.ts`, unchanged.

#### 1. Arrowheads: `<marker>` refs → drawn polygon/path shapes

Previously, description-diagram edges terminated in an SVG `<marker>`
element referenced via `markerEnd="url(#...)"` (`src/core/svg.ts`'s
`arrowHead`/`arrowHeadRef`). They now terminate in **explicit drawn
shapes** — `<polygon>`/`<path>` elements emitted per-edge by
`src/core/svek/SvekEdge.ts` + `src/core/svek/extremity/*.ts` (16 factory
pairs covering arrow/circle/diamond/crowfoot/triangle/etc. decorations),
matching the jar's own approach: PlantUML's `SvgGraphics` never uses
`<marker>` for description-diagram arrowheads either.

- **Before:** `<path d="M..." marker-end="url(#arrow123)"/>` +
  a `<defs><marker id="arrow123">...</marker></defs>` block.
- **After:** `<path d="M..."/>` immediately followed by a sibling
  `<polygon points="..."/>` (or `<path>`) drawing the arrowhead shape
  directly, with no `<marker>`/`<defs>` involved for this element.
- **Consumer impact:** any tooling that located edge arrowheads via
  `<marker>`/`markerEnd` on description-diagram output must instead locate
  the trailing `<polygon>`/`<path>` sibling within the same `<g
  class="link">`.

#### 2. Entities: implicit shapes → `<g class="entity">` wrapper + `<!--entity NAME-->` comment

Every leaf entity (component, usecase, database, node, etc.) is now
wrapped in `<!--entity NAME--><g class="entity" ...>...</g>`, matching
upstream's `EntityImageDescription`-family convention
(`DecorateEntityImage.java` / `EntityImageDescription.java:294-303`,
inlined identically across ~12 upstream `EntityImage*` classes and
consolidated here as `decorateEntityDrawing()`,
`src/core/svek/DecorateEntityImage.ts`). Attribute order on the `<g>`
follows the Java `EnumMap` declaration order (`ID`, `DATA_ENTITY`, etc.,
some dropped-by-writer bug-for-bug — see the file's doc comment); the
`DATA_UID` attribute is renamed to plain `id`.

- **Consumer impact:** entity shapes are no longer bare top-level
  `<rect>`/`<ellipse>`/etc. — they are nested one level inside a
  `<g class="entity">`, and preceded by an XML comment naming the entity.
  Any selector assuming a flat shape list under the root `<svg>` must
  instead select `g.entity` and its children.

#### 3. Document preamble: klimt `SvgOption` header

The root `<svg>` and its immediate children now carry attributes emitted
by `src/core/klimt/drawing/svg/svg-graphics.ts` (`SvgGraphics`), mirroring
upstream `TextBlockExporter#createUGraphicSVG`:

- `data-diagram-type="DESCRIPTION"` on the root element (matches
  `DiagramType.DESCRIPTION.name()` in every jar `description`-family
  fixture).
- `<?plantuml $version$?>` processing instruction. `$version$` is a
  literal placeholder token, not a real version string — this matches the
  jar's own cached-fixture output exactly (decision D4′); it is not a bug
  in this port.
- Deterministic, **source-content-derived** ids in place of any
  previously-random/incremental id scheme: a 64-bit seed is computed from
  the diagram source text (`seedOf`, `src/core/klimt/drawing/svg/
  svg-graphics-core.ts`, porting upstream `UmlSource.seed()`) and threaded
  through `UGraphicSvg.build(geo.seed, ...)`. The same source text always
  produces the same ids; different source text produces different ids —
  this is deliberately reproducible, not random, matching the jar's own
  `UmlSource`-seeded id generation.
- **Consumer impact:** id-based selectors will see different, but stable
  and content-derived, id values. Do not hardcode a previously-observed
  id — regenerate goldens from the new render if you snapshot ids.

#### 4. Default `font-family`: `"Arial, sans-serif"` → `"sans-serif"`

`defaultTheme.fontFamily` (`src/core/theme.ts`) changed from
`'Arial, sans-serif'` to `'sans-serif'`, matching every jar description
fixture's own `font-family="sans-serif"` output. This is a genuine
upstream-alignment fix, not scoped only to the klimt cutover — it affects
every diagram type's *default* font, though in practice almost no other
diagram type relies on the bare default (56 of 58 pre-change `"Arial"`
occurrences across the codebase were explicit user-/test-supplied fonts
and are unaffected; only two true default-font call sites existed).
Explicit `skinparam defaultFontName`/`<style>`-supplied fonts are
unaffected either way.

- **Consumer impact:** any diagram relying on the *unset* default font
  (no explicit `skinparam`/`<style>` font override) will now emit
  `font-family="sans-serif"` instead of `font-family="Arial, sans-serif"`.

#### 5. Diagram margin: symmetric 12pt → asymmetric leading-7pt / trailing-12pt

The description engine's outer diagram margin was a single constant
(`LAYOUT_MARGIN = 12`) applied uniformly to both the content origin and
the trailing edge. Upstream svek uses an **asymmetric** margin: the
outermost element's leading origin sits at `(7, 7)`, while the trailing
margin remains `12`. `src/diagrams/description/layout-helpers.ts` now
splits this into `LAYOUT_MARGIN_LEADING = 7` (content-origin offset,
single-node total-dimension formula) and `LAYOUT_MARGIN` = 12 (unchanged,
trailing margin only).

- **Consumer impact:** every description-diagram coordinate shifts by
  −5px relative to pre-fix output (leading origin moved from `(12, 12)` to
  `(7, 7)`); overall document width/height shrinks correspondingly. A
  minimal single-element diagram (e.g. `[A]`) now renders at the exact
  jar-conformant width, whereas it previously carried 10px of extra
  padding (5px per axis).

### Changed — class diagram `newpage` is now parsed and rendered (T7, class-dot-sync A2)

**What changed:** a class diagram source containing `newpage`
(`net.sourceforge.plantuml.descdiagram.command.CommandNewpage` /
`NewpagedDiagram`) previously had its pages silently merged into one
diagram — every classifier/relationship/note from every page was parsed
into a single flat AST and laid out together, with no page boundary
respected. `newpage` now splits the source into per-page ASTs
(`ClassDiagramAST.pages`, T6), and `layoutClass`/`renderClass` now lay out
each page independently — exactly as upstream's `NewpagedDiagram` treats
each page as a complete, standalone diagram (fresh classifiers,
relationships, directives; only `dpi` carries over) — then stack the
resulting page geometries **vertically**, separated by a 20px gap
(`NEWPAGE_GAP` in `src/diagrams/class/layout.ts`).

**Why vertical stacking, and why this is our own adaptation, not
upstream's:** upstream's CLI emits one output **file** per page (when the
CLI's page-count plumbing works at all — see the limitation noted below).
This library returns a single SVG **string** per render call, so there is
no multi-file equivalent; stacking pages into one tall image is this
port's own choice, not a jar-matched behavior. The 20px gap is likewise
ours.

- **Consumer impact:** any class diagram using `newpage` now renders
  visibly different (and correct, multi-page) output instead of a
  silently-merged single page. Diagrams without `newpage` are unaffected
  — `layoutClass`/`renderClass` output is byte-identical to pre-T7 for the
  single-page path.

**Known limitation surfaced by this work (not fixed here, upstream-side):**
`NewpagedDiagram` (`~/git/plantuml/.../NewpagedDiagram.java`) never
overrides `AbstractDiagram.getNbImages()` (which returns `1`), so the
reference PlantUML CLI (`-tsvg -o dir file.puml`) only ever exports
**page 1** of a multi-page class/descriptive-diagram source — pages 2+ are
silently dropped from CLI output and never reach a second `svek-N.dot`
dump, regardless of whether they are degenerate. Verified directly against
`oracle/dist/plantuml-oracle.jar` on several fixtures (including a clean,
non-degenerate 2-page reproduction) before writing this port's own
multi-page behavior. This means the DOT-sync oracle harness
(`scripts/dot-sync-report.ts`) cannot verify our pages-2-and-beyond output
against the jar for `newpage` sources — its "graph-count mismatch" bucket
is unaffected by this change (only 3 of 680 class fixtures use `newpage`
at all, and none moved bucket).

### Fixed

- `theme.ts`: default `fontFamily` corrected to `sans-serif` (see item 4
  above) — also fixes two dead default-font fallbacks in
  `src/diagrams/json/layout.ts` that referenced the old default.
- `renderer-entity.ts`: `ENTITY_ROUND_CORNER` corrected `2.5` → `5.0`
  (the SVG rectangle driver halves `rx` at serialize time; the prior
  value under-rounded entity corners by 2x relative to the jar).
- `renderer-entity.ts`: `actor-business`/`usecase-business` symbols now
  read their fill color from the dedicated `businessActorFill`/
  `businessUsecaseFill` theme fields instead of falling through to the
  generic entity fill, fixing an integration regression the klimt
  cutover introduced (business actors briefly rendered with the wrong
  background color).
- `skinparam.ts`: `<style>` block class-selector matching (`selectorOpen`
  regex) now matches selectors containing spaces (e.g. `.className {`
  with a space before the brace) — previously a `backgroundColor`
  declaration under such a selector leaked into the document background
  instead of staying scoped to the element class.
- `parser.ts`: the inline shorthand-trailer color/style regex
  (`SHORTHAND_TRAILER`) was silently dropping any paren/colon-shorthand
  entity whose inline suffix contained `;`, `:`, or `.` (e.g.
  `(dummy) #orange;line:yellow`) — widened to accept the same character
  set as the general color-parsing regex.
- `DescriptiveNode.color` (inline `#color` overrides on individual nodes)
  is now consumed by the description renderer (`renderer-entity.ts`); it
  was previously parsed into the AST but never applied.

### Known limitations (tracked, not regressions)

The klimt cutover does not yet reach full description-engine SVG
conformance against the jar oracle. See `docs/svg-conformance.md`'s
"Current description-engine conformance status" for the itemized backlog
(F1 spline-clip edge-drop on 3 fixtures, F2 unsupported structural
features — legend/title/header/footer/newpage/images/creole, F3 D12
measurer-mode residue in the production survey, F4 ~1px multi-leaf
document-dimension under-count, F5 `newpage`/multi-page). A 5-fixture
conformance ratchet (`oracle/goldens/svg-description/`) locks the cases
already proven zero-diff and gates `npm test`.

### Removed

- Playwright raster visual-QA path for the description engine (advisory,
  never CI-gating): `tests/visual/compare.spec.ts`,
  `tests/visual/playwright-visual.config.ts`,
  `tests/visual/capture-reference.ts`, `tests/visual/reference/**`,
  `scripts/visual-qa-svg.ts`, and the `visual:compare` npm script.
  Superseded by the SVG-conformance ratchet above, which is a strictly
  stronger (exact, gating) check for the description/component/usecase
  types it covers. Other diagram types' advisory raster coverage
  (`visual:classify`/`capture`/`build`/`upload`) is retained, unaffected.
