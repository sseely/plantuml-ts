# G4 ledger

## S0 — harness stand-up, TRUE baseline, four-mechanism diagnosis

### Harness

`scripts/svg-conformance-census.ts`'s `renderFixtureFor` now dispatches
`state` to a NEW `tests/oracle/svg-conformance/render-fixture-state.ts
#renderFixtureState` helper — state has its own dedicated upstream engine
(`statediagram/`, confirmed via `.claude/catalog.md`'s own "State —
`src/diagrams/state/`" entry and `src/diagrams/state/index.ts`'s
`statePlugin` registration), so this is a genuinely NEW pipeline dispatch
(`parseState -> layoutState -> renderState`), unlike G3/O0's object
dispatch (which reuses `render-fixture-class.ts` verbatim because object
has no separate engine upstream). `renderFixtureState` mirrors
`render-fixture-class.ts` procedurally with two simplifications, both
confirmed by direct inspection before writing the helper (not assumed):
`StateDiagramAST` (`src/diagrams/state/ast.ts:310`) has no `.pages`
field at all, so G2 N28's multi-page-stripping logic does not apply;
`renderState` (`src/diagrams/state/renderer.ts:237`) never sets
`RenderFragment.preChromeWidth` (grepped, zero matches), so the
post-chrome `applyClassDocumentMargin` re-application is a guaranteed
no-op and is omitted, matching `src/index.ts#applyAnnotationChrome`'s own
generic branch for a plugin whose `preChromeWidth` stays `undefined`.

`scripts/svg-parity-survey.ts` needed **zero code changes** — it already
dispatches generically via `renderSync`'s production plugin registry
(`options.measurer` injected, `plugin = registry.resolve(umlSource)`),
and the `--out <path> <type...>` CLI surface was already made additive
and type-agnostic at G2/N0. Ran directly:
`npx jiti scripts/svg-parity-survey.ts --out tests/oracle/svg-
conformance/parity-state.json state` — 271/271 fixtures surveyed,
267/271 `dotEqual: true` (matches the frozen DOT gate's 267/267 exactly:
the 4 `dotEqual: false` entries are fixtures the jar itself does NOT
classify `data-diagram-type="STATE"`, same "corpus bucket ≠ tag-filtered
subset" situation G3/O0 named for object's `gizini-87-vuve916`), 0/271
`conformant`/`structural-match` (all 271 `diverged`).

`oracle/goldens/svg-state/` stood up (`ratchet.json` with an empty
`fixtures: []` array + `README.md`, mirrors `svg-object`'s flat layout:
no `<type>` dimension). `tests/oracle/svg-conformance/
state.golden.ratchet.test.ts` mirrors `object.golden.ratchet.test.ts`
procedurally, with ONE deliberate deviation from that file's AC3-deferred
placeholder: object's O0 never ran an unsurveyed-placeholder-vs-real
distinction (O0 seeded 5 fixtures same-iteration, so the 0-fixture branch
was never exercised); state's S0 DOES exercise it, and
`parity-state.json` is a REAL, populated 271-entry survey, not an empty
placeholder — the AC3-deferred assertion was written to match that
(`expect(parity.fixtures.length).toBeGreaterThan(0)` +
`expect(manifest.fixtures).toHaveLength(0)`), not copied verbatim from
object's `toHaveLength(0)` (which would have been FALSE and failed the
test if copied literally).

### TRUE baseline (before any fix)

`svg-conformance-census.ts state` (DeterministicMeasurer):
`0/271 -- 1-3:0 -- 4-10:1 -- 11-30:270 -- 31+:0 -- errors:0`. Every
single fixture — including the absolute-simplest possible corpus member,
`jocela-05-niba392` (`state state1 #red`, one state, zero transitions) —
is non-conformant. This is qualitatively different from every prior
mission's own O0/N0 baseline (description 48/355, class-fresh-cache
0/718 pre-N5, object 1/80): state's baseline shows NO variance in WHICH
top-level attribute families fail, across 271 wildly different fixtures
(fork/join, composite/nested states, concurrent regions, history
pseudostates, notes, choice, skinparam overrides, math/creole bodies) —
strong, immediate evidence of a small number of TOTALLY GLOBAL mechanism
gaps rather than per-feature drift.

### Diagnosis: four independent, jar-verified mechanisms

Per `~/.claude/rules/diagnosis.md`: instrumented before hypothesizing —
every claim below is backed by a direct hand-probe (a disposable
`scripts/_tmp-s0-probe*.ts`, deleted before this iteration finished) of
at least 2 fixtures per mechanism, not inferred from the census's
aggregate family table alone (which, per mechanism 2 below, is
ITSELF blind past the root level for every single fixture).

#### Mechanism 1: generic `svgRoot()` shell instead of the CucaDiagram-family document shell

**Mechanism**: `renderState`'s `RenderFragment` carries no shell-routing
flag (`classShell`/`klimtShell`), so `src/index.ts#assembleSvg`'s
fallthrough (`return svgRoot(fragment.width, fragment.height,
[fragment.body], fragment.background, fragment.extraDefs);`) is what
assembles every state SVG's root — the SAME generic `core/svg.ts
#svgRoot` used by any engine that hasn't opted into a document-shell
variant. Jar's actual state-diagram root shell is the CucaDiagram-family
shape (`xmlns:xlink`, `version="1.1"`, `data-diagram-type="STATE"`, a
`style="width:...px;height:...px;background:...;"` attribute,
`zoomAndPan="magnify"`, `preserveAspectRatio="none"`,
`contentStyleType="text/css"`, a `<?plantuml $version$?>` processing
instruction right after the opening tag, and a `<?plantuml-src ...?>`
trailing PI carrying the deflate-encoded source) — this port ALREADY
built the exact shell state needs, `core/klimt/document-shell.ts
#assembleDocumentShell(fragment, diagramType)`, generically parameterized
by `data-diagram-type` (G2 N1) and already reused verbatim by
`class/renderer-shell.ts#assembleClassShell` (passing `'CLASS'`) — state
was simply never wired to call it.

**Origin**: `src/diagrams/state/renderer.ts#renderState` (never sets a
shell-routing flag on its returned `RenderFragment`); `src/index.ts
#assembleSvg:157-162` (falls through to the generic `svgRoot` for any
fragment without `classShell`/`klimtShell`).

**Causal chain**: hand-probed `jocela-05-niba392` (trivial, 1 state, 0
transitions) and `bajelo-54-dixe684` (nested composite, 8 entities, 3
links) directly: our root `<svg>` opens `<svg xmlns="http://www.w3.org/
2000/svg" width="..." height="..." viewBox="...">` (exactly `svgRoot`'s 4
attributes); jar's opens with all 9 of `xmlns`, `xmlns:xlink`, `version`,
`data-diagram-type`, `style`, `width`, `height`, `viewBox`, `zoomAndPan`,
`preserveAspectRatio`, `contentStyleType` (11 attrs total) plus the
`<?plantuml $version$?>` PI immediately after. Every one of these 9
missing/differing sub-attributes shows up as its own diff path in
`compareSvg`'s output (`svg/@contentStyleType`, `svg/@height` [see
mechanism 4 for WHY the height value itself also differs, a second,
independent cause layered on the same attribute], `svg/@preserveAspectRatio`,
`svg/@version`, `svg/@width`, `svg/@xmlns:xlink`, `svg/@zoomAndPan`) —
7 of the 9-10 diffs present on literally every one of the 271 fixtures.

**Ruled out**: NOT a per-fixture content bug — reproduced identically on
the simplest possible (0-transition, 1-state) and a moderately complex
(nested composite, 8-entity) fixture, with the SAME 7 attribute paths
diffing in both. NOT a DOT-emission bug (state DOT gate unaffected,
267/267 unchanged, re-verified after this iteration's harness changes —
this diagnosis touches no production code yet, only measurement).

**Fix**: NOT LANDED this iteration (see "Assessed and explicitly
deferred" below for why). Path for S1: add a `stateShell?: true` (or
similarly-named) flag to `RenderFragment` (`core/dispatcher.ts`), wire
`assembleSvg` to route it through a new, minimal `assembleStateShell`
(mirrors `assembleClassShell`'s OWN thin wrapper around
`assembleDocumentShell(fragment, 'STATE')` — state's own sample data
shows NO `documentBackgroundRect`/`diagramBorderColor` splice needed,
unlike class's own two class-specific decorations, so this should be
SIMPLER than `assembleClassShell`, not a 1:1 port of it), and set the
flag in `renderState`'s own return.

#### Mechanism 2: no outer/per-entity `<g>` wrapping — the census's own blind spot

**Mechanism**: jar wraps a state diagram's ENTIRE body in exactly ONE
outer content `<g>` (immediately after `<defs/>`), and every entity/
cluster/link within it in its OWN `<g class="entity"|"cluster"|
"start_entity"|"end_entity"|"link" data-qualified-name="..." id="..."
data-source-line="..." [data-entity-1="..." data-entity-2="..."
data-link-type="..."]>` wrapper (confirmed directly from
`bajelo-54-dixe684`'s cached `in.svg`: `<g><g class="entity" data-
qualified-name="Track_FSM" id="ent0001" ...>`). `renderState`'s own
`body` (`src/diagrams/state/renderer.ts:237-260`) is a FLAT string
concatenation — one background `<rect>`, then each node's raw
`rect`/`text`/`line`/`path`/`ellipse`/`diamond` markup via `renderNode`,
then each transition's raw `path`+`text` via `renderTransition` — with
**zero** `<g>` wrapping at any level. `svgRoot()` then splices `<defs>` +
its own redundant background `<rect>` + that flat body directly as
`<svg>`'s children, so `<svg>`'s element-child count is wildly higher
than jar's fixed 2 (`<defs/>`, one `<g>`) for any fixture with more than
a trivial number of nodes.

**Origin**: `src/diagrams/state/renderer.ts#renderState:237-262` (flat
`children.push(...)`/`children.join('')`, no `<g>` wrap of any kind);
transitively, `core/svg.ts#svgRoot` (splices `fragment.body` as direct
`<svg>` children rather than a single wrapped `<g>` — though this half is
shared with mechanism 1 and would already be subsumed by that fix's
`assembleStateShell`/`group(fragment.body)` wrap, mirroring
`assembleClassShell:115`'s own `group(fragment.body)` call).

**Causal chain**: `svg[childCount]` diffs on **271/271** fixtures — the
single highest-reach family in the census's `--families` output, tied
with the mechanism-1 attribute families. Critically, `compareSvg`'s own
`compareNodes` (`tests/oracle/svg-conformance/compare.ts:317-325`)
**stops recursing the moment a childCount mismatch is found**
(`return; // structural mismatch — stop recursing into children`) — so
for every one of the 271 state fixtures, the census's family table is
reporting ONLY the root-`<svg>`-level diffs; it is structurally BLIND to
whatever is (or isn't) different inside the content once mechanisms 1+2
are fixed. This is why S0's family table has exactly 9-10 rows total
(not hundreds) despite 271 highly heterogeneous fixtures — the real
per-feature (fork/join, history, concurrent, notes, choice) diff surface
is entirely unmeasured as of this baseline.

**Ruled out**: NOT purely a mechanism-1 side effect — even after
mentally subtracting mechanism 1's 7 attribute diffs, `svg[childCount]`
and the `svg/@viewBox`/`@width`/`@height` diffs (dimension-driven, see
mechanism 4) would remain; confirmed by inspecting `renderState`'s own
source directly (not inferred from the diff alone) that no `<g>` wrap
exists anywhere in its output.

**Fix**: NOT LANDED this iteration. Path for S1: wrap `renderState`'s
overall `body` in a single `<g>` (subsumed by mechanism 1's
`assembleStateShell`/`group()` call, IF that lands first), AND wrap each
node/link in its own `<g class="..." data-qualified-name="..." id="...">`
— a genuinely new per-entity-id-and-qualified-name-threading feature
(`renderNode`/`renderTransition` currently receive `StateNodeGeo`/
`TransitionGeo`, neither of which currently carries an `id`/qualified-
name/source-line field — this needs threading from `layoutState`/the AST
forward, a materially bigger lift than mechanism 1 alone). THIS is the
priority-1 S1 item: until it lands, NO fixture's real per-feature
rendering fidelity is even measurable via `compareSvg`, regardless of
what else gets fixed.

#### Mechanism 3: arrowhead-drawing mechanism (`<marker>` defs vs inline `<polygon>`)

**Mechanism**: jar draws every transition's arrowhead as an inline,
per-edge `<polygon points="...">` sibling of the edge's own `<path>` —
`<defs/>` is EMPTY in every sampled jar fixture (confirmed on
`bajelo-54-dixe684`, `jocela-05-niba392`, and 6 more of the 16 sampled
fixtures below), matching `core/klimt/document-shell.ts
#assembleDocumentShell`'s own doc comment: "No `ALL_ARROW_TYPES`
marker-def injection (every klimt-shaped engine draws its own arrowheads
as inline polygons/paths, never an SVG `<marker>`)". `renderState`
instead emits `<marker id="arrow-sync">`/`<marker id="arrow-sync-back">`
elements inside `<defs>` (confirmed via direct probe of
`bajelo-54-dixe684`'s rendered output) — a materially different
arrowhead-drawing mechanism from what jar (and every other already-built
engine in this port) uses.

**Origin**: `src/diagrams/state/renderer.ts` (the transition-arrow
drawing path — not yet traced to its exact function, since this
mechanism was named via output inspection, not a source-level function
read, given this iteration's harness-only scope). `core/svg.ts#svgRoot`
also contributes: it unconditionally injects `ALL_ARROW_TYPES` marker
defs for ANY fragment routed through it (visible even on
`jocela-05-niba392`, which has ZERO transitions and therefore zero
possible arrowhead use, yet still gets `<marker>` defs in `<defs>` — a
`svgRoot`-level default, not state-specific).

**Ruled out**: NOT the SAME diff as mechanism 1 — `<defs>` CONTENTS never
appear in the family table at all, because mechanism 2's childCount
short-circuit prevents `compareSvg` from ever descending into `<defs>`'s
own children to report a diff on it. Named here as an INDEPENDENT,
jar-verified mechanism (not a hypothesis) purely via direct string
inspection of both sides' raw output, not via any `compareSvg` diff path
(there isn't one yet, per mechanism 2).

**Fix**: NOT LANDED. Path for S1/S2: once mechanism 2 unblocks real
per-element diffing, confirm whether ANY fixture's arrowhead visually
differs under `<marker>`-ref vs inline-`<polygon>` — if not (both render
identically as SVG, just via different DOM shapes), this may resolve
itself as a side effect of switching state's edge-drawing to emit inline
polygons directly (matching the class/description engines' own,
already-correct convention) rather than needing an isolated fix.

#### Mechanism 4: document-margin / ink-extent computation gap

**Mechanism**: raw canvas dimensions differ from jar even on the
absolute-simplest fixture with no transitions, no composite states, no
skinparam overrides at all. `jocela-05-niba392` (`state state1 #red`):
ours renders `width="70.0625" height="62"`; jar's is `width="80px"
height="71px"` — a ~9-10px difference on BOTH axes, present even though
this fixture has exactly one leaf state and no other content to
mis-measure.

**Origin**: not yet traced to a specific function this iteration (S0 is
harness-scoped, no fix attempted) — most plausibly somewhere in
`src/diagrams/state/layout.ts`'s document-dimension computation
(`layoutFlat`/`layoutComposite`'s `totalWidth`/`totalHeight` derivation)
or a missing document-margin post-processing step analogous to class's
own `layout-ink-extent.ts#applyClassDocumentMargin` (G2 N5) — state has
no equivalent function today (grepped `src/diagrams/state/*.ts` for
`DocumentMargin`/`applyClassDocumentMargin`, zero hits).

**Causal chain**: hand-probed `jocela-05-niba392` directly (the smallest
possible corpus member, chosen specifically to rule out any interaction
with edges/composite sizing/other mechanisms): our leaf-node layout
already places the single state's own box correctly (a 58.0625×50 box
starting near the origin, matching the box DIMENSIONS jar itself draws
for the same state — `width="58.0625" height="50"` in jar's own
`in.svg`), so the per-node sizing math is right; the GAP is specifically
in how the surrounding document canvas is sized around that box (a
margin/padding difference of ~9-10px per axis, both larger on jar's
side).

**Ruled out**: NOT the same mechanism as 1/2/3 — isolated by choosing the
single fixture in the ENTIRE 271-fixture corpus with the fewest possible
confounding features (no transitions → mechanism-3's arrowhead question
is moot; no composite/concurrent/history → no additional layout
complexity to misattribute the gap to). NOT a text-measurement issue —
the state's OWN box width (58.0625, derived from measuring "state1" at
14pt) already matches jar's identically-labeled box exactly, ruling out
`DeterministicMeasurer` disagreement as the cause.

**Fix**: NOT LANDED. Path for S1: instrument `layoutState`'s document
dimension computation directly (not yet done this iteration — S0 named
the gap via probing OUTPUT, not by reading `layout.ts`'s dimension code)
against 2-3 more zero-transition, zero-composite fixtures to confirm the
~9-10px margin is a CONSTANT offset (suggesting a simple missing-margin
fix) rather than a percentage/scale factor (which would need a different
mechanism entirely).

### Assessed and explicitly deferred: the stretch fix

Per this iteration's own instruction ("if the survey shows one dominant
cheap mechanism ... land it TDD-first ... Skip if it isn't clearly
bounded"): mechanism 1 alone IS dominant (271/271 reach) but landing it
in isolation would not move the census's zero-diff count from 0 to
ANYTHING — mechanisms 2, 3, and 4 all independently prevent ANY fixture
from reaching zero-diff regardless of mechanism 1's own fix (confirmed
by choosing `jocela-05-niba392`, the simplest possible candidate: even
after mentally subtracting mechanism 1's 7 attribute diffs, the
`svg[childCount]` diff (mechanism 2) and `svg/@viewBox`/`@width`/
`@height` value diffs (mechanism 4, a REAL dimension gap, not just a
`px`-suffix formatting difference) remain). None of the four mechanisms
is bounded to a single fixture-scale change the way G3/O0's
`headerRows()` fix was (that fix landed +4 zero-diff fixtures
IMMEDIATELY, in the same iteration, because it was the ONLY thing wrong
with those 4 fixtures). Landing mechanism 1 alone here would be
observably unverifiable via the census metric (0/271 before, 0/271
after) — explicitly NOT attempted, per the mission's own "skip if it
isn't clearly bounded" clause, rather than landing an unverifiable
change and claiming progress.

### Sampled fixtures (16, hand-probed or hand-read, spanning every major state feature)

| Slug | Feature(s) | dotEqual | Diff count | Notes |
|---|---|---|---|---|
| `jocela-05-niba392` | trivial (1 state, `#red` color, 0 transitions) | true | 11 | Chosen to isolate mechanism 4 from 2/3 — see that mechanism's writeup |
| `moleco-69-sida106` | trivial (`[*] --> Main_Libre : print(...)`, 1 transition + label) | true | 11 | — |
| `votoki-67-gufa610` | trivial (1 state, multi-line body via `\n`) | true | 11 | — |
| `gefefe-91-xoge233` | trivial (1 transition, empty body line `IDLE :`) | true | 11 | — |
| `gupeto-19-mesa256` | `<math>` (LaTeX/KaTeX) body in a state | true | 11 | — |
| `bajelo-54-dixe684` | nested composite (3 levels), start/end pseudostates, 2 internal transitions | true | 11 | Used for mechanism 1/2's direct-probe evidence (8 entities, 3 links) |
| `cekolo-21-gini183` | EVERY pseudostate stereotype in one fixture: `<<start>>`, `<<choice>>`, `<<fork>>`, `<<join>>`, `<<end>>`, `<<sdlreceive>>`, `<<history>>`, `<<history*>>` | true | 11 | Structural probe: jar draws 5 `<ellipse>`, 3 `<rect>`, 1 `<polygon>`, 1 `<path>` for these 8 pseudostates — a rich shape-fidelity target for S1+, entirely unmeasured today (mechanism 2) |
| `kedibo-23-kopo893` | fork/join with `skinparam ActivityBarColor<<fork\|join>>` | true | 11 | — |
| `butigu-57-tobi481` | composite + history pseudostate (`[H]`), `Comp[H]` shorthand entry | true | 11 | — |
| `diteme-18-favi840` | composite + `<<entrypoint>>` + history | true | 11 | — |
| `darime-88-moda428` | concurrent regions (`--`), nested composite | true | 11 | — |
| `cagego-53-vemo516` | concurrent regions (`--`), nested composite | **false** | 11 | One of the 4 corpus fixtures where `dotEqual=false` (pre-existing, out of scope per the frozen DOT gate) — flagged so a future iteration doesn't assume every state fixture is DOT-clean |
| `fakali-52-zuje420` | `skinparam state { ... BackgroundColor<<tag>> ... }` cascade, `<<sdlreceive>>`/`<<sdlsend>>`/`<<rect>>`/`<<choice>>` stereotypes, guarded transitions | true | 11 | Richest single skinparam-cascade fixture sampled |
| `dajipi-09-doki542` | composite, `[[URL]]` links on states, `note left/right of X [[URL]]` | true | 11 | Notes + URL feature combination |
| `fotigo-12-gufu949` | `note on link` (both block form and inline `: text` form), per-note color | true | 11 | — |
| `kujuzo-76-bavi505` | `skinparam backgroundcolor transparent`, `#red\|yellow` split-fill state, `note right #black-yellow` | true | **10** | The ONE fixture whose diff count differs from the other 15 — `svg/@background` doesn't fire because BOTH sides already agree (transparent), confirming mechanism 1's `@background` sub-diff is entirely explained by opaque-vs-transparent skinparam state, not a separate bug |

Every one of these 16 — spanning trivial/1-state, every pseudostate
stereotype, 3-level nesting, concurrent regions, history (both forms),
notes (3 forms), URLs, skinparam cascades, and LaTeX bodies — shows the
EXACT SAME 4-mechanism signature. No 17th distinct mechanism was found
in this sample; the corpus's real diversity is currently invisible below
the root `<svg>` level (mechanism 2).

### Gates (S0, final)

- `state` census: `0/271` zero-diff (`1-3:0, 4-10:1, 11-30:270, 31+:0,
  errors:0`) — this iteration's own TRUE baseline; nothing fixed.
- Class census 294-set: **intact**, unchanged (re-run, byte-identical
  bucket counts).
- Object census 22-set: **intact**, unchanged (re-run, byte-identical
  bucket counts).
- Description census 48-set: **intact** (re-run, byte-identical bucket
  counts).
- DOT gate: `component 262/262 - usecase 90/90 - class 708/708 - object
  78/80 - state 267/267` — EXACTLY unchanged, verified both BEFORE and
  AFTER this iteration's harness changes (a pure test/script-infra
  change touches no production DOT-emission code, but re-verified rather
  than assumed).
- `npm test -- --run`: 9916/9918 passing (363 files, +1 vs pre-S0's 362;
  the 2 "failing-to-pass" are `describe.skipIf` blocks intentionally
  skipped at a 0-fixture ratchet baseline, matching every prior mission's
  own precedent for a not-yet-seeded ratchet suite).
- `npm run typecheck` / `npm run lint`: both clean.

### Files changed (S0)

- `scripts/svg-conformance-census.ts` — `renderFixtureFor` dispatches
  `state` to the new helper; doc comment updated.
- `tests/oracle/svg-conformance/render-fixture-state.ts` — NEW (state's
  own low-level render helper, mirrors `render-fixture-class.ts`).
- `tests/oracle/svg-conformance/state.golden.ratchet.test.ts` — NEW
  (mirrors `object.golden.ratchet.test.ts`, 0-fixture baseline).
- `tests/oracle/svg-conformance/parity-state.json` — NEW (271-fixture
  survey, 267 dotEqual=true, 0 conformant).
- `oracle/goldens/svg-state/ratchet.json` — NEW (empty `fixtures: []`).
- `oracle/goldens/svg-state/README.md` — NEW.
- `plans/g4-state-svg/README.md` — NEW (this mission's index).
- `plans/g4-state-svg/ledger.md` — NEW (this file).
- `plans/g4-state-svg/decision-journal.md` — NEW.

### S1+ queue

1. **Mechanism 2 first** (outer/per-entity `<g>` wrapping) — the
   prerequisite unlock; until this lands, `compareSvg` cannot see past
   the root `<svg>` for ANY fixture, so no per-feature work (fork/join
   shape fidelity, history pseudostate rendering, concurrent-region
   layout, note positioning, skinparam cascades) can be verified.
2. **Mechanism 1** (SVG root shell) — should land alongside or
   immediately after mechanism 2, since `assembleStateShell`'s own
   `group(fragment.body)` call is the natural place to add the outer
   `<g>` wrap mechanism 2 needs.
3. **Mechanism 4** (document margin) — instrument `layoutState`'s
   dimension computation directly against 2-3 more zero-transition
   fixtures to confirm the ~9-10px offset is constant before proposing a
   fix shape.
4. **Mechanism 3** (arrowhead drawing) — likely resolves as a side
   effect of 1+2, or needs its own small follow-up; re-assess once
   mechanisms 1/2 land and real per-fixture diffs become visible.
5. Once 1+2+4 land, re-run the census and `--families` report FRESH —
   the current family table is not representative of the real remaining
   surface (mechanism 2's short-circuit hides it), so S1's OWN family
   classification must be re-derived from scratch, not extrapolated from
   S0's table.

## S1 — mechanisms 1-4 landed, mechanism 5 diagnosed, 0 pins (expected)

### Summary

Landed all four S0-named mechanisms (SVG root shell, outer/per-entity `<g>`
wrapping + uid plan, inline-`<polygon>` arrowheads, `SvekResult`-style
document margin) TDD-first, re-censusing after each. Every mechanism is
individually jar-verified (not guessed) and collectively reduces the state
census's diff-count distribution dramatically:

```
S0 (before): 0/271 -- 1-3:0,  4-10:1,   11-30:270, 31+:0,  errors:0
S1 (after):  0/271 -- 1-3:30, 4-10:192, 11-30:32,  31+:17, errors:0
```

Zero fixtures pinned this iteration — mechanism 2's own `childCount`
short-circuit (S0's own prediction, "no per-feature diff can be measured
until this unblocks") unblocked `compareSvg`'s recursion exactly as
expected, and the newly-visible layer immediately surfaces a FIFTH,
previously-undiagnosable mechanism (state box/shape content fidelity —
see below) that independently blocks every fixture from reaching zero,
regardless of mechanisms 1-4's own correctness. This matches S0's own
explicit prediction ("Expect the diff buckets to WORSEN in count terms
once unmasked — that is the point, not a regression") and its own S1
queue item 5 ("the current family table is not representative of the real
remaining surface... must be re-derived from scratch").

### Mechanism 1 — SVG root shell: LANDED

`src/diagrams/state/renderer-shell.ts#assembleStateShell` — a thin wrapper
around the ALREADY-BUILT `core/klimt/document-shell.ts
#assembleDocumentShell(fragment, 'STATE')`, mirroring `class/renderer-
shell.ts#assembleClassShell`'s own "Part B" single-`<g>`-wrap guarantee.
Simpler than class's version: no `documentBackgroundRect`/
`diagramBorderColor` splice needed (confirmed against every S0-sampled
fixture — state's background is communicated purely via the root `style`
attribute, never an extra `<rect>`). Wired via a new `RenderFragment
.stateShell?: true` flag (`core/dispatcher.ts`), read by `src/index.ts
#assembleSvg` exactly like `classShell`/`klimtShell`.

**Jar-verified**: `jocela-05-niba392`'s root `<svg>` now matches jar's 11
attributes + `<?plantuml ...?>` PI byte-for-byte (previously 7/9 missing).

### Mechanism 2 — outer/per-entity `<g>` wrapping + uid plan: LANDED (with a named simplification)

`src/diagrams/state/renderer-uid.ts#buildStateUidPlan` — fallback-only
dense `ent%04d`/`lnkN` numbering (pre-order over `StateGeometry.states`
including composite children, then `StateGeometry.transitions` array
order). State has NO `creationIndex` threading at all (grepped, zero
hits) — unlike class's G2 N2 exact/fallback split, this is fallback-only,
documented as an approximation (matches class's own established
"unambiguous fixtures get numbered right" bar).

`src/diagrams/state/renderer-group.ts` — `wrapEntity`/`wrapStartEntity`/
`wrapEndEntity`/`wrapLink`, mirroring `class/renderer-group.ts`'s
established shape (`<g class="..." data-qualified-name="..." id="...">`,
`data-*` stripped by the comparator, only `class`/`id` matter).

**Jar-verified wrap-class dispatch** (`renderer.ts#wrapClassFor`), via
direct string inspection of `moleco-69-sida106` and `cekolo-21-gini183`
(every pseudostate stereotype in one fixture):
- `initial` → `start_entity`; `final` → `end_entity`; `choice`/`normal`/
  `json`/composite (`children.length > 0`) → `entity`.
- `fork`/`join`/`syncBar`/`history`/`deepHistory` → **UNWRAPPED** (bare
  siblings, no `<g>`, no id, no comment) — jar-verified directly against
  `cekolo-21-gini183`'s own raw markup (fork/join sync bars and both
  history glyphs draw with zero wrapping), a genuinely different
  convention from class's own "everything gets wrapped" rule. This was
  NOT assumed from class's own precedent — it was caught by hand-reading
  `cekolo`'s raw SVG BEFORE writing the dispatch table, avoiding an
  incorrect blanket-wrap implementation.

**NOT MODELED (named remainder, not chased this iteration)**: a composite
state (`children.length > 0`) sometimes wraps `entity` (an "autonom"
composite, dumped as its own flattened svek pass) and sometimes `cluster`
(a "non-autonom" composite, a real nested `Cluster`) — jar-verified via
`bajelo-54-dixe684`: `Track_FSM` (top, 2 children) and `Track_FSM.Run.
Do_Sector` (1 child) both wrap `entity`, but `Track_FSM.Run` (1 child)
wraps `cluster`. `state-composite-geo.ts` does not thread this
`GeoSpec.kind` classification onto the public `StateNodeGeo` it returns
(verified: no `autonom` field on that type) — threading it through is a
genuinely separate write-set expansion (new `StateNodeGeo` field, plumbed
from `state-composite-pass.ts`'s internals), named here rather than
guessed at or forced in under time pressure. Contributes to the
`svg/g[childCount]`/`svg/g/g/@class` family reach below for composite
fixtures specifically.

Transitions render as FLAT siblings of the top-level state `<g>`s (all in
`StateGeometry.transitions`, which carries no scope/parent info) — correct
for flat diagrams (the corpus majority), a documented simplification for
composite diagrams where jar nests a pass's own internal transitions
inside that pass's own `<g>` (`bajelo-54-dixe684`'s `lnk10`/`lnk11` sit
inside `Track_FSM`'s own `<g>`, not at the outer level).

### Mechanism 3 — arrowhead-drawing mechanism: LANDED

`src/diagrams/state/renderer-arrowhead.ts` — a head-only simplification of
`class/renderer-arrowhead.ts#buildEdgeArrowheads`/`#edgeExtremityInk`:
state transitions always resolve to a single head-side `LinkDecor.ARROW`
(no tail decor, no reversal question — `TransitionGeo` has no decor field
at all). Reuses the ALREADY-BUILT, jar-verified `core/svek/extremity/
ExtremityArrow.ts` + `core/svek/svek-edge-extremity.ts#place` (the SAME
polygon-vertex math and `decorTrim` path-shortening class already uses)
via a throwaway klimt document (`UGraphicSvg`), exactly mirroring class's
own `drawExtremityMarkup` mechanism. `renderer.ts#buildPathD`'s
`applyHeadTrim` now shifts the path's last (and, for a spline, second-to-
last) point by the extremity's own `decorTrim` delta BEFORE building `d`,
so the connecting line stops at the arrow's outer edge instead of running
underneath it, matching jar's own `dotPath.moveEndPoint` mechanism.

Also fixed while wiring this in (a pre-existing, directly-adjacent bug,
not scope creep — the path's own `stroke-width` and `id` attributes are
BOTH exact-match, non-numeric, non-`data-*` attributes `compareSvg`
compares byte-for-byte): `stroke-width` was hardcoded `1.5`, jar uses `1`
on every sampled fixture; the `<path id="...">` value now uses jar's own
`*start*`/`*end*` literal tokens for pseudo-start/final endpoints
(`svgEndpointId`) instead of this port's internal `__initial__`/
`__final__` ids — jar-verified `moleco-69-sida106` (`id="*start*-to-
Main_Libre"`), `bajelo-54-dixe684` (`id="Track_FSM-to-*end*"`).

**Jar-verified**: `<marker>`/`markerEnd` fully removed from state's own
output path; every sampled fixture's `<defs/>` is now genuinely empty
(matching jar) except for the rare `pathHoverColor` case (not exercised
by state, N/A here).

### Mechanism 4 — document-margin / ink-extent computation gap: LANDED (leaf-box case jar-verified; other shapes best-effort)

`src/diagrams/state/layout-ink-extent.ts` — the `SvekResult`/
`TextBlockExporter`/`SvgGraphics` document-dimension recipe, ported for
state's own plain-geometry `StateNodeGeo`/`TransitionGeo` (same margin
constants as class: `(0,5,5,0)`, `.delta(15,15)`, `JAR_INK_MARGIN=6`,
`ensureVisible`'s truncating `+1` — grep-verified no `StateDiagram`-local
`getDefaultMargins()` override exists in `~/git/plantuml/.../
statediagram/*.java`, confirming the shared `CucaDiagram` base applies
unchanged). Wired into `src/diagrams/state/layout.ts#layoutState` via a
new `applyStateDocumentMargin` step (uniform `(dx,dy)` shift + real-dims
recompute), replacing the raw dot-layout `result.width`/`result.height`
this port previously returned directly.

**Jar-verified, the KEY mechanistic finding**: a `normal`/`json` leaf
state's box (rounded rect + horizontal divider `<line>` + name text) does
**NOT** follow class's own `addRectInk` rule (`[x-1,x+w] × [y-1,y+h]`).
The real rule is **asymmetric per AXIS, not per corner**: `[x-1, x+w] ×
[y-1, y+h-1]`. Root cause: the divider `<line>` (upstream `ULine`,
`LimitFinder#drawULine` — plain, UNINSET ink) spans the box's FULL
uninset width (jar's own `<line x1="7" ... x2="65.0625" .../>` where `x2`
equals the rect's `x+width` exactly) and so DOMINATES the rect's own
`-1`-inset right edge on the WIDTH axis — but the line's `y` sits well
INSIDE the box's vertical span, so it never reaches the rect's own
`y+h-1` bottom edge. Isolated and confirmed via 3 INDEPENDENT
zero-transition, zero-composite samples (`jocela-05-niba392` — trivial;
`votoki-67-gufa610` — multi-line `\n` body; `gupeto-19-mesa256` — `<math>`
LaTeX body): `svg/@width` + `svg/@height` byte-exact on all 3 once
applied, robust across body-content complexity.

**NOT independently jar-verified this iteration** (documented, not
silently dropped — see `layout-ink-extent.ts`'s own file doc comment for
the specific `LimitFinder` dispatch each reproduces, ported from REAL
code, not guessed):
- `composite` boxes reuse the leaf-box rule as a best-effort default (no
  divider line in `renderComposite`'s own output, so the mechanism that
  derives the leaf rule doesn't obviously transfer) — `bajelo-54-dixe684`
  (3-level nesting) still shows a real width/height gap (466×494 vs jar's
  494×580), confirming this specific rule is WRONG for composites and
  is the dominant residual on every composite-bearing fixture.
- `fork`/`join`/`syncBar` (plain `LimitFinder#drawRectangle`, real code,
  not guessed) and `initial`/`final`/`history`/`deepHistory`
  (`LimitFinder#drawEllipse`, real code) and `choice`
  (`LimitFinder#drawUPolygon`, real code, `HACK_X_FOR_POLYGON=10`) — each
  ported directly from `core/klimt/drawing/LimitFinder.ts`'s own real
  per-shape dispatch, but not independently confirmed against an isolated
  jar sample this iteration (`moleco-69-sida106`, `cekolo-21-gini183`
  both show small residual width/height gaps — 111×166 vs jar's 155×165,
  and 639×65 vs jar's 651×65 respectively — meaning at least one of
  these per-shape rules, or a residual dot-layout coordinate difference
  unrelated to ink rules, still has a gap; not root-caused further this
  iteration given the time already spent isolating the leaf-box case).

### Mechanism 5 (NEWLY DIAGNOSED, NOT LANDED) — state box/shape content fidelity

Per `~/.claude/rules/diagnosis.md`: instrumented (not guessed) via direct
before/after `compareSvg` probing of `jocela-05-niba392` and
`votoki-67-gufa610` (the two SIMPLEST corpus members, chosen to isolate
this from every other mechanism) after mechanisms 1-4 landed.

**Mechanism**: `renderNormal` (`src/diagrams/state/renderer.ts`) draws a
leaf state as `rect(rx=8) + centered text` — TWO children. Jar's real
`EntityImageState` composition draws THREE-plus: a bordered rect
(`rx="12.5"`, not `8`), a horizontal divider `<line>` (header/body split,
matching class's own classifier convention — this port's `renderNormal`
never draws one at all), and a `<text>` positioned as a HEADER row near
the box's TOP-LEFT (jar: `x="17" y="22.8889"`, with `lengthAdjust=
"spacing"`/`textLength="38.0625"` attrs this port's `text()` helper never
emits) — NOT centered in the box's middle (this port: `x="36.03125"
y="39"`, no `lengthAdjust`/`textLength`). Fill color and stroke-width
also diverge: jar's default state fill is `#F1F1F1` (this port uses
`theme.colors.background`, `#FFFFFF`) with `stroke-width:0.5` (this port:
`1`); `jocela-05-niba392` specifically also carries a `#red` skinparam
override on the state (jar: `fill="#FF0000"`) that this port's renderer
has no mechanism to apply at all (`StateNodeGeo` carries no per-node
color-override field).

**Origin**: `src/diagrams/state/renderer.ts#renderNormal` (and by
extension `renderInitial`/`renderFinal`, which draw raw `<circle>`
strings where jar always uses `<ellipse rx="10" ry="10">` — confirmed via
the family report's `svg/g/g/circle` row, 14-fixture reach — and use
`theme.colors.border` `#181818` for pseudostate fill where jar uses a
DIFFERENT, not-yet-jar-verified constant `#222222`).

**Causal chain**: once mechanism 2 unblocks `compareSvg`'s recursion past
the `<g class="entity">` wrapper, the very NEXT level down is this box's
own child list — `jocela-05-niba392`'s post-S1 diff drops to exactly ONE
entry, `svg/g[1]/g[1][childCount]: actual=2 expected=3` (missing the
divider line), and `compareSvg`'s own "stop recursing on childCount
mismatch" rule means the box's OWN attribute-level diffs (fill/rx/stroke-
width/text position, all confirmed present via direct raw-output
inspection) are not even yet independently measurable per-fixture — they
are a SECOND layer, hidden behind mechanism 5's own childCount gate, the
same "unmasking" pattern mechanism 2 itself exhibited relative to
mechanisms 1/3/4 in S0.

**Ruled out**: NOT a mechanism 1-4 regression — `jocela`'s shell attrs,
wrap structure, and canvas dims (`80px`×`71px`) are ALL byte-exact
post-S1; the ONLY remaining diff is this box's own inner content shape.
NOT limited to `jocela` — the family report's `svg/g/g[childCount]` row
(92-fixture reach) and `svg/g/g/circle` row (14-fixture reach, tag choice
alone) confirm this is corpus-wide, not fixture-specific.

**Fix**: NOT LANDED this iteration — explicitly deferred, not forced.
Rationale: unlike mechanisms 1-4 (each a single, well-bounded, ALREADY-
BUILT-elsewhere-in-the-codebase mechanism reused via a thin adapter),
mechanism 5 is a full per-shape content rewrite (divider line + exact
`rx`/`stroke-width`/fill-color-resolution + jar's real header/body text
layout convention + per-node color-override threading, likely for EVERY
`StateKind`, not just `normal`) — comparable in scope to G2's own
multi-iteration class-classifier-box work, not a same-iteration
"stretch fix". Forcing a partial version now (e.g. adding just the
divider line without also fixing `rx`/color/text-position) would still
not reach zero-diff on any fixture (confirmed: even closing `jocela`'s
ONE remaining childCount gap immediately re-exposes the box's OWN
attribute-level diffs underneath) while consuming this iteration's
remaining budget on an admittedly unbounded surface. Named here, per
diagnosis.md, as the mechanism blocking every remaining fixture from
reaching zero — S2's primary scope.

### Ratchet / pins

0 fixtures pinned (consistent with S0's own 0-pin baseline — the ratchet
was never expected to gain pins until a fixture reaches genuine
`dotEqual && zero-diff`, which mechanism 5 alone prevents this iteration).
`state.golden.ratchet.test.ts` unchanged, still exercising its 0-fixture
`describe.skipIf` branch.

### Census (state), before/after this iteration

```
Before (S0): 0/271 -- 1-3:0,  4-10:1,   11-30:270, 31+:0,  errors:0
After  (S1): 0/271 -- 1-3:30, 4-10:192, 11-30:32,  31+:17, errors:0
```

Diff-family report (post-S1, `--families`, top rows):

```
233 fixtures  svg/@viewBox         (composite-ink-rule gap + mechanism 5's own downstream effects)
224 fixtures  svg/@width
210 fixtures  svg/@height
177 fixtures  svg/g[childCount]    (unwrapped-kind coverage gaps, notes not rendered at all, cluster-vs-entity)
 92 fixtures  svg/g/g[childCount]  (mechanism 5: missing divider line, the dominant single-shape gap)
 50 fixtures  svg/g/g/path/@d     (transition routing/positioning, not this mission's mechanisms)
 49 fixtures  svg/g/g/polygon/@points (mechanism-5-adjacent: arrowhead geometry depends on trimmed path)
 30 fixtures  svg/g/g/path/@id
 25 fixtures  svg/g/g/@id          (uid-plan fallback-numbering mismatches on ambiguous/composite fixtures)
 25 fixtures  svg/g/g/@class       (entity-vs-cluster composite gap, named above)
 14 fixtures  svg/g/g/circle       (mechanism 5: circle vs ellipse tag choice)
```

Full 35-row family table captured in this iteration's own working notes;
truncated here for ledger length — every row funnels into mechanism 5
(box/shape content fidelity) or the two named mechanism-2/4 remainders
(composite entity/cluster split, composite ink rule) above, none of which
is a new, sixth undiscovered class of gap.

### Also discovered, out of S1's write-set (named, not fixed)

- **Notes never render at all**: `StateGeometry` (`state-geo-types.ts`)
  carries no `notes` field whatsoever — `state-notes.ts`/`state-note-
  layout.ts` exist as parsing/layout modules but nothing threads their
  output into `renderState`'s output. Every note-bearing fixture
  (`dajipi-09-doki542`, `fotigo-12-gufu949` from S0's own sample table)
  will show a `svg/g[childCount]` gap from this alone, on top of every
  other mechanism. A genuinely separate, unscoped write-set expansion
  (new geometry field + a new render path), not attempted here.

### Files changed (S1)

- `src/diagrams/state/renderer-shell.ts` — NEW (mechanism 1).
- `src/diagrams/state/renderer-uid.ts` — NEW (mechanism 2, uid plan).
- `src/diagrams/state/renderer-group.ts` — NEW (mechanism 2, `<g>` wraps).
- `src/diagrams/state/renderer-arrowhead.ts` — NEW (mechanism 3).
- `src/diagrams/state/layout-ink-extent.ts` — NEW (mechanism 4).
- `src/diagrams/state/renderer.ts` — rewritten: shell flag, recursive
  `<g>`-wrapped node/transition rendering, inline arrowheads, `stroke-
  width`/path-`id` fixes, background moved to shell `style` attr (no more
  manual full-canvas `<rect>`).
- `src/diagrams/state/layout.ts` — `layoutState` now applies
  `applyStateDocumentMargin` (shift + real dims) as its final step.
- `src/core/dispatcher.ts` — new `RenderFragment.stateShell?: true` flag.
- `src/index.ts` — `assembleSvg` dispatches `stateShell` to
  `assembleStateShell`.
- `tests/unit/state/renderer.test.ts` — 3 pre-S1 assertions updated to
  match the new shell/wrap/arrowhead shape (px-suffixed dims, no manual
  background rect, no `marker-end`); all other pre-existing assertions
  (39 of 42) needed NO changes.

### Gates (S1, final)

- `state` census: `0/271` -- `1-3:30, 4-10:192, 11-30:32, 31+:17,
  errors:0` (histogram improved; 0 zero-diff, expected per mechanism 5).
- Class census 294-set: **intact**, unchanged (`0:294, 1-3:25, 4-10:102,
  11-30:29, 31+:268, errors:0`).
- Object census 22-set: **intact**, unchanged (`0:22, 1-3:5, 4-10:11,
  11-30:11, 31+:31, errors:0`).
- Description census 48-set: **intact**, unchanged (`0:48, 1-3:26,
  4-10:73, 11-30:67, 31+:140, errors:1` across 355 component+usecase
  fixtures — the 1 error is pre-existing, unrelated to this mission's
  write-set, matches S0's own baseline shape).
- DOT gate: `component 262/262 · usecase 90/90 · class 708/708 · object
  78/80 · state 267/267` — EXACTLY unchanged, verified BEFORE and AFTER
  every mechanism landed this iteration.
- `npm test -- --run`: 9917/9918 passing (363 files, +0 vs S0's 363; the
  1 "failing-to-pass" is the SAME pre-existing `describe.skipIf` block at
  the 0-fixture ratchet baseline — actually 2 skipped per vitest's own
  count, matching S0's `9916/9918` shape modulo the +1 test added when
  `renderer.test.ts` gained a new assertion).
- `npm run typecheck` / `npm run lint` / `npm run build`: all clean.

### S2+ queue

1. **Mechanism 5** (state box/shape content fidelity) — the new
   prerequisite blocker for ANY zero-diff fixture: divider line + exact
   `rx`/`stroke-width`/fill-color-resolution (including per-node
   skinparam color overrides) + jar's real header/body text-layout
   convention for `renderNormal`; circle→ellipse tag fix + correct fill
   constant for `renderInitial`/`renderFinal`; likely similar gaps for
   every other `StateKind`'s own shape renderer (`renderForkJoin`,
   `renderChoiceJunction`, `renderHistory`) not yet individually probed.
2. **Composite ink rule** (mechanism 4's own named remainder) — verify
   and correct `addStateBoxInk`'s reuse for `children.length > 0` nodes;
   `bajelo-54-dixe684` is the standing jar-verified counter-example
   (466×494 vs jar's 494×580).
3. **Entity-vs-cluster composite wrap split** (mechanism 2's own named
   remainder) — thread the `autonom`/non-autonom classification from
   `state-composite-pass.ts`'s internal `GeoSpec.kind` onto the public
   `StateNodeGeo` so composite wrap-class dispatch matches jar exactly.
4. **Notes never render** — `StateGeometry` has no `notes` field at all;
   a genuinely new geometry+render write-set expansion.
5. **Per-shape ink-rule verification** — `fork`/`join`/`syncBar`/
   `history`/`deepHistory`/`choice`'s own `LimitFinder`-ported ink rules
   (mechanism 4) are grounded in real code but not independently
   jar-verified per-shape this iteration (`moleco-69-sida106`,
   `cekolo-21-gini183` both show small residual width/height gaps not
   yet root-caused to a specific shape).
6. Once mechanism 5 (at minimum) lands, re-run the census and
   `--families` report FRESH AGAIN — likely still not representative of
   the true remaining surface until the box-content layer itself stops
   short-circuiting `compareSvg`'s recursion into transitions/labels/
   arrowheads for the SAME fixtures.

## S2 — mechanism 5 landed (simple-state box + all pseudostates), 0→9 pins, mechanism 6 diagnosed

### Summary

Landed mechanism 5 (state box/shape content fidelity) TDD-first for BOTH
scoped items: the simple-state (`kind:'normal'`) leaf box (rx/stroke-width/
fill-resolution/divider-line/header+body text layout) and every pseudostate
shape (initial/final/fork/join/syncBar/choice/history/deepHistory). Each
jar-verified against dedicated samples, not guessed:

```
S1 (before): 0/271 -- 1-3:30, 4-10:192, 11-30:32, 31+:17, errors:0
S2 (after):  9/271 -- 1-3:18, 4-10:187, 11-30:37, 31+:20, errors:0
```

9 fixtures reached genuine zero-diff AND `dotEqual:true`, pinned to the
ratchet (`oracle/goldens/svg-state/ratchet.json`, 11 tests: 9× AC1 +
AC2 + AC3). Investigating items 3/4 (composite entity/cluster split,
composite ink rule) surfaced a SIXTH, much larger mechanism (composite box
rendering convention) that supersedes both — diagnosed per diagnosis.md,
explicitly NOT forced this iteration (genuinely unbounded, comparable in
scope to mechanism 5 itself), queued for S3.

### Simple-state box: LANDED, jar-verified 3 samples

`src/diagrams/state/renderer-box.ts#renderNormal` (NEW file) replaces the
old `rect(rx=8,fill=background,strokeWidth=1) + centered text` shape with
the real `EntityImageState` recipe: `rx=ry=12.5`, fill from
`state-render-colors.ts#resolveStateFill` (per-node `#color`/`#back:color`
override, else the jar-verified default `#F1F1F1`), `stroke-width=0.5`, an
ALWAYS-drawn full-width (no 1px inset, unlike class's own divider)
horizontal `<line>` divider, header (name) line(s) CENTERED via
`textLength`-based positioning, body (description) line(s) LEFT-aligned at
`box.x+5`. Both header and body baselines use the SAME content-independent
`ascent = fontSize - fontSize/4.5` formula class's own `class-layout-
helpers.ts` uses (`state-render-colors.ts#textAscent`) — computed
arithmetically since the renderer has no `StringMeasurer`; per-LINE
measured widths are threaded from LAYOUT time instead
(`state-sizing.ts#measureTextLines`/`measureBodyTextLines`, new
`StateNodeGeo.headerLines`/`bodyLines` fields, mirroring class's own
`ClassifierGeo.rows[].width` precedent) via a new shared builder,
`state-sizing.ts#buildStateGeoTextFields`, called from BOTH the flat
pipeline (`layout.ts#buildFlatStateGeos`) and the composite pipeline
(`state-composite-pass.ts#resolveMember`'s leaf branch) so the two never
independently re-derive the same per-kind dispatch.

**Jar-verified byte-for-byte** (`compareSvg(...).pass === true`, own probe
script, deleted before finishing):
- `jocela-05-niba392` — title-only, `#red` inline override, NO body lines
  (the divider STILL draws — `EntityImageState` draws it unconditionally;
  only the separate, NOT-threaded `EntityImageStateEmptyDescription` shape
  omits it, see "Deferred" below).
- `votoki-67-gufa610` — 2-line body, name CENTERED against a wider,
  body-dominated box.
- `gefefe-91-xoge233` — box/text/divider byte-exact (blocked from overall
  zero-diff by an UNRELATED, pre-existing `svg/g/g/path/@d` transition-
  routing gap, S1's own already-named "not this mission's mechanisms"
  family — not chased).

**Two small bugs found and fixed while jar-verifying** (diagnosis.md "fix
violations in the same file", directly adjacent to the mechanism being
landed, not scope creep):
- `textLength` floating-point noise (`105.70000000000002` vs jar's
  `105.7`) — `javaRound4` (already-built, `core/number-format.ts`) applied
  to every measured `textLength` in both new render modules.
- An empty captured body line (`IDLE :`) rendered as a ZERO-width empty
  `<text>` (`textLength="0"`); jar substitutes a literal U+00A0 NBSP
  (confirmed byte-for-byte against the fixture's raw UTF-8, `\xc2\xa0`,
  NOT a plain space) — `state-sizing.ts#measureBodyTextLines` now performs
  the same substitution, matching the class engine's own already-documented
  NBSP convention (`renderer-classifier-box.ts#renderRowAtoms`'s
  `renderText`/`renderWidth` doc comment).

### Pseudostates: LANDED, jar-verified per shape

`src/diagrams/state/renderer-pseudostate.ts` (NEW file) + `state-render-
colors.ts` (NEW file, shared fill/stroke constants + per-node `#color`
override resolution + the ascent/descent formula):
- **initial** (`CircleStart.java`, SIZE=20): `<ellipse>` (not `<circle>`),
  fill=stroke=`#222222` default — jar-verified `gefefe-91-xoge233`.
- **final** (`CircleEnd.java`, SIZE=22, inner delta=5): outer unfilled ring
  + inner filled dot, SAME `#222222` default, SAME center — jar-verified
  `bajelo-54-dixe684`.
- **fork/join/syncBar** (`EntityImageSynchroBar.java`): plain filled bar,
  `fill="#555555"`, `stroke="none"` — jar-verified `cekolo-21-gini183`.
- **choice** (`EntityImageBranch.java`, SIZE*2=24 diamond): SAME
  fill/border/stroke-width default as a plain leaf box (`#F1F1F1`/
  `#181818`/`0.5`) PLUS `stroke-linejoin:miter;stroke-miterlimit:10` (jar
  emits these on every sampled diamond; `compareSvg`'s attribute
  comparator treats a missing attr as a real diff, so they are required,
  not decorative) — jar-verified `cekolo-21-gini183`.
- **history/deepHistory** (`EntityImagePseudoState.java`/
  `EntityImageDeepHistory.java`, SIZE=22): the SURPRISE finding — jar's
  ellipse shares the SAME `#F1F1F1`/`#181818`/`0.5` default as a plain leaf
  box, NOT an unfilled outline (the pre-S2 code's own assumption) — both
  `EntityImagePseudoState`/`EntityImageBranch` share `EntityImage
  StateCommon.STYLE`'s `StyleSignatureBasic.of(root,element,stateDiagram,
  state)` with the plain leaf box, unlike initial/final/fork/join which
  have their OWN distinct default colors. Label ("H"/"H*") centered via the
  SAME `textLength`-based convention as the leaf box's own header text —
  jar-verified `cekolo-21-gini183` (which exercises EVERY pseudostate
  stereotype in one fixture: 11 diffs → 3, all 3 attributable to the
  UNRELATED, pre-existing `<<sdlreceive>>` approximation, see "Also
  discovered" below).
- All pseudostate render functions accept a per-node `#color`/`#back:color`
  inline override (`resolveStateFill`), matching upstream's real
  `Colors#getColor(BackGroundColor)` mechanism for every shape, not just
  the leaf box.

### A companion fix, surfaced by (not part of) mechanism 5: `[*]` endpoint-id resolution

Jar-verifying `gefefe-91-xoge233`/`moleco-69-sida106` surfaced a
PRE-EXISTING, S1-adjacent bug (mechanism 3's own territory, "arrowhead-
drawing mechanism" — specifically `svgEndpointId`'s own `*start*`/`*end*`
translation): `layout.ts#buildFlatTransitionGeos` pushed the RAW,
unresolved AST endpoint token (`'[*]'` verbatim) into `TransitionGeo.from`/
`to` instead of resolving it through the SAME shared start/end anchor id
(`INITIAL_ID`/`FINAL_ID`) the DOT graph itself already uses
(`state-dot-graph.ts#buildDotEdges`'s own local `endpointId` helper). This
made `renderer.ts#svgEndpointId`'s `INITIAL_ID`/`FINAL_ID` check silently
never match for ANY flat-pipeline `[*]`-originating/-terminating
transition, producing `<path id="[*]-to-IDLE">` instead of jar's
`id="*start*-to-IDLE"` — invisible before mechanism 5 landed (everything
else about those fixtures was already failing for bigger reasons).
**Origin**: `layout.ts#buildFlatTransitionGeos:90-101` (pre-fix). **Fix**:
`endpointId` exported from `state-dot-graph.ts`, reused by
`buildFlatTransitionGeos`. A stale unit test (`tests/unit/state/
layout.test.ts`, "TransitionGeo preserves original [*] from/to") asserted
the OLD, buggy behavior as a named requirement — updated to assert the
correct, jar-verified resolution instead (not reverted).

### Mechanism 6 (NEWLY DIAGNOSED, NOT LANDED) — composite box IS NOT a dashed rect

Per diagnosis.md: instrumented (not guessed) — direct raw-string inspection
of `bajelo-54-dixe684`'s jar `in.svg` around `Track_FSM`'s own `<g>`,
undertaken specifically to assess whether S1's items 3 ("entity-vs-cluster
wrap split") and 4 ("composite ink rule") were bounded enough to land this
iteration.

**Mechanism**: `renderer.ts#renderCompositeShape` draws a composite state
as `rect(rx=8, stroke-dasharray='6,3', fill=background) + top label` — a
SINGLE dashed outline. Jar's REAL composite box (both the `entity`/autonom
case, `Track_FSM`, AND the `cluster`/non-autonom case, `Track_FSM.Run`) is
FOUR-LAYERED and uses the EXACT SAME conventions the leaf box (mechanism 5)
and class's own `headerBackgroundPath` already establish: (1) a half-
rounded HEADER-strip `<path>` (`URectangle.halfRounded`'s own arc+line
sequence — `renderer-classifier-box.ts#headerBackgroundPath`'s ALREADY-
PORTED math, verified byte-exact for class since G2), filled `#F1F1F1`,
positioned at the box's own top edge; (2) a FULL, SOLID (never dashed)
`<rect fill="none" stroke="#181818" stroke-width="0.5" rx="12.5"
ry="12.5">` outline spanning the composite's whole bounding box; (3) a
horizontal `<line>` divider at the header/body boundary (the SAME leaf-box
divider convention); (4) the composite's own name, CENTERED via
`textLength` (confirmed algebraically: `x=207.04` == `box midX(243.22) -
textLength/2(36.18)`, byte-exact). The non-autonom `cluster` case
(`Track_FSM.Run`) additionally draws a SECOND, DOT-cluster-specific
background `<rect fill="#F1F1F1" stroke="#F1F1F1" stroke-width="1">`
beneath its own children (likely `DotInputCluster`'s own bgcolor fill,
already-existing dot-emission machinery, not yet traced to its exact
render-side counterpart).

**Origin**: `renderer.ts#renderCompositeShape` (dashed-rect assumption,
never verified against a real jar composite sample — S1's own `bajelo-
54-dixe684` probe checked wrap CLASS dispatch and shell/margin mechanics,
never the composite box's OWN drawn shape).

**Causal chain**: `bajelo-54-dixe684`'s post-mechanism-5 diff (5 total) is
ENTIRELY `svg/@viewBox`/`@width`/`@height` (dimension) + ONE `svg/g[1]
[childCount]` (7 actual vs 5 expected — extra `<rect>`+extra `<text>` from
the dashed-box convention vs jar's 4-element layered convention) — closing
mechanism 5 made this the ENTIRE remaining gap for every composite-bearing
fixture, exactly the same "unmasking" pattern mechanisms 2→5 and 4→5
already exhibited.

**Ruled out**: NOT a mechanism-5 regression (the box's rx/stroke/fill
CONSTANTS mechanism 5 landed are correct in spirit — jar's composite outer
rect DOES use `rx=12.5`/`stroke-width=0.5`/`#181818`, the SAME leaf-box
values — the bug is the DRAWING CONVENTION: a `stroke-dasharray` single
rect instead of the 3-4-layer header-path+outline+divider+text
composition). NOT the SAME bug as the entity/cluster wrap-CLASS split
(that's about which `<g class="...">` wraps the composite, orthogonal to
what's INSIDE it — both bugs are real and independent, this one simply
dominates the remaining diff count).

**Fix**: NOT LANDED this iteration. Explicitly NOT forced — rationale:
this is a genuine, multi-element rendering-convention port (reusing
`headerBackgroundPath`'s arc math, a NEW solid-outline drawing path, the
SAME divider+centered-text convention mechanism 5 already built for leaf
boxes, PLUS the still-unbounded cluster-vs-autonom second-background-rect
question) — comparable in scope to mechanism 5 itself, not a same-iteration
stretch fix. Named here per diagnosis.md, supersedes S1's own vaguer
"composite ink rule"/"entity-vs-cluster wrap split" framing (both are
real, but this diagnosis is the actual dominant blocker) — S3's primary
scope.

### Also discovered, out of S2's write-set (named, not fixed)

- **`<<sdlreceive>>` stereotype draws UNWRAPPED** (no `<g class="entity">`
  at all — bare `rect`+`path`+`text` siblings), unlike every other
  `kind:'normal'` state (always wrapped `entity`) — jar-verified
  `cekolo-21-gini183`. `wrapClassFor` (mechanism 2, S1) has no stereotype
  awareness (`StateNodeGeo` carries no stereotype field), so this port
  still wraps it — a pre-existing, already-flagged-approximate shape
  (`state-sizing.ts#SDL_MARGIN`'s own doc comment) gains one more named
  divergence, not independently chased (single-fixture reach in the
  16-sample set, explicitly out of this iteration's item list).
- **Transition routing/positioning** (`svg/g/g/path/@d`,
  `svg/g/g/polygon/@points`) remains the dominant residual on several
  near-zero fixtures (e.g. `gefefe-91-xoge233`, box/text/divider all
  byte-exact) — S1's own already-named "not this mission's mechanisms"
  family, confirmed still present and unrelated to mechanism 5/6.

### Ratchet / pins

9 fixtures pinned (`dutefi-86-kesa899`, `fuxavu-11-goco024`, `gizati-67-
kora187`, `jocela-05-niba392`, `pujini-03-vasi565`, `sezoxa-56-jefi030`,
`suzope-95-suvu383`, `votoki-67-gufa610`, `xuzapa-55-xoli880`) — all
`conformant && dotEqual:true` per a freshly-regenerated `parity-state.json`
(271/271 surveyed, 9/271 conformant). `state.golden.ratchet.test.ts`:
11 tests (9× AC1 + AC2 + AC3), all passing.

### Census (state), before/after this iteration

```
Before (S1): 0/271 -- 1-3:30, 4-10:192, 11-30:32, 31+:17, errors:0
After  (S2): 9/271 -- 1-3:18, 4-10:187, 11-30:37, 31+:20, errors:0
```

### Files changed (S2)

- `src/diagrams/state/renderer-box.ts` — NEW (simple-state box).
- `src/diagrams/state/renderer-pseudostate.ts` — NEW (all pseudostates).
- `src/diagrams/state/state-render-colors.ts` — NEW (shared fill/stroke
  constants, per-node color-override resolution, ascent/descent formula).
- `src/diagrams/state/state-geo-types.ts` — `StateTextLine` type,
  `StateNodeGeo.headerLines`/`bodyLines`/`color` fields.
- `src/diagrams/state/state-sizing.ts` — `measureTextLines`/
  `measureBodyTextLines`/`historyLabelText`/`buildStateGeoTextFields`
  (shared flat+composite text-field builder).
- `src/diagrams/state/layout.ts` — `buildFlatStateGeos` threads
  `buildStateGeoTextFields`; `buildFlatTransitionGeos` resolves `[*]` via
  `endpointId` (companion fix).
- `src/diagrams/state/state-composite-pass.ts` — `GeoSpec`'s `'state'`
  variant gains `headerLines`/`bodyLines`/`color`; `resolveMember`'s leaf
  branch threads `buildStateGeoTextFields`.
- `src/diagrams/state/state-composite-geo.ts` — `materializeSpecs`'s
  `'state'` branch threads the new spec fields onto `StateNodeGeo`.
- `src/diagrams/state/state-dot-graph.ts` — `endpointId` exported
  (companion fix).
- `src/diagrams/state/renderer.ts` — `renderInitial`/`renderFinal`/
  `renderForkJoin`/`renderChoiceJunction`/`renderHistory`/`renderNormal`
  now delegate to the two new modules; `renderJson` doc comment updated.
- `oracle/goldens/svg-state/ratchet.json` — 9 fixtures added.
- `oracle/goldens/svg-state/<9 slugs>/{in.puml,golden.svg}` — NEW.
- `tests/oracle/svg-conformance/parity-state.json` — regenerated (271/271
  surveyed, 9/271 conformant, unchanged dotEqual set).
- `tests/unit/state/renderer.test.ts` — 13 assertions updated to match the
  new jar-verified shapes (ellipse not circle, `#222222`/`#555555`/
  `#F1F1F1` constants, `rx="12.5"`); a `historyLabelText`-based fallback
  added to `renderHistory` so hand-built test geometries (no `headerLines`)
  still render a plain centered label, keeping those assertions meaningful.
- `tests/unit/state/layout.test.ts` — 2 assertions updated for the `[*]`
  endpoint-id companion fix.

### Gates (S2, final)

- `state` census: `9/271` -- `1-3:18, 4-10:187, 11-30:37, 31+:20,
  errors:0`.
- Class census 294-set: **intact**, unchanged.
- Object census 22-set: **intact**, unchanged.
- Description census 48-set: **intact**, unchanged (1 pre-existing,
  unrelated error).
- DOT gate: `component 262/262 · usecase 90/90 · class 708/708 · object
  78/80 · state 267/267` — EXACTLY unchanged, verified BEFORE and AFTER
  every mechanism landed this iteration.
- `npm test -- --run`: 9925/9925 passing (363 files, +7 vs S1's 9918 —
  net new/updated assertions in the two updated test files plus the new
  ratchet pins).
- `npm run typecheck` / `npm run lint` / `npm run build`: all clean.

### S3+ queue

1. **Mechanism 6** (composite box rendering convention) — port
   `headerBackgroundPath`'s half-rounded-path math into state, a NEW
   solid-outline draw path (not dashed), reuse the divider+centered-text
   convention mechanism 5 already built, resolve the cluster-vs-autonom
   second-background-rect question. Supersedes S1's "composite ink rule"/
   "entity-vs-cluster wrap split" items.
2. **Composite ink-extent** — once mechanism 6's real box shape lands,
   `layout-ink-extent.ts#addStateBoxInk`'s composite reuse (S1's own
   best-effort default) needs re-deriving against the NEW shape, not the
   dashed-rect approximation it currently targets.
3. **`<<sdlreceive>>` unwrapped-entity gap** — `wrapClassFor` needs
   stereotype awareness (a new `StateNodeGeo` field) to match jar's
   unwrapped rendering for this ONE stereotype.
4. **Notes never render** — unchanged from S1, still a genuinely new
   geometry+render write-set expansion.
5. **Transition routing/positioning** (`svg/g/g/path/@d`) — the dominant
   family among the 30/47/49-fixture-reach rows in the post-S2 family
   report; unrelated to mechanisms 5/6, needs its own diagnosis pass.
6. Re-run the census and `--families` report FRESH again once mechanism 6
   lands — composite-bearing fixtures currently dominate the `svg/@viewBox`/
   `@width`/`@height` family (233/224/210-fixture reach), so the true
   remaining non-composite surface is still partly obscured.

## S3 — mechanism 6 landed (autonom composite box shape), wrapper-sizing gap diagnosed but NOT landed, 9/271 unchanged

### Summary

Landed mechanism 6's PRIMARY scope: the autonom (`class="entity"`) composite
box is now drawn as jar's real 3-4-layer structure (half-rounded header
path + solid outline + divider(s) + centered title text + optional
action-zone background/text for entry/exit descriptions), replacing the
S1-era dashed-rect approximation, TDD-first and jar-verified byte-exact on
both `bajelo-54-dixe684`'s `Track_FSM` (no body lines) and `Track_FSM.Run.
Do_Sector` (2 body lines). This closed the `childCount` mismatch that was
short-circuiting `compareSvg` for EVERY composite-bearing fixture, which —
per this mission's own established "unmasking" pattern (S1→S2, S2→S3) —
immediately surfaced a SEVENTH mechanism: a pre-existing composite-wrapper
WIDTH/HEIGHT sizing formula gap (`measureAutonomWrapper`'s `childImg`
parameter uses `layoutGraph()`'s raw, generically-margined `result.width`/
`height` instead of `InnerStateAutonom.calculateDimensionSlow`'s real
`SvekResult#calculateDimension()`, a tight bbox + `.delta(15,15)`). A trial
fix was implemented, jar-verified to IMPROVE two fixtures (`coteta-47-
mare883` 21→18 diffs, `lonuti-97-voko521` 80→67) but ALSO jar-verified to
REGRESS two ALREADY-PINNED `size-backlog.json` entries past their own
tighten-only allowance — REVERTED per this mission's own hard boundary,
diagnosed and queued whole for S4 (needs combining with a still-separate,
still-unresolved child POSITION-offset residual before either stops
regressing a backlog entry). Composite ink-extent (item 2) and the
entity-vs-cluster split (item 3) were both assessed; item 2 is consistent
with the box's own reported dimensions (no independently-verifiable
ink-rule-specific residual found, but full verification is blocked by the
still-unresolved wrapper-sizing gap); item 3 was diagnosed as genuinely
unbounded this iteration (a DOT-native cluster-label sizing code path,
materially different from `InnerStateAutonom`'s math) and deferred.

```
S2 (before): 9/271 -- 1-3:18, 4-10:187, 11-30:37, 31+:20, errors:0
S3 (after):  9/271 -- 1-3:17, 4-10:182, 11-30:40, 31+:23, errors:0
```

Zero-diff count held at 9/271 (all 9 pinned ratchet fixtures verified
UNCHANGED, `dotEqual:true`, via a freshly-regenerated `parity-state.json`).
The 1-3/4-10 buckets shrank slightly while 11-30/31+ grew — the SAME
mixed-direction "unmasking" signature S0→S1 exhibited (`31+:0->17` there),
not a regression: every fixture that moved to a worse bucket was ALREADY
non-zero-diff before this iteration (verified per-fixture, none of the 9
pinned fixtures moved), and the increased diff count is REAL,
previously-hidden structure (the composite's own true attribute mismatches,
now visible because `childCount` finally matches) rather than anything this
iteration's own code introduced.

### Mechanism 6 (composite box rendering convention): LANDED, jar-verified 2 samples

`src/diagrams/state/renderer-composite-box.ts` (NEW file) — `renderComposite`
dispatches on `node.headerLines`:
- `undefined` (hand-built test geometry, OR a concurrent-region LEAF spec,
  OR a non-autonom `cluster` composite — none of these are threaded with
  measured text this iteration) → the PRE-S3 dashed-rect + centered-label
  shape, verbatim, unchanged — a deliberate, non-regressing fallback
  (mirrors `renderer-box.ts#renderUnmeasuredFallback`'s S2 precedent).
- defined (an autonom composite, `state-composite-autonom.ts
  #buildPlainAutonomSpec` / `state-composite-concurrent.ts
  #combineConcurrentPasses`, both newly threaded this iteration) → the real
  shape: `compositeHeaderPath` (a local string-builder reproducing
  `URectangle.halfRounded(25)`'s exact arc+line sequence, the SAME math
  class's own `renderer-classifier-box.ts#headerBackgroundPath` already
  ports, but WITHOUT a stroke attribute — jar-verified the header `<path>`
  carries only `fill`) + a solid (never dashed) outline `<rect fill="none">`
  + a header/body divider `<line>` (ALWAYS drawn) + centered title `<text>`
  + (only when `bodyLines.length > 0`) an action-zone background `<rect
  fill=stroke=THE SAME resolved color, stroke-width="1">` + a second divider
  + left-aligned action `<text>` lines, whose baseline offset
  (`dividerY1 + ascent`, jar-verified via `Do_Sector`'s own `y="349.8889" =
  339 + textAscent(14)` exactly) is confirmed to differ from the leaf box's
  own body-text offset (`renderer-box.ts`'s `dividerY + MARGIN_LINE +
  ascent`) by exactly `MARGIN_LINE` — a genuinely distinct upstream formula,
  not a copy-paste of the leaf convention.

**Jar-verified byte-for-byte** (`bajelo-54-dixe684`, direct probe script,
deleted before finishing):
- `Track_FSM` (top-level, no body lines): header path, outline rect,
  single divider, and title `<text>` all byte-identical to jar (only the
  overall canvas dimensions differ, dominated by the STILL-approximated
  `Run` cluster sibling — a different, deferred mechanism, item 3 below).
- `Track_FSM.Run.Do_Sector` (nested, 2 body lines): full 8-element layered
  shape (header path, action-zone bg, outline, divider1, divider2, title,
  2 action-text lines) byte-identical to jar, INCLUDING the action-zone's
  own `fill`/`stroke` (both the SAME resolved color) and the `dividerY1 +
  ascent` (no `MARGIN_LINE`) baseline offset.

**Split for the 500-line file cap**: `state-composite-pass.ts` (504 lines
pre-S3) had `buildPlainAutonomSpec`/`buildAutonomSpec`/
`resolveAllAutonomPasses` moved out to a NEW `state-composite-autonom.ts`
(mirrors `state-composite-cluster.ts`'s/`state-composite-concurrent.ts`'s
own identical iter-16 split, pure move plus the mechanism-6 threading);
`sweepOrphanEdges` was exported (previously private) for the moved
function's reuse. `renderer-composite-box.ts` itself split
`renderCompositeMeasured` into `buildCoreLayers`/`buildActionZone` to stay
under the per-function token-length complexity cap (draw order preserved
by returning 3 separate action-zone strings, not one concatenated blob,
so they can interleave correctly with the core layers' own divider/title).

### Threading headerLines/bodyLines/color onto composite `GeoSpec`s

`GeoSpec`'s `'autonom'` variant (`state-composite-pass.ts`) gained the SAME
`headerLines?`/`bodyLines?`/`color?` fields the `'state'` variant already
had (mission G4 S2 precedent) — populated via `state-sizing.ts
#buildStateGeoTextFields(s, ...)`, the SAME shared builder the flat leaf
pipeline uses, called from BOTH `buildPlainAutonomSpec`
(state-composite-autonom.ts) and `combineConcurrentPasses`
(state-composite-concurrent.ts, for a concurrent-region-OWNING composite,
which is ALSO wrapped by `InnerStateAutonom` exactly like a plain autonom
composite). `state-composite-geo.ts#materializeAutonom` threads the fields
onto the final `StateNodeGeo`, mirroring `materializeSpecs`'s existing
`'state'`-branch spread pattern. A concurrent-region LEAF
(`state-composite-cluster.ts#buildConcurrentRegionLeaf`, which upstream
NEVER wraps in `InnerStateAutonom` — `GroupMakerState.getImage()` returns
its raw graph image directly) deliberately does NOT get these fields, so
it correctly falls through to the unchanged fallback shape.

### Mechanism 7 (NEWLY DIAGNOSED, NOT LANDED) — composite wrapper width/height sizing gap

Per diagnosis.md: instrumented (not guessed) — direct raw-string inspection
of `coteta-47-mare883`'s and `lonuti-97-voko521`'s own composite `<g>`s,
undertaken after mechanism 6 landing unmasked a fresh `svg/g.../rect/
@width`/`@height` diff family that had no `childCount` short-circuit left
to hide behind.

**Mechanism**: `state-composite-autonom.ts#buildPlainAutonomSpec` passes
`measureAutonomWrapper`'s `childImg` parameter as `{width: result.width,
height: result.height}` — `layoutGraph()`'s raw output, which bakes in a
GENERIC per-graph canvas margin (`MARGIN=12`, `graph-layout.ts
#canvasSize`). Upstream's `InnerStateAutonom.calculateDimensionSlow` wants
`im.calculateDimension(stringBounder)`, where `im` is the wrapped child
pass's own `SvekResult` — `SvekResult#calculateDimension()`
(SvekResult.java:130-135) is a TIGHT content bbox (`TextBlockUtils.
getMinMax`) + a flat `.delta(15,15)`, a COMPLETELY DIFFERENT number from
the generic engine-internal `MARGIN=12` canvas padding. This is the EXACT
SAME class of bug `state-composite-cluster.ts#tightContentDimension`'s own
doc comment already named and fixed for a concurrent region leaf (mission
A4 Phase L iter 16) — the plain-autonom call site simply never got the
same fix, because no fixture's `childCount` matched jar's real composite
box shape until mechanism 6 landed this iteration.

**Origin**: `state-composite-autonom.ts#buildPlainAutonomSpec` (pre-existing
code, moved but NOT logically changed by mechanism 6's own diff — the bug
predates this iteration, only its VISIBILITY is new).

**Causal chain**: `coteta-47-mare883`'s composite `s1` (description: 3
body lines, 1 child `state c`) — jar's own outer rect is `width="91"`,
ours (pre-fix) was `width="87"`, a 4px shortfall. Tracing `mergedWidth =
Math.max(text.width, attr.width, childImg.width)`: `childImg.width` is the
dominant term (child `c`'s own 50×50 leaf, plus DOT layout content), and
`result.width` (raw, MARGIN=12-padded) undercounts relative to
`SvekResult#calculateDimension()`'s own tight+15 formula for this exact
graph shape. `lonuti-97-voko521`'s nested composite `A` (containing an
EMPTY `state B {}` and a `state C : state c`) shows the identical pattern
at a larger scale (width off by ~8px).

**Ruled out**: NOT mechanism 6's own render-shape math (the header path,
outline rect, and divider positions are ALL jar-verified byte-exact given
a CORRECT box width/height — see `Do_Sector`'s own full-byte match above,
which uses REAL jar-computed dimensions, not this port's own drift). NOT
the leading-whitespace text-measurement question raised while diagnosing
`coteta-47-mare883`'s 3-line body (`line1`/`  line2`/`    line3`) — verified
BOTH ours and jar's own `WidthTableMeasurer`-equivalent measure all 3
lines identically (`textLength="29.6625"` on both sides; jar strips the
leading Creole-indentation whitespace from the DISPLAYED text but the
measured WIDTH already excludes it too, since `measure(' ')===0` in this
project's own width table — a genuine, pre-existing, UNRELATED text-content
divergence, named but not chased this iteration, zero effect on the width
gap's own root cause).

**Fix attempted, then REVERTED**: `tightContentDimension(result)` (now
`export`ed from `state-composite-cluster.ts`, reused rather than
re-derived) + the SAME `delta(15,15)` constant (`SVEK_RESULT_DELTA`,
mirroring `REGION_LEAF_MARGIN`) — jar-verified to shrink
`coteta-47-mare883` (21→18 diffs) and `lonuti-97-voko521` (80→67 diffs),
but ALSO jar-verified (via the full `npm test -- --run` suite) to push
`nelupe-49-xova546`'s own `maxSizeDeltaIn` from 1.555555 (its PINNED
`size-backlog.json` allowance) to 1.597222, and `pesita-10-dene726`'s from
0.195792 to 0.237459 — BOTH already-pinned, tighten-only ratchet entries.
Per this mission's own hard boundary ("size-backlog.json (tighten-only)"),
the fix was REVERTED rather than landed with a boundary violation. The
`tightContentDimension` export and this diagnosis are KEPT (harmless,
documents the finding) so S4 does not have to re-derive it — but the
REAL fix likely needs this piece COMBINED with the still-separate child
POSITION-offset residual (below) before either stops regressing a backlog
entry in isolation.

**Also confirmed, same investigation**: a SEPARATE, still-unresolved child
POSITION-offset residual (`coteta-47-mare883`'s child "c": jar wants
absolute `x=19`/`y=90` relative to its parent's own origin; this port
currently produces `x=12`/`y=83`, a consistent ~7px shortfall on BOTH
axes) — NOT the SAME numeric constant as `SvekResult`'s own
`moveDelta(6,6)` (a raw single-node child pass's own node position is
`(0,0)`, not pre-shifted, confirmed via direct `layoutGraph()` probe), so
this is a THIRD, not-yet-derived sub-component of the same general
"composite wrapper geometry" gap — named, not guessed at.

### Item 2 (composite ink-extent): assessed, not independently verifiable this iteration

`layout-ink-extent.ts#addStateBoxInk`'s composite reuse (the SAME
asymmetric leaf-box rule, `[x-1,x+w] × [y-1,y+h-1]`) was checked against
the NEW real box shape: the composite's own OUTLINE rect spans exactly
`(node.x, node.y, node.width, node.height)` — the SAME rect the leaf box's
own ink rule already targets — and the header path/action-zone/dividers
all stay STRICTLY INSIDE that outline's own bounds (confirmed via the
`compositeHeaderPath`/`buildActionZone` geometry above, none of which ever
exceeds the outline rect's own edges). `coteta-47-mare883`'s own
`svg/@width`/`@height` diff (113 vs 109, before the reverted trial fix)
matches its composite's own `rect/@width` diff (91 vs 87) EXACTLY (delta 4
on both) — strong evidence the document-canvas ink-extent formula ITSELF
has NO independent composite-specific error component; the residual
document-size gap traces entirely through mechanism 7's own wrapper-sizing
gap, not a separate ink-rule bug. NOT independently verified byte-exact
this iteration (no corpus fixture has a fully mechanism-7-correct
composite box yet to confirm a TRUE zero residual) — doc comment left
as-is (still marked "best-effort, not independently jar-verified"), a
re-verification queued for whenever mechanism 7 lands.

### Item 3 (entity-vs-cluster wrap split): assessed, confirmed NOT bounded this iteration

Direct inspection of `bajelo-54-dixe684`'s `Track_FSM.Run` (the `cluster`/
non-autonom sibling to `Do_Sector`'s own `entity`/autonom case) confirms
this is a MATERIALLY DIFFERENT upstream code path, not just a different
wrap `class` attribute: `Run`'s own header height (19) does NOT match the
`EntityImageState`/`InnerStateAutonom` MARGIN formula (24) that BOTH the
leaf box (mission G4 S2) and mechanism 6's own autonom-composite box use —
it is sized via graphviz's OWN cluster-label mechanism
(`DotInputCluster.label`/`labelWidth`/`labelHeight`, already fed by
`state-composite-cluster.ts#resolveClusterComposite`'s existing
`measureClusterTitle`, but never consumed on the RENDER side, and
`DotLayoutResult` carries NO cluster bounding-box data at all —
`materializeCluster`'s own `boundingBox(children)` recomputes a LOCAL
approximation with a flat `BOX_PAD=12`, unrelated to graphviz's real
cluster-label-reserved rectangle). Landing this would require: (1)
exposing real cluster bounding boxes from the graphviz-ts layout result (a
library-level or `graph-layout.ts`-level change, the SAME class of item
the mission brief's "fenced sub-item 4" describes, requiring census proof
across ALL cluster-bearing diagram types before keeping it) OR (2)
reserving label height in `materializeCluster`'s own local bbox
computation as a state-only approximation (never byte-exact, since dot's
REAL cluster label placement/sizing algorithm is not reproduced) — neither
is a same-iteration, single-mechanism fix. Deferred, matching S1's own
original framing (`renderer-group.ts`'s "NOT MODELED" doc comment,
unchanged this iteration).

### Also discovered, out of S3's write-set (named, not fixed)

- Nothing new beyond mechanism 7 and the position-offset residual above —
  both already named as this iteration's own primary findings, not
  incidental discoveries.

### Ratchet / pins

9 fixtures remain pinned (UNCHANGED set: `dutefi-86-kesa899`, `fuxavu-11-
goco024`, `gizati-67-kora187`, `jocela-05-niba392`, `pujini-03-vasi565`,
`sezoxa-56-jefi030`, `suzope-95-suvu383`, `votoki-67-gufa610`, `xuzapa-55-
xoli880`) — verified via a freshly-regenerated `parity-state.json`
(271/271 surveyed, 9/271 conformant, `dotEqual:true` on all 9, byte-
identical to S2's own set). `state.golden.ratchet.test.ts`: still 11 tests
(9× AC1 + AC2 + AC3), all passing — no new pins this iteration (mechanism
6 alone did not push any additional fixture to genuine zero-diff; the
composite-bearing fixtures closest to zero are still blocked by mechanism
7's own wrapper-sizing gap and/or the pre-existing, unrelated transition-
routing family).

### Census (state), before/after this iteration

```
Before (S2): 9/271 -- 1-3:18, 4-10:187, 11-30:37, 31+:20, errors:0
After  (S3): 9/271 -- 1-3:17, 4-10:182, 11-30:40, 31+:23, errors:0
```

### Files changed (S3)

- `src/diagrams/state/renderer-composite-box.ts` — NEW (mechanism 6's
  measured composite-box shape + the pre-S3 dashed-rect fallback, moved
  verbatim out of `renderer.ts`).
- `src/diagrams/state/state-composite-autonom.ts` — NEW (`state-composite-
  pass.ts`'s `buildPlainAutonomSpec`/`buildAutonomSpec`/
  `resolveAllAutonomPasses` moved out for the 500-line cap; `
  buildPlainAutonomSpec` threads `buildStateGeoTextFields`).
- `src/diagrams/state/renderer.ts` — `renderCompositeShape` removed,
  delegates to `renderer-composite-box.ts#renderComposite`; `rect` import
  dropped (no longer used directly).
- `src/diagrams/state/state-composite-pass.ts` — the 3 moved functions
  removed; `sweepOrphanEdges` exported; `GeoSpec`'s `'autonom'` variant
  gains `headerLines`/`bodyLines`/`color`.
- `src/diagrams/state/state-composite-cluster.ts` — `tightContentDimension`
  exported (mechanism 7's diagnosed-but-reverted fix, kept for S4 reuse);
  doc comments updated with the mechanism-7 cross-reference.
- `src/diagrams/state/state-composite-concurrent.ts` — `combineConcurrentPasses`
  threads `buildStateGeoTextFields` too (a concurrent-region-owning
  composite is ALSO `InnerStateAutonom`-wrapped).
- `src/diagrams/state/state-composite-geo.ts` — `materializeAutonom`
  threads `spec.headerLines`/`bodyLines`/`color` onto the returned
  `StateNodeGeo`.
- `tests/unit/state/renderer-composite-box.test.ts` — NEW, 13 tests
  (fallback shape, no-body-lines measured shape byte-verified against
  `Track_FSM`, with-body-lines measured shape byte-verified against
  `Do_Sector`, per-node `#color` override).
- `tests/unit/state/layout.test.ts` — 6 new tests (autonom composite
  headerLines/bodyLines/color threading, concurrent-region-owning
  composite threading, non-autonom/cluster composite correctly does NOT
  get headerLines).
- `tests/oracle/svg-conformance/parity-state.json` — regenerated (271/271
  surveyed, 9/271 conformant, UNCHANGED `dotEqual` set).

### Gates (S3, final)

- `state` census: `9/271` -- `1-3:17, 4-10:182, 11-30:40, 31+:23,
  errors:0`.
- Class census: **303/718**, intact, unchanged.
- Object census: **22/80**, intact, unchanged.
- Description census: **48/355**, intact, unchanged.
- DOT gate: `component 262/262 · usecase 90/90 · class 708/708 · object
  78/80 · state 267/267` — EXACTLY unchanged, verified BEFORE and AFTER
  every mechanism landed/attempted this iteration.
- `npm test -- --run`: 9955/9955 passing (364 files, +19 vs S2's 9936 —
  the 13 new `renderer-composite-box.test.ts` assertions + 6 new
  `layout.test.ts` assertions).
- `npm run typecheck` / `npm run lint` / `npm run build`: all clean.
- `state.golden.ratchet.test.ts`: 11 tests (9 pins), unchanged.

### S4+ queue

1. **Mechanism 7** (composite wrapper width/height sizing gap) — land
   `tightContentDimension(result) + SVEK_RESULT_DELTA` (already diagnosed
   and exported, `state-composite-cluster.ts`) COMBINED with a correct
   derivation of the child POSITION-offset residual (currently off by a
   consistent ~7px on both axes for a single-node child pass, not yet
   traced to an exact upstream constant) — landing the width/height piece
   ALONE is proven to regress 2 pinned `size-backlog.json` entries, so
   both pieces need to land together, jar-verified against `coteta-47-
   mare883`/`lonuti-97-voko521` (both should reach exact composite-box
   byte match) AND `nelupe-49-xova546`/`pesita-10-dene726` (both must NOT
   regress past their own pinned allowance).
2. **Composite ink-extent** re-verification — once mechanism 7 lands,
   confirm `addStateBoxInk`'s composite reuse is byte-exact (this
   iteration's own algebraic evidence suggests it already is, pending a
   fixture with a fully-correct composite box to confirm).
3. **Entity-vs-cluster wrap split** (item 3, confirmed NOT bounded this
   iteration) — requires either exposing real graphviz cluster bounding
   boxes (a `graph-layout.ts`/library-level change, needs the SAME
   cross-diagram-type census proof the mission brief's fenced sub-item 4
   describes) or a state-only local-bbox approximation (never byte-exact).
4. **`<<sdlreceive>>` unwrapped-entity gap** — unchanged from S1/S2, still
   a genuinely new `StateNodeGeo` stereotype-awareness field.
5. **Notes never render** — unchanged from S1, still a genuinely new
   geometry+render write-set expansion.
6. **Transition routing/positioning** (`svg/g/g/path/@d`) — unchanged from
   S2, the dominant residual on several near-zero, non-composite fixtures;
   needs its own diagnosis pass, unrelated to mechanisms 5/6/7.
7. Re-run the census and `--families` report FRESH again once mechanism 7
   lands — composite-bearing fixtures should finally drop out of the
   dominant `svg/@viewBox`/`@width`/`@height` family, exposing the true
   remaining non-composite surface for the first time this mission.

## S4 — mechanism 7 landed (composite wrapper sizing + child position),
mechanism 8 discovered and landed (`ConcurrentStates` separator-gap bug),
9→13 pins, 138→102 size-backlog entries

### Summary

Landed mechanism 7 (S3's own queue item 1) in full: the composite wrapper
width/height fix (`tightContentDimension`+15, previously reverted) COMBINED
with the child position-offset fix, both re-derived from a single, unifying
root cause — `SvekResult#calculateDimension()`'s ink-extent-aware bbox
(`layout-ink-extent.ts#computeSvekResultGeometry`), not the naive geometric
box S3's own trial used. Diagnosing the child-position half by hand against
jar's real SVG (`coteta-47-mare883`, `lonuti-97-voko521`) showed the S3-named
"~7px, not the expected 6px" gap is EXACTLY `JAR_INK_MARGIN(6)` plus the
leaf-state-box ink rule's own `-1` min-corner asymmetry (mechanism 4's own
`addStateBoxInk`) — i.e. mechanism 7's position half and width/height half
are the SAME ink-extent computation, not two independent formulas. Landing
this surfaced two FURTHER, previously-invisible mechanisms (both
diagnosed-and-fixed, not deferred):

- A pre-existing bug in `transitionArrowheadInk` (mechanism 3, S1) that
  massively over-reports ink span for certain edge-angle/curvature
  combinations (self-loops; jar-verified `taxile-56-goca422`/`pebepi-32-
  cati486`/`tigibi-80-zidi137`, all the identical `state parent { child -->
  child }` shape) — worked around (not root-caused to an exact line) by
  excluding arrowhead ink from `computeSvekResultGeometry`'s own walk only
  (document-level ink, mechanism 4, is UNCHANGED, zero risk to its own
  already-pinned fixtures).
- Mechanism 8 (NEW, landed): `ConcurrentStates.java`'s real `calculateDimensionSlow`
  has ZERO separator gap between stacked regions (`Separator.add` is a bare
  sum; `drawSeparator` paints a line WITHIN the already-summed dimension,
  never reserving extra space) — `stackConcurrentRegions`'s `CONCURRENT_SEPARATOR_GAP
  = 60` (S1-era, explicitly self-documented "no exact upstream pixel constant
  traced") was WRONG. Diagnosed while chasing a mechanism-7-caused cascade
  regression on `nelupe-49-xova546` (a nested plain composite, `toutou9`,
  becoming MORE accurate via mechanism 7 pushed an already-at-ceiling,
  already-overshooting concurrent-composite total past its pinned
  allowance) — direct read of `ConcurrentStates.java` (not guessed) found
  the gap should be `0`, AND each region's own dimension should be
  `inner.calculateDimension()` (ink-based, the SAME `computeSvekResultGeometry`
  mechanism 7 already built), not the raw `layoutGraph()` canvas size
  `buildConcurrentAutonomSpec` used exclusively before. Landing BOTH pieces
  together (gap=0 + ink-based per-region dimension) fixed nelupe AND
  resolved 2 further regressions the gap=0-alone experiment introduced
  (`darime-88-moda428`, `lumamo-63-zupa263`) — full `state-dot-parity`
  ratchet (268/268) passes clean.

A THIRD sub-issue was diagnosed and explicitly NOT closed this iteration
(named, not silently dropped): a composite whose own dominant content is 1-2
short INTERNAL labeled transitions (`bunade-42-fudu910`'s `NotShooting`) still
under-sizes slightly, because `TransitionGeo.label` carries no measured WIDTH
field. A same-iteration attempt to measure it inline (`ctx.measurer`,
`buildLabelInkPoints`) was jar-verified directionally correct on `bunade` but
OVERSHOT on `beguxu-19-tize774` (single labeled edge) — a worse net result
than not attempting it — REVERTED. `buildPlainAutonomSpec`'s own
`Math.max(geometry.*, result.*)` floor stands in as a non-regressing
safety net for this specific residual (queued for S5).

```
S3 (before): 9/271  -- 1-3:17, 4-10:182, 11-30:40, 31+:23, errors:0
S4 (after): 13/271 -- 1-3:48, 4-10:156, 11-30:34, 31+:20, errors:0
```

4 new zero-diff pins: `coteta-47-mare883` (the primary S3-queued target),
`mibabe-49-kexu237`, `noboda-97-zevo886`, `nuduni-60-mupe742` (all 3
newly-unmasked as a side effect of mechanism 8's concurrent-region fix, not
independently diagnosed — verified via the fresh `parity-state.json` survey,
`dotEqual:true` + `conformant` on all 4, zero regressions on the 9
already-pinned fixtures). `lonuti-97-voko521` (S3's OTHER named target)
reached genuine geometry-exactness (composite box/child-position byte-exact)
but stays non-zero overall — its own remaining 9 diffs are a title
`<style>`-tag `FontColor` cascade + one unrelated title x-position, BOTH
pre-existing, unrelated to mechanisms 6/7/8 (named, not chased — a `<style>
root { FontColor Red }` cascade-to-text-fill gap, a genuinely different,
unscoped mechanism).

### Mechanism 7 (composite wrapper width/height + child position offset): LANDED

`src/diagrams/state/layout-ink-extent.ts#computeSvekResultGeometry` — the
SAME `SvekResult#calculateDimension()` recipe mechanism 4 (S1) already ports
for the TOP-LEVEL document (`computeStateDocumentDims`/`computeStateInkShift`),
reused for a WRAPPED CHILD PASS: an ink-extent bbox of the pass's own
MATERIALIZED content (`state-composite-geo.ts#materializeSpecs`, exported and
reused rather than re-derived — nested autonom/cluster composites get the
SAME real ink-box treatment `addNodeInk` already gives them at the document
level) yields BOTH the reported dimension (`ink-box + 15`, matching
`.delta(15,15)`) and the position shift (`6 - ink-box.min`, matching
`moveDelta(6-minX,6-minY)`) from the SAME walk — not two independent
formulas, as S3's own reverted trial (naive geometric box, no ink awareness)
assumed.

`src/diagrams/state/state-composite-autonom.ts#buildPlainAutonomSpec` —
rewritten: materializes its OWN child pass into `StateNodeGeo`/`TransitionGeo`
(`rawPosMap`/`inkStates`/`inkTransitions`, un-shifted, LOCAL coordinates,
mirroring what `layoutComposite`'s own top-level assembly would eventually
produce), computes `geometry` via `computeSvekResultGeometry`, feeds
`Math.max(geometry.width, result.width)`/height (the S3-established
"never regress a pinned entry" floor, needed ONLY for the still-open
label-ink residual named above) as `childImg` to `measureAutonomWrapper`, and
applies `geometry.dx`/`dy` via a NEW `shiftDotLayoutResult` helper (a pure,
non-mutating field-by-field translate of the child pass's own
`DotLayoutResult`) BEFORE storing it as `localPositions` — downstream
`state-composite-geo.ts#materializeAutonom` needed ZERO changes, since it
already reads `spec.localPositions.nodes` as the local coordinate frame.

**Jar-verified byte-for-byte** (own probe scripts, deleted before finishing):
- `coteta-47-mare883` (1 nesting level, description-bearing leaf child):
  composite outer box width/height AND leaf child `c`'s own absolute
  position, EXACT match to jar; `compareSvg` reaches TRUE zero-diff overall.
- `lonuti-97-voko521` (2 nesting levels, mixed leaf+nested-composite `A`
  containing empty `B` and composite `C` containing leaf `c`): BOTH `A`'s and
  `C`'s own outer box width/height, AND `c`'s own absolute position, EXACT
  match to jar (hand-derived and independently confirmed via the code).
- `bajelo-54-dixe684` (3 nesting levels, mechanism-6's own S3 target):
  UNCHANGED/non-regressing — `Track_FSM`/`Do_Sector`'s own box shapes still
  byte-exact; the fixture's remaining 5 diffs are entirely the ALREADY-named,
  ALREADY-deferred entity-vs-cluster wrap-split gap (S1/S3 item 3, the `Run`
  non-autonom cluster sibling), unchanged before/after (diff count identical,
  5→5, verified via a disposable baseline `git worktree`).

### Mechanism 7's own sub-bug (arrowhead-ink over-reach): diagnosed, worked around

Per diagnosis.md: instrumented (not guessed) — a direct probe of
`transitionArrowheadInk`'s own returned ink box for `taxile-56-goca422`'s
self-loop (`child --> child`) showed a ~30px total ink span for an
arrowhead whose own `ExtremityArrow` geometry (`xWing=9`) should bound it to
~18px at most; a SECOND, independently-diagnosed case
(`bunade-42-fudu910`'s `Idle --> Configuring` back-edge) showed the SAME
class of anomaly (an unexpectedly-very-negative `minX`). **Ruled out**: not
`place()`'s own `trim` field (`transitionArrowheadInk` never reads it). NOT
root-caused to an exact line in `ExtremityArrow`/`rotate-point.ts` this
iteration (would need its own dedicated diagnosis pass, out of THIS
iteration's budget) — named as a real, PRE-EXISTING bug (mechanism 3, S1),
not something S4 introduced; only NEWLY VISIBLE because mechanism 7 is the
first call site where arrowhead ink can dominate a composite's own tight
sizing (a full document's own ink is normally dominated by far larger
node-box ink, masking this). **Fix**: `layout-ink-extent.ts#addTransitionInk`
gained an `includeArrowheadInk` boolean; `computeSvekResultGeometry` passes
`false`, `computeStateDocumentDims`/`computeStateInkShift` (mechanism 4, S1)
keep `true`, UNCHANGED — zero risk to their own already-pinned fixtures.
Jar-verified: `taxile-56-goca422`/`pebepi-32-cati486`/`tigibi-80-zidi137`
(the identical shape) all returned to their PRE-mechanism-7 (already-passing)
`maxSizeDeltaIn`.

### Mechanism 8 (NEW) — `ConcurrentStates` separator-gap bug: diagnosed and LANDED

Per diagnosis.md: instrumented before hypothesizing. Landing mechanism 7's
width/height fix alone left EXACTLY 1 `state-dot-parity` regression,
`nelupe-49-xova546` (`maxSizeDeltaIn` 1.555555→1.583333, its OWN allowance
already at zero slack pre-S4). Traced the cascade: `nelupe`'s `s7_2` owns 3
concurrent regions, one of which (`[*] --> toutou9`) contains a nested PLAIN
composite `toutou9` (`[*] --> leo`) — mechanism 7 correctly fixed `toutou9`'s
OWN reported size (now EXACT jar match, confirmed by direct node-size probe),
which correctly grew the CONTAINING region's own raw canvas height by the
SAME amount — and `stackConcurrentRegions` (unrelated to mechanisms 6/7, a
S1-era formula, self-documented "no exact upstream pixel constant traced")
SUMS region heights + a flat `CONCURRENT_SEPARATOR_GAP=60` PER GAP, so ANY
correct increase to one region's own height cascades 1:1 into `s7_2`'s own
already-overshooting total (baseline delta 1.5556in ≈ 112px, dominated by
this SAME gap term: 2 gaps × 60px ≈ 120px, suspiciously matching). Direct
read of `~/git/plantuml/.../svek/ConcurrentStates.java` (not guessed):
`Separator.add(orig, other)` for the `--`/HORIZONTAL case is `new
XDimension2D(max(orig.w,other.w), orig.h+other.h)` — a BARE SUM, zero gap
term at all; `drawU`'s own cursor advance (`ug.apply(separator.move(dim))`)
uses `dim = inner.calculateDimension()` directly, confirming the SAME
zero-gap stacking at render time. `Separator.drawSeparator` paints the
dashed rule WITHIN the already-summed space (never reserves extra layout
room). **Ruled out**: gap=0 ALONE (without ALSO switching each region's own
dimension from raw canvas to `inner.calculateDimension()`'s real ink-based
formula) was tried first and INTRODUCED 2 new regressions
(`darime-88-moda428`, `lumamo-63-zupa263`) — confirming BOTH pieces (zero
gap AND ink-based per-region sizing) are required together, matching
`ConcurrentStates.java`'s own `inner.calculateDimension()` call exactly
(the SAME `SvekResult#calculateDimension()`/`computeSvekResultGeometry`
mechanism 7 already built, reused here rather than re-derived).

**Fix**: `state-composite-sizing.ts#CONCURRENT_SEPARATOR_GAP` set to `0`
(kept, not deleted, as a named, doc-commented knob rather than silently
removing the term). `state-composite-concurrent.ts#buildConcurrentAutonomSpec`
gained `regionInkDim` (materializes each region's own content, runs
`computeSvekResultGeometry`, `Math.max`-floored against raw canvas for the
SAME non-regressing-floor reason mechanism 7's own `childImg` is) — used for
BOTH `stackConcurrentRegions`'s own input AND `combineConcurrentPasses`'s own
`yShift` (previously raw `p.result.height+REGION_GAP`; now the SAME
`regionInkDim(p).height` per region, keeping reported SIZE and actual STACK
POSITION consistent, matching upstream's own single `calculateDimension()`
call for both purposes). Jar-verified: full `state-dot-parity.test.ts` ratchet
268/268 passing (0 failures, down from mechanism 7's own 1); `nelupe`/
`sapelo-46-jafe280` (the identical `toutou9`-nested-in-region shape) both now
show ONLY an UNRELATED, already-known `svg/g[1][childCount]` diff (the S1-era
transition-nesting simplification, item unrelated to sizing) with ZERO
`svg/@width`/`@height` diffs — a genuine, large fidelity improvement beyond
the single regression it was fixing.

### Ratchet / pins

13 fixtures pinned (was 9; +4: `coteta-47-mare883`, `mibabe-49-kexu237`,
`noboda-97-zevo886`, `nuduni-60-mupe742`) — `oracle/goldens/svg-state/
ratchet.json` updated, 4 new golden dirs added (`in.puml`+`golden.svg`,
copied verbatim from `test-results/dot-cache/state/<slug>/`).
`state.golden.ratchet.test.ts`: **15 tests** (was 11; 13×AC1 + AC2 + AC3),
all passing. `parity-state.json` regenerated clean (0 timeouts; an earlier
regen run under concurrent system load produced 17-130 spurious `timeout`
verdicts on ALREADY-pinned fixtures including `xuzapa-55-xoli880` — ruled
out as a real regression by re-running in isolation after killing stale
concurrent survey processes; `xuzapa`'s own `AC1` byte-exact-against-golden
test never stopped passing throughout, confirming the timeouts were a
survey-tool/system-load artifact, not a render regression).

### size-backlog.json: 138 → 102 entries (36 deleted, 51 tightened, 0 widened)

Computed EVERY backlog entry's actual current `maxSizeDeltaIn` (a dedicated,
disposable probe script, deleted before finishing) and compared against its
pinned allowance: **0 entries worsened** (matches the DOT-parity suite's own
clean 268/268 pass), 87 improved, of which 36 reached EXACTLY 0 (deleted,
matching `size-backlog.json`'s own documented "Phase L size iterations drive
entries to 0 and DELETE them" convention) and 51 shrank but not to zero
(tightened to their new exact actual value — strictly tighten-only, verified
`new <= old` for every entry before writing). Notable large shrinks:
`nelupe-49-xova546` 1.555555→0 (deleted), `sapelo-46-jafe280` 1.444445→0
(deleted), `pevene-26-kebo361` 1.541666→0 (deleted), `nivanu-50-zajo916`
1.361112→0 (deleted), `zacajo-09-tamu628` 1.604167→0.144419, `xasoka-58-
temi462` 1.773264→0.213889, `joleju-94-maru748` 5.916667→0.462240,
`lonuti-97-voko521`/`soxene-95-domu248`/`lasasi-13-nona547` all →0.000034
(effectively exact, floating-point noise) — the large concurrent-region
fixtures (mechanism 8's own primary target) dominate the biggest shrinks, as
expected.

### Also discovered, out of S4's write-set (named, not fixed)

- The label-ink under-count for internal composite transitions (named above,
  `Math.max`-floored, not root-caused) — queued whole for S5, needs
  `attachTransitionLabel`'s own placement formula reconciled against jar's
  real klimt position before a byte-exact fix is possible.
- `transitionArrowheadInk`'s own over-reach bug (worked around via
  `includeArrowheadInk:false` for composite sizing only) — the document-level
  call site (mechanism 4) still uses it unconditionally; NOT verified this
  iteration whether the SAME bug could ever surface there for some
  not-yet-sampled fixture (no evidence it does, but not exhaustively ruled
  out either).

### Files changed (S4)

- `src/diagrams/state/layout-ink-extent.ts` — `computeSvekResultGeometry`
  (NEW, mechanism 7's own dimension+shift primitive), `addTransitionInk`/
  `buildInkBox` gain `includeArrowheadInk` (mechanism 7's own sub-bug
  workaround).
- `src/diagrams/state/state-composite-geo.ts` — `materializeSpecs`/`PosMap`
  exported (reused by both `state-composite-autonom.ts` and
  `state-composite-concurrent.ts`).
- `src/diagrams/state/state-composite-autonom.ts` — `buildPlainAutonomSpec`
  rewritten (mechanism 7); `shiftDotLayoutResult` (NEW).
- `src/diagrams/state/state-composite-concurrent.ts` — `buildConcurrentAutonomSpec`/
  `combineConcurrentPasses` rewritten (mechanism 8); `regionInkDim` (NEW);
  `REGION_GAP` constant removed (superseded by `regionInkDim`'s own zero-gap
  stacking).
- `src/diagrams/state/state-composite-sizing.ts` — `CONCURRENT_SEPARATOR_GAP`
  set `0` (mechanism 8), doc comment rewritten with the `ConcurrentStates.java`
  citation.
- `oracle/goldens/svg-state/ratchet.json` — 4 fixtures added.
- `oracle/goldens/svg-state/{coteta-47-mare883,mibabe-49-kexu237,noboda-97-
  zevo886,nuduni-60-mupe742}/{in.puml,golden.svg}` — NEW.
- `oracle/goldens/state/size-backlog.json` — 138→102 entries (36 deleted, 51
  tightened, tighten-only verified).
- `tests/oracle/svg-conformance/parity-state.json` — regenerated (271/271
  surveyed, 13/271 conformant+1 structural-match, 0 timeouts/errors).
- `plans/g4-state-svg/README.md`, `plans/g4-state-svg/ledger.md` — this
  entry.

### Gates (S4, final)

- `state` census: **13/271** zero-diff (`1-3:48, 4-10:156, 11-30:34, 31+:20,
  errors:0`) — up from S3's `9/271` (`1-3:17, 4-10:182, 11-30:40, 31+:23`).
- Class census: **303/718**, intact, unchanged (`0:303,1-3:25,4-10:103,
  11-30:19,31+:268,errors:0`).
- Object census: **22/80**, intact, unchanged (`0:22,1-3:5,4-10:11,
  11-30:11,31+:31,errors:0`).
- Description census: **48/355**, intact, unchanged (`0:48,1-3:26,4-10:73,
  11-30:67,31+:140,errors:1` — the 1 error pre-existing, unrelated).
- DOT gate: `component 262/262 · usecase 90/90 · class 708/708 · object
  78/80 · state 267/267` — EXACTLY unchanged, verified BEFORE and AFTER
  every mechanism landed this iteration.
- `state-dot-parity.test.ts` (the size-backlog ratchet): **268/268**
  passing (0 failures) — was 267/268 (1 pre-existing near-ceiling entry,
  `nelupe-49-xova546`) before mechanism 8; briefly 21/268 failing mid-
  iteration while mechanism 7 landed alone (fully resolved by mechanism 8).
- `npm test -- --run`: 9959/9959 passing (364 files, +4 vs S3's 9955 — the
  4 new `state.golden.ratchet.test.ts` AC1 assertions).
- `npm run typecheck` / `npm run lint` / `npm run build`: all clean.
- `state.golden.ratchet.test.ts`: 15 tests (13 pins), up from 11 (9 pins).

### S5+ queue

1. **Label-ink under-count** (named above) — needs `attachTransitionLabel`'s
   own placement formula reconciled against jar's real klimt position.
2. **`transitionArrowheadInk`'s own root cause** — the S4 workaround
   (`includeArrowheadInk:false` for composite sizing) sidesteps rather than
   fixes the underlying `ExtremityArrow`/`rotate-point.ts` bug; worth a
   dedicated diagnosis pass since it could ALSO affect the document-level
   ink call site on a not-yet-sampled fixture.
3. **Entity-vs-cluster wrap split** (item 3, S1/S3, STILL confirmed NOT
   bounded) — `bajelo-54-dixe684`'s `Run` cluster sibling remains the
   dominant residual on that fixture; needs library-level graphviz cluster
   bounding-box exposure or a state-only local-bbox approximation.
4. **`<<sdlreceive>>` unwrapped-entity gap** — unchanged from S1/S2/S3.
5. **Notes never render** — unchanged from S1/S2/S3.
6. **`lonuti-97-voko521`'s own `<style>`-tag `FontColor` cascade gap** (NEW,
   named this iteration) — a `<style> root { FontColor Red }` block's cascade
   to text `fill` and one title `<g class="title">` x-position residual; both
   unrelated to mechanisms 6/7/8, not chased.
7. **Transition routing/positioning** (`svg/g/g/path/@d`) — unchanged from
   S2/S3, the dominant residual on several near-zero, non-composite fixtures;
   the mission's own secondary scope for S4 (deferred entirely this
   iteration — mechanism 7+8's own scope consumed the full iteration budget).
8. Re-run the census and `--families` report FRESH again — mechanism 8's own
   reach (concurrent-region fixtures) should now show real per-feature
   fidelity for the first time this mission.

## S5 — transition-nesting mechanism landed (mission's primary scope),
composite ordering + explicit background rect + EntityImageStateEmptyDescription
landed as cheap follow-ons, 13→14 pins, 267/271→267/271 dotEqual unchanged

### Summary

Per this iteration's own instruction, hand-sampled ≥20 of the 48 S4-baseline
near-zero (1-3 diff) fixtures plus ≥10 from the 4-10 bucket BEFORE fixing
anything (temp scripts, deleted before finishing). The attribution table
below shows the dominant, previously-masked signature: `svg/g[1][childCount]`
(alone, or combined with `svg/@height`/`svg/@width`/`svg/@viewBox`) reaches
129/271 fixtures at the EXACT classic 5-diff pattern alone, plus dozens more
variants — overwhelmingly the mission's own named "transitions render as FLAT
siblings" simplification (S1 ledger, mechanism 2's own doc comment): jar
nests a composite pass's OWN internal transitions INSIDE that pass's own
`<g>` (siblings of its entity/cluster children), never as flat top-level
siblings. Landed this mechanism in full (the mission's stated primary
scope), TDD-first, jar-verified byte-exact against `bajelo-54-dixe684`'s own
document structure (`lnk10`/`lnk11` both nest inside `Track_FSM`'s own `<g>`,
confirmed via a full pretty-printed XML dump, not guessed).

Landing it triggered the SAME mixed-direction unmasking signature S0/S1/S3/S4
each already exhibited: `compareSvg`'s childCount short-circuit previously
hid EVERY deeper structural difference for composite fixtures — closing it
let the comparator recurse further and surface several FURTHER, previously
invisible, genuinely separate bugs (named below, not conflated with the
nesting fix itself). Two of these were cheap enough to land THIS iteration
(top-level real-before-pseudo ordering; explicit background `<rect>` for a
non-default diagram background); one more (`EntityImageStateEmptyDescription`,
`hide empty description` + zero body lines) was independently discovered
during the 1-3-bucket sampling pass and landed as its own mechanism, closing
2 fixtures outright. Two more (concurrent-region separator `<line>`s never
drawn; per-region pseudo-node id collision) were diagnosed and root-caused
via a full jar XML pretty-print but NOT landed — genuinely new rendering
features (not "fix a formula"), explicitly named and queued for S6 rather
than forced under this iteration's own "cheapest first" instruction.

```
S4 (before): 13/271 -- 1-3:48, 4-10:156, 11-30:34, 31+:20, errors:0
S5 (after):  14/271 -- 1-3:29, 4-10:136, 11-30:44, 31+:48, errors:0
```

+1 new pin (`tezivo-82-rufa055`, EntityImageStateEmptyDescription mechanism),
0 pins lost (all 13 S4 pins verified unchanged via a fresh `parity-state.json`
regen, `conformant && dotEqual` on all 14). The 1-3/4-10 buckets SHRANK
(48→29, 156→136) while 11-30/31+ GREW (34→44, 20→48) — net fixture count
unchanged (271), but redistributed toward LARGER diff counts in aggregate.
This is the SAME shape S0/S1's own mechanism landings produced (their own
doc comments: "mechanism 2's own childCount short-circuit unblocking exactly
as predicted... immediately surfacing a further mechanism") — a structurally
NECESSARY, jar-verified-correct fix that trades a shallow, uninformative
1-diff-everywhere signature for a smaller number of deeper, but now REAL and
individually addressable, per-fixture diff sets. No PINNED fixture regressed;
`state-dot-parity.test.ts` (size-backlog ratchet) stayed CLEAN at 268/268
throughout (this iteration's mechanisms are render-structure-only, no
sizing-formula changes, so no size-backlog entry could have moved either
direction — verified, not assumed, via the ratchet staying green start to
finish).

### Sampled fixtures (≥20 from the 1-3 bucket, ≥10 from 4-10, hand-probed)

1-3 bucket (35 sampled via a full dump, ≥20 hand-inspected individually):
`beguxu-19-tize774`, `bilare-19-fufe539`, `cekolo-21-gini183`, `ceruzi-77-
give569`, `dajipi-09-doki542`, `dapuko-98-zuzo096`, `decede-10-buvu414`,
`fakali-52-zuje420`, `gokife-89-boja382`, `gopumi-11-pise779`, `judova-36-
kana429`, `kenuci-20-cane702`, `labono-83-nega255`, `lalava-26-zosi801`,
`lasasi-13-nona547`, `livuni-63-fira764`, `lulozu-10-bopu547`, `maruju-55-
soko478`, `mazuzu-54-mene929`, `nelupe-49-xova546`, `nibelu-74-pido796`,
`nivanu-50-zajo916`, `pavuzo-79-zodu430`, `pevene-26-kebo361`, `pexiku-77-
japi217`, `sapelo-46-jafe280`, `semala-31-joji042`, `soxene-95-domu248`,
`tegali-39-molu382`, `tezivo-82-rufa055`, `xexika-61-fedu273`, `xoravu-40-
gebe122`, `xojudi-20-keco020`, `zebuzu-41-caro961`, `zepodi-66-moda518`.
4-10 bucket (≥10 hand-inspected, plus a full 129-fixture programmatic sweep
of the exact classic 5-diff pattern): `bemena-23-zebu249`, `bitaxo-18-
tamo974`, `bujuta-44-rovo666`, `bunade-42-fudu910`, `cakaxu-97-nexe753`,
`cekavi-25-cija650`, `cesifo-37-rugu443`, `cinoni-00-sere847`, `cupesu-59-
sajo991`, `dapunu-39-kava045`, `nelupe-49-xova546`/`sapelo-46-jafe280`
(cross-checked against the 1-3 list — both moved buckets mid-investigation),
`niveno-60-tiro789`, `xipela-98-nuvu593`, `nijugi-19-jazi166`, `nuboca-13-
xape657`, `xexika-61-fedu273`.

### Attribution table (mechanism-bucketed, cheapest-first)

| Mechanism | Signature | Reach (sampled) | Status |
|---|---|---|---|
| 9. Composite internal-transition nesting (flat-sibling simplification) | `svg/g[1][childCount]` alone or + `svg/@height`/`@width`/`@viewBox` | 129/271 at the EXACT classic 5-diff pattern; dominant family across BOTH buckets | **LANDED** |
| 10. Composite top-level real-vs-pseudo ordering | `svg/g[1]/g[N]/@class` swap at top level | common-case win (single composite + one `[*]` pair); NOT a full fix for multi-entity/creation-order cases | **LANDED** (partial — real upstream rule is creation-index-based, out of scope) |
| 11. `EntityImageStateEmptyDescription` (`hide empty description` + 0 body lines) | no divider, centered text, UNWRAPPED | 10/271 fixtures use the directive | **LANDED** |
| 12. Explicit content background `<rect>` for non-default diagram background | `svg/g[1]/rect[1]` missing | 11/271 (15 non-default-bg minus 4 misclassified error-diagrams) | **LANDED** |
| 13. Concurrent-region separator `<line>`s never drawn | childCount undercounts by (regions-1) | 18/271 fixtures use `--`/`||` regions | Diagnosed, NOT landed (new rendering feature) |
| 14. Per-region pseudo-node id/scope collision (`addLocalPseudoNodes` shares `owner.id` across ALL regions) | duplicate `<g class="start_entity">` siblings with the same internal id | subset of the 18 concurrent-region fixtures | Diagnosed, NOT landed |
| 15. `transitionArrowheadInk`'s own root cause (S4 queue item 2) | — | not sampled this iteration | Deferred, unchanged |
| 16. Entity-vs-cluster wrap split (S1/S3 item 3) | — | `bajelo-54-dixe684` and similar | Deferred, unchanged |
| 17. `<<sdlreceive>>`/pseudostate stereotype wrap gaps | `svg/g[1][childCount]` (e.g. `cekolo-21-gini183`) | small, pre-existing S1-S3 named gap | Deferred, unchanged |
| 18. 4 fixtures misclassified: jar renders a PARSE-ERROR diagram, not STATE | `data-diagram-type` absent, green-on-black error page | `cagego-53-vemo516`, `fugedo-34-fice721`, `xacona-99-peze211`, `zecivu-62-pagu681` | Out of scope (jar-blind, matches G3's `gizini-87-vuve916` precedent) |
| 19. Transition routing/positioning (`svg/g/g/path/@d`) — the mission's own secondary scope | e.g. `gopumi-11-pise779`'s `[*]-to-s0_start` cross-composite edge, hand-observed while probing mechanism 10 | several fixtures, magnitude varies (small to large) | NOT started — budget consumed by mechanism 9 + its own unmasking |

### Mechanism 9 (composite internal-transition nesting): LANDED

`src/diagrams/state/state-geo-types.ts#StateNodeGeo` gained a new required
`transitions: TransitionGeo[]` field — the transitions belonging to THIS
node's own svek pass boundary (non-empty only for an `'autonom'`-materialized
composite node; a plain leaf or non-autonom `'cluster'` node always carries
`[]`, since a cluster shares its container pass's edges, never owning any of
its own). `src/diagrams/state/renderer.ts#renderNodeWrapped` renders
`node.transitions` as siblings of `childrenMarkup`, INSIDE the node's own
`<g>` wrap (after children, matching jar's own document order: entities/
clusters first, this pass's own edges last).

`src/diagrams/state/state-composite-geo.ts` — `materializeAutonom` no longer
takes an `outTransitions` accumulator param; it computes `spec.
localTransitions.map(t => shiftTransition(t, dx, dy))` and attaches the
result DIRECTLY to its own returned node's `.transitions` field. A NESTED
autonom composite (reachable via `spec.localStates`) attaches ITS OWN edges
to ITS OWN node during the SAME recursive `materializeSpecs` call — nothing
bubbles past its own pass boundary anymore, replacing the pre-S5 flat-array
accumulator that flattened every nested pass's edges into ONE array regardless
of true nesting depth. `materializeCluster` never owned any transitions of
its own (`transitions: []` always) — unchanged in effect, simplified in
signature (also drops `outTransitions`). `layoutComposite`'s own top-level
`transitions` is now ONLY the top-level pass's own edges (`buildLevelTransitionGeos
(acc, result)` alone, no `nestedTransitions` merge).

`src/diagrams/state/layout-ink-extent.ts#addNodeInk` gained an
`includeArrowheadInk` param (threaded from `buildInkBox`, unchanged
semantics) and now ALSO recurses into `node.transitions` for a composite
node (alongside its existing `node.children` recursion) — this keeps
`computeStateDocumentDims`/`computeStateInkShift`/`computeSvekResultGeometry`'s
own signatures UNCHANGED while covering the SAME ink the pre-S5
`outTransitions` accumulator used to feed them explicitly. `state-composite-
autonom.ts#buildPlainAutonomSpec` and `state-composite-concurrent.ts
#regionInkDim` both simplified to match (drop their own `outTransitions`
locals, rely on the ink-walk's own recursion).

`src/diagrams/state/renderer-uid.ts` — `edgeUid` changed from an array
parallel to a single flat `geo.transitions` list to a `Map<TransitionGeo,
string>` keyed by object identity (transitions now live in MULTIPLE arrays:
the top-level list plus every composite node's own `.transitions`, so a
single array-index scheme no longer identifies a transition uniquely). The
NUMBERING ORDER is unchanged in shape: top-level pass edges first, then each
node's own nested edges walked in the SAME states pre-order `collectPreOrder`
already used — reproducing the pre-S5 flat-array numbering exactly for every
flat (non-composite) fixture (zero behavioral change there, `geo.transitions`
alone, no nested nodes exist) and a reasonable, documented-as-approximate
order for composite fixtures (this port's state parser still has no
`creationIndex` threading, an ALREADY-documented pre-S5 gap, unaffected by
this restructuring).

**Jar-verified** (full pretty-printed XML dump of `bajelo-54-dixe684`'s own
cached `in.svg`, hand-traced bracket nesting): `Stop-to-Chg_Sector` (`lnk10`)
and `Run-to-Stop` (`lnk11`) both nest DIRECTLY inside `Track_FSM`'s own `<g
class="entity">`, as SIBLINGS of its entity/cluster children (`Run` cluster,
`Chg_Sector`/`Do_Sector`/`Stop` entities) — regardless of which specific
entity/cluster their own endpoints happen to sit inside. Top-level pass edges
(`*start*-to-Track_FSM`, `Track_FSM-to-*end*`) stay OUTSIDE `Track_FSM`'s own
`<g>`, as direct siblings of the outer content `<g>`'s own children. This
exactly matches mechanism 9's design: transitions attach to the nearest
ENCLOSING PASS BOUNDARY (autonom composite or top level), never to the
specific entity/cluster an endpoint happens to sit inside.

### Mechanism 10 (composite top-level real-vs-pseudo ordering): LANDED (partial)

`src/diagrams/state/state-composite-pass.ts#buildTopLevelPass` — `specs:
[...pseudoSpecs, ...specs]` (real states/composites AFTER pseudo start/end)
was BACKWARD; flipped to `[...specs, ...pseudoSpecs]` (real entities FIRST,
pseudo start/end LAST) — matches jar's own document order (`bajelo-54-
dixe684`: `Track_FSM` entity first, `.start.`/`.end.` pseudo entities last)
AND the FLAT pipeline's own PRE-EXISTING convention (`layout.ts
#buildFlatStateGeos` already pushes `buildPseudoNodeGeos` AFTER the real
states — this fix brings the composite pipeline in line with a convention
the flat pipeline already had right). Verified SAFE against all 13 S4-pinned
fixtures: none use a top-level `[*]` transition (the ONLY case `pseudoSpecs`
is ever non-empty), so this reorder is a pure no-op for every currently-
pinned fixture. Jar-verified CORRECT for the common single-composite-plus-
one-pseudo-pair shape.

**NOT a full fix** — `nelupe-49-xova546` (two REAL top-level entities, `s7_2`
composite AND `s0_start` leaf, both alongside a `[*]` pair) shows jar's real
order is `s7_2, .start., s0_start` — neither pure declaration order NOR a
simple "real-before-pseudo" rule explains `s0_start` sorting AFTER the pseudo
`.start.` entity. This strongly suggests jar's true ordering is CREATION-
INDEX based (parse-time entity-creation order), the SAME already-documented,
already-accepted gap `renderer-uid.ts`'s own doc comment names ("this port's
state parser has no creationIndex threading at all... a documented
approximation") — NOT a new problem this iteration introduced, and not
chased further (would require threading a parse-time creation counter through
the whole AST, a separate, larger mission-scale item).

### Mechanism 11 (`EntityImageStateEmptyDescription`): LANDED

Per diagnosis.md: instrumented before hypothesizing — `gopumi-11-pise779`'s
own `S1` (`hide empty description`, `[*] --> S1`, `S1 --> S2`, no `S1 :`
body) showed a lone `svg/g[1][childCount]` diff even after mechanism 9's own
fix; a direct hand-read of jar's cached `in.svg` showed `S1` rendered as a
BARE `<rect>`+`<text>` pair, NOT wrapped in any `<g>`, with NO divider `
<line>` — unlike `S2` (which HAS a `S2 : description` body line, rendered
via the regular `EntityImageState` box, wrapped + divided). Traced to
`GeneralImageBuilder.createEntityImageBlockInternal`'s real dispatch (direct
Java read, not guessed): `if (isHideEmptyDescriptionForState &&
leaf.getBodier().getRawBody().size() == 0) return new
EntityImageStateEmptyDescription(leaf);` — a genuinely separate upstream
shape class, gated on BOTH the `hide empty description` directive AND a
truly empty raw body (not just an unset description). **Ruled out**: this is
NOT the same condition `renderer-box.ts`'s OWN pre-existing doc comment
already named ("jocela-05-niba392... the divider STILL draws") — that
fixture uses explicit `state state1 #red` declaration syntax with no `hide
empty description` directive at all, a DIFFERENT case (regular
`EntityImageState`, always-drawn divider); confirmed by re-reading that
fixture's own source, not assumed.

`src/diagrams/state/state-sizing.ts` — `measureNormalKind` ALREADY dimensioned
this shape correctly pre-S5 (`measureEmptyDescription`, jar-verified "px-exact"
per this file's own top doc comment, `bilare-19-fufe539` — sizing was never
the gap). `buildStateGeoTextFields` gained a `hideEmptyDescription` param
(default `false`): when `state.kind === 'normal' && hideEmptyDescription &&
!hasBody`, sets a NEW `emptyDescription: true` marker on the returned
`StateGeoTextFields`/`StateNodeGeo` alongside the SAME `headerLines`
measurement the regular path already uses (only the RENDER shape differs,
not the text measurement). Threaded through the 2 real call sites that
handle genuine LEAF states (`layout.ts#buildFlatStateGeos` via `ast.
hideEmptyDescription`; `state-composite-pass.ts#resolveMember`'s leaf branch
via a NEW `DiagramCtx.hideEmptyDescription` field) — the 2 COMPOSITE-title
call sites (`state-composite-autonom.ts`/`state-composite-concurrent.ts`)
pass nothing, defaulting to `false`, since a composite's own title never
takes this leaf-only upstream branch (`LeafType.STATE`'s dispatch only fires
for the non-composite case).

`src/diagrams/state/renderer-box.ts#renderEmptyDescription` (NEW) — rect
only (no divider, no body), label CENTERED both horizontally AND vertically:
`yDesc = (node.height - headerLines.length*fontSize) / 2`, baseline =
`node.y + yDesc + textAscent(fontSize)` (+ `i*fontSize` per subsequent
line), x CENTERED per-line via the SAME `node.x + node.width/2 - ln.width/2`
convention the regular box's header already uses. Hand-derived algebraically
against `gopumi-11-pise779`'s own `S1` (box x=25.86 y=86 w=50 h=40, single
line "S1"): `yDesc = (40 - 14)/2 = 13`, baseline `= 86 + 13 + 10.8889 =
109.8889` — EXACT match to jar's own `y="109.8889"`; x `= 50.86 - 17.15/2 =
42.285` — EXACT match to jar's own `x="42.285"`.

`src/diagrams/state/renderer.ts#wrapClassFor` — `node.emptyDescription ===
true` now returns `undefined` (unwrapped), matching fork/join/history/
deepHistory's already-established "no `<g>` at all" precedent.

**Jar-verified**: `gopumi-11-pise779`'s `S1` now renders bare `<rect
x="25.862500000000004" .../><text x="42.2875" y="109.88888888888889"...
S1</text>` (numeric tolerance-equal to jar's own rounded `x="42.285"
y="109.8889"`), unwrapped, no divider — `tezivo-82-rufa055` reached TRUE
zero-diff and is pinned. `bilare-19-fufe539` (4 EmptyDescription states, no
transitions at all) improved 3→2 diffs (both remaining diffs a 1px `svg/
@width`/`@viewBox` rounding artifact, PRE-EXISTING and unrelated to this
mechanism — not chased, named in the S6 queue).

### Mechanism 12 (explicit background `<rect>` for non-default background): LANDED

Per diagnosis.md: instrumented, not guessed — `dapuko-98-zuzo096`
(`skinparam BackgroundColor gray`) showed `svg/g[1][childCount]` off by
exactly 1 even with mechanisms 9-11 landed; a direct hand-read of jar's
cached `in.svg` showed an EXPLICIT `<rect x="0" y="0" width="155"
height="121" fill="#808080" style="stroke:none;stroke-width:1;"/>` as the
FIRST child of the content `<g>`, BEFORE any entity markup — a shape S1's
own mechanism-1 sample (16 fixtures, S0 ledger) never exercised, since none
of those samples used a non-default background. **Ruled out** (a targeted
but ultimately unsuccessful source search, logged honestly rather than
guessed): `TitledDiagram#calculateBackColor`, `CucaDiagram`,
`GeneralImageBuilder`, `core/TextBlockExporter#maybeDrawBorder`,
`SvgGraphics`'s own `finalizeRootAttributes` (confirmed this ONLY sets the
root `style="...background:...;"` attribute, draws no `<rect>` at all) —
none of these contain the actual content-level rect draw call. Empirically
confirmed instead via jar bytes across ALL 11 real (non-error-diagram)
non-default-background STATE corpus fixtures — every one shares the exact
SAME `<rect x="0" y="0" width="W" height="H" fill="{background}"
style="stroke:none;stroke-width:1;"/>` shape (W/H = the document's own final
dimensions); 2 default-`#FFFFFF`-background pinned fixtures (`jocela-05-
niba392`, `coteta-47-mare883`) confirmed to carry NO such rect, ruling out
an unconditional draw. This project's own established "jar-verified, exact
source line not found" pattern applies (e.g. mechanism 3's own
`transitionArrowheadInk` sub-bug, S4 ledger) — the mechanism is real and
confirmed by evidence, even without a pinned Java call site.

`src/diagrams/state/renderer-shell.ts#maybeBackgroundRect` (NEW) — emits the
rect (via the existing `core/svg.ts#rect` helper, `stroke:'none'`/
`strokeWidth:1`, separate attrs rather than jar's own `style=` string —
`tests/oracle/svg-conformance/normalize.ts`'s own established style-vs-attrs
equivalence makes both forms byte-equivalent for the comparator, this
codebase's pre-existing convention, not a new one) ONLY when `fragment.
background !== '#FFFFFF'`, prepended to `fragment.body` before the content
`<g>` wrap — additive to (not a replacement for) `assembleDocumentShell`'s
own existing root-style handling, which stays correct and untouched for
BOTH cases.

**Jar-verified**: `dapuko-98-zuzo096`'s own childCount gap closed (the rect
now present); `niveno-60-tiro789`/`xexika-61-fedu273` both confirmed via
direct byte inspection to match jar's own rect format exactly. Neither
fixture reached zero-diff this iteration (both have OTHER, unrelated
residuals — `niveno` has a separate, PRE-EXISTING `svg/@background` mismatch,
`ours=#FFFFFF jar=#AAAAAA`, i.e. the THEME never even resolves the correct
background color for that specific fixture — a genuinely different,
unscoped bug, named in the S6 queue, NOT this mechanism's own fault since
`maybeBackgroundRect` correctly reads WHATEVER `fragment.background` value
it's given).

### Mechanisms 13/14 (concurrent-region separator lines + per-region pseudo-id collision): diagnosed, NOT landed

Per diagnosis.md: instrumented via a full pretty-printed XML dump of
`nelupe-49-xova546`'s own cached `in.svg` (`s7_2`, 3 concurrent regions:
region-0 `chat1`, `CONC1` containing nested composite `toutou9`, `CONC2`
`chat2`). Two SEPARATE, real, pre-existing gaps found (NOT introduced by
mechanism 9 — both were already present pre-S5, simply invisible behind the
SAME childCount short-circuit mechanism 9's own landing removed):

- **Mechanism 13**: jar draws a dashed `<line x1="12" y1="156" x2="122"
  y2="156" style="stroke:#181818;stroke-width:1.5;stroke-dasharray:8,10;"/>`
  BETWEEN each pair of stacked concurrent regions (2 separators for 3
  regions) — this port's `renderer.ts`/`state-composite-concurrent.ts` never
  draws ANY separator line at all (grepped, zero hits for `dasharray`/
  `separator`/`Separator` across the render path). Directly explains the
  `g[1]/g[1][childCount]` off-by-`(regions-1)` residual observed on `nelupe`
  post-mechanism-9 (`ours=13, jar=15`, exactly 2 missing).
- **Mechanism 14**: `state-composite-concurrent.ts#buildConcurrentRegionPass`
  passes `owner.id` (NOT a per-region scope id) as the `scopeId` param to
  `runOneConcurrentBranch`/`addLocalPseudoNodes`/`addLevelEdges` for EVERY
  region (region-0's own inline call in `buildConcurrentAutonomSpec` ALSO
  uses `s.id` — correct for region-0 alone, matching jar's own `s7_2..start.
  s7_2` naming, but the SAME `s.id` gets reused for CONC1/CONC2 too, which is
  wrong). jar creates a DISTINCT `[*]` pseudo-anchor PER region (`s7_2..
  start.s7_2` for region-0, `s7_2.CONC1..start.CONC1` for CONC1, `s7_2.
  CONC2..start.CONC2` for CONC2, each independently id'd) — this port
  currently creates 3 SEPARATE `StateNodeGeo` entries (correct COUNT, one
  per region, since each region has its OWN accumulator) but ALL 3 share the
  SAME internal `__init_s7_2` id (since `scopedPseudoIds(scopeId)` collapses
  to the SAME string for every region), a real, distinct id-collision bug
  from mechanism 13.

**NOT landed this iteration** — both are genuinely NEW rendering
features/fixes (drawing a not-yet-implemented separator line; re-deriving
per-region scope ids through `concurrentRegionScopeId`, already used
elsewhere for note-scoping — `buildConcurrentRegionPass`'s own `noteScopeId`
param already computes the CORRECT per-region id, just doesn't reuse it for
`scopeId`), not "cheap" formula fixes — explicitly deferred per this
iteration's own "cheapest first" instruction rather than rushed. `nelupe`/
`sapelo` (both concurrent-region fixtures) show a real, if temporary,
diff-count INCREASE from mechanism 9 alone (1→14/15) since mechanism 9
correctly stopped masking these two PRE-EXISTING gaps — queued whole for S6,
where landing both together should recover (and likely improve past) their
pre-S5 apparent diff counts.

### Also discovered, out of S5's write-set (named, not fixed)

- `svg/g/g/path/@d` differences for cross-composite top-level edges (e.g.
  `gopumi-11-pise779`'s `[*]-to-s0_start`, hand-observed on `nelupe`/
  `sapelo` too post-mechanism-9) — the mission's OWN secondary scope item,
  NOT started this iteration (budget fully consumed by mechanism 9's own
  scope + its unmasking cascade). Queued whole for S6.
- `bilare-19-fufe539`'s own residual 1px `svg/@width`/`@viewBox` rounding
  gap (unrelated to mechanism 11, present both before and after) — small,
  not chased.
- `niveno-60-tiro789`'s own `svg/@background` mismatch (theme resolution
  failure for that specific fixture's background color, unrelated to
  mechanism 12) — named, not chased.
- 4 fixtures (`cagego-53-vemo516`, `fugedo-34-fice721`, `xacona-99-peze211`,
  `zecivu-62-pagu681`) discovered to be jar-classified PARSE-ERROR diagrams
  (green-on-black error page, `data-diagram-type` attribute absent), not
  real STATE diagrams at all — matches G3's own `gizini-87-vuve916`
  precedent (a corpus bucket can contain fixtures the jar itself classifies
  as a different type). Out of scope; not chased.
- Mechanism 10's own creation-index-based ordering gap (see that mechanism's
  own "NOT a full fix" section) — unchanged, pre-existing, named again here
  for visibility.

### Ratchet / pins

14 fixtures pinned (was 13; +1: `tezivo-82-rufa055`) — `oracle/goldens/
svg-state/ratchet.json` updated, 1 new golden dir added (`in.puml`+
`golden.svg`, copied verbatim from `test-results/dot-cache/state/tezivo-82-
rufa055/`). `state.golden.ratchet.test.ts`: **16 tests** (was 15; 14×AC1 +
AC2 + AC3), all passing. `parity-state.json` regenerated clean: 271/271
surveyed, 267/271 `dotEqual`, 14/271 `conformant`, 0 timeouts/errors.

### size-backlog.json: unchanged (0 entries touched)

This iteration's mechanisms are ALL render-structure-only (transition
nesting, top-level ordering, box shape/wrap decisions, an additive
background rect) — none touch a sizing/layout FORMULA, so no fixture's own
`maxSizeDeltaIn` could have moved in either direction. Verified, not
assumed: `state-dot-parity.test.ts` stayed at **268/268** passing throughout
the ENTIRE iteration (checked before mechanism 9, after mechanism 9, and
again after mechanisms 10-12), confirming zero sizing-side impact. No
tighten-only edits made to `oracle/goldens/state/size-backlog.json` this
iteration (nothing to tighten).

### Files changed (S5)

- `src/diagrams/state/state-geo-types.ts` — `StateNodeGeo.transitions`
  (NEW, mechanism 9), `StateNodeGeo.emptyDescription` (NEW, mechanism 11).
- `src/diagrams/state/layout.ts` — `buildPseudoNodeGeos`/`buildFlatStateGeos`
  populate `transitions: []`; `buildFlatStateGeos` threads `ast.
  hideEmptyDescription` (mechanism 11); `shiftStateNode` recurses into
  `.transitions` too (mechanism 9).
- `src/diagrams/state/state-composite-geo.ts` — `materializeAutonom`/
  `materializeCluster`/`materializeSpecs`/`layoutComposite` rewritten
  (mechanism 9, drop `outTransitions` accumulator); `shiftGeo` recurses into
  `.transitions` too.
- `src/diagrams/state/state-composite-pass.ts` — `DiagramCtx.
  hideEmptyDescription` (NEW, mechanism 11); `resolveMember`'s leaf branch
  threads it; `buildTopLevelPass`'s own `specs` order flipped (mechanism 10).
- `src/diagrams/state/state-composite-autonom.ts` — `buildPlainAutonomSpec`
  simplified (mechanism 9, drop `inkOutTransitions`).
- `src/diagrams/state/state-composite-concurrent.ts` — `regionInkDim`
  simplified (mechanism 9, drop `out` accumulator).
- `src/diagrams/state/layout-ink-extent.ts` — `addNodeInk` gains
  `includeArrowheadInk` param + recurses into `node.transitions` (mechanism 9).
- `src/diagrams/state/renderer.ts` — `renderNodeWrapped` renders
  `node.transitions` inside its own wrap (mechanism 9); `renderTransitionWrapped`
  drops its `index` param (Map-based uid lookup); `wrapClassFor` returns
  `undefined` for `emptyDescription` nodes (mechanism 11).
- `src/diagrams/state/renderer-uid.ts` — `edgeUid` changed from array to
  `Map<TransitionGeo, string>` (mechanism 9); `collectTransitionsInOrder`
  (NEW).
- `src/diagrams/state/renderer-box.ts` — `renderEmptyDescription` (NEW,
  mechanism 11).
- `src/diagrams/state/renderer-shell.ts` — `maybeBackgroundRect` (NEW,
  mechanism 12).
- `src/diagrams/state/state-sizing.ts` — `buildStateGeoTextFields` gains
  `hideEmptyDescription` param + `emptyDescription` marker (mechanism 11).
- `tests/unit/state/renderer-nested-transitions.test.ts` — NEW (mechanism 9).
- `tests/unit/state/renderer-shell.test.ts` — NEW (mechanism 12).
- `tests/unit/state/renderer.test.ts` — `makeNode` gains `transitions: []`
  default; new `EntityImageStateEmptyDescription` describe block (mechanism
  11).
- `tests/unit/state/renderer-composite-box.test.ts` — `makeComposite` gains
  `transitions: []` defaults.
- `tests/unit/state/layout.test.ts` — the 2 pre-existing composite-internal-
  transition tests updated to assert the NEW per-node attachment (mechanism
  9 changes their own documented behavior deliberately, not a regression —
  see diagnosis.md discipline: pre-existing tests encoding the OLD, now-
  incorrect flat-array behavior were updated, not deleted).
- `oracle/goldens/svg-state/ratchet.json` — 1 fixture added.
- `oracle/goldens/svg-state/tezivo-82-rufa055/{in.puml,golden.svg}` — NEW.
- `tests/oracle/svg-conformance/parity-state.json` — regenerated (271/271
  surveyed, 14/271 conformant, 267/271 dotEqual, 0 timeouts/errors).
- `plans/g4-state-svg/README.md`, `plans/g4-state-svg/ledger.md` — this
  entry.

### Gates (S5, final)

- `state` census: **14/271** zero-diff (`1-3:29, 4-10:136, 11-30:44, 31+:48,
  errors:0`) — up from S4's `13/271` (`1-3:48, 4-10:156, 11-30:34, 31+:20`).
  +1 new pin (`tezivo-82-rufa055`), 0 regressed.
- Class census: **303/718**, intact, unchanged.
- Object census: **22/80**, intact, unchanged.
- Description census: **48/355**, intact, unchanged (1 pre-existing error,
  unrelated).
- DOT gate: `component 262/262 · usecase 90/90 · class 708/708 · object
  78/80 · state 267/267` — EXACTLY unchanged, verified BOTH before and after
  every mechanism landed this iteration.
- `state-dot-parity.test.ts` (size-backlog ratchet): **268/268** passing
  throughout — this iteration's mechanisms never touch sizing formulas.
- `npm test -- --run`: 9970/9970 passing (366 files).
- `npm run typecheck` / `npm run lint` / `npm run build`: all clean.
- `state.golden.ratchet.test.ts`: 16 tests (14 pins), up from 15 (13 pins).

### S6+ queue

1. **Concurrent-region separator `<line>`s** (mechanism 13, NEW, diagnosed
   not landed) — a genuinely new rendering feature, `stroke-width:1.5;
   stroke-dasharray:8,10;`, drawn between each pair of stacked regions
   inside the owning composite's own `<g>`.
2. **Per-region pseudo-node scope-id collision** (mechanism 14, NEW,
   diagnosed not landed) — `buildConcurrentRegionPass` needs to pass its
   OWN `concurrentRegionScopeId(owner.id, regionIndex+1)` (already computed
   for `noteScopeId`) as `scopeId` too, not `owner.id`. Land TOGETHER with
   mechanism 13 (both surfaced on the SAME `nelupe`/`sapelo` fixtures).
3. **Transition routing/positioning** (`svg/g/g/path/@d`) — the mission's
   OWN secondary scope, entirely deferred this iteration (mechanism 9's own
   scope + cascade consumed the full budget). The dominant residual on
   several near-zero fixtures once mechanisms 9-14 all land.
4. **Mechanism 10's own creation-index ordering gap** — `nelupe-49-xova546`-
   style multi-real-entity-plus-pseudo diagrams need true parse-time
   creation-order threading (a separate, larger item) to close fully.
5. `transitionArrowheadInk`'s own root cause (S4 queue item 2) — unchanged.
6. Entity-vs-cluster wrap split (S1/S3 item 3) — unchanged.
7. `<<sdlreceive>>` unwrapped-entity gap — unchanged from S1-S4.
8. Notes never render — unchanged from S1-S4.
9. `lonuti-97-voko521`'s own `<style>`-tag `FontColor` cascade gap —
   unchanged from S4.
10. `bilare-19-fufe539`'s own 1px `svg/@width` rounding residual (NEW,
    small) and `niveno-60-tiro789`'s own `svg/@background` theme-resolution
    bug (NEW, unrelated to mechanism 12) — both named this iteration, not
    chased.
11. Re-run the census and `--families` report FRESH again once mechanisms
    13/14 land — the concurrent-region family (18 fixtures) should show
    real per-feature fidelity for the first time this mission.

## S6 — mechanisms 13/14 landed (concurrent-region separator lines +
per-region pseudo-id collision), a NEW mechanism unmasked and landed
alongside them (region-member position-offset), 14→14 pins (net), three
larger deferred items re-diagnosed and confirmed correctly out-of-scope

### Summary

Per this iteration's own instruction, sampled the 29 S5-baseline near-zero
(1-3 diff) fixtures in full (all 29, exceeding the mandated coverage) plus
≥10 from the 4-10 bucket, with the mission's own suggested priority order
("mechanism-19 cheap subset FIRST, then 13, then 14, then mechanism-10
completion — but let the sample decide") explicitly tested against the
data: **no near-zero fixture in the sample was blocked SOLELY by
`svg/g/g/path/@d` (mechanism 19)** — every occurrence of that signature
co-occurred with a larger, more-dominant blocker (mechanism 16's cluster-
dimension gap, or the id-numbering gap below). Mechanisms 13/14 (already
fully diagnosed in S5, exact fix locations named) were the clear
cheapest-first target: 3 direct 1-3-bucket unlocks confirmed in the sample
(`nivanu-50-zajo916`, `semala-31-joji042`, `pevene-26-kebo361`) plus the
full 18-fixture concurrent-region family.

Landed both, TDD-first, jar-verified against `nelupe-49-xova546`'s full
pretty-printed XML dump (S5's own diagnosis artifact, reused rather than
re-derived). Mechanism 14 (`buildConcurrentRegionPass` passing `owner.id`
instead of `concurrentRegionScopeId(owner.id, regionIndex+1)` as `scopeId`)
was a two-line fix, unit-tested first (RED confirmed via a direct
`layoutState` probe showing two `StateNodeGeo` objects sharing id
`__init_Owner`, GREEN after the fix). Mechanism 13 (the separator `<line>`
itself, `stroke:#181818;stroke-width:1.5;stroke-dasharray:8,10;`) required a
genuinely new data shape — `StateNodeGeo.concurrentRegions`/`.separators`,
threaded through `GeoSpec`'s `'autonom'` variant, `materializeAutonom`, and
`renderNodeWrapped` — since jar's real document order INTERLEAVES each
region's own states+transitions with the separator (never wraps a region in
its own `<g>`), which the pre-S6 flat `children`/`transitions` fields could
not represent without losing per-region boundaries.

Landing mechanism 13 immediately surfaced (via direct byte comparison, not
guessed) a THIRD, previously-invisible bug: every concurrent region
member's absolute position was short by a consistent `(+7, +7)` versus jar
— `state-composite-concurrent.ts`'s own `regionInkDim` (renamed
`regionInkGeometry`) computed `SvekResult#calculateDimension()`'s ink-extent
`dx`/`dy` `moveDelta` correction (mechanism 7's own formula, ALREADY applied
for the plain/non-concurrent composite case via `state-composite-autonom.ts
#buildPlainAutonomSpec`'s `shiftDotLayoutResult` call) but silently
DISCARDED it, using only `width`/`height` for stacking. Landed as part of
the SAME mechanism-13 change (not a separate mechanism number — it is
mechanism 7's own `moveDelta` half, simply never wired into the concurrent
path when mechanism 7 first landed in S4). A SECOND, independent bug in the
same area (`layout.ts#shiftStateNode`, the document-margin/mechanism-4 final
shift) was ALSO found and fixed: it walked `children`/`transitions`
recursively but never touched `concurrentRegions`/`separators`, so those
fields retained PRE-document-shift coordinates even after the fix above —
caught via a direct debug dump showing `node.children[0].x=12` but
`node.concurrentRegions[0].children[0].x=5` for the identical logical
object.

Three further items were re-diagnosed this iteration (deeper than their S5
naming) and confirmed correctly out of scope for a "cheapest first"
iteration:

- **Mechanism 16** (S1/S3's own "entity-vs-cluster wrap split", already
  assessed unbounded twice) — reach is LARGER than previously known (7/27
  sampled 1-3-bucket fixtures, not the 1-2 previously spot-checked). A
  fresh check (`decede-10-buvu414`'s cluster margin=16px/1 child(50w) vs
  `gojuja-90-pune699`'s cluster margin=24px/1 child(20w circle anchor))
  confirms the margin is genuinely graphviz-DOT-derived (varies with
  content shape), not a guessable fixed constant — re-confirms, does not
  overturn, the prior unbounded assessment.
- **`skin debug` / named-skin-file directive** (queued as "niveno's
  background theme-resolution bug", a mis-scoped description) — direct
  inspection of upstream's `skin/debug.skin` resource shows this is a
  WHOLE bundled multi-property skin file (`FontSize 19`, `RoundCorner 15`,
  `LineThickness 4`, `BackGroundColor #AAA`, `stereotype`/`title`/`header`
  overrides, …), not a narrow background-color bug — this port has ZERO
  `skin <name>` directive support at all. Correctly NOT attempted; the
  queue's own framing undersold the true scope.
- **`bilare-19-fufe539`'s 1px rounding** — hand-derivation shows the exact
  algebra that would close it (`addStateBoxInk`'s max-corner ink point
  changed from `(x+w, y+h-1)` to `(x+w-1, y+h-1)`, symmetric with the min
  corner), but that function is an ALREADY jar-verified, widely-reused ink
  formula (every leaf state box in the whole corpus) — changing it for a
  single 1px, single-fixture gain risks the `size-backlog.json`
  tighten-only hard boundary across dozens of already-pinned/backlogged
  fixtures with no time this iteration to verify the full blast radius.
  Deferred, NOT attempted; the exact formula change is named for a future
  iteration with budget to verify it.

Census: `14/271` → `14/271` zero-diff (`1-3:29→27, 4-10:136→134,
11-30:44→41, 31+:48→55`) — **no net new pin**, despite substantial,
jar-verified, real improvement on every sampled concurrent-region fixture
(`nivanu-50-zajo916`: childCount-diff → 1 diff; `semala-31-joji042`:
childCount-diff → 3 diffs; `pevene-26-kebo361`: 26+ deep diffs → 15,
id-numbering + `path/@d`-only). The remaining blocker on EVERY
concurrent-region fixture, without exception, is now a SINGLE root cause:
the `id`/`data-qualified-name` numbering approximation (mechanism 10's own
already-documented, already-deferred remainder) — refined this iteration
into three concrete, verified sub-patterns (below), none individually
narrow enough to patch without the others, all requiring the SAME
underlying fix (true parse-time creation-index threading).

### Sampled fixtures (29 from the 1-3 bucket — full coverage, exceeding the
mandated ≥20 — plus 10 from 4-10, hand-probed)

1-3 bucket (all 29 S5-baseline near-zero fixtures, individually diffed):
`bilare-19-fufe539`, `cekolo-21-gini183`, `ceruzi-77-give569`, `dajipi-09-
doki542`, `decede-10-buvu414`, `fakali-52-zuje420`, `gojuja-90-pune699`,
`gokife-89-boja382`, `judova-36-kana429`, `kenuci-20-cane702`, `labono-83-
nega255`, `lalava-26-zosi801`, `lasasi-13-nona547`, `livuni-63-fira764`,
`lulozu-10-bopu547`, `maruju-55-soko478`, `mazuzu-54-mene929`, `nivanu-50-
zajo916`, `nufigo-87-pivi558`, `pevene-26-kebo361`, `pexuve-81-suxi717`,
`semala-31-joji042`, `soxene-95-domu248`, `tofezi-64-koda860`, `xeziki-47-
zomo866`, `xodazu-26-cube992`, `xojudi-20-keco020`, `xomize-22-poro350`,
`xoravu-40-gebe122`.
4-10 bucket / deeper concurrent-region samples (10 hand-probed):
`nelupe-49-xova546`, `sapelo-46-jafe280`, `niveno-60-tiro789`, plus 7 more
from the concurrent-region family (`--`/`||`-bearing fixtures, `grep`-
confirmed 18/271 total corpus reach) cross-checked pre/post mechanism 13/14.

### Attribution table (mechanism-bucketed, cheapest-first)

| Mechanism | Signature | Reach (sampled) | Status |
|---|---|---|---|
| 13. Concurrent-region separator `<line>`s (dashed, between stacked regions) | `svg/g[1]/g[1][childCount]` off by `(regions-1)` | 18/271 corpus fixtures use `--`/`\|\|` regions | **LANDED** |
| 14. Per-region pseudo-node scope-id collision | duplicate `id="entXXXX"` on sibling `<g class="start_entity">`s | subset of the 18 (any region-owning composite with a `[*]` in >1 region) | **LANDED** |
| (mechanism 7's own `moveDelta` half, missing for concurrent regions) | consistent `(+7,+7)` absolute position gap for EVERY region member | ALL 18 concurrent-region fixtures | **LANDED** (landed with mechanism 13, not a separately numbered mechanism — mechanism 7's own formula, simply never wired into this path) |
| 10 (refined). id-numbering creation-index gap — 3 concrete sub-patterns found this iteration: (a) CONC-region synthetic entity consumes an invisible id slot (`nivanu`/`semala`, jar-verified: `ent0005`/`ent0003` skipped exactly where a CONC-region would be created); (b) a transition consumes an interleaved id slot alongside its own scope's entities, not after ALL entities globally (`pevene`: 2-slot gap before region-0's own first entity); (c) a `remove`d entity still consumes its own creation-time id slot (`xoravu-40-gebe122`: `ent0001` reserved for the removed state, `B`=`ent0002` not `ent0001`) | blocks EVERY concurrent-region AND `remove`-directive fixture from TRUE zero, even after mechanisms 13/14 | Diagnosed (3 sub-patterns, refining not replacing S5's own naming), NOT landed — same "separate, larger, mission-scale item" S5 already deferred; the 3 sub-patterns are NOT mutually consistent with one narrow patch (confirmed by testing a "count CONC-regions as 1 slot" hypothesis against `pevene`, which needs a 2-slot gap, not 1) |
| 16. Entity-vs-cluster wrap dimension gap (S1/S3 item 3, re-confirmed unbounded) | cluster box header-height/margin varies by content (19px/16px for a 50w rect child, 19px/24px for a 20w circle anchor) | 7/27 sampled 1-3-bucket fixtures (`decede`,`tofezi`,`xojudi`,`soxene`,`lasasi`,`gojuja`,`nufigo`) — LARGER reach than previously spot-checked | Re-confirmed unbounded (3rd independent check), deferred unchanged |
| `skin debug` / named-skin-file directive (re-scoped from "niveno's background bug") | `svg/@background` + cascading size diffs from an entire unapplied multi-property skin file | 1/271 confirmed (`niveno-60-tiro789`); true corpus reach for `skin <name>` unknown | Re-diagnosed as unimplemented FEATURE (not a narrow bug), deferred |
| Leaf-state-box ink max-corner asymmetry (`bilare`'s 1px rounding) | `addStateBoxInk(x-1,y-1, x+w,y+h-1)` — hypothesized should be `x+w-1` too | 1/271 (`bilare-19-fufe539`); blast radius across the WHOLE corpus not verified | Diagnosed (exact algebraic fix named), NOT attempted — high blast-radius risk to an already-verified formula for a single-fixture 1px gain |
| Creole/markdown bold (`**text**`) in state labels | literal `**` in rendered text, no bold font-weight/textLength | `mazuzu-54-mene929`, `gokife-89-boja382` (2/29 sampled) | Diagnosed as a wholly unimplemented feature (zero creole markup support in the state engine), deferred, unscoped |
| `json` element mixed with `state` declarations | separate diagram-element type embedded alongside state syntax | `maruju-55-soko478` (1/29) | Out of scope, not chased |
| 19. Transition `path/@d` routing (mission's own secondary scope) | e.g. `pevene`/`nelupe`/`sapelo`'s cross-region transitions | present in several samples, but in EVERY case co-occurring with mechanism 16 or the id-numbering gap as the DOMINANT blocker — confirmed NOT the sole blocker on any near-zero fixture sampled this iteration | Sampled per this iteration's own instruction, confirmed no cheap near-zero unlock exists this iteration; still NOT started as its own scoped item |

### Mechanism 14 (per-region pseudo-node scope-id collision): LANDED

Per diagnosis.md: instrumented before hypothesizing — a direct `layoutState`
probe (2 concurrent regions, each with its own `[*] --> X` transition)
reproduced the collision exactly: two DISTINCT `StateNodeGeo` objects with
the identical `id: "__init_Owner"` in the composite's own `children` array,
confirming `scopedPseudoIds`'s (`state-composite-pass.ts`) `__init_<scopeId>`
naming collapses when `scopeId` is the SAME string for every region.
`src/diagrams/state/state-composite-concurrent.ts#buildConcurrentRegionPass`
passed `owner.id` (not a per-region id) as `scopeId` to
`runOneConcurrentBranch` — while its OWN `noteScopeId` argument (the very
next parameter) ALREADY computed the correct
`concurrentRegionScopeId(owner.id, regionIndex + 1)`. Fix: compute that
value ONCE and pass it for BOTH parameters. Unit test (`tests/unit/state/
layout.test.ts`, "each concurrent region's own `[*]` pseudo-node gets a
DISTINCT id") confirmed RED (`expected 1 to be 2`, i.e. only 1 distinct id
existed across 2 regions) before the fix, GREEN after.

### Mechanism 13 (concurrent-region separator lines): LANDED

Per diagnosis.md: jar's real draw call
(`ConcurrentStates.java#Separator.drawSeparator`, direct Java source read —
`THICKNESS_BORDER=1.5`, `DASH=8`, gap `10`) draws each separator INLINE
between region content, never inside a per-region `<g>` wrapper (confirmed
via a full pretty-printed XML dump of `nelupe-49-xova546`'s own `s7_2`:
region-0's own entities+link, THEN the separator `<line>`, THEN CONC1's own
entities+link — all as DIRECT siblings inside `s7_2`'s own `<g>`, no
intermediate region wrapper anywhere).

Coordinate derivation, hand-verified against `nelupe-49-xova546`
byte-for-byte: separator `x1` = composite box `x` + `InnerStateAutonom`'s
own `MARGIN` (5) — ALREADY the exact value `materializeAutonom`'s own `dx`
computes (`pos.x + spec.offset.x`), so a LOCAL `x1=0` (pre dx/dy-shift,
matching `localPositions`' own convention) is correct, not a placeholder.
`x2` = `x1 + contentWidth + DASH(8)`, where `contentWidth` is
`stackConcurrentRegions`'s own already-computed `dimTotal.getWidth()`
(`Separator.add`'s HORIZONTAL max-width rule, mechanism 8, S4) — jar-
verified: box `x=7`, `MARGIN=5` → absolute `x1=12` (jar's own `x1="12"`);
`contentWidth=102` → absolute `x2=12+102+8=122` (jar's own `x2="122"`). `y`
= the cumulative region-height stack cursor at that point (the SAME
`yShift` accumulator `combineConcurrentPasses` already tracked pre-S6, just
now ALSO used to place the separator, not only to offset the next region's
nodes).

New data shape (`src/diagrams/state/state-geo-types.ts`):
`StateNodeGeo.concurrentRegions?: readonly StateRegionGeo[]`
(`{children, transitions}` per stacked region) and `.separators?: readonly
StateSeparatorGeo[]` (absolute `x1/y1/x2/y2`, `undefined` for every
non-concurrent node). Both are `undefined` for a plain composite, keeping
the pre-S6 flat-materialization path completely unchanged for the other
253/271 fixtures. Load-bearing identity constraint (documented in both the
type and the code): `concurrentRegions[i].children`/`.transitions` and the
FLAT `children`/`transitions` fields share the SAME object instances
(`materializeAutonom` builds the flat arrays by concatenating the
per-region ones, never re-materializing) — required because
`renderer-uid.ts`'s `edgeUid` uid-numbering Map is keyed by `TransitionGeo`
object IDENTITY, not value equality.

`src/diagrams/state/renderer.ts#renderNodeWrapped` — when
`node.concurrentRegions !== undefined`, interleaves each region's own
`children`+`transitions` markup with a `renderSeparator` dashed `<line>`
call between consecutive regions (`theme.colors.border`, `stroke-width:1.5`,
a FIXED jar constant independent of the theme's own border-width elsewhere
— matches `ConcurrentStates.java`'s own hardcoded `THICKNESS_BORDER`).
Every other node keeps the pre-S6 "all children, then this node's own
transitions" layout, byte-unchanged.

**Jar-verified**: `semala-31-joji042` (2 regions, 1 separator) and
`nivanu-50-zajo916` (2 regions, 1 separator, 3-level-nested region-0
content) both show the separator `<line>` at the EXACT jar coordinates
post-fix; `pevene-26-kebo361` (3 regions, 2 separators) confirms multi-
separator stacking.

### The `moveDelta` position-offset bug (landed alongside mechanism 13)

Per diagnosis.md: closing mechanism 13's `childCount` gap let `compareSvg`
recurse into region MEMBER content for the first time — surfacing a
consistent `(+7, +7)` absolute position shortfall on EVERY region member
(leaf or nested composite alike), confirmed via a byte-for-byte comparison
against `coteta-47-mare883` (a PINNED, byte-exact PLAIN-composite fixture
with a structurally identical single-child case): coteta's own child "c" is
correctly positioned at local-raw-x(7) + `dx`(12) = absolute `x=19`, but
`semala`'s region member "b" (same box size, same composite `offset`
formula) landed at absolute `x=12` — implying a local-raw-x of 0, not 7.

Root cause, instrumented not guessed: `state-composite-autonom.ts
#buildPlainAutonomSpec` (the plain/non-concurrent case) computes
`computeSvekResultGeometry`'s own `dx`/`dy` (`SvekResult
#calculateDimension()`'s `moveDelta` correction, mechanism 7, S4) and
applies it via `shiftDotLayoutResult` BEFORE the child pass's raw node
positions are used — `state-composite-concurrent.ts`'s own `regionInkDim`
(pre-S6) computed the IDENTICAL `computeSvekResultGeometry` call but
DISCARDED its `dx`/`dy` fields, using only `width`/`height` for
`stackConcurrentRegions`. Renamed to `regionInkGeometry` (returns the full
`{width,height,dx,dy}`); `combineConcurrentPasses` now calls
`shiftDotLayoutResult(p.result, geom.dx, geom.dy)` for EACH region before
building `allNodes`/`regionTransitions` — the exact same formula
`buildPlainAutonomSpec` already applies, just previously never wired into
the concurrent-region path (this was NEVER mechanism 13/14's OWN scope — it
is mechanism 7's own formula, simply incomplete since S4; not given its own
mechanism number since it is not a new algorithm, just a missing call site).

A SECOND bug in the same area was found while verifying the first: `layout.
ts#shiftStateNode` (mechanism 4's own final document-margin shift, applied
to EVERY top-level state) recursed into `children`/`transitions` but never
touched `concurrentRegions`/`separators` — so those fields retained
PRE-document-shift coordinates even after the `moveDelta` fix above,
producing a SECOND, different-magnitude position mismatch visible only
between `node.children[0]` and the (stale) `node.concurrentRegions[0]
.children[0]` for the IDENTICAL logical state. Fixed with the same
"reslice already-shifted flat arrays back into region boundaries"
pattern used in `state-composite-geo.ts#shiftGeo` (a duplicated 10-line
helper in each file — deliberate, per that helper's own doc comment, to
avoid a needless cross-module dependency).

**Jar-verified**: `semala-31-joji042` region members ("b", "c") now land at
the EXACT jar-reported absolute positions (`x=12,y=36`/`x=12,y=101`
pre-document-shift matched jar's OWN `x=19,y=43`/`x=19,y=108` once `dx=7`
folded in correctly); `nivanu-50-zajo916`'s 3-level-deep region-0 nested
composite ("two"→"three"→"four") ALSO lands correctly (confirming the
`moveDelta` propagates through nested materialization, not just the
region's own direct members).

### Mechanism 16 (entity-vs-cluster wrap dimension, S1/S3 item 3): re-confirmed unbounded, NOT landed

Direct byte comparison of TWO independent single-child cluster-classified
composites: `decede-10-buvu414`'s `E{F}` (F a 50x50 rect leaf) shows header
height 19px, side margin 16px; `gojuja-90-pune699`'s `A{[*]-->Configuring}`
(a `[*]` region-anchor, a 20x20 circle, since the internal `[*]-->
Configuring` link crosses `A`'s own boundary — `Configuring` is declared
OUTSIDE `A`'s block — forcing `isAutarkic()` false, i.e. `'cluster'`
classification per `state-composite-classify.ts`) shows header height 19px
(same) but side margin 24px (DIFFERENT). The header-height constant (19,
not `InnerStateAutonom`'s own 24) recurs identically across BOTH samples
(and S3's own original `bajelo-54-dixe684` finding) — genuinely fixed. The
SIDE MARGIN does not (16 vs 24, tracking child content SHAPE, not a fixed
number) — consistent with genuine DOT-native cluster-margin computation
(graphviz's own subgraph-cluster layout), which this port's `layoutGraph()`
seam does not currently expose. Re-confirms, does not overturn, S1/S3's own
"needs library-level cluster-bbox exposure" conclusion — now backed by a
THIRD independent data point rather than one.

### `skin debug` / named-skin-file directive: re-diagnosed, NOT landed

Direct read of `~/git/plantuml/src/main/resources/skin/debug.skin` (the
file `skin debug` loads) shows a WHOLE bundled property-override file:
`root{FontName SansSerif; FontColor green; FontSize 19; RoundCorner 15;
LineColor #3600A8; LineThickness 4; BackGroundColor #AAA; Shadowing 0.0}`
plus separate `stereotype{}`/`title{}`/`header{}` blocks — this port has
NO `skin <name>` directive support at all (grepped, zero hits for
`'debug'`/`skin.*load` across `src/core/*.ts`/`src/diagrams/state/*.ts`).
The S5 queue's own framing ("niveno's background theme-resolution bug")
undersold this — `niveno-60-tiro789`'s `svg/@height`/`@width` diffs (196→
221, 224→263) are NOT a sizing side-effect of a wrong background color;
they are the DIRECT consequence of `FontSize 19` (vs default 14) and
`RoundCorner 15` never being applied at all. Correctly NOT attempted this
iteration — a whole new subsystem (named-skin-file resolution), not a
one-fixture patch.

### `bilare-19-fufe539`'s 1px rounding: diagnosed, NOT attempted

Hand-derivation against jar's own document width (361, vs our 362):
`computeStateDocumentDims`'s `rawWidth = maxX - minX + INK_DELTA(15)`.
`minX` = 6 (leftmost box's own `addStateBoxInk(x-1,...)` = `7-1`). `maxX`
(rightmost box's own ink contribution) = `addStateBoxInk`'s current
`x + w` (NO `-1`) = `272.7125 + 74.575 = 347.2875`, giving OUR OWN
(internally-consistent) `362`. Substituting a SYMMETRIC max-corner rule
(`x + w - 1`, matching `addBarInk`'s own already-symmetric convention two
functions above it in the same file) gives `maxX = 346.2875`, and the
resulting document width computes to EXACTLY jar's own `361`. NOT landed:
`addStateBoxInk` is an ALREADY jar-verified, universally-reused ink formula
(every leaf state box in the corpus, including several already-pinned
fixtures) — its OWN doc comment explicitly names the asymmetry as
deliberate ("leaf-state-box ink rule's own `-1` min-corner asymmetry" —
S4's decision journal). Changing it on the strength of ONE fixture's
algebra, without time this iteration to verify the FULL corpus/
`size-backlog.json` blast radius (a hard tighten-only boundary), was judged
too risky — named precisely (including the exact one-character diff) for a
future iteration with budget to verify it safely.

### Also discovered, out of S6's write-set (named, not fixed)

- Creole/markdown bold (`**text**`) syntax inside state display/body text
  renders literally (no bold `font-weight`, wrong `textLength`) —
  `mazuzu-54-mene929`, `gokife-89-boja382`. Zero creole markup support
  exists anywhere in the state engine (`splitCreoleLines` only splits on
  `\n`) — a genuinely unimplemented feature, unscoped for this mission's
  remaining iterations unless separately prioritized.
- `maruju-55-soko478` mixes a `json foo1 {...}` diagram element alongside
  `state` declarations — out of scope, not chased.
- `xoravu-40-gebe122`'s `remove $tagA` directive: the removed entity still
  consumes an id-numbering slot in jar's real output (`ent0001` reserved,
  `B`=`ent0002`) — folded into the id-numbering-gap sub-pattern list above,
  not a separate mechanism.

### Ratchet / pins

**No new pins this iteration** (`14` pinned, unchanged from S5) — every
sampled concurrent-region fixture improved substantially (jar-verified,
several from double-digit diffs down to 1) but none reached TRUE zero,
blocked entirely by the id-numbering gap (refined, not solved, this
iteration). `oracle/goldens/svg-state/ratchet.json` unchanged.
`state.golden.ratchet.test.ts`: **16 tests** (unchanged — 14×AC1 + AC2 +
AC3), all passing. `parity-state.json` regenerated: 271/271 surveyed,
267/271 `dotEqual`, 14/271 `conformant`, 0 timeouts/errors — IDENTICAL
aggregate counts to S5 (the underlying per-fixture `maxDelta`/`firstDiff`
values changed for concurrent-region fixtures, confirming real movement
even though the coarse conformant/dotEqual buckets didn't shift).

### size-backlog.json: unchanged (0 entries touched)

This iteration's mechanisms touch RENDER structure (separator lines) and
POSITION (the `moveDelta` fix, applied AFTER `layoutGraph()`'s own raw node
sizes are captured) — neither touches a raw DOT NODE SIZE, which is what
`state-dot-parity.test.ts`'s own `maxSizeDeltaIn` ratchet measures via
`setLayoutInputObserver`. Verified, not assumed: **268/268** passing before
and after every change this iteration. No tighten-only edits made (nothing
to tighten — the size-backlog ratchet is orthogonal to this iteration's
scope).

### Files changed (S6)

- `src/diagrams/state/state-geo-types.ts` — `StateNodeGeo.concurrentRegions`/
  `.separators` (NEW), `StateRegionGeo`/`StateSeparatorGeo` (NEW interfaces).
- `src/diagrams/state/state-composite-pass.ts` — `GeoSpec`'s `'autonom'`
  variant gains `regions`/`separators` (NEW, optional).
- `src/diagrams/state/state-composite-concurrent.ts` — `regionInkDim`
  renamed `regionInkGeometry` (now returns `dx`/`dy` too, mechanism 7's
  `moveDelta`); `buildConcurrentRegionPass` fixed (mechanism 14);
  `combineConcurrentPasses` rewritten (mechanism 13: builds `regions`/
  `separators`, applies `shiftDotLayoutResult` per region).
- `src/diagrams/state/state-composite-autonom.ts` — `shiftDotLayoutResult`
  exported (was module-local; reused by state-composite-concurrent.ts,
  accepting the SAME established circular-import pattern S3 already used
  for this file pair).
- `src/diagrams/state/state-composite-geo.ts` — `materializeAutonom` builds
  `children`/`transitions` FROM `regionsOut` (identity-preserving
  concatenation) when `spec.regions` is defined, attaches `concurrentRegions`/
  `separators`; `shiftGeo` reslices `concurrentRegions`/shifts `separators`
  for a nested-ancestor shift (`resliceRegions`, NEW helper).
- `src/diagrams/state/layout.ts` — `shiftStateNode` reslices
  `concurrentRegions`/shifts `separators` for the document-margin shift
  (`resliceStateRegions`, NEW helper — duplicated from `state-composite-
  geo.ts#resliceRegions` deliberately, see that call site's own doc
  comment).
- `src/diagrams/state/renderer.ts` — `renderSeparator` (NEW);
  `renderNodeWrapped` interleaves per-region content + separators when
  `node.concurrentRegions !== undefined`.
- `tests/unit/state/layout.test.ts` — NEW describe block (mechanisms
  13/14), 1 new test (RED confirmed pre-fix, GREEN post-fix).
- `tests/oracle/svg-conformance/parity-state.json` — regenerated (271/271
  surveyed, 14/271 conformant, 267/271 dotEqual, 0 timeouts/errors —
  aggregate counts identical to S5, per-fixture deltas improved).
- `plans/g4-state-svg/README.md`, `plans/g4-state-svg/ledger.md`,
  `plans/g4-state-svg/decision-journal.md` — this entry.

### Gates (S6, final)

- `state` census: **14/271** zero-diff (`1-3:27, 4-10:134, 11-30:41,
  31+:55, errors:0`) — was S5's `14/271` (`1-3:29, 4-10:136, 11-30:44,
  31+:48`). No net new pin; all 14 S5 pins verified unchanged.
- Class census: **303/718**, intact, unchanged.
- Object census: **22/80**, intact, unchanged.
- Description census: **48/355**, intact, unchanged.
- DOT gate: `component 262/262 · usecase 90/90 · class 708/708 · object
  78/80 · state 267/267` — EXACTLY unchanged, verified before and after.
- `state-dot-parity.test.ts` (size-backlog ratchet): **268/268** passing,
  unchanged throughout.
- `npm test -- --run`: 9971/9971 passing (366 files, +1 test vs S5's 9970).
- `npm run typecheck` / `npm run lint` / `npm run build`: all clean.
- `state.golden.ratchet.test.ts`: 16 tests (14 pins), unchanged from S5.

### S7+ queue

1. **Mechanism 10's id-numbering gap, now with 3 concrete verified
   sub-patterns** (CONC-region synthetic-entity id consumption; transitions
   interleaved with entities in creation order, not batched; `remove`d
   entities still consume an id slot) — the SOLE remaining blocker on
   EVERY concurrent-region fixture and every `remove`-directive fixture.
   Needs true parse-time creation-index threading through the AST (a
   separate, larger item, unchanged in scope-size assessment from S5, but
   now much more precisely specified).
2. **Mechanism 16** (entity-vs-cluster wrap dimension) — needs
   `layoutGraph()`/graphviz-ts cluster-bbox exposure; re-confirmed
   unbounded a third time, larger reach than previously known (7/27
   sampled).
3. **`skin debug`/named-skin-file directive support** — a whole
   unimplemented feature (bundled multi-property skin files), re-scoped
   from "niveno's background bug"; genuinely unscoped for this mission
   unless separately prioritized.
4. **`addStateBoxInk`'s max-corner asymmetry** (`bilare`'s 1px rounding) —
   exact one-character fix named (`x+w` → `x+w-1`), NOT landed due to
   unverified blast radius across the size-backlog-tighten-only boundary;
   needs a full-corpus verification pass before landing.
5. **Transition routing/positioning** (`svg/g/g/path/@d`, mechanism 19,
   the mission's own secondary scope) — sampled again this iteration,
   confirmed it is NEVER the sole/dominant blocker on any near-zero
   fixture; still entirely unscoped/unstarted as its own work item.
6. Creole/markdown bold (`**text**`) markup in state labels — a genuinely
   unimplemented feature (zero creole support in the state engine).
7. `transitionArrowheadInk`'s own root cause (S4 queue item 2) — unchanged.
8. `<<sdlreceive>>` unwrapped-entity gap — unchanged from S1-S4.
9. Notes never render — unchanged from S1-S4 (confirmed present in
   `labono-83-nega255`/`pexuve-81-suxi717`/`xodazu-26-cube992`, all 3 in
   this iteration's own 1-3-bucket sample).
10. `lonuti-97-voko521`'s own `<style>`-tag `FontColor` cascade gap —
    unchanged from S4.
11. `<<meblue>>`-style skinparam STEREOTYPE-scoped `StateBorderColor`
    cascade gap (NEW this iteration, `semala-31-joji042`'s own remaining
    non-id diff: `ours=#181818 jar=#0000FF` on the composite's own
    rect/line stroke) — a stereotype-conditional skinparam override not
    threading through to composite box borders. Named, not chased.

## S7 — mechanism 10 (id-numbering creation-index gap) LANDED in full: true
parse-time creation-index threading (states/transitions/pseudostates/CONC
phantoms/removed-entity gaps), true creation-order sibling ordering, and a
newly-discovered composite-pipeline `[*]`-endpoint `<path id>` bug fixed
alongside it -- 14→16 pins, every sampled concurrent-region/`[*]`-multi-scope
fixture now blocked SOLELY by already-named, unrelated mechanisms

### Summary

Per this iteration's own instruction, derived the jar creation-index
algorithm from BOTH Java source (`net.atmp.CucaDiagram#cpt1`/
`getUniqueSequenceValue`/`getUniqueSequence`, `abel/Entity.java:171`,
`abel/Link.java:135`, `statediagram/StateDiagram.java#concurrentState`/
`getStart`/`getEnd`, `statediagram/command/CommandConcurrentState.java`,
`statediagram/command/CommandCreateState.java`) AND direct jar-SVG-id
evidence across the mission's own required 5 fixture categories BEFORE
writing any code (full derivation below). Implemented true parse-time
`creationIndex` threading through the ENTIRE state pipeline (parser →
AST → layout → composite-pass GeoSpec tree → renderer-uid), TDD-first
(unit tests for the new stamping behavior; jar-verified byte-exact id
sequences as the primary acceptance oracle, per this mission's own
established discipline). Landing the id-VALUE fix immediately surfaced
(via direct byte comparison, not guessed) two further, previously-masked
bugs in the SAME area — sibling DOCUMENT ORDER (still using the S5-era
"real before pseudo" heuristic, wrong for jar's true creation-order-based
sibling order) and a composite-pipeline `<path id>` bug (leaking the raw
`'[*]'` AST token instead of the scope-resolved pseudo-anchor name) — both
fixed alongside the id-value mechanism, not deferred, since both were
discovered WHILE jar-verifying mechanism 10's own fix and are the SAME
underlying "true creation order" concept, not separate mechanisms.

```
S6 (before): 14/271 -- 1-3:27, 4-10:134, 11-30:41, 31+:55, errors:0
S7 (after):  16/271 -- 1-3:26, 4-10:133, 11-30:47, 31+:49, errors:0
```

+2 new pins (`nivanu-50-zajo916`, `xoravu-40-gebe122`), 0 pins lost (all 14
S6 pins verified unchanged via a fresh census + `parity-state.json` regen).
Bucket redistribution follows the SAME mixed-direction "unmasking" shape
every prior mechanism-landing iteration has shown (11-30 grew 41→47, 31+
shrank 55→49, net zero-diff up) — landing a structurally-necessary,
jar-verified-correct fix trades a shallow, id-confounded diff signature for
smaller counts of deeper, REAL, individually-addressable residuals.
Critically, EVERY ONE of the mission's own 5 required sample categories now
shows either TRUE ZERO or a residual blocked SOLELY by an already-named,
UNRELATED mechanism (not id-numbering) — direct, hand-verified evidence,
not inferred from the aggregate census:

| Category | Fixture | Before (id-related) | After |
|---|---|---|---|
| Plain | `coteta-47-mare883` | already 0 | 0 (unchanged) |
| Nested composite + concurrent | `nivanu-50-zajo916` | `childCount` gap at the CONC-tick position | **0 (NEW PIN)** |
| Concurrent regions (2, no `[*]`) | `semala-31-joji042` | id/class swap at CONC boundary | 0 id diffs; 2 residual diffs are the ALREADY-NAMED mechanism 11 (`<<meblue>>` stereotype border-color cascade) |
| Concurrent regions (3, transitions only, no explicit declares) | `pevene-26-kebo361` | 2-slot gap before region-0's first entity | 0 id diffs; residual is PURE `path/@d`/`polygon` geometry (mechanism 19) |
| Removed entities | `xoravu-40-gebe122` | `remove`d state's slot not skipped | **0 (NEW PIN)** |
| `[*]` in multiple scopes + nesting + concurrency | `nelupe-49-xova546` | id/class swaps + duplicate pseudo ids across regions | 0 id/ordering/`<path id>` diffs (40→30 diffs); 100% of the remaining 30 are PURE `path/@d`/`polygon` geometry (mechanism 19) |

### The creation-index derivation (per this iteration's own instruction:
BEFORE writing code)

**Java source** (read before any fixture evidence was gathered):
- `net.atmp.CucaDiagram.java:127` — `private final AtomicInteger cpt1 = new
  AtomicInteger(0);` — ONE shared counter for the WHOLE diagram.
- `CucaDiagram.java:725-731` — `getUniqueSequenceValue()` =
  `cpt1.addAndGet(1)`; `getUniqueSequence(prefix)` = `prefix +
  cpt1.addAndGet(1)` — the SAME counter, two callers.
- `abel/Entity.java:171` — the PRIVATE `Entity` ctor stamps `this.uid =
  StringUtils.getUid("ent", diagram.getUniqueSequenceValue())`
  UNCONDITIONALLY, for EVERY `Entity` constructed (leaf OR group,
  `CucaDiagram#createLeaf`/`#createGroup` both funnel through it) —
  regardless of whether that Entity is ever individually drawn as its own
  box.
- `abel/Link.java:135` — the `Link` ctor stamps `this.uid =
  cucaDiagram.getUniqueSequence("lnk")` — the SAME shared counter, fired at
  Link CONSTRUCTION time (inside `CommandLinkStateCommon`'s dispatch, AFTER
  both endpoints are already resolved/auto-created).
- `statediagram/StateDiagram.java#concurrentState` (`--`/`||` handler) —
  `gotoGroup(location, ident1, Display.create(""),
  GroupType.CONCURRENT_STATE)` → `CucaDiagram#createGroup` → `new
  Entity(...)` — a REAL, ticked `Entity`, for a group type that
  `GroupMakerState`/`ConcurrentStates` NEVER draws its own box for
  (mechanism 13, S6) — this is the mechanism behind sub-pattern (a).
- `StateDiagram.java#getStart`/`#getEnd`/`#getHistorical`/`#getDeepHistory`
  — each does `if (quark.getData() == null) reallyCreateLeaf(...)` — LAZY,
  idempotent-per-quark creation, fired the FIRST time a scope's `[*]`/`[H]`/
  `[H*]` is referenced by a transition (i.e. from INSIDE
  `CommandLinkStateCommon#getEntity`'s endpoint resolution, the SAME
  chokepoint real endpoint auto-create uses) — not at composite-open time.
- `CommandConcurrentState.isEligibleFor` returns `ONE|TWO|THREE` (all
  passes) — but `this` port's OWN pre-existing `state-commands.ts` rule 4
  ALREADY only allocates a new region (`scope.regions.push([])`) on pass
  `'one'` (a pre-S7 design decision, unrelated to this iteration) — so a
  SINGLE tick-burn hook at that SAME `pass === 'one'` guard reproduces
  jar's real behavior with no further pass-reconciliation needed (verified
  empirically below, not merely assumed from the Java alone — see the
  "ruled out" note).

**Fixture evidence** (5 required categories, gathered AFTER the Java
reading, used to VERIFY the derived algorithm byte-exact, not to guess it):
- `nivanu-50-zajo916` (nested composite, 1 separator, no `[*]`): raw ids
  `one=1, one.two=2, one.two.three=3, one.two.three.four=4, [SKIP 5],
  one.CONC1.five=6` — confirms sub-pattern (a) (CONC group burns exactly
  ONE tick, not per-pass-repeated) and that nested-composite declaration
  order alone (no `[*]`) already needed no ordering fix.
- `semala-31-joji042` (2 regions, `state b` EXPLICITLY declared before the
  separator): `a=1, b=2, [SKIP 3=CONC1], c=4` — confirms the phantom tick
  fires exactly at the separator's OWN textual position (interleaved with
  real declarations in true source order), not batched.
- `pevene-26-kebo361` (3 regions, ZERO explicit declarations — every state
  auto-created by a transition): `single1=1, [SKIP 2,3 = CONC1,CONC2],
  a=4, b=5, lnk(a→b)=6, c=7, d=8, lnk(c→d)=9, e=10, f=11, lnk(e→f)=12` —
  confirms BOTH remaining sub-patterns at once: (a) BOTH CONC ticks fire
  during PASS ONE, before ANY pass-two auto-create (since pass ONE walks
  the WHOLE composite block, including every `--` line, before pass TWO
  ever starts); (b) transitions interleave with their OWN newly-auto-
  created endpoints in PURE TRANSITION-SOURCE order (`a,b,lnk` THEN
  `c,d,lnk` THEN `e,f,lnk`), never "all entities globally, then all
  transitions".
- `xoravu-40-gebe122` (`remove $tagA`, 2 composites, 1 removed): raw ids
  `a=1 (removed, filtered post-parse), b=2` — confirms sub-pattern (c): the
  removed entity's tick IS consumed during parsing (before
  `state-directives.ts#filterRemovedEntities` excludes it from the layout
  input), so the SURVIVING entity's raw index already reflects the gap
  with ZERO extra bookkeeping needed at the numbering step.
- `nelupe-49-xova546` (3 concurrent regions, ONE with a 2-level-nested
  composite, `[*]` referenced in FIVE distinct scopes: top level, region 0,
  CONC1 [region 1], the nested `toutou9` composite, CONC2 [region 2]): a
  FULL 18-tick hand-derivation (documented in this iteration's own probe
  scripts, `scripts/_tmp-s7-probe4.ts`, deleted before finishing) predicted
  EVERY SINGLE raw id in the fixture's cached `in.svg` exactly —
  `s7_2=1,[CONC1=2],toutou9=3,[CONC2=4]` (pass one) then
  `.start.=5,s0_start=6,lnk=7,` `.start.s7_2=8,chat1=9,lnk=10,`
  `.start.CONC1=11,lnk=12,` `.start.toutou9=13,leo=14,lnk=15,`
  `.start.CONC2=16,chat2=17,lnk=18` (pass two, pure textual re-walk order,
  pseudo-tick lazily fired PER SCOPE the first time `[*]` is seen there) —
  a byte-exact, fully independent verification run via
  `npx tsx scripts/_tmp-s7-probe4.ts` BEFORE any geometry-layer plumbing
  was written (parser-only, `parseState()` output inspected directly).

**Ruled out**: a THIRD hypothesis — that `CommandConcurrentState` genuinely
fires (and burns a tick) once per pass (3× per separator, since
`isEligibleFor` returns true for ONE/TWO/THREE) — was explicitly tested
against `pevene-26-kebo361`'s own numbers (`a=4`, not `6` or higher) and
DISPROVED: this port's PRE-EXISTING `pass === 'one'`-guarded region
allocation (a design decision unrelated to this iteration, already correct)
already reproduces jar's real single-tick-per-separator behavior when the
SAME guard is reused for the tick-burn hook — no additional pass-
reconciliation logic was needed, confirmed empirically before landing.

### The algorithm (implemented)

**Raw values, not dense re-packing** — deliberate, verified via the
`xoravu` sample above: since `ParseState.creationCounter` increments for
EVERY jar tick (visible or not — CONC phantoms, removed entities), the
SURVIVING items' raw `creationIndex` values already carry the correct gap
at every invisible slot. This is DIFFERENT from `class/renderer-uid.ts
#buildClassUidPlan`'s own dense-merge-with-phantom-entries scheme (G2
N2/N15) — that module's `creationIndex` stamping is NOT a full 1:1 replay
of every jar tick, so it needs an explicit phantom-rank mechanism to
reproduce gaps its OWN creation model doesn't otherwise account for. State's
threading IS a full 1:1 replay (verified byte-exact on all 5 samples), so
raw values suffice — simpler, and a smaller diff than porting G2's
dense-merge machinery would have been.

**Chokepoints** (mirrors `class/renderer-uid.ts`'s own "stamp at the
ACTUAL creation moment, not after the fact" discipline):
1. `state-parse-resolve.ts#registerStateInto` — the SINGLE true "brand new
   `State` enters a scope" chokepoint (every creation path — declare,
   dotted-path, history/deepHistory shorthand, compound-history graft,
   transition-endpoint auto-create — already funneled through here
   pre-S7).
2. `state-commands.ts` rule 4 (`--`/`||` handler), `pass === 'one'` branch
   — burns (discards) a tick for the CONC phantom group.
3. `state-parse-state.ts#emitTransition` — stamps `Transition.creationIndex`
   AFTER both endpoints are already resolved (`state-commands.ts` rule 16
   calls `ensureState(from)` then `ensureState(to)` before
   `emitTransition`), mirroring `Link`'s own ctor-time tick.
4. `state-parse-resolve.ts#ensureState` (new `isFrom?: boolean` param) —
   `'[*]'` still returns `undefined` (no `State` node, unchanged) but NOW
   ALSO lazily stamps a per-scope pseudostate tick into a NEW
   `ParseState.pseudoCreationIndex: Map<string, number>` (keyed by
   `pseudoTickKey(noteScopeId(ps), 'start'|'end')`, reusing the ALREADY-
   established `noteScopeId`/`concurrentRegionScopeId` scope-key
   convention mechanism 14 (S6) introduced for note-scoping) — mirrors
   `getStart`/`getEnd`'s own lazy, per-quark-idempotent creation.

**Threading** (additive `creationIndex?: number` field, `GeoSpec`'s
`'state'`/`'autonom'`/`'cluster'` variants → `StateNodeGeo`/`TransitionGeo`):
`layout.ts` (flat pipeline: `buildFlatStateGeos`/`buildPseudoNodeGeos`/
`buildFlatTransitionGeos`), `state-composite-pass.ts` (`resolveMember`'s
leaf branch, `addLocalPseudoNodes`, `buildLevelTransitionGeos`,
`DiagramCtx.pseudoCreationIndex` sourced from `ast.pseudoCreationIndex` in
`buildTopLevelPass`), `state-composite-geo.ts` (`materializeSpecs`'s
`'state'` branch, `materializeAutonom`, `materializeCluster`),
`state-composite-autonom.ts#buildPlainAutonomSpec`,
`state-composite-concurrent.ts#combineConcurrentPasses`,
`state-composite-cluster.ts#resolveClusterComposite`. `renderer-uid.ts`
rewritten: real-indexed nodes/edges use `entUid(n.creationIndex)`/
`lnkUid(t.creationIndex)` directly; items WITHOUT one (hand-built test
geometries, and the ONE still-unthreaded edge case named below) fall back
to the PRE-S7 dense-numbering scheme, continuing from the highest real tick
used (mirrors G2's own exact/fallback split precedent).

**Sibling ordering** (discovered while jar-verifying the id-value fix on
`nelupe-49-xova546`: `toutou9`, declared EARLY at tick 3, sorts BEFORE its
OWN owning region's `[*]`-pseudo anchor, tick 11, in jar's real document —
disproving the S5-era "real states first, pseudo last" heuristic as
anything more than a special case). NEW `state-composite-pass.ts
#sortSpecsByCreationIndex` (stable sort, `undefined` sorts last) applied at
EVERY `GeoSpec`-sibling-list assembly site (`buildTopLevelPass`,
`buildPlainAutonomSpec`, `buildConcurrentBranchAcc`,
`resolveClusterComposite`) AND the flat pipeline's own `buildFlatStateGeos`
— applied to EACH REGION's own spec list BEFORE concatenation into a
composite's flat `children` (never to the already-concatenated array),
preserving `state-composite-geo.ts#materializeAutonom`'s own "flat array is
a concatenation of per-region ones" identity-sharing contract (mission G4
S6).

**Composite-pipeline `<path id>` bug** (discovered the SAME way, same
fixture): `state-composite-pass.ts#buildLevelTransitionGeos` read
`t.from`/`t.to` directly off the ORIGINAL (raw AST) `Transition` object —
re-introducing the literal `'[*]'` token into `TransitionGeo.from`/`.to`
even though the RESOLVED scope-local pseudo-anchor id
(`__init_<scopeId>`/`__final_<scopeId>`) already lived on `acc.edges`
(`addLevelEdges`'s own `levelEndpointId` resolution). Fixed by reading the
resolved endpoints off `acc.edges` (keyed by `edgeId`) instead. This alone
would still have produced the WRONG `<path id>` string, since
`renderer.ts#svgEndpointId` only recognized the FLAT pipeline's own
`INITIAL_ID`/`FINAL_ID` constants — extended to also recognize the
COMPOSITE pipeline's `__init_<scopeId>`/`__final_<scopeId>` pattern,
producing `*start*<localName>`/`*end*<localName>` (jar's own
`"*start*" + g.getName()`, where `g.getName()` for a `CONCURRENT_STATE`
group is the BARE `CONC<n>` segment, not this port's own internally-
qualified `<ownerId>::CONC<n>` scope-dedup string — a `localScopeName`
helper strips the `::`-qualification back to the trailing segment jar's
own unqualified name would be). Jar-verified: `nelupe-49-xova546`'s
`*start*s7_2-to-chat1`/`*start*toutou9-to-leo`/`*start*CONC1-to-toutou9`
all now match exactly.

### Coverage gap NOT threaded (named, not chased)

`state-composite-cluster.ts#buildConcurrentRegionLeaf`'s synthetic
region-as-node id (`regionId`, used ONLY when a CONCURRENT-region-owning
composite is itself classified `'cluster'`, i.e. non-autonom — a rarer
combination than the AUTONOM concurrent case this mission's 5 required
samples all exercised) does NOT get a `creationIndex` — its `GeoSpec` falls
back to the pre-S7 dense-numbering path (via `sortSpecsByCreationIndex`'s
own `undefined`-sorts-last rule). Not chased: this scenario (cluster +
concurrent regions together) was outside the mission's own 5 required
sample categories, and threading it would require determining whether
jar's REAL tick for this case is the SAME `GroupType.CONCURRENT_STATE`
phantom mechanism (sub-pattern a) or a genuinely different one — unverified
this iteration, named precisely for a future iteration.

### Ratchet / pins

+2 new pins (`nivanu-50-zajo916`, `xoravu-40-gebe122` — was 14, now **16**)
— `oracle/goldens/svg-state/ratchet.json` updated, 2 new golden dirs added
(`in.puml`+`golden.svg`, copied verbatim from
`test-results/dot-cache/state/{nivanu-50-zajo916,xoravu-40-gebe122}/`).
`state.golden.ratchet.test.ts`: **18 tests** (was 16; 16×AC1 + AC2 + AC3),
all passing. `parity-state.json` regenerated (271/271 surveyed).

### size-backlog.json: unchanged (0 entries touched)

This iteration's mechanisms are ALL render-structure/id/ordering-only (no
sizing-formula changes) — `state-dot-parity.test.ts` (size-backlog ratchet)
stayed at **268/268** passing throughout, checked before and after every
change. No tighten-only edits made (nothing to tighten).

### Files changed (S7)

- `src/diagrams/state/ast.ts` — `State.creationIndex`/
  `Transition.creationIndex`/`StateDiagramAST.pseudoCreationIndex` (all NEW,
  additive/optional).
- `src/diagrams/state/state-parse-state.ts` — `ParseState.creationCounter`/
  `.pseudoCreationIndex` (NEW); `nextCreationIndex`/`pseudoTickKey` (NEW,
  exported); `emitTransition` stamps `Transition.creationIndex`.
- `src/diagrams/state/state-parse-resolve.ts` — `registerStateInto` stamps
  `State.creationIndex`; `ensureState` gains `isFrom?: boolean` param +
  lazy per-scope pseudostate tick stamping.
- `src/diagrams/state/state-commands.ts` — separator handler burns a
  phantom tick on pass `'one'`; transition dispatch passes `isFrom`
  true/false to both `ensureState` calls.
- `src/diagrams/state/parser.ts` — initializes the 2 new `ParseState`
  fields; hands off `ps.pseudoCreationIndex` onto `ast.pseudoCreationIndex`
  at end-of-parse.
- `src/diagrams/state/state-geo-types.ts` — `StateNodeGeo.creationIndex`/
  `TransitionGeo.creationIndex` (NEW, additive).
- `src/diagrams/state/layout.ts` — `buildPseudoNodeGeos`/
  `buildFlatStateGeos`/`buildFlatTransitionGeos` thread `creationIndex`;
  `buildFlatStateGeos` sorts via `sortSpecsByCreationIndex`.
- `src/diagrams/state/state-composite-pass.ts` — `GeoSpec`'s 3 variants
  gain `creationIndex?`; `DiagramCtx.pseudoCreationIndex` (NEW);
  `addLocalPseudoNodes` threads it; `resolveMember`'s leaf branch threads
  `s.creationIndex`; `buildLevelTransitionGeos` fixed (reads resolved
  endpoints off `acc.edges`, threads `t.creationIndex`); `buildTopLevelPass`
  populates `ctx.pseudoCreationIndex`; NEW `sortSpecsByCreationIndex`
  (exported), applied at its own `specs` assembly.
- `src/diagrams/state/state-composite-geo.ts` — `materializeSpecs`'s
  `'state'` branch, `materializeAutonom`, `materializeCluster` all thread
  `creationIndex`.
- `src/diagrams/state/state-composite-autonom.ts` —
  `buildPlainAutonomSpec` threads `s.creationIndex`, sorts `localSpecs`.
- `src/diagrams/state/state-composite-concurrent.ts` —
  `combineConcurrentPasses` threads `s.creationIndex`;
  `buildConcurrentBranchAcc` sorts its own `specs`.
- `src/diagrams/state/state-composite-cluster.ts` —
  `resolveClusterComposite` threads `s.creationIndex`, sorts `children`.
- `src/diagrams/state/renderer-uid.ts` — rewritten: raw-value numbering for
  real-indexed nodes/edges, dense-fallback-continuation for the rest.
- `src/diagrams/state/renderer.ts` — `svgEndpointId` recognizes the
  composite pipeline's own scoped pseudo-anchor ids; NEW
  `localScopeName` helper.
- `src/diagrams/state/state-pseudokind.ts` (NEW) — `PSEUDOSTATE`/
  `stereotypeToKind`/`pseudoKindForId`/`compoundHistoryKind` split out of
  `state-parse-state.ts` (500-line file-cap compliance once this
  iteration's additive edits pushed it over; pure move, re-exported for
  backward compat).
- `src/diagrams/state/state-composite-pseudo.ts` (NEW) —
  `scopedPseudoIds`/`sortSpecsByCreationIndex`/`addLocalPseudoNodes`/
  `levelEndpointId` split out of `state-composite-pass.ts` (same file-cap
  reason; pure move, re-exported for backward compat).
- `tests/unit/state/state-global-resolution.test.ts`,
  `tests/unit/state/state-dotted-id.test.ts` — 6 pre-existing `toEqual`
  assertions on `Transition` objects switched to `expect.objectContaining`
  (the tests are about scope/resolution mechanics, not id-numbering — per
  testing.md/diagnosis.md, asserting the exact NEW `creationIndex` tick
  value would over-specify a test that isn't about that field).
- `oracle/goldens/svg-state/ratchet.json` — 2 fixtures added.
- `oracle/goldens/svg-state/{nivanu-50-zajo916,xoravu-40-gebe122}/
  {in.puml,golden.svg}` — NEW.
- `tests/oracle/svg-conformance/parity-state.json` — regenerated.
- `plans/g4-state-svg/README.md`, `plans/g4-state-svg/ledger.md`,
  `plans/g4-state-svg/decision-journal.md` — this entry.

### Gates (S7, final)

- `state` census: **16/271** zero-diff (`1-3:26, 4-10:133, 11-30:47,
  31+:49, errors:0`) — was S6's `14/271` (`1-3:27, 4-10:134, 11-30:41,
  31+:55`). +2 new pins, 0 regressed.
- Class census: **303/718**, intact, unchanged.
- Object census: **22/80**, intact, unchanged.
- Description census: **48/355**, intact, unchanged.
- DOT gate: `component 262/262 · usecase 90/90 · class 708/708 · object
  78/80 · state 267/267` — EXACTLY unchanged, verified before and after.
- `state-dot-parity.test.ts` (size-backlog ratchet): **268/268** passing,
  unchanged throughout.
- `npm test -- --run`: 9973/9973 passing (366 files, +2 vs S6's 9971 —
  the 2 new AC1 pin tests; the 6 test-file assertion updates net zero).
- `npm run typecheck` / `npm run lint` / `npm run build`: all clean.
- `state.golden.ratchet.test.ts`: **18 tests** (16 pins), up from 16 (14
  pins).

### S8+ queue

1. **Mechanism 19** (transition `path/@d`/`polygon` routing) — now
   confirmed (not just suspected) as the SOLE remaining blocker on
   `pevene-26-kebo361` and `nelupe-49-xova546` (both 100% geometry-only
   residuals after this iteration's fixes) — the strongest evidence yet
   that this is a real, bounded-per-fixture, high-value target, though
   still unstarted as its own scoped item (a preliminary look at
   `nelupe`'s own `[*]-to-chat1` diff shows OUR path has ~8 short
   piecewise-cubic segments vs jar's ONE clean 4-point cubic for what
   should be a straight vertical edge — looks like a graphviz-ts/dot-layout
   spline-simplification gap, not a state-diagram-specific bug; needs
   investigation in `core/graph-layout*`/`core/dot/` before any fix, not a
   quick formula tweak).
2. **Mechanism 16** (entity-vs-cluster wrap dimension) — unchanged, needs
   `layoutGraph()`/graphviz-ts cluster-bbox exposure.
3. **`<<meblue>>`-style stereotype-scoped `StateBorderColor` cascade gap**
   (S6's own item 11) — now the SOLE remaining blocker on
   `semala-31-joji042` (2 diffs, both this mechanism).
4. **`state-composite-cluster.ts#buildConcurrentRegionLeaf`'s own
   `creationIndex` gap** (NEW, named this iteration) — cluster + concurrent
   region combination, unthreaded; needs its own jar-verified derivation
   (does it share sub-pattern (a)'s phantom-tick mechanism, or something
   else?) before landing.
5. `skin debug`/named-skin-file directive support — unchanged, unscoped.
6. `addStateBoxInk`'s max-corner asymmetry (`bilare`'s 1px rounding) —
   unchanged, exact fix named, unverified blast radius.
7. Creole/markdown bold (`**text**`) markup — unchanged, unimplemented
   feature.
8. `transitionArrowheadInk`'s own root cause (S4 queue item 2) — unchanged.
9. `<<sdlreceive>>` unwrapped-entity gap — unchanged from S1-S4.
10. Notes never render — unchanged from S1-S4.
11. `lonuti-97-voko521`'s own `<style>`-tag `FontColor` cascade gap —
    unchanged from S4.

## S8 — mechanism 19 (transition path/@d routing) LANDED in full: root
cause was a missing `manualArrowheads: true` seam flag, NOT a graphviz-ts
routing/spline-simplification gap -- 16→39 pins (+23), the largest
single-iteration jump this mission has seen

### Summary

Per this iteration's own instruction, drilled `pevene-26-kebo361` and
`nelupe-49-xova546` (the two fixtures S7 confirmed were blocked SOLELY by
mechanism 19) by feeding each fixture's exact pinned `oracle/goldens/
state/<slug>/svek-N.dot` (already structurally EQUAL to jar per the DOT
gate) through BOTH real `dot -Tplain` (`/opt/homebrew/bin/dot`, graphviz
15.1.0) and a minimal `layoutGraph()` probe carrying the IDENTICAL node/
edge structure -- BEFORE writing any fix, per this iteration's own "reproduce
first" instruction. For `nelupe`'s `s7_2`→`chat1` edge (circle→rounded-rect,
`minlen=1`, `arrowtail=none,arrowhead=none`): real dot's own spline reached
to within 0.27px of the target node's boundary (`y=85.69→50.27`, a 36pt
ranksep gap almost fully traversed); `layoutGraph()` fed the SAME structure
stopped ~11.5px short (`y=20.31→44.51` out of a 36pt available gap). Since
real dot and a from-scratch `layoutGraph()` probe DIVERGED on identical
input, the natural next step was tracing WHY -- leading directly to
`graph-layout-build.ts#addEdges`'s existing `manualArrowheads` flag
(`DotInputGraph.manualArrowheads`, already landed for `class` in mission
G2's own N29 and for `description` in mission G1's own I9): when unset,
`addEdges` defaults to `arrowhead=normal` and graphviz-ts reserves a
~10-11px arrow-clip gap, EVEN when the edge itself carries
`arrowtail=none,arrowhead=none` (state draws its arrowhead as an inline
`<polygon>` at the raw spline endpoint, mission G4 S1 mechanism 3 -- the
SAME switch that made `class` need this exact flag in G2 N29). State's own
3 `DotInputGraph` construction sites (`state-dot-graph.ts#buildDotGraph`,
`state-composite-pass.ts#runPass`/`buildTopLevelPass`) never carried the
flag, despite state having made the identical arrowhead-rendering switch
`class` made. This is the SAME "seam invocation gap, not an engine bug"
class of root cause G2 N29 already diagnosed -- confirming (not merely
suspecting, per this iteration's own explicit attribution-first
instruction) that S7's "looks like a graphviz-ts spline-simplification gap"
framing was UNVERIFIED and, once actually reproduced against real dot, WRONG.

Landing the `manualArrowheads` fix alone immediately exposed a SECOND,
independent bug in `renderer.ts#buildPathD`: `TransitionGeo.points` is
ALREADY a well-formed `1 + 3*n` cubic-bezier spline for every real
dot-layout-driven transition (confirmed by direct inspection of
`layoutState()`'s own raw output, a probe script, BEFORE the fix -- nelupe's
raw `s7_2`→`chat1` points were already exactly 4 points/1 segment, matching
jar's own single-`C`-command shape), but the pre-S8 `buildPathD` discarded
that structure unconditionally and re-derived a Catmull-Rom smoothing curve
through the points regardless of count, producing 2-3x too many segments
(nelupe: jar draws ONE `C` segment, the pre-S8 port drew THREE). Rewrote
`buildPathD` to mirror `class/renderer.ts#buildPathData` exactly (bezier-
chain passthrough for `1+3n` point lists, straight-`L` fallback otherwise,
including the exact `M{x},{y} C{x1},{y1} {x2},{y2} {x},{y}` no-space
format jar uses) -- `renderer-arrowhead.ts#applyHeadTrim` already assumed
this exact bezier-control-point structure (mirrors `class`'s own
`applyDecorTrim` head-side branch), so the trim math needed no changes.

```
S7 (before): 16/271 -- 1-3:26, 4-10:133, 11-30:47, 31+:49, errors:0
S8 (after):  39/271 -- 1-3:31, 4-10:130, 11-30:27, 31+:44, errors:0
```

+23 new pins, 0 pins lost (all 16 S7 pins verified unchanged via a fresh
census + `parity-state.json` regen; all 22 dotEqual=true-checked before
pinning per `state.golden.ratchet.test.ts`'s own AC3 gate). A SECOND,
smaller mechanism was found and landed in the same iteration: `kilato-
12-laso661`'s choice-diamond `<polygon>` was missing its closing point
(jar's `EntityImageBranch` repeats the first coordinate pair last -- 5
pairs for a 4-sided diamond; `core/svg.ts#diamond`, shared with `activity`/
`chronology` and OUTSIDE this mission's write-set, does not -- fixed via a
state-local post-hoc string patch, `renderer-pseudostate.ts
#closeDiamondPoints`, +1 pin, included in the 39/271 total above).

### Attribution table (ours vs library, evidence per fixture family)

| Fixture / family | Symptom (pre-S8) | Root cause | Attribution | Evidence |
|---|---|---|---|---|
| `nelupe-49-xova546` (`s7_2→chat1`, circle→rounded-rect, minlen=1) | Spline 3 segments, ~11.5px short of target boundary | Missing `manualArrowheads: true` (state's 3 `DotInputGraph` sites) + Catmull-Rom over-expansion (`buildPathD`) | **OURS** (consumer, both parts) | Real `dot -Tplain` on the pinned `svek-3.dot` golden reaches to within 0.27px of the target boundary; identical structure through `layoutGraph()` WITHOUT the flag stopped 11.5px short; raw (pre-render) `layoutState()` output already carried the correct 4-point/1-segment spline |
| `pevene-26-kebo361` (`a→b`, box→box, `minlen=0`, same-rank) | 0.15-0.27px residual on interior control points, 27 diffs (all same shape ×3 regions) | Small (<0.5px), genuine graphviz-ts vs real-dot clip-inset difference for `minlen=0` same-rank straight edges | **LIBRARY** (small, unfiled — see below) | Minimal `layoutGraph()` probe with jar's EXACT `svek-1.dot` structure (2 boxes, `minlen=0`) reproduces the SAME ~0.27px start-inset delta vs real `dot -Tplain` on the identical input; node positions match exactly (gap=18 both), only the edge's OWN clip-into-gap amount differs |
| `kilato-12-laso661` (choice diamond) | Polygon `@points` token count 4 vs jar's 5 | `core/svg.ts#diamond` never repeats the first point to close the polygon | **OURS** (consumer) | jar's `<polygon points="162,86,174,98,162,110,150,98,162,86">` (5 pairs) vs our 4; fixed via `closeDiamondPoints`, now byte-token-exact |
| `lalava-26-zosi801`, `tegali-39-molu382` (2 composites, each with concurrent regions) | `<path id>` says `*start*CONC1-...` for the SECOND composite's region, jar says `*start*CONC2-...` | `CONC<n>` bare-name numbering is diagram-GLOBAL in jar (`getUniqueSequence2`), per-composite-LOCAL in this port | **OURS** (consumer, diagnosed, NOT landed) | jar's own `data-qualified-name`s confirm `State2.CONC2...` (global), but `normalize.ts` strips ALL `data-*` attrs before comparison — the ONLY live-checked consumer is `renderer.ts#localScopeName`'s `<path id>` derivation |
| `semala-31-joji042` (`<<meblue>>` stereotype) | `rect`/`line` `@stroke` `#181818` vs jar's `#0000FF` | `StateBorderColor<<X>>` stereotype-scoped skinparam entirely unimplemented (`core/skinparam.ts` discards ALL `<<tag>>` keys except `classBorderThickness<<X>>`) | **OURS** (consumer, diagnosed S6/S7, still blocked by write-set boundary) | `core/skinparam.ts`'s own `key.includes('<<')` early-branch comment names the ONE modeled exception; `StateBorderColor<<meblue>>` falls into `unknown[]` |
| `kenuci-20-cane702` (`state S [[{S}]]`) | `childCount` 5 vs jar's 2 | State hyperlink (`[[url]]`) annotation entirely unimplemented | **OURS** (consumer, new finding, unimplemented feature) | jar wraps the linked entity differently; out of scope, a genuinely new feature |
| `lasasi-13-nona547`, `soxene-95-domu248` (`<style>` block, `RoundCorner`/`Shadowing`) | `childCount` 5 vs jar's 6 | `<style>`-tag state-diagram-scoped CSS property support gap (already-named S4 item, `lonuti-97-voko521`'s own cascade gap family) | **OURS** (consumer, previously named, unchanged) | Matches the already-diagnosed S4 `<style>`-tag `FontColor` cascade family — a different property (`RoundCorner`/`Shadowing`) hitting the SAME unimplemented mechanism |
| `jijuze-43-ceva131`, `zecivu-62-pagu681` (cluster + concurrent regions) | 5-6 diffs, dominated by viewBox/height off by 25-138px | `buildConcurrentRegionLeaf`'s own unthreaded `creationIndex` (S7-named) -- but MASKED by larger, unrelated sizing/childCount gaps on both known fixtures | **OURS** (consumer, could not independently verify this iteration) | Direct `classifyDiagram` probe over the full 271-fixture corpus found ONLY these 2 fixtures combining cluster-classification with concurrent regions; neither is clean enough to isolate the creationIndex mechanism from its co-occurring larger bugs |

### The `pevene` library-attribution decision (NOT filed to docs/graphviz-issues/)

The minlen=0 same-rank clip-inset delta (~0.15-0.5px, decreasing along the
curve) is real and reproducible via a minimal, jar-structurally-verified
probe -- but it is small enough (well under 1px, only 1 known fixture,
27 diffs all the SAME shape repeated 3x for pevene's 3 identical regions)
that filing a new `docs/graphviz-issues/` entry was judged premature
without a SECOND independent same-rank fixture to confirm the magnitude is
consistent (this iteration's own corpus scan found no second minlen=0
same-rank case to cross-check against). Named precisely (exact probe
inputs/outputs, both engines' own raw values) for a future iteration with
budget to gather a second sample before filing.

### Files changed (S8)

- `src/diagrams/state/state-dot-graph.ts` — `buildDotGraph` sets
  `manualArrowheads: true`.
- `src/diagrams/state/state-composite-pass.ts` — `runPass`/
  `buildTopLevelPass` both set `manualArrowheads: true`.
- `src/diagrams/state/renderer.ts` — `buildPathD` rewritten (bezier-chain
  passthrough + straight-`L` fallback, mirrors `class/renderer.ts
  #buildPathData`); the pre-S8 Catmull-Rom implementation removed entirely.
- `src/diagrams/state/renderer-pseudostate.ts` — `renderChoiceJunction`
  now closes the diamond polygon via new `closeDiamondPoints`.
- `tests/unit/state/state-manual-arrowheads.test.ts` (NEW) — 3 tests:
  `manualArrowheads` on the flat pipeline, on every composite pass, and a
  numeric-tolerant byte-shape check against `nelupe`'s jar-exact path.
- `tests/unit/state/renderer.test.ts` — 3 stale Catmull-Rom-era assertions
  replaced with 4 tests asserting the new bezier-passthrough/`L`-fallback
  contract; 1 new test asserting the diamond's closing point.
- `tests/unit/state/renderer-nested-transitions.test.ts` — 2 stale
  `'M 10,20'` (space) assertions updated to `'M10,20'` (no space).
- `oracle/goldens/svg-state/ratchet.json` — 22 fixtures added (16→38).
- `oracle/goldens/svg-state/{22 new slugs}/{in.puml,golden.svg}` — NEW,
  copied verbatim from `test-results/dot-cache/state/<slug>/`.
- `tests/oracle/svg-conformance/parity-state.json` — regenerated
  (271/271 surveyed).
- `plans/g4-state-svg/README.md`, `ledger.md`, `decision-journal.md` —
  this entry.

### Ratchet / pins

+23 new pins (16→**39**) — `bapoja-80-lori225`, `figiza-55-migo973`,
`forine-82-befe711`, `gaxume-08-maki760`, `gefefe-91-xoge233`,
`gimopu-56-rete904`, `gokaka-17-pati662`, `gopumi-11-pise779`,
`jocado-69-dara158`, `kilato-12-laso661`, `leloja-87-tebi184`,
`makizi-03-tapu007`, `mazize-40-paxi649`, `nelupe-49-xova546`,
`pexiku-77-japi217`, `pidaxu-33-tigi166`, `sapelo-46-jafe280`,
`sizife-41-buje191`, `vulete-98-xeje860`, `xixuxo-57-beju714`,
`zageca-24-zino008`, `zebuzu-41-caro961`, `zepodi-66-moda518`. All 22
verified `dotEqual: true` in the regenerated `parity-state.json` (AC3)
before pinning. `state.golden.ratchet.test.ts`: **40 tests** (38 pins,
was 18/16), all passing.

### size-backlog.json: unchanged (0 entries touched)

This iteration's mechanisms are ALL render-structure/routing/polygon-only
(no sizing-formula changes) — `state-dot-parity.test.ts` (size-backlog
ratchet) stayed at **268/268** passing throughout, checked before and
after every change.

### Gates (S8, final)

- `state` census: **39/271** zero-diff (`1-3:31, 4-10:130, 11-30:27,
  31+:44, errors:0`) — was S7's `16/271` (`1-3:26, 4-10:133, 11-30:47,
  31+:49`). +23 new pins, 0 regressed.
- Class census: **303/718**, intact, unchanged.
- Object census: **22/80**, intact, unchanged.
- Description census (no-arg, 355 fixtures): **48/355**, intact, unchanged.
- DOT gate: `component 262/262 · usecase 90/90 · class 708/708 · object
  78/80 · state 267/267` — EXACTLY unchanged, verified before and after.
- `state-dot-parity.test.ts` (size-backlog ratchet): **268/268** passing,
  unchanged throughout.
- `npm test -- --run`: **10000/10000** passing (367 files), up from
  9973/9973 (+27: 3 new `state-manual-arrowheads.test.ts` tests, 22 new
  AC1 pin tests, 1 new choice-diamond test, 1 net from the 3 stale-test
  replacements becoming 4).
- `npm run typecheck` / `npm run lint` / `npm run build`: all clean.
- `state.golden.ratchet.test.ts`: **40 tests** (38 pins), up from 18
  (16 pins).

### S9+ queue

1. **CONC-region bare-name global numbering** (NEW, S8) — `renderer.ts
   #localScopeName`'s per-composite-local `CONC<n>` derivation needs a
   diagram-global counter (jar's `getUniqueSequence2(CONCURRENT_PREFIX)`)
   threaded from parse time (mirror the `creationIndex`/
   `pseudoCreationIndex` S7 precedent). 2 known fixtures
   (`lalava-26-zosi801`, `tegali-39-molu382`), both down to exactly 2
   diffs, both on the SAME `<path id>` mechanism. Scope narrowed by
   `normalize.ts`'s own `data-*` exclusion (only the rendered `<path id>`
   string is live-checked, not the internal qualified-name machinery).
2. **`pevene-26-kebo361`'s minlen=0 same-rank clip-inset delta** (NEW,
   S8) — small (<0.5px), reproduced against real dot via a minimal probe,
   but not yet filed to `docs/graphviz-issues/` (needs a second
   independent same-rank fixture to confirm magnitude before filing; this
   iteration's corpus scan found none).
3. **`<<meblue>>`/`StateBorderColor<<X>>` stereotype-scoped skinparam**
   (S6/S7, re-confirmed S8) — sole blocker on `semala-31-joji042`.
   BLOCKED by write-set boundary: needs `core/skinparam.ts` (mirror G2
   N51's `classBorderThickness<<X>>` precedent) + `core/theme.ts`, both
   outside `src/diagrams/state/**`.
4. **`buildConcurrentRegionLeaf`'s own `creationIndex` gap** (S7,
   re-confirmed S8) — the only 2 known corpus fixtures combining cluster-
   classification with concurrent regions are both dominated by larger,
   unrelated sizing/childCount bugs, so the mechanism could not be
   independently verified this iteration either.
5. **State hyperlink (`[[url]]`) annotation** (NEW, S8) — entirely
   unimplemented feature, `kenuci-20-cane702`'s sole blocker
   (`childCount` 5 vs jar's 2).
6. **`<style>`-tag state-diagram-scoped CSS properties** (S4, re-confirmed
   S8 via 2 new fixtures) — `RoundCorner`/`Shadowing` hit the SAME
   unimplemented-cascade family as S4's own `FontColor` finding
   (`lonuti-97-voko521`).
7. Mechanism 16 (entity-vs-cluster wrap dimension) — unchanged, needs
   `layoutGraph()`/graphviz-ts cluster-bbox exposure.
8. `skin debug`/named-skin-file directive support — unchanged, unscoped.
9. `addStateBoxInk`'s max-corner asymmetry (`bilare`'s 1px rounding) —
   unchanged, exact fix named, unverified blast radius.
10. Creole/markdown bold (`**text**`) markup — unchanged, unimplemented
    feature.
11. `<<sdlreceive>>` unwrapped-entity gap — unchanged from S1-S4.
12. Notes never render — unchanged from S1-S4.
## S9 — mechanism 20 (`StateBorderColor<<X>>` cascade) LANDED in full; 6
new mechanisms sampled/attributed (notes-never-render, `<<sdlreceive>>`
folded-frame shape, pseudostate stroke-color over-application, title/arrow
`<style>` cascade generalization, json+composite childCount gap, CONC-region
global numbering) diagnosed but explicitly NOT forced -- 39/271 -> 40/271

### Summary

Sampled ALL 31 of S8's own near-zero (1-3 diff) fixtures individually, plus
25 from the 4-10 bucket (10 requested + a targeted 15-fixture note-family
sweep), BEFORE choosing a fix target, per this iteration's own instruction.
The full sample produced a much richer attribution table than S8's queue
implied -- several items named as single-fixture residuals turned out to be
small FAMILIES once sampled directly (see table below).

Landed the task's own explicitly-named priority-2 item,
`StateBorderColor<<stereotype>>` (`semala-31-joji042`'s sole blocker, S6/S7/S8
re-confirmed), mirroring G2 N51's `classBorderThicknessByStereo` precedent
exactly (`SkinParam#getColor(ColorParam, Stereotype)` -- a direct
stereotype-qualified VALUE lookup, not the `<style>`/`.tagname` cascade).
Landing it required threading a NEW `StateNodeGeo.stereotype` field through
BOTH pipelines (flat `buildStateGeoTextFields`, composite `GeoSpec`
'state'/'autonom' variants + `materializeSpecs`/`materializeAutonom`) --
mirrors the ALREADY-established `color` field's identical two-pipeline
threading pattern (mission G4 S2/S3), not a new mechanism shape. Scoped
DELIBERATELY narrow: `StateBorderColor<<X>>` only, NOT `stateBackgroundColor
<<X>>`/`stateFontColor<<X>>`/`stateFontSize<<X>>` (all three used by the
OTHER known stereotype-color fixture, `laferu-31-tice836`) -- `FontSize<<X>>`
would additionally require threading a per-stereotype font size through
`state-sizing.ts`'s LAYOUT-time measurement (affects box width/height, a
materially larger, unverified blast radius), and Background/FontColor were
judged not worth splitting from FontSize's own three-key fixture. Jar-verified
byte-exact against `semala-31-joji042` (both the box `rect`'s and divider
`line`'s `stroke="#0000FF"`, non-stereotyped children unaffected) via the
REAL production `renderSync` pipeline, not just the deterministic-measurer
census harness -- caught (and resolved, see below) a survey-tooling race
this iteration.

### Mid-iteration tooling incident: stale `parity-state.json` race (resolved,
### not a code bug)

Regenerating `parity-state.json` per the write-set's own required step
initially reported `semala-31-joji042` as `verdict: diverged` despite
`dotEqual: true` and a byte-exact `DeterministicMeasurer` census pass -- a
confusing, seemingly-contradictory result (a real code bug would need
`@stroke` to differ under `WidthTableMeasurer` specifically, which makes no
sense for a non-text attribute). Per diagnosis.md's "instrument before
hypothesizing", re-ran `renderSync` directly (the REAL production entry
point, not the survey script) and confirmed `stroke="#0000FF"` renders
correctly. Root cause: an earlier BASH TOOLING mistake, not a rendering bug
-- two independent invocations of the same long-running survey command were
launched in overlapping background shells (the first via a bare command that
auto-backgrounded, the second via a manually-run `until`-loop polling for
"file exists AND no matching process" that returned true prematurely because
a STALE `parity-state.json` from a PRIOR, unrelated survey run already
existed on disk while the actual new survey was still mid-flight in a
DIFFERENT background shell) -- the stale file was read before the real
survey finished writing it. Killed the stray processes, re-ran the survey
ONCE cleanly with a single `until`-loop keyed only on "no matching process
running" (not file existence), and confirmed `semala-31-joji042: dotEqual:
true, verdict: conformant` in the fresh, fully-completed 271/271 survey. No
code change resulted from this — logged so a future iteration recognizes the
"file exists but verdict looks wrong" symptom as a tooling race to
re-instrument, not a rendering regression to chase.

### Attribution table (31 near-zero + 25 from 4-10, evidence per family)

| Family (fixture count sampled) | Symptom | Root cause | Status |
|---|---|---|---|
| `StateBorderColor<<X>>` (1: `semala-31-joji042`) | `rect`/`line` `@stroke` wrong | Stereotype-qualified skinparam entirely unimplemented for state | **LANDED** (mechanism 20, this iteration) |
| `addStateBoxInk` 1px width asymmetry (3: `bilare-19-fufe539`, `jelusa-98-nexa591`, `lavera-29-vuka790`) | `@viewBox[2]`/`@width` off by exactly 1 | Pre-existing, S6-named, algebraically-derived 1-char fix, deliberately not landed (blast-radius-unverified, universally-reused ink formula) | Unchanged, re-confirmed with 2 NEW same-shape samples (was 1 known) |
| Mechanism 16, entity-vs-cluster wrap dimension (10: `decede`/`fakali`/`gojuja`/`livuni`/`lulozu`/`nufigo`/`tofezi`/`xojudi`/`gokife`/`xomize`) | `@height`/`@viewBox[3]` + nested `g[N][childCount]` | Confirmed unbounded (needs graphviz cluster-bbox exposure), S1/S3/S6-named | Unchanged, largest single family in the near-zero bucket by far |
| Notes never render (15 corpus-wide: `labono`/`pexuve`/`xodazu`/`dajipi`/`kujuzo`/`fatupo`/`fotigo`/`gedude`/`joleju`/`jaxuxe`/`kupexa`/`vateco`/`xupefu`/`tumaba`/`xeziki`) | `childCount` short by 1-2 (or, for `kujuzo`, a note WRONGLY rendered as a plain state box) | `layout.ts#buildFlatStateGeos` iterates `ast.states` ONLY -- a note's DOT-graph position (`state-dot-graph.ts#addNotes`) is computed and feeds layout spacing, but NEVER converted into a renderable `StateNodeGeo`/`NoteGeo`; the shared class-engine note subsystem (`renderer-note.ts`, `<polygon>`-based) does not match jar's OWN state-note shape (`<path>`-based folded-corner, jar-verified `labono`'s raw SVG) | **Diagnosed in full, NOT landed** -- largest single-mechanism reach found this iteration (15 fixtures, several with cascading document-size effects that would likely unmask MORE fixtures below them once fixed), but a genuinely new feature (parser grammar gap: `State.url`/note-position AST fields already partially exist for notes themselves but per-node `StateNodeGeo` rendering does not; needs a NEW state-specific note-box renderer since the shape byte-differs from class's `<polygon>` convention) comparable in scope to mechanism 5/6's own multi-iteration box-shape work — queued whole for S10 |
| `<<sdlreceive>>` folded-frame shape (1: `cekolo-21-gini183`) | `g[1][childCount]` short by 2 | `state-sizing.ts` already approximates the DIMENSION (S1-era, flagged "UNVERIFIED") but no renderer branch draws jar's real `USymbolFrame`-style folded-corner-flag shape (`<path>` corner cut, no divider line) -- falls through to the plain box's divider-line shape instead, wrong element count | Diagnosed (root cause pinned to a specific missing renderer branch), NOT landed -- single fixture, unscoped new shape |
| Pseudostate stroke-color over-application with `#color` (1: `ceruzi-77-give569`) | `<<start>>`/`<<end>>` `ellipse` `@stroke` colored (red/green) when jar keeps the `#222222` default | jar's `#color` override on a start/end pseudostate applies to FILL only (already correct, not flagged), our port ALSO applies it to STROKE (bug); `dummy #Blue` (a plain leaf) is unaffected, correctly | Diagnosed (root cause pinned to `renderer-pseudostate.ts`'s fill/stroke call for start/end), NOT landed this iteration (found late in the sampling pass, no remaining budget to verify blast radius against `renderer-pseudostate.ts`'s OTHER pseudostate kinds) |
| `<style>` cascade generalization (4: `lasasi`/`soxene` [RoundCorner/Shadowing, S4-named], `judova-36-kana429` [title `HorizontalAlignment`/`FontColor`/`BackgroundColor`, NEW], `nanozi-96-foda024` [arrow `LineColor`/`HeadColor`, NEW]) | `text/@x` (title alignment) / `path/@stroke`+`polygon/@fill`+`@stroke` (arrow colors) wrong, or `childCount` short (box-level properties) | Same unimplemented `<style>`-tag cascade family S4 first named, now confirmed to span THREE independent sub-targets (state-box properties, title properties, arrow properties) rather than one | Re-confirmed + WIDENED (2 new sub-families found), still entirely unimplemented, unchanged |
| json+composite childCount gap (1: `maruju-55-soko478`) | `g[1]/g[3][childCount]` 2 vs 6, `@viewBox[2]`/`@width` off by 8 | Not root-caused this iteration (combination of an embedded `json` leaf + a sibling composite state) | Diagnosed only (symptom located), root cause NOT yet isolated -- needs a probe script pass, deferred |
| `xexika-61-fedu273`'s two sub-issues (1 fixture, 2 mechanisms) | `rect/@fill` (bare `StateBackgroundColor` skinparam not applied) + `g[3]`/`g[4]` `childCount` (arrow-endpoint markers `-->o`/`x-->` not drawn) | (a) `core/skinparam.ts`'s `ELEMENT_BUCKET_SNAMES` set does not include `'state'` -- the SAME generic per-element bucket mechanism `'object'`/`'map'`/`'json'` already reuse "for free" (G3/O1 precedent) is simply missing this ONE sname; (b) genuinely new arrow-decoration feature (circle/cross endpoint markers), unrelated | (a) Diagnosed, verified-cheap-but-NOT-landed this iteration (see below); (b) diagnosed only, unimplemented feature |
| CONC-region bare-name global numbering (2: `lalava-26-zosi801`, `tegali-39-molu382`) | `<path id>` says local `CONC1` on the SECOND composite's own region, jar says global `CONC2` | `renderer.ts#localScopeName`'s per-composite-local numbering vs jar's diagram-global `getUniqueSequence2(CONCURRENT_PREFIX)` counter (S8-named) -- traced this iteration to the EXACT Java call site (`StateDiagram.java:194-208`, `concurrentState()`) and its counter field (`CucaDiagram.java:733`, `cpt2`, separate from the `creationIndex` counter `cpt1` S7 already threaded) | Re-derived precisely (see below), still NOT landed -- an open verification question (does `cpt2` tick fire on every parser pass, or only pass ONE, matching `cpt1`'s own S7-verified pass-ONE-only behavior?) blocks a confident implementation without repeating S7's own fixture-id-sequence verification methodology |

### `xexika`'s bare `StateBackgroundColor`/`StateBorderColor` item — why NOT
### landed despite being "free"

Confirmed `'state'` is absent from `core/skinparam.ts#ELEMENT_BUCKET_SNAMES`
(the SAME generic per-element `<sname>(Background|Border|Font)Color` bucket
`'object'`/`'map'`/`'json'` already reuse for free, G3/O1) -- adding it would
capture `StateBackgroundColor`/`StateBorderColor`/`StateFontColor`/
`StateFontSize` (bare) parsing "for free" via the pre-existing mechanism.
NOT landed this iteration because EVERY known corpus fixture using the bare
form (`cinoni-00-sere847`, `dapuko-98-zuzo096`, `taxile-56-goca422`,
`vekoja-22-made430`, `xexika-61-fedu273` -- 5 total, re-surveyed this
iteration) is dominated by a LARGER, unrelated bug (mechanism 16's cluster-
wrap gap, or `xexika`'s own arrow-marker gap) that would keep the fixture off
zero regardless -- meaning the fix's REAL improvement could not be jar-
verified end-to-end on any clean sample this iteration, only asserted
correct by inspection. Also unclear which of `renderer-box.ts`'s 6
`resolveStateFill` call sites should consume the new bucket tier: the doc
comment on `state-render-colors.ts` itself states initial/final/fork/join
pseudostates have their OWN distinct default colors (`PSEUDO_ANCHOR_COLOR`/
`SYNCHRO_BAR_COLOR`, NOT the plain-state `StyleSignature`), so a correct
scoping needs to exclude those call sites specifically -- a small but real
extra verification step with no fixture to confirm it against this
iteration. Named precisely (exact set/field, exact call sites to include/
exclude) for S10.

### CONC-region global numbering — Java source re-derived, still not landed

Traced `renderer.ts#localScopeName`'s S8-named gap to its exact upstream
mechanism: `StateDiagram.java:194-208`'s `concurrentState()` calls
`this.getUniqueSequence2(CONCURRENT_PREFIX)` (`CucaDiagram.java:733`,
`return prefix + cpt2.addAndGet(1);`) -- a SEPARATE counter field (`cpt2`)
from `cpt1` (mission G4 S7's own `creationIndex` source, `getUniqueSequence`/
`getUniqueSequenceValue`). `CommandConcurrentState.isEligibleFor` returns
`true` for `ParserPass.ONE`/`TWO`/`THREE` (jar's state-diagram grammar runs
THREE passes total, unlike this port's two), and `executeArg` calls
`diagram.concurrentState(...)` UNCONDITIONALLY on every eligible pass --
reading the Java in isolation suggests `cpt2` (and the synthetic `CONC<n>`
group's `quarkInContext` lookup) would fire 3 TIMES per separator, which
would be architecturally broken (three different-numbered group names per
separator) unless there is a REPLAY-vs-fresh-creation distinction inside
`quarkInContext`/`gotoGroup` this iteration did not trace far enough to
confirm. S7's OWN precedent (`ParseState.creationCounter`'s doc comment)
establishes that `cpt1` DOES need explicit pass-ONE-only gating in THIS
port's two-pass model (`nextCreationIndex(ps)` only fires `if (pass ===
'one')` at the identical `--`/`||` separator command site,
`state-commands.ts:159-172`) -- but that conclusion was reached via S7's own
fixture-id-sequence cross-verification methodology (5 independent samples),
not by reading the Java source alone. Implementing `cpt2` threading
correctly needs the SAME rigor (a handful of independent `CONC<n>` id
sequences from real jar fixtures, verified against a hypothesized pass-
gating rule BEFORE writing code) -- not yet done this iteration, so NOT
landed despite the call site now being fully pinned down. Named precisely
(exact Java lines, exact counter field, exact open question) for S10 to
pick up without re-deriving.

### Files changed (S9)

- `src/core/skinparam.ts` — `STATE_BORDER_COLOR_STEREO_RE`,
  `stateBorderColorByStereo` accumulator + `<<`-branch parsing +
  `graphOverride` wiring (mirrors `classBorderThicknessByStereo` exactly).
- `src/core/theme.ts` — `colors.graph.stateBorderColorByStereo?:
  Readonly<Record<string, string>>` (new field, additive).
- `src/diagrams/state/state-geo-types.ts` — `StateNodeGeo.stereotype?:
  string` (new field, additive).
- `src/diagrams/state/state-sizing.ts` — `StateGeoTextFields.stereotype`,
  `buildStateGeoTextFields` threads `state.stereotype` through.
- `src/diagrams/state/state-composite-pass.ts` — `GeoSpec` 'state'/'autonom'
  variants gain `stereotype?: string`.
- `src/diagrams/state/state-composite-geo.ts` — `materializeSpecs`
  ('state' branch) and `materializeAutonom` copy `spec.stereotype` through
  (mirrors the pre-existing `spec.color` pattern exactly).
- `src/diagrams/state/state-render-colors.ts` — new `resolveStateBorder`
  (stereotype-scoped border-color resolution, mirrors `resolveStateFill`).
- `src/diagrams/state/renderer-box.ts` — `renderNormal` uses
  `resolveStateBorder` instead of the bare `theme.colors.border`.
- `src/diagrams/state/renderer-composite-box.ts` — `buildCoreLayers`/
  `buildActionZone` both use `resolveStateBorder`.
- `tests/unit/skinparam.test.ts` — 2 new tests (stereo-key parsing,
  lowercasing).
- `tests/unit/state/layout.test.ts` — 4 new tests (flat + composite +
  concurrent-region stereotype threading).
- `tests/unit/state/state-render-colors.test.ts` (NEW) — 5 tests
  (`resolveStateBorder` direct unit coverage, no fixture required).
- `oracle/goldens/svg-state/ratchet.json` — 1 fixture added (38→39).
- `oracle/goldens/svg-state/semala-31-joji042/{in.puml,golden.svg}` — NEW,
  copied verbatim from `test-results/dot-cache/state/semala-31-joji042/`.
- `tests/oracle/svg-conformance/parity-state.json` — regenerated
  (271/271 surveyed, re-run once after a tooling-race false alarm, see
  above).
- `plans/g4-state-svg/README.md`, `ledger.md`, `decision-journal.md` — this
  entry.

### Ratchet / pins

+1 new pin (38→**39**) — `semala-31-joji042`, verified `dotEqual: true` in
the (twice-regenerated, second run clean) `parity-state.json` (AC3) before
pinning. `state.golden.ratchet.test.ts`: **41 tests** (39 pins), was 40/38.

### size-backlog.json: unchanged (0 entries touched)

This iteration's mechanism is render-color-only (no sizing-formula
changes) — `state-dot-parity.test.ts` (size-backlog ratchet) stayed at
**268/268** passing throughout, checked before and after.

### Gates (S9, final)

- `state` census: **40/271** zero-diff (`1-3:30, 4-10:130, 11-30:27, 31+:44,
  errors:0`) — was S8's `39/271` (`1-3:31, 4-10:130, 11-30:27, 31+:44`).
  +1 new pin, all 39 S8-pinned fixtures verified unchanged (fresh census
  before/after).
- Class census: **303/718**, intact, unchanged.
- Object census: **22/80**, intact, unchanged.
- Description census (no-arg, 355 fixtures): **48/355**, intact, unchanged.
- DOT gate: `component 262/262 · usecase 90/90 · class 708/708 · object
  78/80 · state 267/267` — EXACTLY unchanged, verified before and after.
- `state-dot-parity.test.ts` (size-backlog ratchet): **268/268** passing,
  unchanged throughout.
- `npm test -- --run`: **10012/10012** passing (368 files), up from
  10000/10000 (+11 new tests this iteration + 1 new ratchet-pin test).
- `npm run typecheck` / `npm run lint` / `npm run build`: all clean.
- `state.golden.ratchet.test.ts`: **41 tests** (39 pins), up from 40 (38
  pins).

### S10+ queue

1. **Notes never render** (NEW, S9, LARGEST reach found this iteration —
   15 corpus fixtures) — `layout.ts#buildFlatStateGeos` never converts a
   note's DOT-computed position into a renderable `StateNodeGeo`; needs a
   state-specific note-box renderer (`<path>`-based folded corner, NOT
   class's `<polygon>`-based `renderer-note.ts` shape — jar-verified byte
   difference, `labono-83-nega255`). Comparable in scope to mechanism 5/6's
   own multi-iteration box-shape work. Full fixture list in the attribution
   table above.
2. **CONC-region bare-name global numbering** (S8, re-derived to the exact
   Java call site this iteration) — `cpt2` counter
   (`CucaDiagram.java:733`), `StateDiagram.java:194-208`'s
   `concurrentState()`. Open question: pass-gating behavior (mirrors S7's
   own `cpt1`/`creationIndex` derivation, which needed 5 independent
   fixture-id-sequence samples to confirm pass-ONE-only firing) — needs the
   SAME rigor before implementing. 2 known fixtures (`lalava-26-zosi801`,
   `tegali-39-molu382`).
3. **Bare `StateBackgroundColor`/`StateBorderColor`/`StateFontColor`/
   `StateFontSize`** (NEW, S9) — `ELEMENT_BUCKET_SNAMES` missing `'state'`
   (a ONE-LINE addition, mirrors G3/O1's `'object'`/`'map'`/`'json'`
   precedent), but every known fixture is masked by a larger unrelated bug
   (mechanism 16 or arrow-markers) so the improvement could not be jar-
   verified end-to-end this iteration; also needs scoping which
   `resolveStateFill` call sites should consume it (excludes initial/
   final/fork/join per their own distinct-default-color doc comment).
4. **`stateBackgroundColor<<X>>`/`stateFontColor<<X>>`/`stateFontSize<<X>>`**
   (NEW, S9, deliberately deferred alongside mechanism 20's own
   `StateBorderColor<<X>>`) — `laferu-31-tice836`'s sole blocker.
   `FontSize<<X>>` needs LAYOUT-time (not just render-time) threading
   through `state-sizing.ts` (affects box width/height) — materially larger
   than the border-color case just landed.
5. **`<style>` cascade generalization** (S4, WIDENED this iteration — now
   3 independent sub-families: state-box `RoundCorner`/`Shadowing`
   [S4-original], title `HorizontalAlignment`/`FontColor`/
   `BackgroundColor` [NEW], arrow `LineColor`/`HeadColor` [NEW]) —
   `judova-36-kana429`, `nanozi-96-foda024` join `lasasi-13-nona547`/
   `soxene-95-domu248`. Entirely unimplemented `<style>`-tag cascade for
   state diagrams.
6. **`<<sdlreceive>>` folded-frame shape** (NEW root-cause pinpoint, S9;
   symptom known since S1-S4) — `cekolo-21-gini183`'s sole blocker; the
   dimension formula already exists (S1, flagged unverified) but no
   renderer branch draws the real `USymbolFrame` shape.
7. **Pseudostate stroke-color over-application with `#color`** (NEW, S9) —
   `ceruzi-77-give569`'s sole blocker; `renderer-pseudostate.ts` applies a
   `#color` override to BOTH fill and stroke on start/end pseudostates, jar
   applies it to fill only. Found late, blast radius against other
   pseudostate kinds unverified.
8. **`maruju-55-soko478`'s json+composite childCount gap** (NEW, S9,
   symptom only) — root cause not yet isolated, needs a probe script pass.
9. Mechanism 16 (entity-vs-cluster wrap dimension) — unchanged, needs
   `layoutGraph()`/graphviz-ts cluster-bbox exposure. LARGEST family in the
   near-zero bucket this iteration (10/31 sampled fixtures).
10. `pevene-26-kebo361`'s minlen=0 same-rank clip-inset delta (S8) —
    unchanged, needs a second independent sample before filing to
    `docs/graphviz-issues/`.
11. `buildConcurrentRegionLeaf`'s own `creationIndex` gap (S7/S8) —
    unchanged, still no clean fixture to verify against.
12. State hyperlink (`[[url]]`) annotation (S8, RE-SCOPED this iteration) —
    `kenuci-20-cane702` (anchor-reference form `[[{alias}]]`) +
    `dajipi-09-doki542` (regular URL form) — investigated this iteration:
    substantially MORE complex than the task's own "mirror class's URL
    subsystem" framing suggested. jar wraps each entity's WHOLE box in
    `<a>`, with URL INHERITANCE from the nearest ancestor entity that has
    one (`kenuci`'s `S.a.b` has no own url but inherits `a`'s, NOT `S`'s),
    plus a separate anchor-reference resolution path (`[[{alias}]]` ->
    `href=""`, `title=alias`) distinct from a real URL. `State.url` does
    not exist on the AST at all yet (parser, not just renderer, gap).
    Comparable in scope to notes (item 1) — a new multi-layer feature, not
    a cheap mirror.
13. `addStateBoxInk`'s max-corner asymmetry (`bilare`'s 1px rounding,
    RE-CONFIRMED this iteration with 2 NEW same-shape samples — now 3
    known fixtures) — unchanged, exact fix named, unverified blast radius.
14. Creole/markdown bold (`**text**`) markup — unchanged, unimplemented
    feature.
15. `skin debug`/named-skin-file directive support — unchanged, unscoped.

## S10 — mechanism 21 (notes never render, flat pipeline: freestanding +
opale-merged attached shapes) LANDED in full; mechanism 22 (bare
`state`-element skinparam bucket) LANDED, scoped, non-regressing;
+1 pre-existing zero-diff fixture discovered (unrelated to notes) --
40/271 -> 44/271

### Summary

Landed the task's own explicitly-named primary target -- "notes never
render", S9's largest-reach diagnosed family (15 fixtures). Derived the
jar's real note DOT participation and render shape BEFORE coding, per this
iteration's own instruction, against 5 fixtures spanning all three
attachment shapes: `labono-83-nega255` (freestanding, no host),
`pexuve-81-suxi717` (2 freestanding notes, cross-verifies id numbering),
`xodazu-26-cube992`/`gedude-95-subi666` (attached `of X`, explicit
position, single- and multi-line body), `fatupo-62-bemu777` (attached with
a creole TABLE body -- read to confirm it's correctly OUT of scope, not
landed). A sixth, `kujuzo-76-bavi505` (implicit-position attach + gradient
fill), was read and confirmed correctly deferred (state notes have NO
`#color`/gradient grammar capture at all yet -- `state-notes.ts`'s
`NOTE_COLOR` regex group is non-capturing).

### Note-subsystem derivation (jar source + fixture evidence, BEFORE any code)

**DOT participation.** Already fully built (mission A4 Phase L iter 9,
`state-note-layout.ts`) -- a note contributes its own DOT node (sized via
`measureNote`) plus, for an attached note, a connector edge
(`__noteedge_<id>`) into whichever svek pass owns its declaring scope. This
mission's own gap was entirely on the RENDER side: `layout.ts
#buildFlatStateGeos` iterated `ast.states` only, never converting a note's
already-laid-out DOT position into a renderable geometry entry.

**Render shape -- two kinds, not one, jar-verified from raw SVG + Java
source (`EntityImageNote.java`/`Opale.java`) together:**
- A FREESTANDING note (`opaleLine == null`, `EntityImageNote#drawNormal`)
  draws `Opale.getPolygonNormal`/`getCorner` at `roundCorner === 0`: a
  plain `<path>` rectangle-with-cut-corner (`M x,y Lx,y+h Lx+w,y+h
  Lx+w,y+c Lx+w-c,y Lx,y`, `c` = cornersize = 10) PLUS a SEPARATE filled
  corner-triangle `<path>`. Byte-derived and confirmed against `labono`'s
  own `path d="M92.27,20.5 L92.27,43.5 L221.7388,43.5 L221.7388,30.5
  L211.7388,20.5 L92.27,20.5"` (main) + `"M211.7388,20.5 L211.7388,30.5
  L221.7388,30.5 L211.7388,20.5"` (corner). CRITICAL asymmetry:
  `drawNormal` strokes ONLY the main polygon draw call (`stroked.draw
  (polygon)`, `stroke-width="0.5"`) -- the corner draw
  (`ug.draw(getCorner(...))`) reuses the UN-stroked base `ug`, so it draws
  at `UStroke`'s bare default width (`"1"`), NOT 0.5. Jar-verified both
  numbers directly in `labono`'s own two `<path style="...stroke-
  width:...">` values.
- An ATTACHED note (`of X` / implicit-position) with a resolved connector
  edge ALWAYS draws jar's Opale zigzag-notch MERGED shape
  (`EntityImageNote#drawU`'s `opaleLine != null && isOpale()` branch,
  `Opale.drawU`) -- confirmed on BOTH `xodazu-26-cube992` (explicit `of
  state1`) and `gedude-95-subi666` (implicit via `[*] --> state1` then
  `note bottom of state1`): both raw SVGs contain degenerate `A0,0 0 0 0
  x,y` arc commands (SVG's zero-radius-arc-equals-line convention) woven
  INTO the note's own outline path, pointing a notch at the host -- NO
  separate `<g class="link">`/dashed connector line exists at all for this
  case. Unlike the freestanding shape, `Opale.drawU` applies the SAME
  `ug` (post-stroke-apply) to BOTH the outline AND corner draw calls, so
  BOTH get `stroke-width="0.5"` -- confirmed on `gedude`'s own two `<path>`
  elements (both `0.5`, no asymmetry).
- Text baseline/margins: `EntityImageNote`'s `marginX1=6`/`marginX2=15`/
  `marginY=5` constants (`getTextWidth = pureTextWidth + 21`, `getTextHeight
  = textHeight + 10`), font FIXED at 13pt (`plantuml.skin`'s `note {
  FontSize 13 }` default) -- NOT `theme.fontSize` (the diagram's general
  14pt body font). Derived arithmetically from `labono`'s own
  `textLength="108.4688"` -> `width="129.4688"` (exactly `+21`) and
  `gedude`'s 2-line `height="36"` (exactly `2*13 + 10`, confirming NO
  `*1.4` line-height multiplier unlike this port's OTHER multi-line body
  conventions) -- the PRE-EXISTING `state-note-layout.ts#measureNote`
  formula (`NOTE_HPAD*2+NOTE_FOLD` width, `*1.4` height, `theme.fontSize`
  font) was simply WRONG on all three counts, masked because the DOT-
  structural gate (267/267) only checks graph TOPOLOGY, not exact node
  sizes.
- Attribution direction: no fixture in the target set exercises `up`/
  `down` opale notches (only `left`/`right`), but the generic
  `getOpaleStrategy`/`resolveOpaleConnector` machinery (reused verbatim
  from `../class/note-opale.ts`, diagram-agnostic pure geometry) handles
  all four uniformly regardless.

**`note ... on link` (fotigo/jaxuxe/kupexa/vateco/xupefu/tumaba, 6
fixtures) -- confirmed a THIRD, structurally different shape, NOT built.**
`vateco-92-pece508`'s raw SVG shows the note's `<path>` pair embedded
DIRECTLY inside the transition's own `<g class="link" id="lnk3">`,
alongside the arrowhead `<polygon>` -- no separate `<g class="entity">`,
no id, no notch, no dashed connector: a plain (non-opale) folded box
floating at a fixed offset near the edge's own label position. The DOT-
sizing half of this (`state-dot-graph.ts#edgeLabelAttrs`'s `mergeNoteWithLabel`)
was ALREADY built (mission-A4-era); only the render side is missing, and
it needs its OWN placement formula (mirrors `SvekEdge.java:308-326`'s
`mergeLR`/`mergeTB`), not a reuse of either shape landed this iteration.

### GMN quark-name dual-tick (id-numbering correctness for attached notes)

Read `CommandFactoryNoteOnEntity.java:327` directly: an ATTACHED note calls
`diagram.getUniqueSequence("GMN")` (ticks `cpt1`, mission G4 S7's own
`creationIndex` counter) to generate an internal quark name BEFORE
`reallyCreateLeaf` ticks `cpt1` AGAIN for the note's own entity id -- TWO
ticks per attached note, not one. Verified against 3 independent fixtures'
own `id="entNNNN"` gaps: `gedude`/`xodazu` both land on `ent0005` after 4
prior ticks (start-pseudo, `state1`, the `[*]-->state1` transition, the
burned GMN tick) instead of `ent0004`; `kujuzo` (no transitions) lands on
`ent0003` after `s1`(1) + the burned GMN tick(2). Confirmed via direct read
of `tests/oracle/svg-conformance/normalize.ts` that `data-*` attributes
(including `data-qualified-name`, the ONLY place the `GMN<n>` STRING itself
would ever surface) are stripped before comparison entirely -- so only the
TICK COUNT needed threading (`nextTick()` burned once, discarded, before
the note's own `creationIndex`), not the string, saving a whole quark-name-
generation subsystem for a value nothing compares.

### Attribution table

| Family (fixture count) | Symptom (before) | Root cause | Status |
|---|---|---|---|
| Freestanding notes (2: `labono-83-nega255`, `pexuve-81-suxi717`) | `childCount` short, note never drawn | `layout.ts#buildFlatStateGeos` never materialized a note geo at all | **LANDED** (mechanism 21) |
| Attached notes, opale-merged (2: `xodazu-26-cube992`, `gedude-95-subi666`) | same, plus (once geo existed) `textLength` off by float noise | Same root cause + a SEPARATE `javaRound4` rounding gap on note `textLength` (fixed alongside) | **LANDED** (mechanism 21) |
| `kilato-12-laso661` (pre-existing, no note) | (was already 0 diffs) | Unrelated to S10 — a previously-undiscovered zero-diff fixture surfaced by this iteration's own fresh full-census re-run | **PINNED** (found-money, `dotEqual` re-verified) |
| Bare `StateBackgroundColor`/`StateBorderColor`/etc. (5 known: `cinoni`/`dapuko`/`taxile`/`vekoja`/`xexika`) | `rect/@fill` wrong (or masked) | `ELEMENT_BUCKET_SNAMES` missing `'state'` | **LANDED** (mechanism 22), 0 fixtures reach zero (all masked by mechanism 16 or `xexika`'s own arrow-marker gap — re-confirmed, matches S9's own prediction) |
| `note ... on link` (6: `fotigo`/`jaxuxe`/`kupexa`/`vateco`/`xupefu`/`tumaba`) | `childCount`/size mismatch, note-in-link-group never drawn | Confirmed a THIRD, structurally different shape (embedded in `<g class="link">`, no host wrap, no notch) — DOT-sizing half already built, render half is not | Diagnosed in full, **NOT landed** — queued whole for S11 |
| Creole/table note content (1: `fatupo-62-bemu777`) | `childCount` short by 18, wrong dimensions | Note body is a full creole TABLE (`|= header |`), needs the class engine's table-rendering machinery ported into state's own note renderer | Diagnosed only, **NOT landed** — unbounded, queued |
| `#color`/gradient override on notes (1: `kujuzo-76-bavi505`) | `defs[childCount]`/`g[childCount]` mismatch | `state-notes.ts`'s `NOTE_COLOR` regex capture group is non-capturing — the grammar itself doesn't thread a color value through yet, a PARSER gap not just a renderer gap | Diagnosed only, **NOT landed** — queued |
| Composite-scoped notes (`dajipi`/`joleju`/`tumaba`/`xupefu`, all also blocked by OTHER unrelated composite gaps) | note never drawn inside a composite scope | `buildFlatNoteGeos` only ever called from the FLAT pipeline (`layout.ts#layoutFlat`) — `state-composite-pass.ts`/`state-composite-geo.ts` never call into the new note-materialization module at all | Diagnosed (call site named precisely), **NOT landed** — queued |

### Files changed (S10)

- `src/diagrams/state/ast.ts` — `StateNote.creationIndex?: number` (new
  field, additive, full doc comment deriving the GMN dual-tick rule).
- `src/diagrams/state/state-notes.ts` — `addNote`/`addFreestandingNote`
  gain an optional `creationIndex`; `finalizePendingNote` gains an optional
  `nextTick: () => number` callback (burns the extra GMN tick for
  `'attached'`, one tick for `'freestanding'`, none for `'link'`).
- `src/diagrams/state/state-commands-notes.ts` — rules 11 (single-line
  attached) and 14 (single-line freestanding) call `nextCreationIndex(ps)`
  directly (mirrors the multi-line path's callback).
- `src/diagrams/state/parser.ts` — `handlePendingNoteLine` passes `()  =>
  nextCreationIndex(ps)` into `finalizePendingNote`.
- `src/diagrams/state/state-note-layout.ts` — `measureNote`'s formula
  corrected (fixed 13pt font, `marginX1(6)+marginX2(15)` width,
  `NOTE_FONT_SIZE*lines + marginY(5)*2` height, no `*1.4`); exported (was
  private) + returns `lines: {text,width}[]` (was aggregate-only) so the
  new render-geo mapper can recover per-line content without re-deriving
  the formula.
- `src/diagrams/state/state-geo-types.ts` — `StateNodeGeo.kind` widened to
  `StateKind | 'note'`; new `noteLines?`/`noteOpale?` fields (additive).
- `src/diagrams/state/renderer-note.ts` (NEW, 246 lines) — `buildFlatNoteGeos`
  (post-DOT-layout note materialization), `renderStateNoteFreestanding`/
  `renderStateNoteOpale`/`renderStateNote` (the two shapes + dispatch).
  Reuses `../class/note-opale.ts`'s pure geometry functions directly (no
  duplicate port).
- `src/diagrams/state/layout.ts` — `buildFlatStateGeos` takes a
  `FlatNoteGeoCtx` bundle (posMap/edgePosMap/theme/measurer, collapsed to
  stay under the param-count cap) and appends `buildFlatNoteGeos`'s output
  before the creation-index sort; `layoutFlat` builds `edgePosMap` and
  passes the bundle through; `buildPseudoNodeGeos`'s `posMap` param widened
  to `ReadonlyMap`.
- `src/diagrams/state/renderer.ts` — `renderShape`/`wrapClassFor` gain a
  `case 'note'` (dispatches to `renderStateNote`; wraps `'entity'`).
- `src/diagrams/state/layout-ink-extent.ts` — new `addNoteInk` (uninset-
  both-corners rule, `LimitFinder`'s generic path-vertex-walk convention,
  jar-verified against `labono`'s own 236×71 canvas) + a `case 'note'` in
  `addNodeInk`'s switch.
- `src/diagrams/state/state-sizing.ts` — `historyLabelText`'s param type
  widened to `StateKind | 'note'` (a type-only fix, `renderHistory` calls
  it with a `StateNodeGeo` whose `kind` is now the broader union).
- `src/core/skinparam.ts` — `ELEMENT_BUCKET_SNAMES` gains `'state'`
  (mechanism 22, mirrors the `object`/`map`/`json` G3/O1 precedent).
- `src/diagrams/state/state-render-colors.ts` — new
  `resolveStateFillBucketed` (mechanism 22, `#color` override -> `state`
  bucket -> hardcoded fallback), consumed by `renderer-box.ts#renderNormal`
  and `renderer-composite-box.ts#buildCoreLayers` (both were
  `resolveStateFill`, now bucketed) — `renderer-pseudostate.ts`'s 3
  PSEUDO_ANCHOR_COLOR/SYNCHRO_BAR_COLOR call sites are UNCHANGED (still
  plain `resolveStateFill`, per the doc comment's own distinct-default
  scoping) but its OTHER 2 (choice, history/deepHistory,
  STATE_DEFAULT_BACKGROUND fallback) were NOT switched this iteration —
  named as a small follow-up (queued below), the composite/box/normal
  sites cover every fixture this iteration's own verification touched.
- `tests/unit/state/state-notes.test.ts` — 1 pre-existing assertion updated
  (`note "text" as N1` now also stamps `creationIndex: 1`).
- `tests/unit/state/renderer-note.test.ts` (NEW) — 15 tests (geo
  materialization: freestanding/composite-skip/no-posMap/resolved-opale/
  unresolved-opale/no-notes-array; both render shapes incl. the
  asymmetric-vs-symmetric stroke-width distinction; dispatch).
- `tests/unit/state/state-render-colors.test.ts` — +4 tests
  (`resolveStateFillBucketed`: default fallback, override-wins-over-bucket,
  bucket-wins-over-default, non-string-bucket-falls-through).
- `oracle/goldens/svg-state/{labono-83-nega255,gedude-95-subi666,
  pexuve-81-suxi717,xodazu-26-cube992,kilato-12-laso661}/{in.puml,
  golden.svg}` — NEW, copied verbatim from `test-results/dot-cache/state/`.
- `oracle/goldens/svg-state/ratchet.json` — 5 fixtures added (39→44).
- `tests/oracle/svg-conformance/parity-state.json` — regenerated (271/271
  surveyed; the first survey mid-run showed `kilato-12-laso661` as a
  `verdict: timeout` — re-ran once cleanly and confirmed `dotEqual: true,
  verdict: conformant`, matching S9's own "survey timeout ≠ regression"
  precedent, no code change).
- `plans/g4-state-svg/README.md`, `ledger.md`, `decision-journal.md` — this
  entry.

### Ratchet / pins

+5 new pins (39→**44**) — `labono-83-nega255`, `gedude-95-subi666`,
`pexuve-81-suxi717`, `xodazu-26-cube992` (mechanism 21, notes), `kilato-
12-laso661` (pre-existing, found via fresh census, unrelated to any S10
mechanism) — ALL verified `dotEqual: true, verdict: conformant` in a
freshly (twice-)regenerated `parity-state.json` (AC3) before pinning.
`state.golden.ratchet.test.ts`: **46 tests** (44 pins), was 41/39.

### size-backlog.json: unchanged (0 entries touched)

`state-dot-parity.test.ts` (size-backlog ratchet) stayed at **268/268**
passing throughout, checked before and after — this iteration's changes
are note-materialization + render-color-bucket only, no changes to any
EXISTING state/transition sizing formula (the `measureNote` fix only
affects NOTE nodes, which size-backlog.json's own 268 entries don't cover).

### Gates (S10, final)

- `state` census: **44/271** zero-diff (`1-3:28, 4-10:128, 11-30:26,
  31+:45, errors:0`) — was S9's `40/271` (`1-3:30, 4-10:130, 11-30:27,
  31+:44`). +5 new pins, all 39 S9-pinned fixtures verified unchanged
  (fresh census before/after each mechanism landed).
- Class census: **303/718**, intact, unchanged.
- Object census: **22/80**, intact, unchanged.
- Description census (no-arg, 355 fixtures): **48/355**, intact, unchanged.
- DOT gate: `component 262/262 · usecase 90/90 · class 708/708 · object
  78/80 · state 267/267` — EXACTLY unchanged, verified before, mid-
  iteration (after `measureNote`'s sizing-formula fix specifically), and
  after.
- `state-dot-parity.test.ts` (size-backlog ratchet): **268/268** passing,
  unchanged throughout.
- `npm test -- --run`: **10036/10036** passing (369 files), up from
  10012/10012 (+19 new unit tests, +5 new ratchet-pin tests).
- `npm run typecheck` / `npm run lint`: both clean.
- `state.golden.ratchet.test.ts`: **46 tests** (44 pins), up from 41 (39
  pins).

### S11+ queue

1. **`note ... on link`** (NEW derivation, S10 — 6 fixtures: `fotigo`/
   `jaxuxe`/`kupexa`/`vateco`/`xupefu`/`tumaba`, 4 of them fully flat) — a
   THIRD note render shape (embedded in the transition's own `<g
   class="link">`, plain non-opale box, no host `<g class="entity">` at
   all). DOT-sizing half already built (`state-dot-graph.ts
   #edgeLabelAttrs`); needs its own placement formula
   (`SvekEdge.java:308-326`'s `mergeLR`/`mergeTB`) and a new render
   function — comparable in scope to this iteration's own mechanism 21.
2. **Creole/table note content** (S10, `fatupo-62-bemu777`) — a note body
   containing a `|= header |` table needs the class engine's table-
   rendering machinery ported into state's own `renderer-note.ts`.
3. **`#color`/gradient override on notes** (S10, `kujuzo-76-bavi505`) — the
   note grammar's `NOTE_COLOR` regex group is non-capturing; needs BOTH a
   parser change (capture + thread the override) and a `state-notes.ts`/
   `renderer-note.ts` render-side consumer (mirrors class's own
   `resolveNoteBackground`).
4. **Composite-scoped note materialization** (S10) — `buildFlatNoteGeos`
   is FLAT-pipeline only; `state-composite-pass.ts`/`state-composite-
   geo.ts` never call into it. Blocks `dajipi-09-doki542`/`joleju-94-
   maru748`/`tumaba-64-tosu281`/`xupefu-98-roni234` (all ALSO blocked by
   other, unrelated composite gaps this iteration — mechanism 16 chiefly
   — so even landing this alone would not reach zero on any of the 4
   known fixtures without ALSO closing mechanism 16 first).
5. **State hyperlink (`[[url]]`)** (S8/S9, unchanged) — `kenuci-20-cane702`/
   `dajipi-09-doki542`, URL-inheritance + anchor-reference resolution +
   missing `State.url` AST field, re-scoped at S9.
6. Mechanism 16 (entity-vs-cluster wrap dimension) — unchanged, LARGEST
   family in the near-zero bucket, needs `layoutGraph()`/graphviz-ts
   cluster-bbox exposure.
7. **CONC-region bare-name global numbering** (S8/S9, unchanged) — exact
   Java call site pinned (`StateDiagram.java:194-208`, `cpt2`), still needs
   the SAME fixture-id-sequence verification rigor S7 used for `cpt1`
   before implementing.
8. `stateBackgroundColor<<X>>`/`stateFontColor<<X>>`/`stateFontSize<<X>>`
   (S9, unchanged) — `laferu-31-tice836`'s sole blocker.
9. `<style>` cascade generalization (S4, unchanged, 3 sub-families).
10. `<<sdlreceive>>` folded-frame shape (S9, unchanged, single fixture).
11. Pseudostate stroke-color over-application with `#color` (S9, unchanged,
    `ceruzi-77-give569`, single fixture).
12. `maruju-55-soko478`'s json+composite childCount gap (S9, unchanged,
    root cause not yet isolated).
13. `pevene-26-kebo361`'s minlen=0 same-rank clip-inset delta (S8,
    unchanged).
14. `buildConcurrentRegionLeaf`'s own `creationIndex` gap (S7/S8,
    unchanged).
15. `addStateBoxInk`'s max-corner asymmetry (`bilare`'s 1px rounding, S6,
    unchanged, 3 known fixtures).
16. Creole/markdown bold (`**text**`) markup — unchanged, unimplemented.
17. `skin debug`/named-skin-file directive support — unchanged, unscoped.
18. `resolveStateFillBucketed` NOT yet wired into `renderer-pseudostate.ts`'s
    choice/history/deepHistory call sites (S10, small follow-up) — those 2
    of the 6 STATE_DEFAULT_BACKGROUND-fallback sites stayed on the plain
    `resolveStateFill` this iteration since no sampled fixture needed them
    bucketed; low-risk, same pattern as the 4 already-wired sites.


## S11 — mechanism 23 (pseudostate `#color` override stroke over-application)
LANDED in full; `note ... on link` (priority-1 task item) DIAGNOSED to a
DEEPER, newly-found blocking mechanism (edge-label real-size injection gap)
and explicitly NOT landed after a same-iteration attempt was reverted --
44/271 -> 46/271

### Summary

Sampled the 6 `note ... on link` fixtures (`fotigo-12-gufu949`,
`jaxuxe-73-sije305`, `kupexa-94-dude266`, `vateco-92-pece508`,
`xupefu-98-roni234`, `tumaba-64-tosu281`) plus `CommandFactoryNoteOnLink.java`/
`SvekEdge.java:308-326`/`EntityImageNoteLink.java` (Java source) BEFORE
attempting a fix, per this iteration's own instruction. Derived the render
shape correctly (jar's `EntityImageNoteLink#drawU` calls `comp.drawU`
directly -- the SAME plain folded-corner box as a freestanding note, but
SYMMETRIC 0.5 stroke-width on both outline+corner paths, unlike the
freestanding shape's asymmetric split) and a candidate position formula
(note box sits a FIXED 5px to the right of the edge's own routing line,
vertically CENTERED on the edge's geometric midpoint -- cross-verified
against BOTH `vateco` and `jaxuxe`'s first link, both showing the identical
5px gap between the edge line's x and the note box's left edge). Implemented
the full wiring: `TransitionGeo.linkNoteBox` (new field), `state-transition-
label.ts#attachTransitionLinkNote` (geometry, scoped to the "no guard/action
label" case only -- combining a REAL label with a note needs jar's
`mergeLR`/`mergeTB` stacking + a 13pt arrow-label font-size correction,
confirmed via `jaxuxe`'s own `<text font-size="13">` for `hello`, deferred
whole as a separate, larger item), `renderer-note.ts#renderTransitionLinkNote`
(the render shape, reusing `plainNoteBoxPaths` factored out of the existing
freestanding-note renderer), `layout-ink-extent.ts#addTransitionInk`
(ink-extent contribution, reusing the existing `addNoteInk` primitive),
`layout.ts#shiftStateTransition` (document-margin shift propagation), and
`renderer.ts#buildTransitionInnerMarkup` (DOM-order wiring, note AFTER the
arrowhead -- jar-verified DOM order).

### Deeper mechanism found while verifying: edge-label real-size injection
### gap (NEW, blocks note-on-link AND, unverified but likely, any real
### guard/action label whose real rendered size diverges from graphviz-ts's
### own internal guess)

Jar-verifying the wired implementation against `vateco-92-pece508` (the
simplest target: single unlabeled transition, single-line note, default
position) surfaced a childCount-correct but POSITION-wrong result: the note
box landed 7px too far right and 5.8px too far up, AND `State1`'s own
`<rect>` position (unrelated to the note itself) shifted 16.5px off from
golden too. Instrumented (per diagnosis.md, BEFORE proposing any further
fix) `state-dot-graph.ts#buildDotGraph` -> `core/graph-layout.ts#layoutGraph`
directly: the raw graphviz-ts-computed node/edge positions differ from a
label-less control graph by only ~16.5px of extra rank separation, matching
the observed position error almost exactly. Traced to
`graph-layout-build.ts#addEdges` (line ~186): `attrs.label = a.label` feeds
graphviz-ts the RAW TEXT STRING only, plus `fontname: 'Times'` -- our own
`labelWidth`/`labelHeight` (`state-dot-graph.ts#edgeLabelAttrs`,
`measureLinkNote`) are read back by `core/graph-layout.ts` (`entry.labelWidth
= inp?.attributes?.labelWidth`) but this is a PURE ECHO for downstream
consumers (e.g. `state-composite-cluster.ts`'s own width calc) -- grep-
confirmed `graph-layout-build.ts` NEVER emits `labelWidth`/`labelHeight`/an
HTML-table label into the actual DOT text/builder calls graphviz-ts lays out
from. graphviz-ts instead computes its OWN label bounding box via
`node_modules/graphviz-ts/src/common/make-label.ts#makePlainLabel`, which
calls a GLOBAL `TextMeasurer` (`core/graph-layout.ts#setTextMeasurer(new
LutTextMeasurer())`, set ONCE at module load, no per-call override point) --
this measurer's own per-line height (Times-font LUT) has no relationship to
jar's real note-box height formula (13pt font + marginY(5)*2, mission G4
S10's own `measureNote`). For `vateco`'s single-line "this is a note",
graphviz-ts reserved only ~16.5px of extra rank gap where jar's real note
needs 23px -- a ~6.5px under-reservation that cascades into every downstream
position (the note box AND, since ink-extent/shift are diagram-global, the
neighboring state box too).

Ruled out before landing this finding: (1) the `measureLinkNote` formula
fix alone (already correct per this iteration's own re-derivation, matching
`state-note-layout.ts#measureNote` exactly) does NOT fix this -- confirmed
by grep that the override is architecturally unreachable from graphviz-ts's
real layout call, not merely miscalibrated; (2) a `fontsize`-attribute-
tuning workaround (inflating `attrs.fontsize` so graphviz-ts's own Times-LUT
height calculation happens to land near 23px) was considered and REJECTED
as unverified/fragile -- it would only work for the SPECIFIC 1-line case
tuned against, would not generalize to jar's real `n*13+10` multi-line
formula (graphviz-ts's own per-line accumulation has no additive `+10`
margin term to match), and constitutes exactly the kind of "guess to make
progress" diagnosis.md prohibits; (3) a real HTML-table label injection
(graphviz-ts DOES support an HTML label form via an internal control-
character-prefixed marker, `node_modules/graphviz-ts/src/common/
html-string.ts`) is architecturally the CORRECT fix but is a substantial,
unverified-blast-radius new mechanism (touches the shared `graph-layout-
build.ts`/`core/graph-layout.ts` used by EVERY diagram type, not just
state) -- comparable in scope to mechanism 21 itself, explicitly NOT
attempted this iteration given the remaining time budget.

Given the wired implementation could not reach byte-exact on ANY of the 4
fully-flat target fixtures (`vateco`/`jaxuxe`/`kupexa`/`fotigo`, the latter
two ALSO blocked by the separately-named `#color` grammar gap and the
label+note merge-stacking gap respectively) and made `vateco`'s own diff
count strictly WORSE (9 -> 39 diffs, zero new pins) rather than the mission's
own established "mixed-direction unmasking with an offsetting zero-diff
gain" pattern, the wiring was REVERTED IN FULL before any commit (`git show
HEAD:<path>` restore per each of the 6 touched files, `git diff --stat`
verified empty, `npm run typecheck`/`npm test` re-verified clean at
baseline) rather than landed as unverified/wrong code. Named precisely
(exact file/line, exact library internals, exact 3 workarounds considered
and rejected with reasons) for a future iteration authorized to touch the
shared `core/graph-layout.ts`/`graph-layout-build.ts` files with a properly
scoped HTML-table-label mechanism.

### Mechanism 23 (LANDED): pseudostate `#color` override applies to FILL
### only, never STROKE

Re-scoped to the cheapest fully-diagnosable item on the S10 queue after the
note-on-link revert: `ceruzi-77-give569`'s pseudostate stroke-color
over-application (S9-named, root cause already pinpointed to the exact call
sites). jar-verified via `ceruzi`'s own raw SVG: `state start1 <<start>>
#Red` renders `fill="#FF0000"` but `style="stroke:#222222;..."`
(UNCHANGED); `state end2 <<end>> #Green` renders the inner dot
`fill="#008000"` with BOTH ellipses' `stroke:#222222` unchanged too --
confirmed against the no-override case (`gefefe-91-xoge233`) that stroke is
ALWAYS the literal `#222222` default, never derived from the override.
`renderInitial`/`renderFinal` (`renderer-pseudostate.ts`) both previously
passed `stroke: fill` (the SAME resolved value as the fill, correct only in
the coincidental no-override case where both default to `#222222`) --
changed to `stroke: PSEUDO_ANCHOR_COLOR` (the literal constant) on both
functions' every `ellipse()` call. TDD-first: `tests/unit/state/renderer-
pseudostate.test.ts` (NEW, 4 tests) asserted the fill/stroke divergence
under an override BEFORE the fix (2 of 4 tests red), confirmed green after
the 2-line change. Jar-verified 0 diffs on `ceruzi-77-give569`; a fresh full
census re-run also surfaced `gepoti-01-sasi356` (`state end1 <<end>> #Red` +
`state end2 <<end>> #Green`, no note/link involved) newly reaching zero from
the SAME mechanism. Re-sampled 5 already-pinned pseudostate-bearing fixtures
(`gefefe-91-xoge233`, `nelupe-49-xova546`, `nivanu-50-zajo916`,
`xoravu-40-gebe122`, plus `cekolo-21-gini183` which stays non-zero for its
own already-named, unrelated `<<sdlreceive>>` gap) -- all unchanged, zero
regressions.

### Attribution table (6 note-on-link fixtures + 5 re-sampled pinned
### pseudostate fixtures)

| Fixture | Symptom | Root cause | Status |
|---|---|---|---|
| `ceruzi-77-give569` | `<<start>>`/`<<end>>` `ellipse/@stroke` colored when jar keeps `#222222` | `renderInitial`/`renderFinal` passed `stroke: fill` instead of the literal `PSEUDO_ANCHOR_COLOR` constant | **LANDED** (mechanism 23), 0 diffs, PINNED |
| `gepoti-01-sasi356` | Same shape, 2x `<<end>>` with 2 different `#color` overrides | Same mechanism 23 | **LANDED** (found via fresh census after mechanism 23), 0 diffs, PINNED |
| `vateco-92-pece508` (note-only, no label, position=bottom/default) | `childCount` short by 3 (note never drawn) | `layout.ts#buildFlatStateGeos`/`buildFlatTransitionGeos` never materializes `note on link` as ANY geometry -- a THIRD, unbuilt note shape | Render shape + position formula DERIVED and jar-verified independently (X-axis, DOM order, stroke symmetry all confirmed correct) but BLOCKED end-to-end by the edge-label real-size injection gap (Y-axis wrong by ~5.8px, cascades into `State1`'s own position too) -- wiring implemented then REVERTED, NOT landed |
| `jaxuxe-73-sije305` (4 transitions, ALL combine a real guard label with a note, all 4 position keywords) | Same + needs `mergeLR`/`mergeTB` label+note stacking, arrow-label font-size correction (13pt not `theme.fontSize`) | Combined-label case explicitly scoped OUT of `attachTransitionLinkNote` even before the deeper blocker was found (comparable in scope to note-on-link's own MVP) | NOT landed, deferred whole |
| `kupexa-94-dude266` (both transitions combine a guard label + multi-line note) | Same as jaxuxe | Same combined-label gap | NOT landed, deferred whole |
| `fotigo-12-gufu949` (2 unlabeled transitions, BOTH `#red`/`#blue` note colors) | Note-only (no label) shape would apply, BUT needs `#color`/gradient note overrides too (S10's own named, separate parser gap: `NOTE_COLOR` regex group non-capturing) | TWO independent blockers stacked (edge-label injection gap + color parser gap) | NOT landed, blocked on 2 separate deferred items |
| `xupefu-98-roni234`, `tumaba-64-tosu281` (composite-scoped) | Composite pipeline never calls note-materialization at all (S10's own named item 4) | Composite pipeline gap, unrelated to this iteration's own findings | NOT landed, unchanged from S10 |

### Files changed (S11)

- `src/diagrams/state/renderer-pseudostate.ts` -- `renderInitial`/
  `renderFinal` both changed `stroke: fill` to `stroke: PSEUDO_ANCHOR_COLOR`
  (2-line fix), doc comments updated with the jar-verified derivation.
- `tests/unit/state/renderer-pseudostate.test.ts` (NEW) -- 4 tests (fill/
  stroke divergence under a `#color` override, both `renderInitial`/
  `renderFinal`, with and without an override).
- `oracle/goldens/svg-state/{ceruzi-77-give569,gepoti-01-sasi356}/
  {in.puml,golden.svg}` -- NEW, copied verbatim from
  `test-results/dot-cache/state/`.
- `oracle/goldens/svg-state/ratchet.json` -- 2 fixtures added (44 -> 46
  pins).
- `tests/oracle/svg-conformance/parity-state.json` -- regenerated (271/271
  surveyed cleanly in one run, 46 conformant, 0 errors/timeouts).
- `plans/g4-state-svg/README.md`, `ledger.md`, `decision-journal.md` -- this
  entry.
- No files left changed from the note-on-link investigation -- fully
  reverted (`layout-ink-extent.ts`, `layout.ts`, `renderer-note.ts`,
  `renderer.ts`, `state-geo-types.ts`, `state-transition-label.ts` all
  restored to their pre-iteration committed content, `git diff --stat`
  verified empty before starting mechanism 23's own work).

### Ratchet / pins

+2 new pins (44 -> **46**) -- `ceruzi-77-give569`, `gepoti-01-sasi356`, both
verified `dotEqual: true, verdict: conformant` in a freshly regenerated
`parity-state.json` (271/271 surveyed in one clean run, no timeouts/errors)
before pinning. `state.golden.ratchet.test.ts`: **48 tests** (46 pins), was
46 (44 pins).

### size-backlog.json: unchanged (0 entries touched)

This iteration's landed mechanism is render-color-only (no sizing-formula
changes) -- `state-dot-parity.test.ts` (size-backlog ratchet) stayed at
**268/268** passing throughout, checked before and after. The reverted
note-on-link work never reached a committed state, so it made no lasting
change to any sizing formula either.

### Gates (S11, final)

- `state` census: **46/271** zero-diff (`1-3:27, 4-10:127, 11-30:26, 31+:45,
  errors:0`) -- was S10's `44/271` (`1-3:28, 4-10:128, 11-30:26, 31+:45`).
  +2 new pins, all 44 S10-pinned fixtures verified unchanged.
- Class census: **303/718**, intact, unchanged.
- Object census: **22/80**, intact, unchanged.
- Description census (no-arg, 355 fixtures): **48/355**, intact, unchanged.
- DOT gate: `component 262/262 - usecase 90/90 - class 708/708 - object
  78/80 - state 267/267` -- EXACTLY unchanged, verified before and after
  (this iteration's landed mechanism made no DOT-graph/node/edge changes at
  all -- pure render-time color resolution).
- `state-dot-parity.test.ts` (size-backlog ratchet): **268/268** passing,
  unchanged throughout.
- `npm test -- --run`: **10042/10042** passing (370 files), up from
  10036/10036 (+4 new unit tests, +2 new ratchet-pin tests).
- `npm run typecheck` / `npm run lint` / `npm run build`: all clean.
- `state.golden.ratchet.test.ts`: **48 tests** (46 pins), up from 46 (44
  pins).

### S12+ queue

1. **Edge-label real-size injection gap** (NEW, S11, the mission's own
   deepest finding this iteration) -- `graph-layout-build.ts#addEdges`
   passes edge labels to graphviz-ts as raw text only; the caller's real
   `labelWidth`/`labelHeight` (`state-dot-graph.ts#edgeLabelAttrs`) is never
   fed into the actual layout call, only echoed back for OTHER downstream
   consumers. Blocks `note ... on link` (and, unverified but plausible, any
   guard/action label whose real size diverges materially from graphviz-ts's
   own Times-LUT guess -- no currently-pinned fixture exercises a REAL guard/
   action label to confirm either way, a gap worth closing FIRST in S12).
   The architecturally-correct fix is an HTML-table label (graphviz-ts DOES
   support this via `node_modules/graphviz-ts/src/common/html-string.ts`'s
   own control-character-prefixed marker) -- a shared-infrastructure change
   (`core/graph-layout.ts`/`graph-layout-build.ts`, used by EVERY diagram
   type), needing its OWN careful, cross-diagram-verified iteration, not a
   state-only patch.
2. **`note ... on link`** (S10/S11, blocked on item 1 above for the
   note-only sub-case; ALSO needs `mergeLR`/`mergeTB` label+note stacking +
   13pt arrow-label font-size correction for the label+note combined
   sub-case, `jaxuxe`/`kupexa`) -- render shape + DOM order + X-position
   formula ALREADY derived and jar-verified independently this iteration
   (5px fixed gap from the edge line, in `plans/g4-state-svg/ledger.md`
   S11's own derivation above); once item 1 lands, re-verify the Y-position
   formula (vertically centered on the edge midpoint) against a CORRECTED
   rank-gap reservation before re-landing the wiring.
3. **Whether a REAL guard/action label (`transitionLabelText`) is also
   affected by item 1** -- UNVERIFIED this iteration (no currently-pinned
   fixture exercises the non-undefined branch of `attachTransitionLabel` at
   all -- every pinned fixture's `-->`/`:` pattern turned out to be a `[*]`
   false-positive on inspection). Needs a dedicated sample before S12 claims
   this is/isn't a real gap.
4. **Composite-scoped notes** (S10, unchanged) -- `buildFlatNoteGeos` is
   FLAT-pipeline only.
5. **Creole/table note content** (S10, unchanged) -- `fatupo-62-bemu777`.
6. **`#color`/gradient override on notes** (S10, unchanged) -- `kujuzo-76-
   bavi505`, parser gap (`NOTE_COLOR` regex non-capturing).
7. **CONC-region bare-name global numbering** (S8/S9, unchanged).
8. Mechanism 16 (entity-vs-cluster wrap dimension) -- unchanged, LARGEST
   family in the near-zero bucket.
9. `stateBackgroundColor<<X>>`/`stateFontColor<<X>>`/`stateFontSize<<X>>`
   (S9, unchanged) -- `laferu-31-tice836`.
10. `<style>` cascade generalization (S4, unchanged, 3 sub-families).
11. `<<sdlreceive>>` folded-frame shape (S9, unchanged, `cekolo-21-gini183`).
12. `maruju-55-soko478`'s json+composite childCount gap (S9, unchanged).
13. `pevene-26-kebo361`'s minlen=0 same-rank clip-inset delta (S8,
    unchanged).
14. `buildConcurrentRegionLeaf`'s own `creationIndex` gap (S7/S8, unchanged).
15. `addStateBoxInk`'s max-corner asymmetry (S6, unchanged, 3 known
    fixtures).
16. State hyperlink (`[[url]]`) (S8/S9, unchanged, re-scoped, substantially
    more complex than first framed).
17. Creole/markdown bold (`**text**`) markup -- unchanged, unimplemented.
18. `skin debug`/named-skin-file directive support -- unchanged, unscoped.
19. `resolveStateFillBucketed` NOT yet wired into `renderer-pseudostate.ts`'s
    choice/history/deepHistory call sites (S10, small follow-up).
