# svg-state conformance ratchet

Regression-proof gate for state diagrams (`src/diagrams/state/`), mission
G4. Unlike object (G3, which has no separate engine upstream and reuses
the class pipeline), state diagrams DO have a dedicated upstream package
(`statediagram/`, `StateDiagram extends AbstractEntityDiagram extends
CucaDiagram` — `net/atmp/CucaDiagram.java`) and a dedicated port pipeline
(`parseState` -> `layoutState` -> `renderState`,
`src/diagrams/state/{parser,layout,renderer}.ts`). A fixture ratchets in
once it renders byte-for-byte identical to the jar oracle under a
**deterministic** text measurer; the ratchet test then holds it forever.
See `tests/oracle/svg-conformance/state.golden.ratchet.test.ts`.

## Why a deterministic measurer, not production

Same rationale as `oracle/goldens/svg-class/README.md`,
`oracle/goldens/svg-object/README.md`, and
`oracle/goldens/svg-description/README.md`: production (`renderSync`)
always measures text with `jarMeasurer` (AWT font metrics via the cached
jar), a pre-existing, already-documented apples-to-oranges gap (D12), not
evidence of a rendering bug. This ratchet uses a NEW, state-scoped render
helper, `tests/oracle/svg-conformance/render-fixture-state.ts
#renderFixtureState` — state has its own engine, so (unlike object) it
cannot reuse `render-fixture-class.ts` verbatim. `renderFixtureState`
mirrors `render-fixture-class.ts` procedurally, with two simplifications
noted in its own doc comment: `StateDiagramAST` has no `.pages` field (no
multi-page stripping needed), and `renderState` never sets
`RenderFragment.preChromeWidth` (no post-chrome document-margin
re-application needed).

## Layout

```
oracle/goldens/svg-state/
  ratchet.json                 <- the manifest (source of truth for CI)
  README.md                    <- this file
  <slug>/
    in.puml                    <- fixture source (committed, offline)
    golden.svg                 <- committed jar SVG, copied verbatim from
                                   test-results/dot-cache/state/<slug>/in.svg
```

State fixtures have no `<type>` subdirectory level (mirrors svg-class/
svg-object, not svg-description's `<type>/<slug>/`) — every entry here is
drawn from the `state` dot-cache bucket. `in.puml` and `golden.svg` are
committed copies so the ratchet test runs fully offline — no dependency
on the gitignored, regenerable `test-results/dot-cache/` tree at test
time.

## Current state (G4/S0, 2026-07-20)

**0 fixtures pinned — TRUE baseline is 0/271 zero-diff.** State DOT sits
at 267/267 STRUCTURALLY EQUAL among the fixtures the jar itself classifies
`data-diagram-type="STATE"` (frozen gate, unchanged since G0); the SVG
census corpus is the FULL `test-results/dot-cache/state/` bucket, 271
fixtures (same "count all cache-dir fixtures, not just the tag-classified
subset" convention `svg-conformance-census.ts` already used for
`object`'s 80, per G3/O0's own `gizini-87-vuve916` precedent).

Every one of the 271 fixtures — including the SINGLE-STATE, ZERO-
transition trivial case (`jocela-05-niba392`, `state state1 #red`) —
diffs on the SAME root-level attribute family, confirmed by hand-probing
several fixtures (not just reading the aggregate census): `renderState`
routes through the GENERIC `svgRoot()` shell (`core/svg.ts`), not the
CucaDiagram-family document shell class/object already use
(`assembleDocumentShell`, `core/klimt/document-shell.ts`, parameterized
by `data-diagram-type` — reused verbatim by
`class/renderer-shell.ts#assembleClassShell` with `'CLASS'`). This means
every state fixture is missing `xmlns:xlink`, `version="1.1"`,
`data-diagram-type="STATE"`, the `style="width:...px;height:...px;
background:...;"` attribute, `zoomAndPan="magnify"`,
`preserveAspectRatio="none"`, `contentStyleType="text/css"`, and the
`<?plantuml $version$?>`/`<?plantuml-src ...?>` processing instructions —
9 root-level attribute families at 271/271 reach (`svg/@contentStyleType`,
`@height`, `@preserveAspectRatio`, `@version`, `@viewBox` (x2 per fixture,
width+height), `@width`, `@xmlns:xlink`, `@zoomAndPan`, plus `@background`
at 270/271).

This SAME family also drives `svg[childCount]` mismatch at 271/271
reach, which is NOT primarily a shell issue: jar wraps its entire body in
exactly ONE outer content `<g>` (itself containing per-entity/per-cluster
`<g class="entity"|"cluster"|"start_entity"|"end_entity"|"link"
data-qualified-name="..." id="..." data-source-line="...">` wrapper
groups) so `<svg>` has exactly 2 element children (`<defs/>`, `<g>`).
`renderState`'s own `body` is a FLAT concatenation of top-level
`rect`/`text`/`line`/`path`/`ellipse`/`polygon` markup with NO `<g>`
wrapping at ANY level (no outer content `<g>`, no per-entity `<g>`) —
`svgRoot()` then splices `<defs>` + a redundant background `<rect>` +
that flat body directly as `<svg>`'s own children, so childCount is
wildly higher than jar's for any fixture with more than a trivial number
of nodes. This is a STRUCTURAL rendering-shape gap, not a cosmetic one —
`compareSvg`'s own childCount check short-circuits recursion into
children the moment counts disagree (`compare.ts:317-325`), so the
census's family table is BLIND to any deeper per-element diff for every
single state fixture; nothing below the root is currently measurable.

A THIRD, independent mechanism was also confirmed by hand-probe: jar
draws arrowheads as inline per-edge `<polygon>` elements (no `<defs>`
markers at all — `<defs/>` is empty in every sampled fixture), matching
`assembleDocumentShell`'s own doc comment ("every klimt-shaped engine
draws its own arrowheads as inline polygons/paths, never an SVG
`<marker>`") — `renderState` instead emits `<marker id="arrow-sync">`/
`<marker id="arrow-sync-back">` defs and (presumably) `marker-end`
references, a materially different arrowhead-drawing mechanism.

A FOURTH, independent mechanism: raw canvas dimensions differ even on
the single-state trivial fixture with no transitions at all
(`jocela-05-niba392`: ours 70.0625x62, jar 80x71 — a ~9-10px margin
difference on both axes) — a document-margin/ink-extent computation gap,
analogous to (but not yet confirmed identical to) class's own
`applyClassDocumentMargin`/`layout-ink-extent.ts` mechanism (G2 N5).

None of these four mechanisms is a small, bounded, single-fixture-scale
fix — landing any ONE of them in isolation would not move ANY fixture to
zero-diff (the OTHER three would still produce diffs), so S0 explicitly
did NOT attempt a stretch fix (per this iteration's own mission
instruction: "skip if it isn't clearly bounded"). All four are named
here, jar-verified, for the S1+ queue. See
`plans/g4-state-svg/ledger.md` S0 for the full sampled-fixture evidence
(15+ fixtures spanning fork/join, history, concurrent regions, notes,
choice pseudostates, skinparam overrides) and the fixture-family
breakdown.

## Add rule

A fixture may be added to `ratchet.json` only when **both** hold:

1. **Conformant** — rendering the fixture's `in.puml` through
   `renderFixtureState` with `DeterministicMeasurer` produces an SVG that
   is zero-diff (`compareSvg(ours, golden, 'deterministic').pass === true`)
   against the jar's `in.svg`.
2. **DOT-EQUAL** — the fixture's DOT emission is structurally `EQUAL`
   against the oracle DOT, enforced via
   `tests/oracle/svg-conformance/parity-state.json`
   (`npx jiti scripts/svg-parity-survey.ts --out tests/oracle/svg-
   conformance/parity-state.json state`, additive `--out`/positional-type
   args, does NOT touch the shared component/usecase `parity.json` or
   class's/object's own `parity-class.json`/`parity-object.json`).

To add a slug:

1. Confirm both conditions above (e.g. via `npx tsx scripts/svg-
   conformance-census.ts state` and `parity-state.json`).
2. Copy `test-results/dot-cache/state/<slug>/in.puml` and `in.svg` into
   `oracle/goldens/svg-state/<slug>/` (renaming `in.svg` to `golden.svg`).
3. Append `{ slug, addedAt, source: "dot-cache" }` to `ratchet.json`.

## Remove rule

Removal is **maintainer-only** — see `oracle/goldens/svg-description/
README.md`'s identical rule; the same rationale applies verbatim.
