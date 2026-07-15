# Mission G1 — description SVG conformance (component + usecase)

**Objective.** Drive the deterministic SVG census from 12/355 conformant to
**100% minus known divergences** (maintainer ruling 2026-07-14, superseding the ≥90% bar: every non-conformant fixture must carry a named DIVERGENCES.md/ledger entry — no anonymous misses) — the first Phase-G "the SVG is the product"
depth pass. Protocol: `plans/dot-oracle-sync/loop-protocol.md` (sequential
iterations, one mechanism each, diagnosis.md discipline, fix at origin,
grow the SVG ratchet as fixtures hit zero-diff, ledger the unfixable).

- Branch: `feat/g1-description-svg` (from main @ ce5cf25)
- Merge: merge commit; orchestrator owns all commits (one per iteration).
- Agents: NEVER git checkout/reset/stash/clean; read-only git.

## Baseline (2026-07-14, census with stdlib store wired)

```
12 / 355 conformant · 1-3: 13 · 4-10: 97 · 11-30: 73 · 31+: 152 · errors: 8
DOT gate FROZEN THROUGHOUT: component 262/262 · usecase 90/90 · class
708/708 · object 78/80 · state 266/267 (G1 is render-side only — ANY DOT
movement is a stop condition).
Gates per iteration: npm test (≥90/90/90) · typecheck · lint · build ·
dot-sync-report (frozen) · census (conformant must not DROP; record delta).
Measure: npx tsx scripts/svg-conformance-census.ts [--families]
```

## Iteration queue (family table, census --families 2026-07-14; re-derive each iteration)

| Iter | Family | Reach | Notes |
|---|---|---|---|
| I0 | harness: image-href normalize rule (deliberate divergence, DIVERGENCES.md § raster pass-through) + errors 8→n triage (incl. xusuxe gvts crash, ledgered) | 1 + 8 | compare must not flag `image/@xlink:href` bytes; assert dims/position only |
| I1 | svg ROOT attrs on ANNOTATED fixtures (`@version @preserveAspectRatio @zoomAndPan @xmlns:xlink @contentStyleType svg[childCount]`) | 18 | the G0b-flagged unwrapKlimtSvg/assembleSvg root-attr loss — one mechanism |
| I2 | text style constants: `@font-size` (71) `@font-weight` (71) `@fill` (45) `@font-family` (6) | ~75 | likely emission-format/default constants |
| I3 | element `@id` conventions (`g/@id` 83, `path/@id` 10) | ~85 | jar's id naming scheme |
| I4 | `text/@textLength` value | 94 | both sides deterministic — a rounding/format mechanism |
| I4b | per-element FontSize/StereotypeFontSize skinparam + <style> wiring (renderer-symbol textFont is global-constant today) | ~25 | from I4 diagnosis; dominant textLength/font-size driver |
| I4c | creole text-CONTENT bugs -- DONE: 4/6 mechanisms fixed (unicode/entity escapes, link-label quote retention, colon/paren-wrapped-display-before-as, literal \n newline escape); 2 ledgered blocked-on-E2-remainder (== heading markers -- needs per-line font cascade; multi-line note/nested creole markup -- ~45-fixture reach, needs full char-atom subsystem) | 6 named + ~45 broader | from I4 ruled-out list; see ledger.md I4c |
| I-scale | `scale N` directive (whole-diagram scaling, unimplemented) | TBD | uniform primitive scaling |
| I5 | `svg/g/g[childCount]` structural — port fallback missing label text (`EntityImagePort.drawU`) | 20 | DONE — sub-classified the full 99+64 childCount family into 9 named sub-families (see ledger.md I5); drilled the largest tractable one (port label) |
| I5b | entity/link multi-stereotype: only the FIRST `<<tag>>` renders, upstream stacks one `<text>` per tag | 12 | DONE — `DescriptiveNode.stereotype` widened to `string[]`; 2 fixtures (mamase-39-buto560, juvucu-92-bugo434) fully closed on the childCount family, usecase mopimi-10-jaco443 partially (blocked on a NEW `hide <<label>> stereotype` unbuilt-command finding); 5 fixtures deferred to I5e (auto-create routing), 4 deferred (archimate sprite-stereotype, unbuilt) — see ledger.md I5b |
| I5c | bracket-body `[Line1\nLine2]` shorthand: literal `\n` not resolved via `finalizeDisplay` for that parse path | 2+ | DONE — `finalizeDisplay` exported + wired into `parseBracketDeclaration`; saxosu-09-nodi002/seguci-13-zure968/zarabi-01-koka785 (bonus) all reach zero-diff, zarabi ratchet-backfilled; surfaced a new component-container-cluster default-border-style gap (see ledger.md I5c) |
| I5d | transparent/near-zero-alpha color (`FontColor transparent`, `BackgroundColor transparent`, `#00000000`) draws the element instead of eliding it | ~14 fixtures / 37 diff instances (25 text + 12 rect) | DONE — condition is EXACTLY alpha===0 (jar-verified, not fuzzy); new `isTransparentColor` (paint.ts) wired into `setupBackcolor`/`textFontColor`; cobadu-43-gabi397 + catari-10-xiza828's targeted families both fully closed — see ledger.md I5d |
| I5e | link-endpoint auto-create stereotype (`Name<<tag>>` on the arrow's target) wrongly drawn as the LINK's own visible `«tag»` label | ~6 | DONE — new `DescriptiveLink.stereotypeIsLinkLabel` discriminator distinguishes the never-drawn pre-colon form from the genuinely-drawn post-colon-embedded form; all 5 fixtures' childCount family fully closed (DOT gate re-verified frozen despite nodesep/ranksep strictness) — see ledger.md I5e |
| I5f | sprite/icon multi-path glyphs (`<$bi-globe>` etc) collapsed to fewer `<path>` elements than jar | 9 diff instances / ~6 fixtures directly observed (23 fixtures corpus-wide use `<$name>` sprites, upper bound) | jar emits one `<path>` per icon sub-glyph; this port likely merges sub-paths into one `d` |
| I5g | content-level `<g>` wrapper count mismatch (`svg/g[childCount]`, both extra and missing, multiple `+N<g>` signatures) | ~20 fixtures combined | unexplained — not diagnosed this iteration; likely 2+ distinct mechanisms (group-anchor artifacts, interface/lollipop shield wrapping, `-[hidden]-` link handling) |
| I5h | `<linearGradient>` def count mismatch | 4 | `svg/defs[childCount]` — gradient dedup/emission-count divergence, not diagnosed |
| I-hideshow | hide/show command family (unconditionally ignored in command-table.ts; structural — unmasks geometry) | 13 | DONE — two mechanisms fixed (entity-level hide via HideOrShow's ordered rule list, draw-time-only; per-label stereotype-visibility, closes I5b's mechanism D); also fixed a co-discovered ink-extent/LimitFinder gap (hidden entities must still reserve canvas space). component/ciboso-93-romi495 + sufedi-40-baki261 reach zero-diff (ratchet-added); mavuxi-16-jafi782/tusugu-95-geju398/7×`hide stereotype` fixtures/mopimi-10-jaco443/zanibo-14-sami874 all mechanism-verified correct, blocked on unrelated pre-existing gaps (I4b color-override, cluster-border-style, title-chrome nesting, sizing-formula, font-baseline) — see ledger.md I-hideshow |
| I6 | `text/@x @y` (206+203 fixtures) | DONE (diagnosis-only, no code changed) — sub-classified: >99% is class A, box-position-inherited (text follows its own box's offset exactly, residual=0 in 91% of directly-matched rect/ellipse cases + the polygon/path/line-outlined remainder) — NOT its own mechanism, IS I7's family; re-measure text/@x,@y after I7 lands. Two narrower sub-mechanisms drilled to root cause but not fixed (layout/graphviz-ts-adjacent, outside safe render-only scope): (B) port-label above/below tie-break for port-only containers (4 fixtures, container min-body-size gap) and (C) ellipse-leaf (actor/usecase) uniform position drift (~1.5px actor / ~1.0px usecase topologies, 18 fixtures, graphviz-ts node-size-rounding candidate, unverified) — see ledger.md I6 | ~200 (99%+ redirects to I7) |
| I7 | rect/ellipse/line geometry (`rect@x/y/w/h`, `ellipse@cx/cy/rx/ry`, `line@x1/y1/x2/y2`) | ~120 | node-shape placement — I6 found this is ALSO the true owner of most `text/@x`/`text/@y` diffs (text is a pure render-time offset from its box); fixing this will likely close a large fraction of I6's family as a side effect |
| I8 | `polygon/@points` (arrowheads etc.) | 149 fixtures / 612 differing elements | DONE (diagnosis-only, no code changed) -- sub-classified into mechanism A (5pt/4pt arrowhead extremities, downstream of I9's spline endpoint/angle -- jar-verified, not its own mechanism) and mechanism B (6pt/7pt node/file/artifact cut-corner decoration polygons, downstream of I7's already-deferred ink-extent-margin/FrontierCalculator mechanisms B/C); exhaustive 0/173 isolation scan confirms no independent polygon-formula bug exists. Surfaced a NEW deferred mechanism: bracket-style link modifiers (`-[thickness=N]>`, `-[dashed]>`, `-[bold]>`, `-[#color]>`) are parsed into `rawStyle` but never applied (prior iteration's documented cut) -- candidate future iteration I-linkstyle -- see ledger.md I8 |
| I-linkstyle | bracket-style link modifiers (`-[thickness=N]>`, `-[dashed]>`, `-[bold]>`, `-[#color]>`) parsed into `DescriptiveLink.rawStyle` but never applied — needs `SvekEdgeInput.style` widening (thickness/color-override) + `strokeForStyle` wiring; feeds `path/@stroke-width @stroke @stroke-dasharray` and `polygon/@stroke-width @stroke` | DONE — `parseArrowStyle` (link-grammar.ts) faithfully ports `WithLinkType.applyOneStyle`; `DescriptiveLink.thicknessOverride`/`.colorOverride` thread through `DescriptionEdgeGeo.styleThickness`/`.styleColor` (replacing a crippled `dashed: boolean` field, also closing a latent unreached queue-char dotted/bold gap) into `SvekEdgeInput.styleThickness`/`.color`; `strokeForStyle` widened (incl. the BOLD-ignores-thickness-override upstream quirk, preserved faithfully). 7 fixtures jar-verified improved (0 regressions, confirmed by an exhaustive full-corpus before/after diff-count scan, not just the census bucket histogram), 0 reach zero-diff (all carry other out-of-scope residual families). Attempted-and-REVERTED: `-[hidden]-` bracket-elision (regresses canvas ink-extent on 2 fixtures — needs I-hideshow's edge-side ink-extent-registration fix as prerequisite). Ledgered, not fixed: `skinparam arrowThickness N` (new, unwired diagram-wide default) and `-[#transparent]-` path-elision (instrumented, root cause not found) — see ledger.md I-linkstyle |
| I9 | `path/@d` (splines) | 151 | sub-classified 178 fixtures/627 elements (link 135, entity 74, cluster 20 by ancestor `<g class>`); isolation scan found 15 fixtures PURE `path/@d` (no box/childCount diff elsewhere) -- drilled the dominant `link` mechanism: `graph-layout.ts#addEdges` never told graphviz-ts edges have no arrowhead (jar's dot text says `arrowhead=none` universally; this port's shared layout seam silently defaulted to `arrowhead=normal`, reserving an ~11px arrow-length gap graphviz-ts genuinely computes correctly once told -- real-graphviz-vs-graphviz-ts cross-check confirmed the library itself is faithful, per the mission's own instruction). FIXED, scoped via a new `DotInputGraph.manualArrowheads` flag to `description` only (class/state/dot/json draw arrowheads via SVG `marker-end` and rely on the reservation, confirmed by one surfaced golden-test regression before scoping). conformant 19->30/355 (+11), 0 regressions (full-corpus before/after scan). Deferred: 158/177 `link`/`cluster`-kind fixtures downstream of I7's mechanisms B/C (re-measure after I7 lands); 74-fixture `entity`-kind sub-family (actor stick-figure/queue-cylinder `<path>`s, a different mechanism class -- DRILLED in I9b) -- see ledger.md I9 |
| I9b | `path/@d` (entity-kind: actor/queue/database/cloud/file/... shapes) | 74 fixtures / 201 elements (I9's own named remainder) | sub-classified: actor 74/38 + database 41/13 (72/74 and 39/41 translate-only -- ATTRIBUTED to I7-C's already-deferred document-wide ink-extent margin, isolation-scan-confirmed never-pure, not re-drilled), queue 36/2 (concentrated, non-position-only) + file/cloud/folder/component/node/usecase/frame (~34 diffs, not drilled this iteration). DONE -- drilled queue's mechanism: bare Creole horizontal-line separator markers (`----`/`====`/`....`, EMPTY content only) rendered as literal `<text>` instead of a `<line>` -- `buildTextBlock` (`EntityImageDescriptionSupport.ts`) had no classification for `CreoleStripeSimpleParser`'s SECTION_HEADER/TITLE/SEPARATOR/DOUBLE_DOT patterns at all; the full downstream drawing machinery (`UGraphicStencil`/`AbstractUGraphicHorizontalLine`/`MyUGraphicQueue`/`MyUGraphicDatabase`/`UHorizontalLine`) was already faithfully ported and unused. FIXED (`classifySeparatorLine` + empirically-calibrated stacking constants, jar-verified against 2 independent fixtures); 6 new tests. component/butebe-90-dozo380 47->31 diffs (structural fix verified exact: outer shape, separator `<line>` position, box height all now byte-match); census conformant unchanged at 30/355 (every reached fixture carries other out-of-scope residuals). Diagnosed (not reverted) a `[childCount]`-bail-unmasking "regression" on component/babafi-51-dixi026 (26->72 diffs -- pre-existing I7-C diffs previously hidden, not new). Surfaced 2 new deferred mechanisms: `buildTextBlock`'s per-line CENTER-vs-LEFT alignment gap (broader, own iteration) and `USymbolQueue#getClosingPath`'s single-fixture-derived formula not holding for a TALL queue (needs multi-fixture re-derivation) -- see ledger.md I9b |
| I10 | `@viewBox/@width/@height` residue + queue-closing full re-measure/residue accounting | 325 non-conformant, ALL attributed | DONE -- confirmed the residue is downstream of interior mechanisms (root/document dims move only when interior geometry does); mechanical classifier attributed every one of the 325 non-conformant fixtures to a named ledger mechanism (see ledger.md I10's accounting table); fixed one genuine quick-win found during triage (folder/package cluster `roundCorner` hardcoded to 0 -- jar's real default is 5, same as every other container; a `polygon`-vs-`path` structural tag mismatch was masking interior geometry on 16+ fixtures); surfaced 3 new small named mechanisms (demoted-empty-package loses bold title, 7-fixture reach; named `!theme` border/roundCorner suppression not honored, 1 fixture; named-color gap extends to gradient stop-color + bare-hex-no-`#`, 2 fixtures); 8 fixtures left as an honest triage queue (geometry-cascade-dominant, secondary residual not fully drilled) -- see ledger.md I10 |

Colors/strokes (`@stroke`, `@stroke-width`, `@stroke-dasharray`, `@fill` on
shapes) fold into whichever iteration owns the emitting element.

## Standing rules

Upstream spec: the jar's cached SVGs (test-results/dot-cache/<type>/<slug>/
in.svg, deterministic-text capture) + `~/git/plantuml/src/main/java/net/`
(SvgGraphics.java is the emitter oracle). Fix at origin in the klimt
drivers/emitters — never post-hoc string surgery. The 8-fixture SVG ratchet
(tests/oracle/svg-conformance/) grows every iteration (add newly-zero-diff
fixtures to ratchet.json + goldens... verify the existing add procedure).
Complexity-hook playbook per project memory. Tests in tests/unit/ +
tests/oracle/. Ledger: plans/g1-description-svg/ledger.md (loop format).
Known deliberate divergences the compare must accommodate (normalize rule +
ledger, not fixes): image href bytes; annotated-fixture chrome DOM shape
(g-transform vs baked coords — IF the census flags it, decide baked-coords
port vs normalize at I1 with jar evidence).

## Mission-closing summary (I10, queue-closing iteration, 2026-07-15)

**Iterations run:** I0-I9b (11 iterations, one mechanism-family drill each
per `loop-protocol.md`) + I10 (this queue-closing re-measure/accounting
pass). Full per-iteration mechanism, jar-evidence, and disposition detail
lives in `ledger.md`.

**Census trajectory:** 12/355 (mission baseline, 2026-07-14) → 19/355 (I0-I8,
each iteration's own fix closing a handful of fixtures or none — several
iterations were diagnosis-only by design, e.g. I6/I8, sub-classifying a
family without a safe targeted fix) → 30/355 (I9's `manualArrowheads` fix,
the single largest jump, +11 in one iteration) → 30/355 (I9b, I10 — both
held steady; every remaining reachable fixture in each iteration's scope
carried other out-of-scope residuals). Final: **30/355 conformant**
(DeterministicMeasurer, byte-identical zero-diff set across I9-I10).

**Ratchet growth:** 0 (pre-mission) → 5 (early iterations, per the mission
brief's own baseline note) → 16 (I9's own backfill) → **26** (I9's ratchet
backfill of 10 newly-zero-diff fixtures; unchanged through I9b/I10 — neither
iteration reached a NEW zero-diff fixture). 4 fixtures remain blocked on a
stale `tests/oracle/svg-conformance/parity.json` (regeneration needs a full
`svg-parity-survey.ts` corpus run, out of every completed iteration's
write-set — see ledger.md I3/I9).

**Named-mechanism accounting (I10):** every one of the 325 non-conformant
fixtures is attributed to at least one named ledger mechanism — see
ledger.md I10's full table (31 named buckets, reach-descending, summing to
exactly 325). No anonymous misses remain; the 8-fixture triage queue is
explicitly flagged as "dominant mechanism named, secondary residual not
yet drilled" rather than silently dropped.

**What the 100%-minus-divergences bar still requires** (remaining named
mechanisms, reach-descending, each needing its own future iteration before
the mission can be declared fully complete):

1. **I6/I7 mechanism B/C — `FrontierCalculator` port-only-cluster sizing +
   `SvekResult` ink-extent-margin** (~81+23+4 ≈ 108 fixtures directly, plus
   most of I8's 170-fixture polygon family and I9's 158-fixture deferred
   `path/@d` family cascade through it once fixed — the single largest
   remaining mechanism by a wide margin). Root cause is fully pinned
   (`SvekResult.java:125-136`, ink-extent walk vs this port's flat node-box
   margin; `FrontierCalculator`'s DELTA=18 port-edge push, unported) but
   requires a genuine ink-extent/LimitFinder subsystem — a cross-cutting
   change touching every leaf/cluster renderer, deliberately deferred past
   every single-iteration safe-scope boundary so far.
2. **I2 named-CSS-color→hex table (T19)** (~50+2 ≈ 52 fixtures) — a
   ~150-name `HColorSet` port, pre-existing gap predating this mission.
3. **I4c mechanism 6 — full creole/char-atom subsystem** (~35+2 ≈ 37
   fixtures) — nested inline style runs, `<latex>`, `<code>` blocks,
   `[[url]]` atom-splitting, word-wrap; explicitly out of any single
   iteration's reach, needs its own mission-scale effort.
4. **I5g unclassified/remaining childCount family** (31+27 = 58 fixtures
   combined, many small 1-3-fixture leads) — each needs its own
   diagnosis.md pass; no shared mechanism found across the set.
5. **I1 chrome sibling-`<g>` nesting** (19 fixtures) — a prior-mission
   (G0b/T4) DOM-shape divergence shared by every diagram type's chrome;
   needs a maintainer decision on whether to unify chrome's nesting shape
   across all engines or accept it as a permanent divergence.
6. **I-hideshow-blocked** (9 fixtures) — mechanism is CORRECT, blocked by
   unrelated co-occurring gaps (I4b color-override, cluster-border, sizing
   nuances) — will close automatically as those land.
7. Everything else in ledger.md I10's table (≤10-fixture reach each):
   I10's own 2 new findings this iteration (demoted-empty-package bold
   title, 7 fixtures; theme border/roundCorner suppression, 1 fixture),
   I5f/I5b unbuilt sprite subsystems, I-linkstyle's `arrowThickness`
   skinparam, I4b's per-stereotype-NAME override, I5c's font-quoting gap,
   I3's uid-order/draw-order residuals, and 5 single-fixture unbuilt-
   feature gaps (I-scale handwritten, I2 ArrowFont*, I5h filter-shadow,
   I4 `scale N`, I0's unfixable jar-side malformed golden).
8. The 8-fixture triage queue (ledger.md I10) — needs individual
   diagnosis.md drilling before its dominant-mechanism attribution can be
   considered final.

No fixture in the 325-strong non-conformant set lacks a named home; closing
the mission fully means working down this list in reach order, largest
(ink-extent-margin) first.
