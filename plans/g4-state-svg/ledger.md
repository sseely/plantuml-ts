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
