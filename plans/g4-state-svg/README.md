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
| S7 | Landed mechanism 10 in full (id-numbering creation-index gap): derived jar's real `net.atmp.CucaDiagram#cpt1` shared-counter algorithm from Java source + 5 jar-verified fixture id-sequences BEFORE writing code, then threaded true parse-time `creationIndex` through the ENTIRE state pipeline (parser -> AST -> layout -> composite-pass `GeoSpec` tree -> `renderer-uid.ts`, all 3 S6-refined sub-patterns: CONC-region phantom ticks, transition/auto-created-endpoint interleaving, `remove`d-entity gaps). Landing the id-VALUE fix surfaced (jar-verified, `nelupe-49-xova546`) two further bugs in the SAME area, fixed alongside: sibling DOCUMENT ORDER (the S5-era "real before pseudo" heuristic was only a special case of true creation-order sorting, NEW `sortSpecsByCreationIndex`) and a composite-pipeline `<path id>` bug (`buildLevelTransitionGeos` leaked the raw `'[*]'` AST token instead of the scope-resolved pseudo-anchor name, `renderer.ts#svgEndpointId` extended). Census: `14/271` -> `16/271` zero-diff (`1-3:27->26, 4-10:134->133, 11-30:41->47, 31+:55->49`), +2 new pins (`nivanu-50-zajo916`, `xoravu-40-gebe122`), 0 regressed. Verified EVERY ONE of the mission's own 5 required sample categories (plain, nested composite, concurrent regions, removed entities, `[*]` in multiple scopes) is now either TRUE ZERO or blocked SOLELY by an already-named, UNRELATED mechanism -- `semala-31-joji042` down to the already-named `<<meblue>>` stereotype-border-color gap alone; `pevene-26-kebo361`/`nelupe-49-xova546` down to PURE `path/@d`/`polygon` geometry (mechanism 19) alone, the strongest evidence yet gathered for that item. Mechanism 19 itself NOT started this iteration (budget fully consumed by mechanism 10's own scope + its 2-bug unmasking cascade; a preliminary look suggests a graphviz-ts/dot-layout spline-simplification gap, not a state-diagram-specific bug). See `plans/g4-state-svg/ledger.md` S7 for the full derivation, mechanism writeups, attribution table, and the S8+ queue. | done |
| S8 | Landed mechanism 19 (transition `path/@d` routing) in full: root cause was a missing `manualArrowheads: true` seam flag on state's 3 `DotInputGraph` construction sites (mirrors class's own G2 N29 fix -- state switched to inline-`<polygon>` arrowheads in S1 mechanism 3, the SAME switch that made class need this flag, but state's own construction sites never carried it over), confirmed by reproducing `nelupe-49-xova546`'s exact pinned svek DOT through BOTH real `dot -Tplain` and a minimal `layoutGraph()` probe BEFORE writing any fix -- real dot reached the target node's boundary, `layoutGraph()` without the flag stopped ~11.5px short. S7's own "looks like a graphviz-ts spline-simplification gap" framing was explicitly UNVERIFIED and, once reproduced, WRONG -- a seam invocation gap, not a library bug. Landing the flag surfaced a SECOND bug: `renderer.ts#buildPathD` was discarding the ALREADY-correct `1+3n` bezier-spline structure `layoutState()` produces and re-deriving a Catmull-Rom smoothing curve instead (2-3x too many segments) -- rewritten to mirror `class/renderer.ts#buildPathData` exactly. A THIRD, independent bug found and landed the same iteration: `kilato-12-laso661`'s choice-diamond `<polygon>` was missing its jar-required closing point (`renderer-pseudostate.ts#closeDiamondPoints`, a state-local patch -- `core/svg.ts#diamond` is shared with activity/chronology and outside this mission's write-set). Census: `16/271` -> `39/271` zero-diff (`1-3:26->31, 4-10:133->130, 11-30:47->27, 31+:49->44`), +23 new pins (the largest single-iteration jump this mission has seen), 0 regressed, ratchet now 40 tests (38 pins). Two further mechanisms diagnosed but NOT landed (write-set/verification-blocked): CONC-region bare-name global numbering (2 fixtures, `renderer.ts#localScopeName`'s per-composite-local numbering vs jar's diagram-global counter) and a small (<0.5px) genuine graphviz-ts vs real-dot clip-inset delta on `pevene-26-kebo361`'s own minlen=0 same-rank edges (reproduced, not yet filed -- needs a second independent sample). Re-confirmed `<<meblue>>`/`StateBorderColor<<X>>` (blocked by write-set: needs `core/skinparam.ts`/`core/theme.ts`) and `buildConcurrentRegionLeaf`'s creationIndex gap (both known fixtures dominated by unrelated larger bugs, still unverifiable). See `plans/g4-state-svg/ledger.md` S8 for the full derivation, attribution table, and the S9+ queue. | done |
| S9 | Landed mechanism 20 (`StateBorderColor<<X>>` stereotype-qualified skinparam cascade) in full: mirrors G2 N51's `classBorderThicknessByStereo` precedent exactly (`core/skinparam.ts`/`core/theme.ts`, additive-only, both class/object/description censuses proven unchanged), closing `semala-31-joji042` -- the task's own explicitly-named priority-2 target. Required threading a NEW `StateNodeGeo.stereotype` field through both the flat and composite pipelines, mirroring the pre-existing `color` field's identical two-pipeline threading shape (S2/S3). Sampled ALL 31 of S8's near-zero fixtures plus 25 from the 4-10 bucket BEFORE choosing a fix target, surfacing a much richer attribution table than S8's queue implied: notes-never-render is a 15-fixture family (the LARGEST single reach found this mission, root-caused to `layout.ts#buildFlatStateGeos` never converting a note's DOT-computed position into a renderable `StateNodeGeo`, jar's OWN note shape is `<path>`-based, byte-different from class's `<polygon>`-based `renderer-note.ts`); the `<style>` cascade gap widened to 3 independent sub-families (state-box, title, arrow properties); `addStateBoxInk`'s 1px asymmetry re-confirmed with 2 new same-shape samples; `<<sdlreceive>>`'s folded-frame shape and a pseudostate stroke-color over-application bug were newly root-caused (both single-fixture, not landed); CONC-region global numbering was traced to its EXACT Java call site (`StateDiagram.java:194-208`, `cpt2` counter) but left unimplemented pending the same fixture-id-sequence verification rigor S7 used for `cpt1`/`creationIndex`; the state hyperlink mechanism was investigated and found substantially more complex than the task's own framing suggested (URL inheritance from nearest ancestor, a separate anchor-reference `[[{alias}]]` resolution path, `State.url` missing from the AST entirely) -- re-scoped, not landed. A mid-iteration bash-tooling race (two overlapping `svg-parity-survey.ts` background invocations produced a stale-file false alarm) was diagnosed and resolved with no code change -- see ledger for the full incident writeup. Census: `39/271` -> `40/271` zero-diff (`1-3:31->30, 4-10:130->130, 11-30:27->27, 31+:44->44`), +1 new pin (`semala-31-joji042`), 0 regressed, ratchet now 41 tests (39 pins). See `plans/g4-state-svg/ledger.md` S9 for the full attribution table and the S10+ queue. | done |
| S10 | Landed mechanism 21 (notes never render, the task's own explicitly-named primary scope) in full for the FLAT pipeline: two shapes derived from `EntityImageNote.java`/`Opale.java` BEFORE coding (freestanding `drawNormal` folded box, asymmetric stroke-width; attached `of X`/implicit-position opale-merged zigzag-notch, symmetric stroke-width, reusing `../class/note-opale.ts`'s diagram-agnostic geometry verbatim), a corrected `state-note-layout.ts#measureNote` sizing formula (fixed 13pt font, real `marginX1(6)+marginX2(15)`/`marginY(5)*2` margins, no incorrect `*1.4` line-height), and a new GMN-quark-name dual-tick mechanism for attached-note id numbering (derived from `CommandFactoryNoteOnEntity.java:327` + verified against 3 fixtures' own `id=` gaps) -- notes fold into the SAME `StateNodeGeo` array (`kind:'note'`) rather than a parallel array, reusing state's own (more precise than class's) creation-index sort/uid machinery for free. Jar-verified byte-exact against `labono-83-nega255`/`pexuve-81-suxi717` (freestanding) and `xodazu-26-cube992`/`gedude-95-subi666` (attached). Also landed mechanism 22 (bare `state`-element skinparam bucket, `ELEMENT_BUCKET_SNAMES` + a new `resolveStateFillBucketed`, scoped to 4 of 7 `resolveStateFill` call sites per the distinct-pseudostate-default exclusion S9 already named) -- proven safe/additive but 0 fixtures reach zero from it alone (all 5 known bare-skinparam fixtures remain masked by unrelated bugs, exactly as S9's own queue entry predicted). `note ... on link` (6 fixtures) was investigated and confirmed a THIRD, structurally different shape (embedded in the transition's own `<g class="link">`, no host wrap, no notch) -- diagnosed in full, explicitly NOT landed this iteration, queued for S11 alongside creole/table note content, `#color`/gradient note overrides, and composite-pipeline note materialization. Census: `40/271` -> `44/271` zero-diff (`1-3:30->28, 4-10:130->128, 11-30:27->26, 31+:44->45`), +5 new pins (`labono-83-nega255`, `gedude-95-subi666`, `pexuve-81-suxi717`, `xodazu-26-cube992` -- mechanism 21; `kilato-12-laso661` -- a pre-existing zero-diff fixture unrelated to any S10 mechanism, surfaced by this iteration's own fresh full-census re-run), 0 regressed, ratchet now 46 tests (44 pins). Added 19 new unit tests (`renderer-note.test.ts`, `state-render-colors.test.ts`) covering branches the golden fixtures alone don't reach. See `plans/g4-state-svg/ledger.md` S10 for the full note-subsystem derivation, attribution table, and the S11+ queue. | done |
| S11 | Attempted `note ... on link` (task's own priority-1 item) in full: derived the render shape and a position formula (jar-verified independently on X-axis, DOM order, stroke symmetry), implemented the full wiring, then discovered a DEEPER, unrelated pre-existing bug while jar-verifying it -- `graph-layout-build.ts#addEdges` feeds graphviz-ts an edge `label` as raw text only, never the caller's real `labelWidth`/`labelHeight` override, so graphviz-ts under-reserves vertical rank separation for ANY state edge label whose real size diverges from its own internal Times-font guess (cascades into wrong note AND neighboring state-box positions). Ruled out 2 workarounds (fontsize-tuning: fragile/non-generalizing; the correct fix, an HTML-table label, is a substantial shared-infrastructure change touching `core/graph-layout.ts`, comparable in scope to mechanism 21 itself). Since the wired implementation could not reach byte-exact on any target fixture and made `vateco-92-pece508`'s own diff count strictly worse (9->39, zero new pins) with no offsetting gain, REVERTED it in full before committing (`git diff --stat` verified empty) per diagnosis.md, rather than land unverified/wrong code. Re-scoped to the cheapest fully-diagnosable remaining item: landed mechanism 23 (pseudostate `#color` override applies to FILL only, never STROKE -- `renderInitial`/`renderFinal` previously passed `stroke: fill`, jar keeps stroke at the literal `#222222` default regardless of override), TDD-first (`tests/unit/state/renderer-pseudostate.test.ts`, 4 tests, 2 red before the fix), a 2-line change. Census: `44/271` -> `46/271` zero-diff (`1-3:28->27, 4-10:128->127, 11-30:26->26, 31+:45->45`), +2 new pins (`ceruzi-77-give569` -- the target; `gepoti-01-sasi356` -- same mechanism, found via fresh census), 0 regressed, ratchet now 48 tests (46 pins). See `plans/g4-state-svg/ledger.md` S11 for the full note-on-link derivation (including the newly-named "edge-label real-size injection gap" mechanism, its exact library-level root cause, and the 3 workarounds considered/rejected), the attribution table, and the S12+ queue. | done |
| S12 | Followed the fenced-item protocol on S11's own top queue item (the edge-label real-size injection gap) in full: traced the exact mechanism BEFORE coding (jar's cached svek DOT confirms an HTML-table label, `FIXEDSIZE="TRUE" WIDTH=".." HEIGHT=".."`; read graphviz-ts's bundled runtime source, not just its `.d.ts`, to confirm `isHtmlValue`/`applyLabel`/`sizeTableInner`'s exact mechanism; ran a standalone probe script confirming the rank gap tracks the declared HEIGHT, not text content), landed it TDD-first (`graph-layout-build.ts#addEdges`'s new `applyEdgeLabelAttrs`/`htmlSizedLabel`, `HTML_LABEL_MARK = String.fromCharCode(1)`) -- then discovered via `npm test -- --run` that it regressed 12/268 `state-dot-parity.test.ts` size-backlog entries (all composite fixtures dominated by 1-2 short internal labeled transitions), root-caused precisely to a PRE-EXISTING, S4-named ink-under-count floor (`state-composite-autonom.ts#buildPlainAutonomSpec`'s `Math.max(geometry.*, result.*)`) that was silently benefiting from graphviz-ts's OLD, over-large Times-LUT label-size guess -- feeding the REAL (smaller) size removed that accidental compensation. Verified ZERO offsetting SVG-census gain (state 46/271 IDENTICAL SET, class 303/718, object 22/80, description 48/355, DOT gate frozen exactly) before REVERTING the fenced item in full per this iteration's own protocol (`git show HEAD:` restore, `git diff --stat` verified empty) -- the write-set's size-backlog.json is hard tighten-only, no exception for elsewhere-verified correctness. Re-scoped to mechanism 24 (solid `#color` override on notes, re-diagnosed from the S10/S11 queue's "NOTE_COLOR non-capturing" framing after a real-fixture render revealed the TRUE gap is larger -- state has NO gradient/`Paint` support at all): landed the SOLID-color subset (`NOTE_COLOR_CAPTURE`, `StateNote.color`, `resolveStateFill` reused verbatim for note fill), TDD-first (11 new tests), jar-verified byte-exact against `fatupo-62-bemu777`'s own note fill (`fill="#FFFFFF"`) though the fixture itself stays non-zero (separate, still-unbuilt creole/table content gap). Also investigated "composite-scoped notes" (S10 item 4) to the point of naming the exact two injection points needed (`materializeCluster`/`materializeAutonom`, `state-composite-geo.ts`) but found ZERO corpus fixtures reach zero from it alone (all 4 known combinations blocked by a separate gap) -- deferred, named precisely. Census: `46/271` → `46/271` zero-diff, unchanged (same 46-fixture SET, no new pins, no regressions), ratchet still 48 tests (46 pins). See `plans/g4-state-svg/ledger.md` S12 for the full fenced-item derivation+revert, the mechanism-24 derivation, the attribution table, and the S13+ queue (item 1: land the fenced item TOGETHER WITH the adjacent ink-under-count fix in the same iteration). | done |
| S13 | Re-landed the fenced item (edge-label real-size HTML injection, independently re-verified) exactly per S12's own derivation, TDD-first, then attempted THREE distinct label-ink formulas for the adjacent `buildPlainAutonomSpec` ink-under-count floor (full box from the render-position approximation; full box from graphviz's REAL computed label position, threaded as a NEW separate `TransitionGeo.labelInk` field; the same box halved) -- each jar-verified against a 10-fixture control set (the 6-fixture `0.244904in` multi-edge family, the `bunade`/`beguxu` S4 pair, 3 large-pre-existing-gap controls) via a disposable delta-measurement script. Variant 1 fixed the multi-edge family but regressed 10 previously-fine fixtures; Variant 2 fixed NONE of the 13 originally-failing fixtures while introducing a NEW regression (`zacajo-09-tamu628`, concurrent regions, PASS->FAIL); Variant 3 fixed `bemena` but broke `bunade` and worsened `zacajo` further -- no formula net-improved. Root-caused the instability (jar-verified via `bemena-23-zebu249`'s own cached golden SVG `<text>` element) to TWO compounding gaps: jar's real `SvekEdge.java` label placement is NOT simply "centered on graphviz's own virtual label-node position" (a genuine positional divergence, not yet characterized exactly), AND this port's own `StringMeasurer` measures at least "EvNewValueSaved" ~7% WIDER than jar's real Java font metrics (a NEW, likely cross-diagram-type calibration gap) -- the same measured width feeds both graphviz's label-reservation position AND any ink-box formula, compounding the error. This is the mission's THIRD independent attempt at this mechanism (S4, S12, S13) to hit the same wall. Per protocol ("if the final state widens ANY entry [or flips PASS to FAIL], revert both and report"), REVERTED (a)+(b) in full back to the exact S12 HEAD commit (9 touched files restored via `git show HEAD:`, 4 created files deleted, `git status --short`/`git diff --stat` verified EMPTY) -- `npm test -- --run` 10053/10053 (identical to S12), `state-dot-parity.test.ts` 268/268, all 4 censuses and the DOT gate re-verified fresh and IDENTICAL to S12. Census: `46/271` -> `46/271` zero-diff, unchanged (same SET, 0 new pins, 0 regressions). See `plans/g4-state-svg/ledger.md` S13 for the full 3-variant derivation, the jar-verified root-cause numeric evidence, the attribution table, and the S14+ queue (item 1: close the text-measurement calibration gap FIRST; item 2: either port `SvekEdge.java`'s real label-placement algorithm or re-attempt the geometric-box formula only after item 1 lands). | done |

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

## Gates (S13, final)

- `state` census: **46/271** zero-diff (`1-3:27, 4-10:127, 11-30:26, 31+:45,
  errors:0`) — IDENTICAL to S12's own baseline: same 46-fixture SET
  (diffed against `ratchet.json`'s own pinned list, zero additions/
  removals), not merely the same count.
- Class census: **303/718**, intact, unchanged.
- Object census: **22/80**, intact, unchanged.
- Description census (no-arg, 355 fixtures): **48/355**, intact, unchanged.
- DOT gate: `component 262/262 - usecase 90/90 - class 708/708 - object
  78/80 - state 267/267` — EXACTLY unchanged, re-verified fresh after the
  full revert.
- `state-dot-parity.test.ts` (size-backlog ratchet): **268/268** passing at
  the START and END of this iteration (dipped as low as 247/268 across the
  three formula variants tried mid-iteration, fully restored by the revert).
- `npm test -- --run`: **10053/10053** passing (370 files) — IDENTICAL to
  S12's own final count (no new tests survived the revert). `npm run
  typecheck` / `npm run lint` / `npm run build`: all clean.
- `state.golden.ratchet.test.ts`: 48 tests (46 pins), unchanged from S12.

## Mission status (S13, 2026-07-20)

**OPEN.** Re-landed S12's own fenced item (the edge-label real-size HTML
injection, `graph-layout-build.ts#addEdges`'s `htmlSizedLabel`/
`applyEdgeLabelAttrs`) exactly as S12 derived it — independently
re-verified via a fresh disposable probe script BEFORE writing production
code (a plain-text label's rank gap is identical regardless of text length;
an HTML label's rank gap tracks the declared HEIGHT exactly; the
`HTML_STRING_MARK = "\x01"` byte confirmed again via direct inspection of
`node_modules/graphviz-ts/dist/index.js`), TDD-first (2 new tests in
`tests/unit/core/graph-layout.test.ts`). Confirmed the SAME regression S12
found — **13** (not 12; `zacajo-09-tamu628` was an additional near-miss)
`state-dot-parity.test.ts` size-backlog fixtures fail once the injection
lands alone.

Per this iteration's own task order, then attempted THREE distinct formulas
to close the adjacent `state-composite-autonom.ts#buildPlainAutonomSpec`
`Math.max(geometry.*, result.*)` ink-under-count floor ("replace the max()
floor with the true ink formula, jar-verified per fixture"), each
jar-verified against a 10-fixture control set (the six same-shape
`0.244904in`-delta multi-edge-composite fixtures; the `bunade-42-fudu910`/
`beguxu-19-tize774` pair S4 originally targeted; three large-pre-existing-gap
control fixtures expected to stay unchanged) via a disposable delta-
measurement script (`scripts/_tmp-s13-deltas.ts`, avoiding a slow full
`vitest run` per formula attempt):

1. **Full box anchored at `attachTransitionLabel`'s own render-position
   formula** (the pre-existing perpendicular-offset-from-routed-midpoint
   x/y, treated as an SVG left-baseline anchor). FIXED the 6-fixture
   multi-edge family outright but REGRESSED 10 previously-fine fixtures
   into failure — net WORSE (16 failures vs. 13 baseline).
2. **Full box centered on the REAL graphviz-computed label position**
   (`DotLayoutResult.edges[].labelX/labelY/labelWidth/labelHeight`, threaded
   through as a NEW, separate `TransitionGeo.labelInk` field — a probe
   proved this diverges substantially from `attachTransitionLabel`'s own
   render-position formula, ~266px apart on `bemena`'s widest internal
   edge). Fixed **0 of the 13** originally-failing fixtures (the EXACT SAME
   pass/fail set as making no change at all) while introducing a **NEW**
   regression: `zacajo-09-tamu628` (3 concurrent regions, each with 2
   internal labeled transitions) flipped from PASSING to FAILING.
3. **The same centered box, HALVED** (an empirical attempt to compensate
   for the systematic overshoot). Fixed `bemena` but broke `bunade`
   (previously fine) and worsened `zacajo` further — confirming no single
   uniform scale factor generalizes across the corpus's differently-shaped
   composites.

Root-caused the instability (jar-verified, not guessed) by comparing jar's
REAL rendered `<text>` element (from `bemena-23-zebu249`'s own cached golden
SVG, the "EvNewValueSaved" label: local x=255.86, `textLength=111.475`,
right edge=367.335) against a naive centered box built from graphviz-ts's
own real `labelX`/`labelWidth` for the SAME edge (center 317.94, half-width
60.025, right edge=377.965 — off by 10.63px). Two independent, COMPOUNDING
gaps: (1) jar's real `SvekEdge.java` label-placement algorithm is NOT simply
"centered on graphviz's own virtual label-node position" — the LEFT edge is
nearly right (2.05px off) while the RIGHT edge is off by 10.6px, a
width-scaling divergence, not a uniform positional offset; (2) this port's
own `StringMeasurer` measures "EvNewValueSaved" ~7-8px (7%) WIDER than jar's
real Java font metrics — a NEW, likely cross-diagram-type calibration gap
that compounds any box-based ink formula, since the SAME over-measured
width feeds both graphviz's own label-reservation position AND the ink box
itself.

This is the mission's **third independent attempt** at this exact mechanism
to hit the same wall: S4's inline `ctx.measurer` attempt (jar-verified
directionally correct on `bunade`, overshot on `beguxu`, reverted); S12's
fenced item (the injection landed correctly, exposed this SAME adjacent
gap, reverted); this iteration's 3 formula variants (each trading one
regression set for a different one, none net-improving). The convergent
evidence across three independent attempts, by two different methods
(inline measurement, geometric box formulas), strongly suggests a uniform
geometric-box ink formula cannot match jar's real `SvekEdge.java`-driven
label placement without either porting that algorithm directly or first
closing the text-measurement calibration gap.

Per this iteration's own explicit protocol ("if the final state widens ANY
entry, revert both and report the mechanism instead" — generalized here to
"or flips a PASSING entry to FAILING," `zacajo-09-tamu628`'s exact case),
REVERTED every touched file to the exact S12 HEAD commit content (`git show
HEAD:<path> > <path>` for all 9 touched `src`/`tests` files; `tests/oracle/
svg-conformance/parity.json` was also found modified as an unrelated side
effect and restored the same way), deleted every file created this
iteration (`scripts/_tmp-s13-probe.ts`, `scripts/_tmp-s13-deltas.ts`,
`tests/unit/state/state-transition-label.test.ts`, `tests/unit/state/
layout-ink-extent.test.ts`), verified `git status --short`/`git diff
--stat` EMPTY, then re-verified the FULL baseline from scratch: typecheck/
lint clean, `npm test -- --run` 10053/10053 (identical to S12),
`state-dot-parity.test.ts` 268/268, all 4 SVG censuses and the DOT gate
re-run fresh and confirmed IDENTICAL to S12.

Since neither task item 1 (land a+b) nor its prerequisite for item 2
(note-on-link, explicitly blocked on item 1's own landing per S11/S12) could
be completed this iteration, no further task items were attempted — landing
partial/unverified work on top of a mechanism already shown unstable across
three independent attempts would risk exactly the kind of "looks complete
but is silently wrong for unpredictable inputs" outcome this mission's own
CLAUDE.md explicitly warns against.

Census: 46/271 → **46/271** zero-diff, unchanged — same SET, 0 new pins,
0 regressions, all 4 censuses and the DOT gate re-verified fresh and
byte-identical to S12's own final state. See `plans/g4-state-svg/ledger.md`
S13 for the full 3-variant derivation (including the exact numeric evidence
for each), the jar-verified root-cause analysis (label-placement divergence
+ text-measurement calibration gap), the attribution table (13
`state-dot-parity.test.ts` fixtures × 3 variants + 10 control fixtures), and
the S14+ queue (item 1: close the text-measurement calibration gap FIRST —
likely cross-diagram-type, not state-specific; item 2: either port
`SvekEdge.java`'s real label-placement algorithm or re-attempt the
geometric-box formula only once item 1 lands — NOT another blind
formula-search iteration, this iteration exhausted that search space).
