# Mission G4 — state diagram SVG conformance

**Authorization.** Maintainer, 2026-07-20: "start G4."

**Objective.** Drive the state SVG census to **100% minus known
divergences** (2026-07-14 ruling: every non-conformant fixture carried by
a named DIVERGENCES.md/ledger entry — no anonymous misses). State
diagrams have a DEDICATED upstream engine
(`net/sourceforge/plantuml/statediagram/`, `StateDiagram extends
AbstractEntityDiagram extends CucaDiagram` — `net/atmp/CucaDiagram.java`)
and a dedicated port pipeline (`src/diagrams/state/`), unlike G3's object
mission, which rides the class engine verbatim. So this mission starts
from TRUE zero rather than inheriting a G2/G3 head start, and every
mechanism found is new work, not cross-attribution.

- Branch: `feat/g4-state-svg` (from main @ post-G3 merge 1445bd9).
- Merge: merge commit; orchestrator owns all commits (one per iteration).
- Agents: NEVER git checkout/reset/stash/clean in this repo — NO
  EXCEPTIONS (disposable `git worktree` or the ratchet.json manifest are
  the snapshot methods); no commits.
- Protocol: `plans/dot-oracle-sync/loop-protocol.md`; G2's ledger
  (plans/g2-class-svg/ledger.md) and G3's ledger
  (plans/g3-object-svg/ledger.md) are precedent for shared mechanisms
  (SVG root shell, `<g>`-wrapping, document-margin/ink-extent) — check
  those before re-deriving.

## Corpus & oracle (verified fresh 2026-07-20)

```
test-results/dot-cache/state/ — 271 fixture dirs (captured 2026-07-11,
POST-deterministic-text-patch, same batch G3 verified fresh; NEVER pass
--rebuild).
DOT gate baseline: state 267/267 STRUCTURALLY EQUAL among jar-classified
STATE fixtures (frozen gate, unchanged since G0 — the gate FREEZES at
EXACTLY these five counts: component 262/262 · usecase 90/90 · class
708/708 · object 78/80 · state 267/267 — ANY movement = stop condition).
The SVG CENSUS corpus is the FULL dot-cache/state/ bucket (271), not the
267-subset — same "count every cache-dir fixture" convention
svg-conformance-census.ts already used for object's 80 (G3/O0's
gizini-87-vuve916 precedent: a corpus bucket can contain fixtures the
jar itself classifies as a DIFFERENT diagram type; census counts the
bucket, not the tag-filtered subset).
CLASS SVG GATE: the 294-fixture class ratchet
(tests/oracle/svg-conformance/class.golden.ratchet.test.ts) must stay
green and the class census zero-diff set identical.
OBJECT SVG GATE: the 22-fixture object ratchet
(tests/oracle/svg-conformance/object.golden.ratchet.test.ts) must stay
green and the object census zero-diff set identical.
DESCRIPTION SVG GATE: the 48-fixture set identical + ratchet green.
Gates per iteration: npm test · typecheck · lint · build ·
dot-sync-report (frozen) · class census (294 set intact) · object census
(22 set intact) · description census (48 set intact) · state census
(non-dropping).
```

## Iteration queue

| Iter | Scope | Status |
|---|---|---|
| S0 | Harness: `scripts/svg-conformance-census.ts`'s `renderFixtureFor` dispatches `state` through a NEW `render-fixture-state.ts#renderFixtureState` helper (state's own dedicated `parseState -> layoutState -> renderState` pipeline — genuinely new, not a reuse like G3's object-through-class dispatch); `svg-parity-survey.ts` needed NO code change (already generic via `renderSync`'s production registry dispatch, additive `--out`/positional-type args from G2/N0). State ratchet harness stood up (`oracle/goldens/svg-state/` + `state.golden.ratchet.test.ts` + `parity-state.json`, 271/271 surveyed, 267/271 dotEqual=true). TRUE baseline: **0/271 zero-diff** — every fixture, including the single-state zero-transition trivial case, fails on the SAME root-level SVG shell family. Diagnosed and named FOUR independent, jar-verified mechanisms (none individually a bounded/cheap fix; stretch fix explicitly SKIPPED per this iteration's own instruction — see `plans/g4-state-svg/ledger.md` S0 for the full writeup): (1) generic `svgRoot()` shell instead of the CucaDiagram-family `assembleDocumentShell`; (2) no outer/per-entity `<g>` wrapping (renderState emits flat markup, `svg[childCount]` mismatch at 271/271, which short-circuits `compareSvg`'s recursion so NO deeper diff is currently measurable for ANY fixture); (3) inline-`<polygon>`-per-edge arrowheads (jar) vs `<marker>`-def arrowheads (port); (4) a document-margin/ink-extent gap (canvas dims differ even on the zero-transition trivial fixture). Ratchet stands up EMPTY (0 pinned) — first mission iteration to genuinely exercise every ratchet suite's "0 fixtures" graceful-degradation branch. | done |
| S1 | Landed all four S0-named mechanisms TDD-first (SVG root shell `renderer-shell.ts`; outer/per-entity `<g>` wrap + uid plan `renderer-uid.ts`/`renderer-group.ts`; inline-`<polygon>` arrowheads `renderer-arrowhead.ts`; `SvekResult`-style document margin `layout-ink-extent.ts`), each jar-verified against S0's sampled fixtures. Census: `0/271` -> `0/271` but histogram shifts hard toward smaller diff counts (`1-3:0->30, 4-10:1->192, 11-30:270->32, 31+:0->17`) -- mechanism 2's own `childCount` short-circuit unblocking exactly as S0 predicted, immediately surfacing a FIFTH, newly-diagnosed mechanism (state box/shape content fidelity -- missing divider line, wrong `rx`/stroke-width/fill color, wrong text-layout convention, circle-vs-ellipse tag choice) that independently blocks every fixture from zero regardless of mechanisms 1-4's own correctness -- diagnosed per diagnosis.md, explicitly NOT forced this iteration (unbounded per-shape rewrite, comparable in scope to G2's own multi-iteration classifier-box work), queued for S2. 0 pins (expected, matches S0's own 0-pin baseline). See `plans/g4-state-svg/ledger.md` S1 for the full mechanism writeups (including two named remainders: composite `entity`-vs-`cluster` wrap split, composite ink-rule gap) and the S2+ queue. | done |
| S2 | Landed mechanism 5 (state box/shape content fidelity) TDD-first, both scoped items: the simple-state box (`renderer-box.ts`, rx=12.5/stroke-width=0.5/fill-resolution/divider-line/header+body text) and every pseudostate shape (`renderer-pseudostate.ts`, `state-render-colors.ts` -- initial/final/fork/join/syncBar/choice/history/deepHistory), each jar-verified against dedicated samples (jocela/votoki/gefefe for the box; gefefe/bajelo/cekolo for pseudostates). Two small adjacent bugs fixed while verifying (`javaRound4` textLength rounding; NBSP substitution for an empty body line, matching class's own precedent) plus a companion fix surfaced by mechanism 5 (S1 mechanism 3's own `[*]`-endpoint-id resolution was broken in the flat pipeline, `layout.ts#buildFlatTransitionGeos` -- fixed by reusing `state-dot-graph.ts`'s own `endpointId`). Census: `0/271` -> `9/271` zero-diff (`1-3:30->18, 4-10:192->187, 11-30:32->37, 31+:17->20`), all 9 pinned (`conformant && dotEqual`, ratchet now 11 tests). Investigating S1's own items 3/4 (composite entity/cluster split, composite ink rule) surfaced a SIXTH, much larger mechanism -- composite states are NOT a dashed rect at all, jar draws a 3-4-layer half-rounded-header-path + solid-outline + divider + centered-text composition (reusing class's own already-ported `headerBackgroundPath` math) -- explicitly NOT forced this iteration (unbounded, comparable in scope to mechanism 5 itself), queued for S3. See `plans/g4-state-svg/ledger.md` S2 for the full mechanism writeups and the S3+ queue. | done |
| S3 | Landed mechanism 6 (autonom composite box's real 3-4-layer shape: half-rounded header path + solid outline + divider(s) + centered title + optional action-zone bg/text, `renderer-composite-box.ts`), jar-verified byte-exact against `bajelo-54-dixe684`'s `Track_FSM`/`Track_FSM.Run.Do_Sector`. Closing the composite `childCount` mismatch surfaced a SEVENTH mechanism (composite wrapper width/height sizing gap, `measureAutonomWrapper`'s `childImg` uses `layoutGraph()`'s raw generically-margined output instead of `InnerStateAutonom.calculateDimensionSlow`'s real `SvekResult#calculateDimension()` tight-bbox+delta(15,15) formula) -- a trial fix was jar-verified to IMPROVE 2 fixtures but ALSO jar-verified to REGRESS 2 already-pinned `size-backlog.json` entries past their tighten-only allowance, so it was REVERTED per that hard boundary and queued whole for S4 (needs combining with a still-separate child position-offset residual). Composite ink-extent (item 2) and the entity-vs-cluster wrap split (item 3) were both assessed: item 2 shows strong algebraic evidence of no independent bug (not yet independently verifiable, blocked on mechanism 7); item 3 confirmed genuinely unbounded (a DOT-native cluster-label sizing path, materially different code, needs library-level cluster-bbox exposure). Census: `9/271` -> `9/271` zero-diff (`1-3:18->17, 4-10:187->182, 11-30:37->40, 31+:20->23`) -- the SAME mixed-direction unmasking signature S0-S1 exhibited; all 9 pinned fixtures verified unchanged, no regression. 9 pins (unchanged, ratchet still 11 tests). See `plans/g4-state-svg/ledger.md` S3 for the full mechanism writeups and the S4+ queue. | done |
| S4 | Landed mechanism 7 in full (composite wrapper width/height + child position offset, unified as ONE ink-extent-aware `SvekResult#calculateDimension()` computation, `layout-ink-extent.ts#computeSvekResultGeometry`), jar-verified byte-exact against `coteta-47-mare883` (1 level) and `lonuti-97-voko521` (2 levels, geometry-exact; 9 unrelated diffs remain), non-regressing on `bajelo-54-dixe684` (3 levels). Landing it surfaced and fixed TWO further mechanisms: a pre-existing `transitionArrowheadInk` over-reach bug (worked around, composite-sizing-only, via a new `includeArrowheadInk` flag) and mechanism 8 (NEW) — `ConcurrentStates.java`'s real region-stacking formula has ZERO separator gap (a direct-source finding, not a guess; the S1-era `CONCURRENT_SEPARATOR_GAP=60` placeholder was wrong), landed together with routing each region's own dimension through the SAME ink-extent formula (`state-composite-concurrent.ts`). Full `state-dot-parity.test.ts` size-backlog ratchet: 268/268 passing (was 267/268 pre-S4, briefly 247/268 mid-iteration before mechanism 8). `size-backlog.json`: 138→102 entries (36 reached exactly 0 and deleted, 51 tightened, 0 widened — every change verified `new <= old`). Census: `9/271` -> `13/271` zero-diff (`1-3:17->48, 4-10:182->156, 11-30:40->34, 31+:23->20`), +4 new pins (`coteta-47-mare883` — the primary target — plus 3 fixtures newly unmasked by mechanism 8: `mibabe-49-kexu237`, `noboda-97-zevo886`, `nuduni-60-mupe742`), ratchet now 15 tests. A third sub-issue (composite-internal-labeled-transition ink under-count) was diagnosed, a same-iteration fix attempt was jar-verified to overshoot on a different fixture than it helped, and was reverted in favor of a non-regressing `Math.max` floor — queued whole for S5. Secondary scope (transition-family/`path/@d`) NOT started — mechanism 7+8's own diagnosis and verification consumed the full iteration budget. See `plans/g4-state-svg/ledger.md` S4 for the full mechanism writeups and the S5+ queue. | done |
| S5 | Landed mechanism 9 (composite internal-transition nesting -- the mission's own primary scope), jar-verified against `bajelo-54-dixe684`'s full document structure. Landing it unmasked several further mechanisms via the same childCount-short-circuit-removal pattern S0/S1/S3/S4 each already showed: mechanism 10 (top-level real-before-pseudo ordering, LANDED, partial -- the real upstream rule is creation-index-based) and mechanism 11 (`EntityImageStateEmptyDescription`, `hide empty description` + zero body lines, LANDED in full, +1 pin) both landed; mechanism 12 (explicit background `<rect>` for non-default backgrounds, LANDED, 11/271 reach) discovered independently during 1-3-bucket sampling and landed too. Mechanisms 13/14 (concurrent-region separator lines never drawn; per-region pseudo-node id collision) diagnosed via a full jar XML pretty-print but NOT landed -- genuinely new rendering features, not cheap formula fixes, queued for S6. Census: `13/271` -> `14/271` zero-diff (`1-3:48->29, 4-10:156->136, 11-30:34->44, 31+:20->48`) -- the SAME mixed-direction unmasking signature every prior mechanism-landing iteration exhibited (bucket redistribution toward larger-but-real diff counts, net zero-diff still up); all 13 S4 pins verified unchanged, +1 new pin (`tezivo-82-rufa055`). The mission's own secondary scope item (transition `path/@d` routing) was NOT started -- mechanism 9's own scope + its unmasking cascade consumed the full iteration budget. See `plans/g4-state-svg/ledger.md` S5 for the full mechanism writeups, attribution table, and the S6+ queue. | done |
| S6 | Landed mechanisms 13/14 (concurrent-region dashed separator lines; per-region pseudo-node scope-id collision), TDD-first, jar-verified against `nelupe-49-xova546`'s full XML dump. Landing mechanism 13 immediately surfaced a THIRD bug in the same area (mechanism 7's own `moveDelta` position correction was never wired into the concurrent-region path at all, `regionInkDim` renamed `regionInkGeometry`) plus a fourth, independent bug in `layout.ts#shiftStateNode` (the document-margin shift never touched the new `concurrentRegions`/`separators` fields) -- both fixed alongside 13/14, jar-verified byte-exact position match on `semala-31-joji042`/`nivanu-50-zajo916`. Three items were re-diagnosed deeper than their prior naming and re-confirmed correctly out of scope: mechanism 16 (entity-vs-cluster wrap dimension, now confirmed via a THIRD independent sample, larger reach than known -- 7/27 sampled fixtures); `skin debug` (re-scoped from "niveno's background bug" to its true scope, a whole unimplemented named-skin-file directive feature); `bilare-19-fufe539`'s 1px rounding (exact fix algebraically derived but NOT landed -- touches an already-verified, widely-reused ink formula, blast radius unverified this iteration). Mechanism 19 (`path/@d` routing, the mission's own secondary scope) was sampled again per this iteration's own instruction and confirmed NOT the sole blocker on any near-zero fixture this iteration -- still unstarted as its own item. Census: `14/271` -> `14/271` zero-diff (`1-3:29->27, 4-10:136->134, 11-30:44->41, 31+:48->55`) -- NO net new pin despite substantial jar-verified improvement on every sampled concurrent-region fixture (e.g. `nivanu-50-zajo916`: childCount-diff -> 1 diff, `pevene-26-kebo361`: 26+ diffs -> 15), because the SOLE remaining blocker on every concurrent-region fixture is now the id-numbering creation-index gap (mechanism 10's own remainder), refined this iteration into three concrete, verified sub-patterns (CONC-region synthetic-entity id consumption; transitions interleaved with entities in creation order; `remove`d entities still consuming an id slot) but not solved -- all 14 S5 pins verified unchanged. See `plans/g4-state-svg/ledger.md` S6 for the full mechanism writeups, the refined attribution table, and the S7+ queue. | done |

## Standing rules

Upstream spec: jar cached SVGs + `~/git/plantuml/src/main/java/net/`
(grep `net/`, never just `net/sourceforge/plantuml/`; state model lives
in `statediagram/` + the shared `net/atmp/CucaDiagram`/`svek/` machinery
class/object already ported). Fix at origin; G2's and G3's named
mechanisms are precedent — if a state diff matches an ALREADY-LANDED
G2/G3 mechanism (SVG shell shape, document margin, style cascades), check
whether the SAME code path is reachable from state before re-deriving a
parallel implementation. graphviz-ts findings go in
`docs/graphviz-issues/`. SVG-channel standing rule (maintainer
2026-07-17, geometry extraction stays on the SVG-text/regex channel, not
`getLayout()`) applies. Complexity playbook, TDD, ledger:
`plans/g4-state-svg/ledger.md`.

## Gates (S6, final)

- `state` census: **14/271** zero-diff (`1-3:27, 4-10:134, 11-30:41, 31+:55,
  errors:0`) — was S5's `14/271` (`1-3:29, 4-10:136, 11-30:44, 31+:48`); no
  net new pin, all 14 previously-pinned fixtures verified unchanged.
- Class census: **303/718**, intact, unchanged.
- Object census: **22/80**, intact, unchanged.
- Description census: **48/355**, intact, unchanged.
- DOT gate: `component 262/262 - usecase 90/90 - class 708/708 - object
  78/80 - state 267/267` — EXACTLY unchanged (verified BOTH before and
  after every mechanism landed this iteration).
- `state-dot-parity.test.ts` (size-backlog ratchet): **268/268** passing
  (0 failures), unchanged throughout — this iteration's mechanisms are
  render-structure/position-only, no raw DOT node-size changes.
- `npm test -- --run`: 9971/9971 passing (366 files), `npm run
  typecheck` / `npm run lint` / `npm run build`: all clean.
- `state.golden.ratchet.test.ts`: 16 tests (14 pins), unchanged from S5.

## Mission status (S6, 2026-07-20)

**OPEN.** Landed mechanisms 13/14 (concurrent-region dashed separator
lines; per-region pseudo-node scope-id collision), the S5-queued top
priority, TDD-first, jar-verified against `nelupe-49-xova546`'s full XML
dump. Landing mechanism 13 immediately surfaced TWO further, previously
invisible bugs in the same area (mechanism 7's own `moveDelta` position
correction was never wired into the concurrent-region path at all; the
document-margin shift, `layout.ts#shiftStateNode`, never touched the new
`concurrentRegions`/`separators` fields) — both fixed, jar-verified
byte-exact position match. Net effect: substantial, jar-verified
improvement on EVERY sampled concurrent-region fixture (e.g.
`nivanu-50-zajo916`: childCount-diff → 1 diff; `pevene-26-kebo361`: 26+
diffs → 15) but **no net new pin**, because the SOLE remaining blocker on
every concurrent-region fixture is now the id-numbering creation-index gap
(mechanism 10's own already-documented remainder) — refined this iteration
into three concrete, verified sub-patterns (CONC-region synthetic-entity id
consumption; transitions interleaved with entities in creation order, not
batched; `remove`d entities still consuming an id slot), but not solved
(same "separate, larger, mission-scale item" scope S5 already deferred).
Per this iteration's own "let the sample decide" instruction, mechanism 19
(transition `path/@d` routing, the mission's own secondary scope) was
re-sampled and confirmed NOT the sole/dominant blocker on any near-zero
fixture this iteration — still entirely unstarted as its own scoped item.
Three further items were re-diagnosed deeper than their S5-era naming and
re-confirmed correctly out of scope for a "cheapest first" iteration:
mechanism 16 (entity-vs-cluster wrap dimension, now backed by a THIRD
independent sample, larger reach than previously known); `skin debug`
(re-scoped from "niveno's background theme-resolution bug" to its true
scope, a whole unimplemented named-skin-file directive feature — the S5
queue's own framing undersold this); `bilare-19-fufe539`'s 1px rounding
(exact algebraic fix derived but NOT landed — touches an already-verified,
widely-reused ink formula, unverified blast radius against the
size-backlog tighten-only boundary). Census: 14/271 → 14/271 zero-diff,
bucket distribution shifting toward the SAME "unmasking reveals more real,
individually-addressable diffs" pattern every prior mechanism-landing
iteration exhibited, even without a net pin count increase this time. See
`plans/g4-state-svg/ledger.md` S6 for the full mechanism writeups, the
refined attribution table, and the S7+ queue.
