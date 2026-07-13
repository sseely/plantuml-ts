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

**Testing consequence:** the ~34 corpus fixtures carrying
`!pragma layout smetana|vizjs` are re-captured **with the pragma stripped**, so
the jar shells out to real graphviz and emits the `svek-N.dot` our DOT oracle
needs. This *removes* them from the oracle-blind bucket (the jar dumps no svek
DOT on the smetana/vizjs paths) and brings them under the normal DOT + SVG
conformance bars, rather than silently excluding them from the denominator.

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

### ⏳ Orphan `!else` / `!elseif` / `!endif` are ignored, not an error — TEMPORARY, being removed (SI6)

> **MAINTAINER RULING 2026-07-13: be faithful to the Java.** This divergence is
> **accepted as temporary** and is scheduled for removal by mission **SI6**
> (`planning/mission-index.md`). It is documented here because it ships today,
> not because it is endorsed.

**Upstream:** the jar renders an **error diagram** for an `!else`, `!elseif`, or
`!endif` with no enclosing `!if`/`!ifdef`. Live-oracle verified — the SVG shows
the Welcome screen, the source listing, and the message
`No if related to this endif`.

**This port:** silently ignored, a no-op.

**Why it still ships:** pre-existing plantuml-ts behavior, pinned by
`tests/unit/preprocessor.test.ts` since before the TIM port. A faithful
`CodeIteratorIf` throws, so the two cannot both hold — and **this port has no
error-diagram path**, so the `EaterException` would escape `renderSync` and
crash the caller. That is a *worse* divergence than the no-op: upstream never
throws; a malformed diagram still produces an SVG. Fidelity therefore requires
building the error-diagram path first, which is what **SI6** does (port
`net/sourceforge/plantuml/error/`, 814 LOC — retires this divergence plus the
"Function not found" passthrough and the `RetrieveProcedure` NPE case, all three
of which cite the missing error path as their only justification).

**⚠ Do not conflate with unclosed `!ifdef`.** An `!ifdef` left **unclosed at
EOF** is *tolerated* by the jar and renders normally — verified against the
oracle on `buveco-86-tibo673` (itself a PlantUML bug report,
forum.plantuml.net/6808/nested-ifdef-bug). Only true **orphans** error. SI6 must
handle the two differently.

**Cost of fixing: zero DOT parity.** No fixture in the 1,428-fixture DOT-gating
corpus has an orphan conditional; exactly 1 of 5,694 pdiff fixtures is
unbalanced at all, and it is the tolerated unclosed-`!ifdef` case.

**Category:** limitation — **temporary; scheduled for removal by SI6.**

### A known function called with an uncoverable arity passes through

**Upstream:** throws `EaterException("Function not found " + name)`; the jar
renders an error diagram (verified against the live oracle).

**This port:** the call passes through as literal text.

**Why:** this port has no error-diagram path — the exception would escape
`renderSync` into the caller. The pre-TIM preprocessor also passed such calls
through. **Category:** limitation.

### `!undefine` accepted as an alias for `!undef` (superset)

**Upstream:** only `!undef` exists; the jar errors on `!undefine`.

**This port:** accepts **both**, and `!undefine` additionally drops a like-named
*macro* (which upstream's `FunctionsSet` cannot do).

**Why:** pre-existing plantuml-ts behavior, pinned by
`tests/unit/preprocessor.test.ts`. A strict superset — no upstream-valid diagram
changes meaning. **Category:** limitation (upstream gap we fill).

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
