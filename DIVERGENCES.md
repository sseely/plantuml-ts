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

## General

### `!pragma layout smetana|vizjs` — always laid out with graphviz

**Upstream:** `!pragma layout` selects the layout engine. `smetana` uses
PlantUML's in-JVM engine (`sdot/`, driving the transpiled `gen/lib/dotgen/`);
`vizjs` uses Viz.js; the default shells out to the graphviz `dot` binary.

**This port:** the pragma is accepted and **ignored** — every graph diagram is
laid out with graphviz-ts. We do not implement smetana or vizjs as distinct
engines, and we do not conform to their output.

**Why (maintainer decision, 2026-07-12):** all three are *the same algorithm*.
Smetana is a mechanical Java transpile of graphviz 2.38 (`gen/lib/dotgen/` —
`acyclic__c.java`, `mincross__c.java`, `dotsplines__c.java` are line-for-line
transpiles of `acyclic.c`, `mincross.c`, `dotsplines.c`). Viz.js is graphviz
compiled to JS via Emscripten. graphviz-ts is a faithful TypeScript port of the
same graphviz source. Conforming to Smetana's *output* would mean faithfully
reproducing the divergences its transpilation introduced — porting the bugs of
a copy rather than the behavior of the original. Real graphviz is the correct
oracle, and it is the one we already match.

**Testing consequence (DONE 2026-07-13, mission G0):** the corpus fixtures carrying
`!pragma layout smetana|vizjs` are re-captured **with the pragma stripped**, so
the jar shells out to real graphviz and emits the `svek-N.dot` our DOT oracle
needs. This *removes* them from the oracle-blind bucket (the jar dumps no svek
DOT on the smetana/vizjs paths) and brings them under the normal DOT + SVG
conformance bars, rather than silently excluding them from the denominator.
*Executed in mission G0 (`plans/g0-limitfinder/`): 42 fixtures re-captured,
41 arrived DOT-EQUAL and 39 are pinned in ratchet goldens; the DOT gate
baseline is now component 253/262, usecase 84/90, class 708/708, object
78/80, state 266/267 with oracle-blind reduced to the elk residue.*

**Category:** limitation (upstream's alternate engines are redundant copies of
the one we implement).

**See also:** `!pragma layout elk` — **not supported**, below. It is not a
graphviz copy and is not covered by this entry.

### `!pragma layout elk` — not supported at this time

**Upstream:** `!pragma layout elk` lays the diagram out with the Eclipse Layout
Kernel — a genuinely different algorithm (Sugiyama-style), not a graphviz
reimplementation.

**This port:** **unsupported.** Unlike `smetana` and `vizjs` (which are graphviz
under other names — see above), ELK cannot be satisfied by routing to
graphviz-ts: it would produce a different layout. Diagrams carrying this pragma
currently lay out with graphviz-ts, which will **not** match upstream. The ~8
corpus fixtures using it are ledgered and excluded from the conformance bars.

**Why deferred (maintainer decision, 2026-07-12):** supporting ELK means taking
on `elkjs`, and three properties make that a poor trade for 8 fixtures:

1. **Async-only API.** `elkjs`'s sole entry point is `layout(): Promise<…>`.
   This port's public `renderSync` contract is synchronous, as is the entire
   SVG-conformance harness. ELK diagrams could therefore only work through the
   async `render()` path — and would remain **untestable** by the conformance
   harness regardless, so supporting them would not even move the bar.
2. **License.** `elkjs` is EPL-2.0 — the first non-permissive dependency in a
   tree that is otherwise MIT (graphviz-ts, katex, jsonc-parser).
3. **Bundle size.** Large enough that it would need to be an optional peer
   dependency, not a hard one, for a browser-targeted library.

**Revisit if** real demand appears, as an optional, async-only, peer-dependency
integration.

**Category:** limitation (unimplemented upstream feature).


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

### `mainframe <label>` — parsed, not yet rendered (BigFrame port deferred)

**Upstream:** `mainframe <label>` (`command/CommandMainframe.java`) wraps the
whole diagram in a bordered frame with a folded-corner tab carrying the
label, drawn by `DiagramChromeFactory.decorateWithFrame`
(`core/DiagramChromeFactory.java:257-318`) + `BigFrame`
(`klimt/shape/BigFrame.java`), applied as the innermost chrome layer
(mission G0b `decisions.md` D1/D9).

**This port:** `mainframe` is parsed into `DiagramAnnotations.mainFrame`
(T1) and participates in `isEmpty()`'s chrome-skip check (T1/T4), but
`applyChrome` (`src/core/annotations/chrome.ts`) does not draw it — a
diagram with a `mainframe` directive renders identically to one without.

**Why (T9, jar-verified investigation) — UPDATED by mission G0/T5,
STILL TEMPORARY per D9's escape hatch:** T9 found the blocker was a
missing *primitive* — `BigFrame`'s `computeWidth`/`computeHeight` need
`TextBlockUtils.getMinMax(original, stringBounder, false)`, a real
ink-bounding-box walk (`LimitFinder`) over every drawn primitive, and
this port had no `LimitFinder`/`MinMax`/`TextBlockUtils.getMinMax` at
all. Mission G0 ported that machinery in full (T1) and wired it into the
description (klimt) engine's own document-sizing pass
(`renderer-ink-extent.ts#computeDocumentDims`, T3) — the primitive T9
was missing now exists, and the description engine already performs the
exact kind of ink walk `BigFrame` needs, over the same `draw` callback
(`drawClusters`/`drawEntities`/`drawEdges`) `renderDescription` uses for
its real pass.

T5 evaluated decisions.md D5's two branches and re-traced the blocker
with the primitive now available. The remaining obstacle is
**architectural, not a missing primitive**: `BigFrame` needs the
`mainFrame` display data AND its resolved box style
(`padding`/`margin`/`lineColor`/`lineThickness`, honoring `skinparam`
and `<style>` overrides the same way title/legend/caption/header/footer
already do) available *inside* the klimt draw pass — and neither is
reachable there without crossing a boundary this port's plugin
architecture does not currently expose:

- `renderDescription(geo, theme, measurer)` — the only entry point with
  a real `draw` callback / `UGraphic` — receives `DescriptionGeometry`
  (`layout.ts`), which carries no annotation data. Threading
  `ast.annotations.mainFrame` onto it requires an edit to
  `src/diagrams/description/layout.ts` (mirroring the already-
  established `ast.seed -> geo.seed` precedent) — a file outside every
  branch-(a) write-set this mission authorized for T5 (`decisions.md`
  D5, batch-3/overview.md, T5's own boundaries section).
- Even with display data threaded onto `geo`, the *style* (padding/
  margin/lineColor/lineThickness) cannot follow the same path:
  `resolveAnnotationStyles(theme, skinparam, styleMap)` — the ONE
  function every other annotation element uses to honor `skinparam` and
  `<style>` block overrides — needs `preprocessed.skinparam` and
  `styleMap`, which exist only in `src/index.ts`'s top-level
  `renderSync`/`render`, resolved *after* `plugin.render()` already
  ran (`applyAnnotationChrome`, called on the returned fragment). Reaching
  them from inside `renderDescription` means either widening
  `SyncPlugin.layoutSync`/`render` (`src/core/dispatcher.ts`) to carry
  skinparam/styleMap — a plugin-contract change rippling to every
  diagram engine, not just description — or mutating `geo` from
  `src/index.ts` with an engine-specific, type-unsafe cast before
  `plugin.render()` runs, growing a SECOND, pre-render, description-only
  special case next to T7's existing post-render unwrap/reassemble
  special case (`src/index.ts#applyAnnotationChrome`). Both are exactly
  the "second chrome pipeline" shape D5/T5 were scoped to avoid; hard-
  coding the style (skipping `skinparam`/`<style>` support only for
  `mainframe`) would silently diverge mainframe from every other
  annotation element's fidelity to user overrides, undocumented, inside
  the same diagram.

Because the clean data path requires touching files this task was not
authorized to write (`layout.ts`) and the style path requires either a
cross-engine plugin-contract change or an undocumented fidelity
asymmetry, T5 takes **branch (b)**: keep the divergence TEMPORARY,
update the rationale, make no code change. Geometry itself is no longer
the open question — T5 independently re-derived `BigFrame`'s exact
formula against `klimt/shape/BigFrame.java` and
`DiagramChromeFactory.java:257-318` and confirms it is fully portable
(`ww = minX>=0 ? maxX : width`, `computeWidth = padL + max(ww+12,
titleW+10) + padR`, etc., off a `TextBlockUtils.getMinMax`-shaped raw
`MinMax`, not `computeDocumentDims`'s own post-processed width/height) —
only the plumbing to reach it from inside the klimt pass, with correct
style resolution, is missing.

Probe evidence (`@startuml\nmainframe demo\na->b\n@enduml` vs bare
`a->b`, oracle jar `-tsvg`): the bare diagram reports canvas 70×107.
Wrapped in `mainframe demo`, the frame's own `<rect>` is 80.543×139.953
(`x=5 y=15`), and the embedded original content is translated by exactly
`(10, 38.4883)` inside it — consistent with `margin.left + padding.left`
/ `margin.top + padding.top + dimTitle.height + 10` (`padding` = mission
G0b's already-ported `mainframe` style, `{top:1,right:5,bottom:1,left:5}`;
`dimTitle.height` = 16.4883, independently reconciled from the tab
path's `textHeight - 3`, and matches this port's own
`LINE_ADVANCE_RATIO` — `14 * 14.1328/12 = 16.4883` exactly).

`computeWidth`'s `Math.max(ww + 12, dimTitle.width + 10)` term only
reconciles (`80.543 - padding.left - padding.right = 70.543 = ww + 12`)
if `ww ≈ 58.5` — the diagram's ink-derived max-X — not its declared
width (`70`); using `ww = original.width` is off by ~11.5px, not a
rounding difference. The same pattern holds for height: `computeHeight`
reconciles only with an ink-derived `hh ≈ 95`, not the declared height
(`107`). This is exactly the `LimitFinder`/`getMinMax`-shaped quantity
T1/T3 now compute for description's own document sizing — G0's own
confirmation that the *ink extent* half of the problem is solved; only
the annotation-plumbing half (above) remains.

For every OTHER (non-description) engine, T9's original blocker still
holds unchanged: chrome (`src/core/annotations/chrome.ts`) composes flat,
pre-measured `{ body, width, height }` `AnnotationBlock` fragments
(project CLAUDE.md D2's string-fragment architecture) with no drawable
tree and no ink-bounding-box tracking anywhere — reproducing `LimitFinder`
there means walking/parsing composed SVG body strings (D5's explicitly
rejected "SVG-string extent walker") or threading real geometry objects
through the whole render pipeline instead of flat strings, both far
outside a "small, isolated" `BigFrame` port.

**Category:** limitation (parsed, not yet rendered — see D9).

**Revisit:** description-engine BigFrame is unblocked as soon as (a) the
mainframe annotation can reach `DescriptionGeometry` (a `layout.ts`
write-set expansion, mirroring `geo.seed`) and (b) `resolveAnnotationStyles`
or an equivalent can be evaluated before/inside the klimt render pass
(a `SyncPlugin` contract change, or an index.ts-level restructuring that
resolves styles before calling `plugin.render`) — both are natural
follow-up mission scope, not new unported machinery. Fragment-string
engines still need the same primitive as before: an SVG path/shape
extent walker, or geometry-object threading in place of flat fragment
strings.

---


### Default element skin — grey (`#F1F1F1`), not legacy yellow (`#FEFECE`)

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

---

## Preprocessor (TIM)

Recorded 2026-07-13 with mission SI5a, which replaced the flat line-loop
preprocessor with a faithful port of upstream's TIM interpreter (`TContext` over
the `CodeIterator` chain). Each is marked `PLANTUML-TS DIVERGENCE <n>` at its
site in `src/core/tim/TContext.ts` and pinned by a test.

### Includes resolve from a synchronous `IncludeStore`, prefetched out of band

**Upstream:** `!include` / `!includesub` / `!includedef` / `!import` are resolved
**during interpretation** (`TContext#executeInclude`), by opening the file
through a `PathSystem` — blocking I/O, mid-interpretation.

**This port:** the *architecture* is upstream's — resolution happens inside the
interpreter, where conditionals and variables have already been evaluated — but
the *content* comes from a pre-populated, **synchronous** `IncludeStore`
(`src/core/tim/IncludeStore.ts`), never from live I/O. `render()` runs an async
**prefetch** pass first (`include-resolver.ts#prefetchIncludes`), which walks the
source transitively and fills the store; `renderSync` takes a store from the
caller (`RenderOptions.includeStore`) or resolves nothing.

**Why:** `renderSync` is public API and `src/` must run in a browser (CLAUDE.md:
no `fs`, no blocking I/O, no async in rendering paths). The interpreter therefore
cannot await. Splitting the I/O in two is the only way to keep upstream's
resolution *point* while satisfying that constraint.

**This replaced a structural divergence, and is a net fidelity gain.** The old
`resolveIncludes` was a **textual pre-pass that ran before conditionals were
evaluated**: an `!include` inside a false `!ifdef` was fetched *and inlined*
anyway, a variable-built include path (`!include $path`) was inexpressible, and
`!includesub` had no expression at all. All three now behave as upstream does.

**Category:** limitation (architectural). **Accepted consequences:**

- **The prefetch OVER-FETCHES.** It is a text scan, not an evaluation: it cannot
  know which branch of an `!ifdef` will be taken, so it fetches include targets
  in **both** branches. The interpreter then executes only the live one, so the
  *output* is correct — but a file named by a dead branch is still requested (a
  wasted fetch), and a fetch failure there is still an error. Upstream, being
  single-pass and synchronous, never issues that request.
- **The converse limit:** a target the scan cannot see statically — `!include
  $path` where `$path` is computed, or an include inside a `!procedure` body
  invoked with computed arguments — is not prefetched. Supply those through
  `options.includeStore` directly.
- **No relative-path resolution.** Upstream re-bases the current directory on the
  including file's folder. Store keys are the include target verbatim; a host
  fetcher owns whatever path policy it wants (`include-resolver-node.ts` already
  does, and sandboxes to a base directory).

### `!include <bundle/thing>` is a typed error, not a silent skip

**Upstream:** resolves the angle-bracket form from PlantUML's **bundled stdlib**
(`c4`, `tupadr3`, `awslib`, `bootstrap`, …), which ships inside the jar.

**This port:** **vendors no stdlib asset.** The form is *resolvable through the
seam* — a host may put the bundle's files in `options.includeStore` under either
`<bundle/thing>` or `bundle/thing` — but with nothing supplied it throws
`StdlibNotBundledError`, naming the bundle the caller has to provide.

**Why:** vendoring the stdlib is a licensing question the maintainer owns
(mission SI5b). Until then, the honest behavior is to fail loudly. **What this
replaced was worse:** `include-resolver.ts` used to **silently drop** the line,
so every macro the bundle defines stayed unexpanded and the diagram rendered
*quietly wrong*. **Category:** limitation (blocked on SI5b).

### `!includedef` reads the store; `!import` registers a lookup prefix

**Upstream:** `!includedef NAME` pulls the named definition out of the
`DefinitionsContainer` — the `@startuml(id=NAME)` blocks of whichever *file set*
the CLI is processing. `!import PATH` adds a folder or zip to the `PathSystem`
and **throws `Cannot import`** when the path does not exist.

**This port:** `!includedef NAME` resolves through the include seam, keyed by
`NAME`. `!import PATH` registers `PATH` as a **key prefix** that later `!include`s
are also tried against, and never throws.

**Why:** this port is handed one source string, not a file set, so there is no
`DefinitionsContainer`; and there is no filesystem to check an import path
against. **Category:** limitation.

### ~~Orphan `!else` / `!elseif` / `!endif` are ignored~~ — RETIRED (SI6, 2026-07-13)

### ~~A known function called with an uncoverable arity passes through~~ — RETIRED (SI6, 2026-07-13)

### ~~`RetrieveProcedure` guards a lookup upstream leaves unguarded~~ — RETIRED (SI6, 2026-07-13)

All three are **gone**, and the record needs correcting, because all three
rested on the same claim:

> *"This port has no error-diagram path, so the exception would escape
> `renderSync` and crash the caller."*

**That claim was FALSE.** An error path existed the whole time — `src/index.ts`
caught every throw and returned a homegrown red box. What it was NOT was
*faithful*. So the three divergences were not buying "the document still
renders" (it already did); they were buying nothing, at the cost of hiding
malformed input. Anyone re-deriving that reasoning from the code today should
stop at this paragraph.

SI6 ported `net/sourceforge/plantuml/error/` (`PSystemError` and friends, plus
`eggs/PSystemWelcome`) into `src/core/error/`, replaced the red box with it, and
made all three faithful:

- an orphan `!else` / `!elseif` / `!endif` throws
  `No if related to this <directive>` (`CodeIteratorIf`), which the error
  diagram renders — exactly what the jar does;
- a call to a KNOWN function name that no overload's arity covers throws
  `Function not found <name>` (`TContext#applyOneFunction`);
- `RetrieveProcedure` dereferences its lookup unguarded, as upstream does.

**⚠ An unclosed `!ifdef` at EOF is still TOLERATED** and still renders — it is a
different condition, not a variant of the first (the unclosed context stays *on*
the if-stack, so no directive ever finds the stack empty). Both are pinned by
tests (`tests/unit/preprocessor.test.ts`,
`tests/unit/core/tim/iterator/CodeIteratorIf.test.ts`,
`tests/integration/error-diagram.test.ts`). Cost to DOT parity: **zero** —
component 251/259, usecase 81/87, class 680/680, object 78/80, state 260/261,
with no fixture changing bucket.

### The error diagram omits the raster decorations, and prints this port's own version

**Upstream:** the error diagram stacks the PlantUML logo into the Welcome
block's top-right corner, and — depending on the *minute of the hour*
(`System.currentTimeMillis() / 60000L % 60`) — a Patreon, Liberapay,
dedication, or Arecibo banner, each a bundled raster image with a QR code.
Its version banner reads `PlantUML version <x> / <commit>`.

**This port:** none of the raster decorations are drawn, and the banner reads
`plantuml-ts version <x> / <commit>`. The text of the error — the source
listing, the `[From … (line N) ]` stack, the message — is byte-identical to the
jar's, verified against the live oracle.

**Why:** `src/` may not read a clock (rendering must be reproducible — no
`Date.now()`), and this port vendors no raster assets. Upstream ships the same
switch: `PSystemError.disableTimeBasedErrorDecorations()`. The version line
naming *this* renderer, not the Java one, is the point of the line.
**Category:** limitation (assets) / clarity (version identity).

### `!undefine` accepted as an alias for `!undef` (superset)

**Upstream:** only `!undef` exists; the jar errors on `!undefine`.

**This port:** accepts **both**, and `!undefine` additionally drops a like-named
*macro* (which upstream's `FunctionsSet` cannot do).

**Why:** pre-existing plantuml-ts behavior, pinned by
`tests/unit/preprocessor.test.ts`. A strict superset — no upstream-valid diagram
changes meaning. **Category:** limitation (upstream gap we fill).

**SI6 note:** the removal is now COMPLETE. It used to leave the macro's name in
`FunctionsSet`'s `functions3` trie, relying on the (now retired) "function not
found" passthrough to make a later call site fall back to literal text. With
that passthrough gone, a call to an undefined macro would have raised `Function
not found` — an error for a function the document explicitly removed — so the
trie is now rebuilt from the surviving functions.

### `!theme` records the name; it does not execute the theme's source

**Upstream:** loads the theme file and executes its lines through the
preprocessor.

**This port:** the interpreter records the theme **name**;
`src/core/theme.ts` resolves it. Surfaced as `PreprocessorResult.theme`.

**Why:** architectural — this port already resolves themes by name through
`themes-builtin.ts` / `style-map-theme.ts`. **Category:** limitation.

### File, environment, clock, and RNG builtins are inert by default

**Upstream:** `%getenv`, `%file_exists`, `%filedate`, `%dirpath`, `%now`,
`%date`, `%random`, `%get_all_stdlib`, … read real ambient state.

**This port:** all ambient I/O and non-determinism reach the builtins **only**
through an injected `TimEnvironment` seam (`src/core/tim/builtin/TimEnvironment.ts`),
whose default implementation is inert and deterministic.

**Why:** non-negotiable architectural constraint — the library must run in a
browser (no `fs`, no `process.env`) and render reproducibly (no `Date.now()`, no
`Math.random()`). A host can supply a real implementation. **Category:**
limitation.

### `%newline()` / `%breakline()` emit a real newline, not the BLOCK_E1 sentinel

**Upstream:** carries both branches, gated on
`JawsFlags.USE_BLOCK_E1_IN_NEWLINE_FUNCTION`.

**This port:** takes upstream's **legacy branch** (flag `false`), yielding a real
newline.

**Why:** this port has no Jaws/Creole decoder, so the BLOCK_E1 sentinel would
reach the SVG as an invisible private-use character instead of a line break. The
legacy branch is what made `%n()` split lines pre-TIM. **Category:** limitation.

**Known residual:** `%retrieve_procedure`'s captured body is joined with
upstream's `BLOCK_E1_NEWLINE` *in-line* separator (faithful — and required: line
*splitting* regressed `roputo-88-fuxo199` to zero layout graphs by turning a
captured class body inside a `note` into loose top-level lines). Without a Jaws
decoder that separator renders as an invisible character rather than a label
line break.

## Descriptive diagrams

<!--
RESOLVED 2026-06-26 — "Descriptive diagrams — edge routing": an earlier draft
of the merged description engine routed edges center-to-center (2-point lines).
This was rebuilt to the faithful upstream model — one DOT graph with cluster_*
subgraphs, a single graphviz pass, real bezier splines, and container-endpoint
edges clipped to the cluster rectangle (mirroring svek's simulateCompound). No
longer a divergence; entry removed.
-->

---

## DOT diagrams

### @startdot — title and skinparam support

Upstream Java (`PSystemDot`) ignores `title` and `skinparam` directives
inside `@startdot` blocks (both are present in the source but never
applied). This port parses and applies both, consistent with all other
diagram types.

**Rationale:** DOT diagrams frequently appear alongside other PlantUML
content in the same document. Ignoring directives that work everywhere
else creates confusing inconsistency for users.

---

## HCL diagrams

### `title` inside `@starthcl` renders; upstream crashes (deliberate)

**Upstream:** a `title My Title` line inside `@starthcl` reaches the HCL
content parser and throws `IllegalStateException: EQUALS`
(`HclParser.java:88`, `getModuleOrSomething`) — HCL never registers the
title commands and the raw line is treated as HCL data. Jar-verified
2026-07-13 (`-tsvg -pipe` stack trace).

**This port:** `title` (and caption/legend/header/footer) in `@starthcl`
route through the shared annotation chrome (G0b) and render, consistent
with `@startjson` / `@startyaml` (whose titles the jar does render).
Before G0b this port silently stripped the line — also divergent.

**Reason:** the upstream crash is an unhandled-exception bug, not a
behavior to reproduce. Aligning HCL with its json/yaml siblings is the
lowest-surprise choice.

**Affects:** `@starthcl` blocks carrying annotation directives.

---

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

## DOT-passthrough diagrams

### `title` inside `@startdot` renders; upstream errors (limitation, inverted)

**Upstream:** `@startdot` is `PSystemDot extends DirectOsDiagram` — it shells
out to the real `dot` binary and streams its SVG through, bypassing
`DiagramChromeFactory` entirely. `PSystemDotFactory.executeLine` requires the
first content line to match the bare graphviz header, so a `title …` line
before it is a **syntax error** (jar-reproduced twice, 2026-07-13).

**This port:** `title` (and the other annotation directives) inside
`@startdot` render via the shared chrome. This was a pre-existing port-only
feature (the old bespoke `TITLE_HEIGHT` band); G0b consolidated it through
`src/core/annotations/` rather than removing it.

**Reason:** removing a shipped feature to reproduce an upstream error has no
user value; the consolidation keeps exactly one title mechanism.

**Affects:** `@startdot` blocks carrying annotation directives (no upstream
oracle exists for them — the jar errors).

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
