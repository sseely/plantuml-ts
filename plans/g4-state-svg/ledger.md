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
