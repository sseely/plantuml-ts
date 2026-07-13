# plantuml-ts — Project Notes

## Feature Catalog — read before writing any code

`.claude/catalog.md` lists every existing module (file paths + public API) and
every planned-but-unbuilt feature. **Check it before implementing anything:** if
a module is Done, use it — don't reimplement. Agents routinely forget these
exist: `skinparam.ts` (resolveSkinparam, parseStyleBlock), `latex.ts` (KaTeX),
`auto-layout.ts` (engine selection), all eight layout engines, `svg-sanitize.ts`,
`include-resolver.ts`, and the dot pipeline in `src/core/dot/`.

**Before drafting a `/plan-mission` prompt:** read `planning/mission-guide.md` —
exact Java packages, reuse targets, architecture constraints, and common agent
mistakes per remaining phase.

## License

MIT, per the MIT license option in upstream PlantUML's LICENSES.md (maintainer decision 2026-07-11). Keep dependencies MIT-compatible.

## Reference Implementation

`~/git/plantuml` (Java) is the canonical spec — consult it whenever diagram
semantics or rendering rules need looking up. Key packages under
`src/main/java/net/sourceforge/plantuml/`:

| Package | Purpose |
| --- | --- |
| `klimt/` | Drawing primitives — `UGraphic`, shapes, `DotPath`, geometry, fonts |
| `svek/` | Node/edge/cluster layout + SVG assembly (`SvekEdge`, `Cluster`) |
| `cucadiagram/` | Shared entity/group model across most diagram types |
| `descdiagram/` | Descriptive/deployment diagrams (component, usecase, node, …) |
| `classdiagram/` | Class diagram parser/AST |
| `sequencediagram/` | Sequence diagram |
| `activitydiagram3/` | Activity (beta) diagram |
| `statediagram/` | State diagram |
| `command/` | Command grammar — how each keyword line is parsed and dispatched |
| `style/`, `skin/`, `theme/` | skinparam / style / theme resolution |
| `preproc/`, `preproc2/` | Preprocessor (`!include`, `!define`, …) |
| `tim/` | TIM preprocessor — `!define`/`!procedure`/`!function`/`!foreach`, 76 builtins, `CodeIterator` chain, expression evaluator |
| `dot/`, `sdot/` | dot emission; `sdot` = Smetana (Java transpile of graphviz dot) |
| `svg/` | Low-level `SvgGraphics` emitter — the SVG-conformance oracle |

### ⚠ Not everything lives under `net/sourceforge/plantuml/`

**Grep `src/main/java/net/`, never just `src/main/java/net/sourceforge/plantuml/`.**
Scoping a search to the table above will silently miss code and produce
confidently wrong conclusions. This has already cost one multi-hour dead end:
`WithLinkType.isSingle` was declared "dead code upstream" on the strength of a
"full-tree grep" that was actually scoped to `net/sourceforge/plantuml/` — the
live call site is in `net.atmp`, and the real mechanism went undiagnosed
(`.agent-notes/silito-78-definelong.md`).

| Root | Contents |
| --- | --- |
| `net/atmp/` | **`CucaDiagram.java`** — the shared base of the whole cuca family (`ClassDiagram`, `StateDiagram`, `DescriptionDiagram`, object all inherit it via `AbstractEntityDiagram`). Owns `addLink`/`containsSimilarLink`. The single most load-bearing class outside the table above, and the target of mission SI1. Also `PixelImage`, `SpecialText`, `SvgOption`. |
| `gen/lib/`, `smetana/` | The graphviz→Java transpile (Smetana). Read the graphviz **C** instead — see Reference Corpora. |
| `h/`, `zext/`, `jcckit/`, `com/`, `org/` | Vendored third-party + transpile support. |

For the dot layout algorithm itself, prefer the graphviz C source (see Reference
Corpora below) over `sdot`/Smetana's mangled transpile — this port's dot pipeline
is graphviz-ts. Every ported symbol carries a JSDoc `@see` to its Java origin,
e.g. `/** @see .../svek/SvekEdge.java#solveLine */`.

## The long tail is the deliverable (YAGNI does not apply)

This port's value lives almost entirely in PlantUML's accumulated special cases —
arrow styles, label positions, layout quirks, rendering decisions that took 16
years to discover and encode. The simple, general implementation of any diagram
type is worth ~nothing: users already have it from upstream via Java. The
trailing 20% of behavior IS the product.

So the 80% solution is not a milestone — it's the starting condition before real
work begins. This inverts normal practice, and it overrides YAGNI / KISS /
"simplify / clean up" for **diagram behavior, rendering, and parser edge cases**.
(Those principles still apply to the infrastructure around the port — build
tooling, test harness, CI.)

- Never propose skipping an edge case, deferring an obscure feature, or
  simplifying away a special-case branch. If a behavior appears in upstream's
  fixtures or docs, it is in scope.
- Upstream's `.puml` corpus is the spec and the work queue, not a post-hoc
  validation suite — every fixture encodes a real case someone hit.
- The bar is "pleasing aesthetic alignment with upstream," not "produces a
  correct diagram." Layout, spacing, label placement, edge routing, and styling
  all count; a structurally-correct diagram that looks worse than upstream is a
  regression.
- Don't optimize for time or space. The Java's complexity reflects the problem,
  not accident — match it unless a behavior is verified preserved.

## Porting discipline: working with an accreted codebase

Standard porting practice — translate, clean up, modernize — destroys the value
being ported at this scale. These rules override general code-quality instincts.

### Upstream architecture is authoritative — and rewrites are allowed

Upstream's **architecture** is authoritative, not just its output and names:
which engine owns which syntax, where parser/module boundaries sit, how diagram
types dispatch. When plantuml-ts split or merged engines differently from
upstream, that structural divergence is itself the bug — re-mirror upstream's
structure rather than patch symptoms with more special-case branches.

Example: upstream routes every descriptive/deployment keyword (`actor component
usecase node package interface rectangle entity …`) through one engine
(`DescriptionDiagramFactory` → `CommandCreateElementFull.ALL_TYPES`). plantuml-ts
scattered these across separate `component` + `usecase` plugins with incomplete
coverage, so `class`/`sequence` `accepts()` steal the leftovers and deployment
diagrams collapse into the class renderer. The fix is consolidation to match
upstream's engine boundary — not more `accepts()` patterns on the diverged
structure.

So it's explicitly OK to look at a plantuml-ts file, say "hell no," and rewrite
it from scratch to mirror upstream. "Do not refactor while porting" (below)
guards *faithfully-ported* behavior from loss; it does not protect local code
that was never faithful. Verify upstream's real boundary in `~/git/plantuml`
before proposing the new structure.

### Do not refactor while porting

Port the Java faithfully, including code that looks redundant, awkward, or dated.
**Don't propose cleanups, simplifications, or modernizations during the port.** A
branch that looks redundant probably handles a case that surfaces in the corpus
months from now; refactored away it's gone, undetectable, and reappears later as
an unattributable regression. The asymmetry is severe: preserving awkward code
costs little now; losing a special case costs a lot later. Refactor only once
tests exist that would catch the loss — in practice, well past the initial port,
if ever.

Example: `DotPath#simulateCompound` (spline↔cluster clipping, `spline-clip.ts`)
finds the boundary crossing with 8 fixed midpoint subdivisions
(`XCubicCurve2D#subdivide`), discarding the straddling sliver. That looks
replaceable by a cleaner bisection-to-convergence — but the oddity is
load-bearing: the jar computes *that* 1/256-granular point, so a more precise
crossing fails the ±0.01pt conformance bar. When an upstream algorithm looks
replaceable, first check whether the jar's exact numeric output depends on its
granularity.

### Preserve upstream names, including the ugly ones

Match upstream class/method/variable names and file organization. Names like
`CommandActivityLegacy1` or `EntityDescriptor` are load-bearing — they're how the
maintainer thinks and how 16 years of commits, issues, and forum posts reference
the code. Renaming severs that: grepping upstream's source and tracker for the
same identifier is the difference between a 10-minute and a multi-day
investigation. **Don't rename for clarity, idiom, or style.**

### Build deep before wide

Complete one diagram type end-to-end (parser → preprocessor → layout → renderer →
output) before starting the next; don't build by horizontal layer. Special cases
cluster at *layer interactions*, not within layers — building vertically surfaces
each in context where it's diagnosable, instead of all at once during late
composition. The first type also hardens the harness and agent rules; later types
go faster for it.

### Test for layer interactions, not just features

Most complexity is "what happens when feature A meets feature B in context C with
skinparam D," not "does A work." Per-feature tests pass while the diagram is
broken because the bug lives in the interaction. **Prefer upstream fixtures over
synthesized inputs** — upstream's are combinatorial (they came from real
combinatorial bugs); fresh single-feature tests give false confidence.

### Preserve behavior; diverge only deliberately

The goal isn't faithful reproduction — it's **lower-friction PlantUML for the
JS/TS ecosystem.** Upstream is the behavior reference, not the quality ceiling.
Split upstream behavior into two kinds:

- **Information-carrying output — preserve.** Diagram structure, label placement
  that disambiguates, layout that reflects source order, colors that distinguish
  element types — anything carrying what the user put there. Users depend on it,
  sometimes for years; diverging silently breaks their diagrams. This includes
  behavior that *looks* like a bug but produces output (a weird arrow when two
  stereotypes combine may be load-bearing). Default to "intentional" when unsure.
- **Incidental rendering — may improve, deliberately.** Clunky default styling,
  awkward spacing, dated visuals that accumulated rather than were designed are
  the friction this port exists to reduce. Diverging here is the project doing
  its job — but it's a conscious, documented decision (`DIVERGENCES.md`, a code
  comment, or the commit message), never an opportunistic mid-port cleanup.

Never fix apparent upstream bugs case-by-case inline: each fix looks defensible,
but the aggregate is a port that silently differs for unpredictable inputs —
worse than either a faithful port or a deliberate fork. A bug worth fixing
becomes a named divergence flagged for the human maintainer, not a quiet
correction. Test: *would a long-time PlantUML user be surprised?* Surprise at
reduced friction is the point; surprise at changed meaning is a regression.

## Reference Corpora & layout source

`~/git/pdiff/` — primary fixture corpus, 5600+ `.puml` (one per upstream issue),
each a JSON metadata header then the diagram. The work queue: if a behavior
appears here, it's in scope.
- `~/git/pdiff/input/` — ~42 named, curated fixtures
- `~/git/pdiff/dbhum/` — ~5599 hashed fixtures, one per issue

`tests/corpus/` — 4400+ fixtures classified by diagram type from pdiff + the
plantuml nonreg suite. Gitignored (regenerate: `python3 scripts/populate-corpus.py`);
local reference, don't commit.

Layout engine — use the graphviz C source directly (authoritative):
```
~/git/graphviz/lib/dotgen/
  rank.c        ← rank assignment (network simplex)
  mincross.c    ← crossing minimization (WMEDIAN + transpose)
  position.c    ← x/y coordinate assignment
  dotsplines.c  ← edge routing (spline / polyline)
  acyclic.c     ← cycle removal
```
Smetana (`~/git/plantuml/.../gen/lib/dotgen/`) is a mechanical Java transpile of
graphviz 2.38 — same algorithm, no comments, mangled names. Prefer the C.

## Translation Rules (Java → TypeScript)

| Java | TypeScript |
| --- | --- |
| `int`, `long` | `number` (mind precision > 2^53) |
| `double`, `float` | `number` |
| `String` | `string` |
| `byte[]` / `char[]` | `Uint8Array` (bytes) / `string` (text) |
| `class Foo` (plain data) | `interface Foo` |
| `class Foo` (behavior/identity) | `class Foo` |
| `enum` | `enum`, `const enum`, or string-literal union |
| generics `Foo<T>` | generics `Foo<T>` |
| `null` | `null` or `undefined` (prefer `undefined` for optional fields) |
| `static final` constant | module-level `const` (`UPPER_SNAKE_CASE`) |
| `Optional<T>` | `T \| undefined` |
| checked exception | thrown `Error` subclass, or a `Result`-style return |

Java and TS share a GC model, so most translation is direct. Prefer immutable
data where the Java builds then only reads a structure (`DotPath` — `addCurve`
returns a new path); where it mutates in place (layout passes), use mutable
objects and document the mutation contract.

## Quality Gates

```sh
npm test              # vitest + coverage (90/90/90 thresholds)
npm run typecheck     # tsc --noEmit (both tsconfig.json + tsconfig.node.json)
npm run lint          # eslint src tests demo
npm run build         # vite library build
```

All four must pass before any commit lands on main.

## Architecture Notes

- Pure SVG renderer — no DOM, no async, no canvas. This library must run in a
  browser: in `src/`, never use Node built-ins (`fs`, `path`, `os`,
  `child_process`), `process.env` (pass a config/options object instead),
  `require()` (ES `import` only), or blocking I/O. If the Java reads a file
  (font metrics, `!include`), expose it as a parameter/callback
  (`include-resolver.ts`, the measurer seam).
- No `Date.now()` / `Math.random()` in rendering paths — every non-determinism
  (uid counters, gradient/shadow ids) is seeded so output is reproducible.
- Layout pipeline: `parse → layout (dot engine) → render (SVG string)`.
- `CONTAINER_KINDS` appears in both `layout.ts` and `renderer.ts` — keep them in
  sync. Container nodes with **no children** are treated as leaf nodes for both
  layout and rendering.
- `svgRoot` in `src/core/svg.ts` embeds all arrowhead marker `<defs>`
  automatically — edges need only `markerEnd: url(#<ref>)`.
