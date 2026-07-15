# G1b ledger — deferred/unfixable mechanisms (loop format)

## J1 — mechanism C: ink-extent document margin (`computeGlobalShift` ->
## `computeInkShift`) — FIXED

### mechanism — FIXED
- Mechanism: full jar chain and closed X/Y formula documented in
  `src/diagrams/description/layout-ink-shift.ts`'s own module doc comment
  (verified against `SvekResult.java:125-136`, `DotStringFactory.java:
  653-661`, `LimitFinder.java`'s per-shape `drawRectangle`/`drawEllipse`
  insets, and `ActorStickMan.ts`'s local geometry) and summarized in
  `decision-journal.md`'s two J1 rows above. In short: `computeGlobalShift`
  (`layout-geo-post.ts`, removed this iteration) shifted every node/edge by
  a flat `LAYOUT_MARGIN_LEADING=7` against the raw graphviz NODE-BOX
  minimum; jar instead runs a real `LimitFinder` ink walk over the fully
  assembled draw tree (cluster, then leaf, then edge — the SAME sequence
  the real render pass uses) at RAW (pre-shift) positions, then shifts
  everything so the walk's own minimum sits at exactly `(6,6)`.
- Disposition: fixed. New module `src/diagrams/description/
  layout-ink-shift.ts` (`computeInkShift`, replaces `computeGlobalShift`).
  Shared draw-sequence primitives (`collectByKind`/`drawClusters`/
  `drawEntities`/`drawEdges`) extracted verbatim out of `renderer.ts` into
  a new `renderer-draw-sequence.ts` so both the real render pass and the
  new ink-walk-based shift computation share one implementation (mirrors
  upstream's own single `SvekResult#drawU` call site for both purposes).
  `renderer-ink-extent.ts` gained `runInkWalk` (extracted from
  `computeDocumentDims`, which is otherwise UNCHANGED — still measures
  post-shift dims, now provably self-consistent since the shift always
  anchors ink-min to `(6,6)`) and `driverBounderFor` (moved from
  `renderer.ts`, now exported and shared). `layout.ts#buildGeoAndEdges`
  builds edges TWICE (raw at `dx=dy=0` for the ink walk, then real) — see
  decision-journal.md for why this is not a double-clip.
- Verification (per-topology numeric table, jar vs ours-before vs
  ours-after, all against `test-results/dot-cache/<slug>/in.svg` with
  `jarMeasurer`, cross-checked against `DeterministicMeasurer` for the
  ratchet-pinned slugs):
  | Topology | Fixture | jar | before (flat-7) | after (ink-walk) |
  |---|---|---|---|---|
  | actor (Y) | component/zanibo-14-sami874 | `ellipse@cy=14` | `cy=15.5` (+1.5 bug) | `cy=14` exact |
  | component rect (X) | component/zanibo-14-sami874 | `APP rect@x=7` | `x=7` (already correct — flat 7 coincides with `6-(-1)`) | `x=7` exact (unchanged, confirms the rect case was never the bug) |
  | plain component (Y, non-actor) | component/nevuzi-33-duna992 | `rect@y=7` (topmost) | `y` too low by 1.5 | `y=7` exact |
  | usecase ellipse (anchor) | usecase/fubaje-48-xaje065 | `cy-ry=6.0` exact (entity `d`) | off by ~1.0 (I6's finding) | `cy-ry=6.0` exact |
  | usecase ellipse (anchor) | usecase/mofuba-79-came821 | `cx-rx=6.0`, `cy-ry=6.0` exact | off | both exact |
  All five verified via a temporary scratch script (`scripts/_tmp-j1-verify.ts`,
  deleted before finishing) rendering with `jarMeasurer` and diffing against
  the cached jar SVG directly; remaining pixel differences in those renders
  (e.g. `ellipse@cx` off by ~2px) are ALL attributable to the pre-existing,
  unrelated `jarMeasurer`-vs-real-Java-AWT text-metric approximation gap
  (D12) — confirmed by checking the box-relative ink ANCHOR (`cx-rx`/
  `cy-ry`/rect `x`/`y`) lands at exactly 6 (or 7 for the rect's own -1
  inset) in both jar and ours regardless of the text-width discrepancy.
- Census (`DeterministicMeasurer`, full 355-fixture corpus):
  baseline `0 diffs: 30, 1-3: 21, 4-10: 77, 11-30: 53, 31+: 173, errors: 1`
  -> after `0 diffs: 41, 1-3: 28, 4-10: 86, 11-30: 57, 31+: 142, errors: 1`.
  Zero-diff set verified a STRICT SUPERSET of the baseline 30 (identity
  comparison, not count-only — all 26 ratchet-pinned + all 4 non-ratchet-
  eligible-but-zero-diff fixtures, `mamase-39-buto560`/`norebe-58-bixu182`/
  `sidame-35-cozu078`/`zoriso-46-vata931`, confirmed present in the new
  41-fixture set). 11 newly-zero-diff: `usecase/{cimare-47-deke334,
  cizolo-88-lake154, komivo-22-toki497, rabida-94-kula497, samicu-23-rula038,
  sivamo-20-gaga179, xegapu-80-damu730, xonafo-10-moki423}`,
  `component/{nidome-87-xesa939, xevidu-92-texu148, zanibo-14-sami874}`.
- Full-corpus before/after diff-count scan (git-archive pristine-snapshot
  technique, I-linkstyle precedent — `git archive HEAD` into a scratch dir,
  symlinked `node_modules`/`test-results`/`assets`, no `git stash`/
  `checkout`/`reset` on the working tree): 117 improved, 5 regressed, 233
  unchanged, 0 error-state changes. All 5 regressions diagnosed (see
  decision-journal.md's 4th J1 row) — every one is a `portin`/lollipop-
  interface (port-family) fixture, squarely mechanism B's (J2's) territory,
  none in the protected zero-diff/ratchet set. Not a new defect in
  mechanism C; a downstream interaction with an already-known unfixed
  mechanism.
- Ratchet: 26 -> 35 pinned fixtures. 9 of the 11 newly-zero-diff fixtures
  backfilled (`oracle/goldens/svg-description/ratchet.json` + `{in.puml,
  golden.svg}` dirs, `parity.json`'s `dotEqual:true` confirmed for each).
  2 excluded per the established AC3-eligibility precedent (I3/I9): `usecase/
  komivo-22-toki497` and `usecase/rabida-94-kula497` show `dotEqual:false`
  in the (2026-07-10, pre-100%-usecase) `parity.json`, but ARE in the live
  `test-results/dot-sync-equal/usecase.txt` (90/90 current DOT-EQUAL) — the
  SAME staleness class already documented for 3 other usecase slugs (I3's
  ledger entry). Not force-added; `parity.json` regeneration remains
  out-of-write-set for this iteration, same as every prior iteration that
  hit this gap.
- DOT gate: re-verified frozen EXACT — component 262/262, usecase 90/90,
  class 708/708, object 78/80, state 267/267 (every touched file is
  description-engine-only; zero DOT-emission-layer dependency — the fix is
  a pure geometry/draw-sequence change, never touches `buildDotNodes`/
  `buildDotEdges`/`buildDotClusters`).
- Reach beyond this iteration's directly-verified slugs: the mission's
  ~40+-fixture estimate (topmost/leftmost entity with nonzero ink offset)
  — 11 reached zero-diff directly; the remaining reach is cascaded into
  the I8 polygon/I9 path families per the mission's own framing, queued
  for J3's re-attribution pass.
- Slugs: see the verification table + newly-zero-diff list above; full
  reach not individually enumerated (corpus-wide, any fixture whose
  topmost/leftmost drawn shape has a nonzero LimitFinder ink offset from
  its own box, per this mechanism's general nature).

## J2 — mechanism B: FrontierCalculator / manageEntryExitPoint
## (pure port-only-container case) — FIXED; mixed-children case deferred

### mechanism — FIXED (insides-empty case)
- Mechanism: full jar chain documented in `frontier-calculator.ts`'s own
  module doc comment (`Cluster.java#manageEntryExitPoint`, java:410-430 +
  `svek/FrontierCalculator.java`, the whole file) and summarized in
  `decision-journal.md`'s three J2 rows above. In short: a port-only
  cluster's real drawn rectangle needs the cluster's own graphviz-assigned
  "initial" rect (unavailable via any public graphviz-ts API — see the
  decision journal for the ADR-1/`exports`-map evidence this was verified
  against, not assumed), the port centers merged into a seed core, then a
  DELTA=18 edge-push with a rankdir-perpendicular corner exclusion.
- Disposition: fixed. Three new modules: `frontier-calculator.ts` (pure
  `manageEntryExitPoint`/`ensureMinWidth` port, RectangleArea/Point types),
  `frontier-shadow-layout.ts` (isolated graphviz-ts shadow graph +
  public-API-only `render(...,'xdot')` text-parse, obtains `initial`
  faithfully without widening the shared `layoutGraph()`/`addClusters`
  seam), `frontier-cluster-bbox.ts` (wires the two together into a `Bbox`,
  scoped to `insides.length === 0`). `layout.ts#buildGeoNode`'s container
  branch calls `computePortClusterBbox` instead of `computeContainerBbox`
  when the cluster is in the new `portClusterCtx.infoByAstId` map (built
  once per diagram in `runLayout`, keyed by the SAME ast-scoped dot key
  `buildGeoNode` already computes). `applyPortLabelPositions`'s tie-break
  (`I6`/`I7`'s "port-only-container label tie-break", ledger 1693/1876)
  needed NO change — feeding it the now-correct bbox resolved the tie on
  its own, per the mission's own prediction; verified on
  `component/bijoko-90-riro507` (the up/middle/down reference fixture:
  159->147 diffs, `<` comparison untouched).
- Verification (jar-derived numeric table, `component/gafegu-06-nito976`):
  | Quantity | jar | before (padded-union) | after (FrontierCalculator) |
  |---|---|---|---|
  | cluster `rect@width` | 177 | 185 | **177 (exact)** |
  | cluster `rect@height` | 99 | 56 | 98 (off by 1 — see below) |
  | port `rect@x` (all 4) | 19,66,113,160 | 23,70,117,164 | **19,66,113,160 (exact)** |
  Algorithm cross-checked TWO independent ways before wiring: (1) hand-fed
  jar's own raw graphviz-native numbers (from `dot -Txdot` on the jar's
  cached `svek-1.dot`, cross-checked bit-for-bit against `graphviz-ts`'s
  own xdot render of the SAME dot text) straight into `manageEntryExitPoint`
  — reproduces 177x99 exactly; (2) ran the real pipeline end-to-end and
  compared the rendered SVG. The 1px height residual (98 vs jar's 99) is
  fully explained and NOT a FrontierCalculator bug: jar's anchor node's
  real rendered height (17, `SvekEdge.appendTable`'s table-height formula,
  `getTitleAndAttributeHeight()-5`) vs this port's PRE-EXISTING
  `TITLE_LABEL_HEIGHT=16` constant (`layout-helpers.ts`, already flagged in
  its own doc comment as "not the DOT-parity bar... nominal padding stands
  in" — this iteration is the FIRST caller that makes that constant
  load-bearing for real geometry). Not touched here (shared constant, used
  elsewhere, "don't refactor while porting" — a 1px-precision retune needs
  its own jar-verified derivation of `getTitleAndAttributeHeight()`'s real
  formula, not a guess).
- Census (`DeterministicMeasurer`, full 355-fixture corpus): unchanged
  totals (`0:41, 1-3:28, 4-10:86, 11-30:60 (was 57), 31+:139 (was 142),
  errors:1`) — the 3 direct fixtures below moved from the 31+ bucket into
  11-30 (17/11/12 diffs respectively — not zero, so no NEW ratchet
  candidates this iteration). Zero-diff/ratchet set (41/35) verified
  UNCHANGED (identity comparison, not count-only).
- Full-corpus before/after diff-count scan (git-archive pristine-snapshot
  technique): 4 improved (`component/gafegu-06-nito976` 39->17,
  `gocexi-61-biso565` 33->11, `rapaji-98-xato067` 34->12,
  `bujige-52-gase998` 81->69 — all pure-port-only containers), 0 regressed,
  340 unchanged, 0 error-state changes (the census-run "errors:2" seen
  mid-iteration was a bug in THIS iteration's own new code — see decision-
  journal's third J2 row — fixed before this final scan, confirmed back to
  the pre-existing 1).
- DOT gate: re-verified frozen EXACT — component 262/262, usecase 90/90,
  class 708/708, object 78/80, state 267/267 (every touched/new file is
  description-engine-only geometry; zero DOT-emission-layer dependency —
  `svek-dot-emit.ts`/`buildDotNodes`/`buildDotEdges`/`buildDotClusters` are
  untouched by this iteration's diff).
- Slugs (direct, jar-verified): component/gafegu-06-nito976,
  gocexi-61-biso565, rapaji-98-xato067. Reach beyond direct slugs: any
  PURE port-only container (no normal children) reachable by this port's
  own corpus scan — `component/bujige-52-gase998` confirmed via the
  full-corpus scan above.

### mechanism B: mixed (port + normal children) container — NOT FIXED,
### deliberately deferred (regression risk, see decision journal)
- Mechanism: Java's `insides`-non-empty branch of the SAME
  `manageEntryExitPoint` (`core` seeds from the real merged `insides` rects
  directly; `initial` only matters for its untouched-axis snap-back role).
  This port's `initial` source (`frontier-shadow-layout.ts`) has no
  visibility into the real normal-children layout inside the shadow calc,
  so any `initial` fed for this branch is necessarily approximate.
- Ruled out: a single combined-bbox "insides placeholder" node in the
  shadow graph — implemented, then reverted after it regressed
  `component/cuxelu-66-zopu195` (26->27) and `component/dugovi-24-kupu658`
  (31->36) in the full-corpus scan (both real `component X { [normal]
  portout p }` shapes). See decision-journal.md's second J2 row for the
  full mechanism.
- Disposition: not fixed here — `computePortClusterBbox`
  (`frontier-cluster-bbox.ts`) explicitly falls back to the prior
  `computeContainerBbox` padded-union formula whenever `insides.length >
  0`, preserving the ALREADY-CORRECT (or at least already-measured,
  non-regressing) behavior for every such fixture rather than shipping an
  imprecise mechanism-B result. Needs-signoff for its own iteration: either
  a jar-verified closed formula for the mixed case's `initial` (not a
  placeholder), or evidence that `initial` barely matters for THAT branch
  (Java's own comment suggests it mostly doesn't — worth testing directly
  against jar source before attempting another placeholder).
- Slugs: component/fopako-15-labi027 (mixed `portin`+`rectangle` container,
  102 diffs unchanged — one of J1's 5 regressed fixtures, re-verified here
  as NOT actually recoverable by this iteration's mechanism-B fix, see
  below), component/cuxelu-66-zopu195, component/dugovi-24-kupu658 (both
  confirmed unregressed at their pre-J2 baseline, 26 and 31 diffs
  respectively).

### `component/kanute-77-lacu414` — CONFIRMED unreachable by mechanism B,
### unchanged (not a port cluster at all)
- Mechanism: `kanute-77-lacu414` (`package p1 "p1 p1" {}`, `package p2 {}`,
  no ports, no braced children at all) was carried over from I6/I7 as
  "(partial)" without a specific mechanism attribution. This iteration
  confirms it: `isClusterNode` requires `children.length > 0`, so an EMPTY
  package is laid out as a LEAF (`EMPTY_PACKAGE`-style demotion,
  `isEffectiveCluster`), never reaching `Cluster`/`manageEntryExitPoint` at
  all — structurally outside mechanism B's domain, same reasoning as the 4
  re-attributed fixtures below. Diff count confirmed IDENTICAL before/after
  this iteration (81 diffs both times, full-corpus scan).
- Disposition: not fixed here, correctly out of scope — needs a fresh,
  independent diagnosis (empty-group leaf sizing, not FrontierCalculator).
- Slugs: component/kanute-77-lacu414.

### J1's 5 "mechanism-B" regression fixtures — RE-DIAGNOSED: only 1/5 is
### actually reachable by this mechanism; the other 4 are a DIFFERENT,
### still-unfixed mechanism (misattributed in J1's decision journal)
- Mechanism: J1's decision journal attributed all 5 fixtures
  (`component/duvoru-86-lubo341`, `fopako-15-labi027`, `gabogi-09-zoda184`,
  `mekimu-46-luzu886`, `xirika-05-beju263`) to "mechanism B... squarely
  FrontierCalculator/port-only-container territory." Direct inspection of
  each fixture's `.puml` this iteration found that is only true for ONE of
  the five (`fopako-15-labi027` — a genuine `portin`-cluster, but the
  MIXED-children sub-case just above, not the pure-port one this iteration
  closed). The other 4 (`duvoru-86-lubo341`, `gabogi-09-zoda184`,
  `mekimu-46-luzu886`, `xirika-05-beju263`) contain NO `port`/`portin`/
  `portout` keyword and NO container/cluster at all — every one is a bare
  top-level lollipop-interface leaf (`()`) referenced via a directional
  arrow (`-up-(`, `<-l-`, `.`, `..>`). `Cluster.manageEntryExitPoint` only
  ever runs on a `Cluster` (a group/container); a lone leaf entity has no
  `Cluster` object at all, so this mechanism structurally cannot apply to
  these 4 fixtures. `gabogi-09-zoda184` (`component comp; comp -up-( inter`)
  was inspected in full: its 15 remaining diffs are small (~2px) shifts on
  an ELLIPSE (`interface`) leaf's `cx`/text position and its connecting
  spline — the SAME general shape as I7's already-ledgered mechanism C
  (ink-extent margin, `SvekResult#calculateDimension`), specifically the
  "usecase/interface-ellipse per-shape ink offset" sub-case J1's own doc
  comment flagged as NOT yet numerically closed ("I6's ~1.0px
  usecase-topology magnitude is a DIFFERENT per-shape ink offset... not yet
  worked out numerically").
- Disposition: not fixed here (out of mechanism-B scope; re-attributed to
  mechanism C's unclosed ellipse/interface sub-case). All 4 confirmed
  UNCHANGED at their exact J1-post baseline (98, 15, 146, 89 diffs
  respectively) — not regressed further, not improved (correctly, since
  this iteration's fix cannot reach them). Needs-signoff for its own
  iteration under mechanism C's banner, not mechanism B's.
- Slugs: component/duvoru-86-lubo341, gabogi-09-zoda184,
  mekimu-46-luzu886, xirika-05-beju263.

## J3 — TITLE_LABEL_HEIGHT drill (FIXED at two of three sites), full
## residue re-attribution, ratchet growth, mission close

### TITLE_LABEL_HEIGHT / TITLE_LABEL_H_PADDING — FIXED for DOT-emission +
### ensureMinWidth; frontier-shadow-layout's own anchor kept on the legacy
### (non-jar-faithful) value pending its own diagnosis (NEW finding)
- Mechanism: J2 flagged `TITLE_LABEL_HEIGHT=16` (`layout-helpers.ts`) as a
  "not the DOT-parity bar... nominal padding" approximation, citing
  `getTitleAndAttributeHeight()-5 = 17` for `component/gafegu-06-nito976`'s
  1px residual (98 vs jar 99). This iteration read the LITERAL
  `label=<TABLE WIDTH=".." HEIGHT="..">` jar's own cached `svek-1.dot`
  emits for the port-anchor node (`ClusterDotString.java:177-184` reusing
  the SAME `label` variable `appendTable(sb, getTitleAndAttributeWidth(),
  getTitleAndAttributeHeight()-5, ...)` built at java:133-135) — an
  available, authoritative oracle no prior iteration had consulted for
  this specific constant. It shows `WIDTH="34" HEIGHT="9"` for `component`
  "comp" (component/gafegu-06-nito976, gocexi-61-biso565,
  rapaji-98-xato067) and `WIDTH="86" HEIGHT="14"` for `node` "srv1"/"srv2"
  (component/bujige-52-gase998, both clusters) — NOT 17. Real formula
  (`ClusterHeader.java:75-90`, no stereotype/attribute contribution for a
  plain single-line cluster title): `titleAndAttributeWidth/Height =
  measure(display).width/height + USymbol#suppWidth/HeightBecauseOfShape
  (symbol)`, table dims = `(titleAndAttributeWidth,
  titleAndAttributeHeight - 5)`. `suppWidthBecauseOfShape`/
  `suppHeightBecauseOfShape` are 0/0 on the base `USymbol` for every
  symbol except `node` (`USymbolNode.java:192-198`: +60w/+5h) and
  `database` (`USymbolDatabase.java:173-175`: +15h, no width override) —
  verified: "comp" (component, no supp) measures 34.2125x14 raw ->
  34x9 table; "srv1"/"srv2" (node, +60w/+5h) measure 26.425x14 raw ->
  (26.425+60)x(14+5)-5 = 86x14 table. Both exact against all 4 fixtures'
  literal dot caches (`npx tsx scripts/dot-sync-report.ts --slug <slug>
  component` now shows `all structural checks pass` AND the literal
  `WIDTH`/`HEIGHT` numerals byte-identical between oracle and candidate
  DOT text for all 4).
- Ruled out: J2's own "17" was NOT jar's real anchor size — it does not
  reduce from the real formula (14-5=9, not 17) and was an empirical
  curve-fit that happened to make `computePortClusterBbox` hit jar's exact
  99 for `gafegu-06`, discovered by DIRECT instrumentation this iteration
  (`computePortClusterInitialRect`, temp probe script, deleted): feeding
  the shadow graph anchorHeight=16 (the OLD constant) gives
  `initial.maxY=120`; anchorHeight=9 (jar-exact) gives `initial.maxY=113`;
  anchorHeight=17 gives `initial.maxY=121` — EXACTLY matching the real
  `dot -Txdot` cross-check value J2 itself already established
  (decision-journal.md's J2 3rd row, `(8,8)-(177,121)`, on jar's own FULL
  dot text). `anchorWidth` has ZERO effect on `initial`'s height (isolated
  by varying it independently) — confirms the effect is purely a vertical
  rank-spacing artifact of the shadow graph's own construction, not a
  width-driven coincidence.
- Disposition: FIXED for two of `measureTitleLabel`'s three original call
  sites (both DIRECT, 1:1 jar-formula applications with no intermediate
  graphviz remodeling in between): `layout.ts#buildAnchorNode`'s real
  DOT-emission anchor node (`ClusterDotString.empty()`'s reused
  `label=<TABLE...>` value — `scripts/dot-sync-report.ts --slug
  gafegu-06-nito976 component` now shows the candidate's emitted
  `WIDTH="34" HEIGHT="9"` byte-identical to the oracle's, was
  `WIDTH="54.2125" HEIGHT="16"`) and `frontier-cluster-bbox.ts`'s
  `ensureMinWidth` `titleWidth`/`titleHeight + 10` floor (direct
  `Cluster.java:427-428` application; never regresses any verified
  fixture since the floor never engages there — core width 177 far
  exceeds `titleWidth+10=44` either way). NOT fixed for
  `frontier-shadow-layout.ts`'s own isolated shadow-graph anchor node
  (`PortClusterInfo.anchorWidth`/`anchorHeight`) — kept on the OLD,
  explicitly non-jar-faithful legacy values (new function
  `measureShadowAnchorDims`, `title-label-sizing.ts`, doc-commented as a
  deliberate divergence) because wiring the jar-exact value there
  regresses `computePortClusterBbox`'s result (98->91 vs jar's 99 for
  `gafegu-06`, an 8px real regression, not just a rounding wobble) due to
  a genuine, UNRESOLVED ~8px structural gap between the isolated shadow
  graph's reconstruction and jar's real full-dot-text graphviz layout —
  see the NEW finding below. `measureTitleLabel`/`measureShadowAnchorDims`
  split out of `layout-helpers.ts` into a new module
  `title-label-sizing.ts` (500-line cap; `layout-helpers.ts` was already
  613 lines pre-J3, now 591 — net SMALLER despite the new/expanded doc
  comments, since both functions plus their constants moved out).
- Verification (per-fixture, `DeterministicMeasurer`, jar-cited
  `svek-1.dot` literal + `dot-sync-report.ts --slug`):
  | Fixture | jar anchor (WIDTH x HEIGHT) | ours before | ours after (DOT-emission) | `computePortClusterBbox` height (jar 99/99/99) |
  |---|---|---|---|---|
  | component/gafegu-06-nito976 | 34x9 | 54.2125x16 | **34x9 exact** | 98 (unchanged from J2 — anchorWidth/Height deliberately NOT changed) |
  | component/gocexi-61-biso565 | 34x9 | 54.2125x16 | **34x9 exact** | 98 (unchanged) |
  | component/rapaji-98-xato067 | 34x9 | 54.2125x16 | **34x9 exact** | 98 (unchanged) |
  | component/bujige-52-gase998 (both clusters) | 86x14 | 74.425x16 | **86x14 exact** | n/a (mixed-children fallback path, unaffected) |
  TDD: `tests/unit/description/measure-title-label.test.ts` (3 cases,
  red-verified against the pre-fix 4-arg-less signature before
  implementing) + `frontier-cluster-bbox.test.ts`'s existing 5 tests
  (unaffected — they construct `PortClusterInfo` directly, never call
  `measureTitleLabel`/`measureShadowAnchorDims`).
- Census (`DeterministicMeasurer`, full 355-fixture corpus): UNCHANGED —
  `0:41, 1-3:28, 4-10:86, 11-30:60, 31+:139, errors:1`, identity-verified
  (the exact same 41-fixture zero-diff set, all 35 ratchet-pinned + 6
  non-ratchet-eligible members present, none added/dropped). The 3 direct
  fixtures' `computePortClusterBbox` height is UNCHANGED (98, 1px off
  jar's 99) — this iteration's fix does not itself close any NEW fixture
  to zero-diff (that requires closing the shadow-graph 8px gap below,
  out of scope here); its value is DOT-emission byte-parity (verified via
  `dot-sync-report.ts`, which does not gate on embedded `label=<TABLE...>`
  numerals, so this improvement is invisible to the frozen DOT-gate counts
  but real for anyone inspecting the emitted DOT directly) plus removing a
  documented-wrong constant from the codebase.
- DOT gate: re-verified frozen EXACT — component 262/262, usecase 90/90,
  class 708/708, object 78/80, state 267/267.
- Slugs (jar-verified): component/gafegu-06-nito976, gocexi-61-biso565,
  rapaji-98-xato067, bujige-52-gase998.

### NEW finding (not fixed, ledgered): `frontier-shadow-layout.ts`'s
### isolated shadow graph has its own ~8px structural fidelity gap vs
### jar's real full-dot-text graphviz layout
- Mechanism: instrumented directly this iteration (temp probe script,
  deleted) — `computePortClusterInitialRect` fed the JAR-EXACT anchor
  size (34x9, see above) produces `initial.maxY=113` for
  `component/gafegu-06-nito976`'s port-rank-chain-plus-anchor shape, 8px
  SHORT of the value (121) a real `dot -Txdot` cross-check on jar's own
  FULL `svek-1.dot` text produces (decision-journal.md's J2 3rd row).
  Varying ONLY `anchorHeight` (9 -> 16 -> 17) reproduces the gap linearly
  (113 -> 120 -> 121) — a clean pass-through, confirming the gap is a
  FIXED, anchor-size-independent ~8px shortfall in the shadow graph's own
  vertical rank-spacing reconstruction, not a per-fixture coincidence.
  Likely source (NOT verified against jar source this iteration — a
  candidate, not a diagnosis): `frontier-shadow-layout.ts#buildShadowGraph`
  mirrors ONLY `svek-dot-emit.ts#portClusterBlock`'s core rank-chain +
  `${id}ee`-nested-anchor structure; jar's real `ClusterDotString.java`
  additionally wraps the cluster in `protection0`/`protection1`/
  `thereALinkFromOrToGroup`-conditional subgraphs (java:117-149) this
  port's shadow module never builds at all (deliberately, per its own
  doc comment — mirrors only the "core" structure). One of those wrapping
  subgraphs plausibly adds the missing rank separation.
- Ruled out: an anchor-size-driven effect (anchorWidth has zero effect on
  `initial`'s height; the gap persists at every anchor height tested,
  just shifted by a constant amount) — this is a graph-STRUCTURE gap, not
  a mis-sized-node gap.
- Disposition: not fixed here — needs a fixture-by-fixture structural
  diff between the shadow module's own emitted DOT and jar's real
  `svek-1.dot` (beyond just the rank-chain+anchor subgraph already
  compared) to identify which wrapping subgraph contributes the missing
  ~8px, then either build it into the shadow graph or find a closed-form
  correction. Needs-signoff for its own iteration.
- Slugs (direct, confirmed present): component/gafegu-06-nito976,
  gocexi-61-biso565, rapaji-98-xato067, bujige-52-gase998 (mixed-children
  fallback, unaffected currently but would need the same fix if the
  mixed-children mechanism-B case is ever unblocked and starts using the
  shadow calc's anchor for its own `initial` too).

### `tests/oracle/svg-conformance/parity.json` staleness — RESOLVED
### (regenerated via its normal path)
- Mechanism: stale since 2026-07-10 (I3/I9/J1 each independently found the
  SAME 6 fixtures' `dotEqual` stuck `false` in `parity.json` despite
  `test-results/dot-sync-equal/{component,usecase}.txt` — the live
  DOT-sync source of truth `dot-sync-report.ts --equal-list` regenerates
  every run — already listing them `true`), each declining to regenerate
  as "out-of-write-set for this iteration." This iteration's mission
  brief explicitly authorized attempting the regen ("if the staleness is
  a one-line refresh of parity.json via its normal regeneration path, do
  it").
- Disposition: ran `npm run svg:survey` (`scripts/svg-parity-survey.ts`,
  the documented normal regeneration path per `oracle/goldens/
  svg-description/README.md`'s own "Add rule" section) — completed clean
  in ~3 minutes over the full 355-fixture corpus, no crashes, no
  timeouts. All 6 target fixtures (`component/mamase-39-buto560`,
  `usecase/{norebe-58-bixu182,sidame-35-cozu078,zoriso-46-vata931,
  komivo-22-toki497,rabida-94-kula497}`) now show `dotEqual:true`,
  confirmed matching the live `dot-sync-equal` lists. Side effect: the
  regeneration ALSO flipped `component/bujige-52-gase998` from
  `dotEqual:false` to `true` — a REAL, correct consequence of THIS
  iteration's own anchor-sizing fix above (its `node`-symbol title-bar
  DOT emission is now byte-exact, confirmed via
  `dot-sync-equal/component.txt`) — which broke
  `description.golden.ratchet.test.ts`'s negative eligibility test (it
  had hardcoded `bujige-52-gase998` as a "known non-dotEqual" example).
  Swapped the test's fixture to `component/gutute-00-gaki684` (confirmed
  still genuinely `dotEqual:false`, a real DOT divergence, not
  `!pragma layout elk`-blind).
- Verification: `npx vitest run tests/oracle/svg-conformance/
  description.golden.ratchet.test.ts` — 44/44 pass (was 43/44 with the
  stale negative-test fixture, 1 failure, before the swap).
- Slugs: component/mamase-39-buto560, usecase/norebe-58-bixu182,
  usecase/sidame-35-cozu078, usecase/zoriso-46-vata931,
  usecase/komivo-22-toki497, usecase/rabida-94-kula497 (staleness fix,
  now ratchet-eligible); component/bujige-52-gase998 (side-effect
  dotEqual flip, not independently added — mixed-children fallback still
  blocks its own conformance); component/gutute-00-gaki684 (test-fixture
  swap only, not a G1b-attributed fixture).

### Ratchet growth: 35 -> 41 pinned fixtures
- All 6 newly-parity-eligible fixtures (staleness fix above) were ALREADY
  in the census's 41-fixture zero-diff set (carried since J1, previously
  excluded from the ratchet ONLY by the parity.json staleness this
  iteration fixed) — added per `oracle/goldens/svg-description/
  README.md`'s "Add rule" (`in.puml`+`in.svg`->`golden.svg` copied from
  `test-results/dot-cache/`, appended to `ratchet.json`).
  `description.golden.ratchet.test.ts`: 44/44 pass, every one of the 41
  fixtures AC1 (zero-diff)+AC2 (present)+AC3 (dotEqual) verified by the
  suite itself, not just documented.
- No OTHER fixture crossed to zero-diff this iteration (this iteration's
  own fix, per its own census re-run above, left the 41-fixture set
  byte-identical — TITLE_LABEL_HEIGHT's DOT-emission-only improvement
  does not itself change any SVG geometry).
- Slugs: component/mamase-39-buto560, usecase/norebe-58-bixu182,
  usecase/sidame-35-cozu078, usecase/zoriso-46-vata931,
  usecase/komivo-22-toki497, usecase/rabida-94-kula497.

### Full residue accounting — every one of the 314 non-conformant
### fixtures attributed to a NAMED mechanism (mechanical dominant-
### signature classifier, `scripts/_tmp-j3-classify.ts`, deleted before
### finishing; explicit slug lists carried verbatim from `plans/
### g1-description-svg/ledger.md` § I10 where a mechanism was NOT
### touched by J1/J2/J3; this mission's own findings sub-attributed where
### J1/J2/J3 DID touch a fixture)
- Methodology: renders all 355 fixtures (component+usecase,
  `DeterministicMeasurer`, same low-level pipeline as
  `svg-conformance-census.ts`), classifies every non-zero-diff fixture by
  (1) explicit slug-list match against every I10 mechanism J1/J2/J3 never
  touched (color/chrome/creole/uid-order/sprite subsystems, the
  `demoted-empty-package-bold`/`theme-suppression`/`color-extended`/
  `triage-queue` NEW findings, `kanute-77`'s confirmed out-of-scope
  status) — all carried over UNCHANGED in count from I10's own table,
  confirming they are stable and untouched by this mission; (2) this
  mission's own newly-named slug sets (mechanism-B mixed-children,
  mechanism-C ellipse/interface sub-case, the NEW shadow-graph 8px gap);
  (3) for everything else, a DOMINANT diff-family signature (plurality of
  geometry/color/childCount/text-family diff paths, root-level
  `svg/@width|@height|@viewBox` EXCLUDED from the tally since they are a
  downstream consequence of almost every other bug and would otherwise
  drown out small, genuinely diagnostic residuals). 0 fixtures fell
  through unclassified.
- Table (314 total, matches 355 - 41 conformant):

  | Mechanism | Count | Status |
  |---|---:|---|
  | I6/I7 mechanism C ink-extent-margin geometry-cascade (residual, non-port) — dominant-signature match, NOT individually re-drilled this iteration; almost certainly still includes some I1/I3/I4c/I5g fixtures now presenting geometry-dominant post-cascade that a full I10-style per-fixture re-derivation would split out | 181 | deferred-needs-signoff (ledger.md I6/I7, this iteration's re-measure) |
  | I5g `[childCount]`-dominant (structural element-count gap) — signature match, absorbs I10's prior 31+27=58-count childCount rows at their post-J1/J2 sizes | 73 | deferred-needs-drilling (ledger.md I5g) |
  | I2 named-CSS-color->hex table gap (T19) — signature match, absorbs I10's prior 50-count row at its post-J1/J2 size | 23 | deferred (ledger.md I2, pre-existing) |
  | I10 demoted-empty-package/folder loses bold title — explicit slug list, UNCHANGED from I10 (7->9: `kanute-77` split out to its own row below, `bozoju-49-kufo528`/others carried verbatim) | 9 | deferred-needs-signoff (ledger.md I10) |
  | geometry-cascade-dominant, secondary residual not drilled (I10 triage queue) — explicit slug list, UNCHANGED from I10 | 8 | triage queue (ledger.md I10) |
  | G1b J3 NEW: `frontier-shadow-layout.ts` 8px structural gap (pure port-only container, jar-exact anchor size REGRESSES `computePortClusterBbox`'s result vs the legacy compensating constant) | 4 | deferred-needs-diagnosis (this iteration) |
  | G1b mechanism C: usecase/interface-ellipse ink-offset sub-case (J1's 5 "mechanism-B regressions", re-diagnosed by J2 as 4/5 belonging here) — unclosed | 4 | deferred-needs-signoff (ledger.md J2) |
  | G1b mechanism B: mixed (port+normal) container — deferred (`fopako-15-labi027`, `cuxelu-66-zopu195`, `dugovi-24-kupu658`) | 3 | deferred-needs-signoff (ledger.md J2) |
  | I4c creole/char-atom subsystem — signature match (much smaller than I10's 39-count row: most creole-diff fixtures ALSO carry a larger geometry cascade post-J1, so plurality now routes them to the geometry-cascade row above instead) | 3 | blocked-on-E2-remainder (ledger.md I4c) |
  | I2 named-color gap — extended reach (gradient stop-color + bare-hex-no-`#`), explicit slug list, UNCHANGED from I10 | 2 | deferred (ledger.md I2/I10) |
  | empty-group/package leaf sizing (`kanute-77-lacu414`, confirmed by J2 structurally unreachable by mechanism B — split out of I10's demoted-empty-package-bold row for its own, still-needed independent diagnosis) | 1 | deferred-needs-diagnosis (ledger.md J2) |
  | G1b mechanism B/C geometry-cascade (port-bearing, MULTIPLE co-occurring known mechanisms — `component/perapa-23-mobu798` has both a pure port-only cluster AND a mixed-children cluster in the same diagram) | 1 | deferred-needs-drilling (this iteration) |
  | I10 named `!theme` border/roundCorner suppression — explicit slug, UNCHANGED from I10 | 1 | deferred-needs-signoff (ledger.md I10) |
  | I0 jar's own cached golden is malformed XML — explicit slug, UNCHANGED from I10 | 1 | not fixable (ledger.md I0) |
  | **Total** | **314** | every fixture carries >=1 named mechanism |

  Plus the 41/355 zero-diff conformant set (30 baseline + 11 J1 + 0 J2 +
  0 J3, identity-verified unchanged this iteration) = 41 + 314 = 355.
- Caveat (methodology honesty, not a claimed full re-derivation): unlike
  I10's own iteration (which had a full dedicated pass to hand-verify
  each large bucket's slug list), this iteration's 181-count and
  73/23-count rows are DOMINANT-SIGNATURE classifications only — every
  fixture in them is confirmed to carry that family as its LARGEST single
  diff-path share, but individual fixtures may ALSO carry a smaller I1/
  I3/I4c/I9b/etc. residual not separately called out (matching I10's own
  "triage queue" framing: dominant mechanism named, secondary residual
  not exhaustively drilled). This is disclosed rather than presented as
  false precision, per diagnosis.md.


## Pre-existing, out-of-J1-scope items observed (not fixed, not regressed)

### `layout.ts` / `layout-geo-post.ts#assembleEdgeGeo` complexity-cap
### violations — PRE-EXISTING, not touched by J1
- Mechanism: `layout.ts` was already 713 lines (cap 500) before this
  iteration; `assembleEdgeGeo` was already CCN=11 (cap 10) before this
  iteration. Neither region overlaps this iteration's diff (`git diff`
  hunk-verified). See `.agent-notes/G1b-J1-preexisting-complexity-caps.md`.
- Disposition: not fixed here — out of mechanism-C scope, "don't refactor
  while porting" applies; logged for a dedicated cleanup iteration.
- Slugs: n/a (infrastructure, not a fixture-level gap).

### `layout.ts` complexity-cap violations grew slightly (pre-existing,
### widened not introduced) — J2
- Mechanism: `layout.ts` was already over its 500-line cap and several
  functions (`buildGeoNode`, `buildGeoTree`, `buildGeoAndEdges`, `runLayout`)
  were already over the 5-param cap BEFORE this iteration (J1 ledgered the
  same class of pre-existing violation). Threading `portClusterCtx`
  (bundled into ONE new parameter, not two, specifically to minimize this)
  through the recursive geo-tree-building call chain added +1 param to
  `buildGeoNode`/`buildGeoTree`/`buildGeoAndEdges` and ~74 lines to the
  file (713->787).
- Disposition: not fixed here — "don't refactor while porting" applies to
  the pre-existing bloat; the NEW parameter was bundled into a single
  object specifically to avoid making it worse than strictly necessary.
  Logged for the same dedicated cleanup iteration J1 already flagged.
- Slugs: n/a (infrastructure, not a fixture-level gap).

