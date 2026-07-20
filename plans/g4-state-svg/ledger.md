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
