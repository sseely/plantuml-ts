# Mission G2 — class diagram SVG conformance

**Authorization.** Maintainer, 2026-07-15: "Go" (following the G1-family
completion report). Second Phase-G depth pass; same protocol as G1/G1b.

**Objective.** Drive the class SVG census to **100% minus known
divergences** (2026-07-14 ruling: every non-conformant fixture carried by
a named DIVERGENCES.md/ledger entry — no anonymous misses, no percentage
slack). Class DOT is already 708/708; this mission is render-side only.

- Branch: `feat/g2-class-svg` (from main @ 9d9f17b, post-G1d)
- Merge: merge commit; orchestrator owns all commits (one per iteration).
- Agents: NEVER git checkout/reset/stash/clean; read-only git; no commits.
- Protocol: `plans/dot-oracle-sync/loop-protocol.md` (one mechanism per
  iteration, diagnosis.md discipline, fix at origin, grow a class SVG
  ratchet, ledger the unfixable).

## Baseline

**SUPERSEDED (N0): the raw-first-run number below was measured through the
description engine's pipeline applied to class fixtures — a harness bug,
not a real conformance signal (see `ledger.md` N0, mechanism 0). The
CORRECTED baseline, measured against the real class pipeline after N0's
harness fixes, is:**

```
0 / 718 conformant · 1-3: 0 · 4-10: 19 · 11-30: 699 · 31+: 0 · errors: 0
Measure: npx tsx scripts/svg-conformance-census.ts class [--families]
(DeterministicMeasurer section; renderFixtureFor now dispatches class
fixtures through render-fixture-class.ts's real parseClass/layoutClass/
renderClass pipeline, not description's)
The universal mechanism is the "SVG root shell" gap (698-718/718 reach,
ledger.md N0 mechanism 2) — NOT fixed in N0 (needs new machinery, ledgered
for N1), matching G1's I1 precedent rather than I2/I4.
```

### Raw first run (2026-07-15, superseded — kept for history only)

```
0 / 718 conformant · 1-3: 2 · 4-10: 548 · 11-30: 53 · 31+: 84 · errors: 31
Measure: npx tsx scripts/svg-conformance-census.ts class [--families]
(DeterministicMeasurer section; script already accepts type args)
Oracle: test-results/dot-cache/class/<slug>/in.svg (718 fixtures cached)
The 548-fixture 4-10 bucket implies a FEW universal mechanisms — find
them first (G1's I2 font-constants / I3 id-conventions precedent).

DOT gate FROZEN THROUGHOUT: component 262/262 · usecase 90/90 · class
708/708 · object 78/80 · state 267/267 (ANY movement = stop condition).
DESCRIPTION SVG gate: the 48-fixture description ratchet
(tests/oracle/svg-conformance/description.golden.ratchet.test.ts) must
stay green — class fixes to SHARED code (klimt, svek, annotations,
creole, colors) must not regress description conformance. Re-run the
description census (component usecase) each iteration; its 48/355
zero-diff set must not shrink.
Gates per iteration: npm test · typecheck · lint · build ·
dot-sync-report (frozen) · class census (non-dropping) · description
census (48 zero-diff set intact).
```

## Assets inherited from G1/G1b/G1c/E2r/G1d (shared code — reuse!)

Creole atom engine (klimt/creole/), HColorSet canonical colors
(klimt/color/), chrome DOM shape (annotations/ — already jar-shaped for
every engine), javaFixed4 %.4f formatting (svg-graphics-core), ink
primitives (LimitFinder/MinMax/TextBlockUtils), image-href normalize
rule, SvekEdge/extremity machinery. Class-SPECIFIC territory: the class
renderer (src/diagrams/class/), member compartments, visibility icons,
generics, EntityImageClass and friends upstream
(~/git/plantuml/.../svek/image/EntityImageClass.java, classdiagram/).
NOTE: description's ink-shift (layout-ink-shift.ts) and draw-sequence
are description-local — class likely needs its own equivalent wiring;
check how class computes its document margin before assuming.

## Iteration queue (re-derive from --families each iteration)

**N0 finding: the README's originally-stated baseline (below) was measured
through the WRONG pipeline** — `svg-conformance-census.ts` hardcoded
`parseDescription` for every fixture type, including `class`;
`parseDescription` silently drops native class syntax instead of throwing
(verified: `package p1 { class cl1 }` loses `cl1` entirely). Harness fixed
in N0 (`render-fixture-class.ts` + a `renderFixtureFor` dispatcher in the
census script) — see `plans/g2-class-svg/ledger.md` N0 for the full
diagnosis. The CORRECTED baseline (0 errors, re-measured against the real
class pipeline) is:

```
0/718 conformant · 1-3: 0 · 4-10: 19 · 11-30: 699 · 31+: 0 · errors: 0
```

| Iter | Family | Reach | Status |
|---|---|---|---|
| N0 | harness fix (wrong pipeline + missing stdlib store, 31→0 errors); `--families` re-run against the corrected pipeline; class ratchet harness (`oracle/goldens/svg-class/` + `class.golden.ratchet.test.ts`, empty — no fixture reaches zero-diff yet); root-shell mechanism diagnosed but NOT fixed (needs new machinery, not a constant swap — see ledger) | all 718 (measurement); 0 fixed | done |
| N1 | "SVG root shell" landed (all 3 parts): root literal-constant attrs (shared `core/klimt/document-shell.ts#assembleDocumentShell`, generalized from G1 I1's `assembleKlimtShell`) + single wrapping `<g>` (`class/renderer-shell.ts#assembleClassShell`, new `RenderFragment.classShell`/`bodyWrapped` flags) + marker-vs-inline-polygon arrowheads (`class/renderer-arrowhead.ts#buildEdgeArrowheads`, reuses `core/svek/extremity/*` directly). Every literal-constant + root `svg[childCount]` family from N0 is gone; census moved from 0/718·4-10:19·11-30:699 to 0/718·1-3:6·4-10:712. Landing mechanism 2 UNMASKED a new universal mechanism 3 (per-element `<g class="entity"/"cluster"/"link">` wrapping + uid assignment, `ledger.md` N1) that blocks EVERY fixture from zero-diff — not fixed this iteration, next N2 target. | 0 new zero-diff (mechanism 3 blocks all); all literal-constant + root-childCount families closed | done |
| N2 | mechanism 3 LANDED: parse-time `creationIndex` threading (`ast.ts`/`parser.ts`/`class-namespace.ts`/`class-container.ts`/`class-commands.ts`) + dense-re-numbering uid plan (`class/renderer-uid.ts#buildClassUidPlan`) + pure-string `<g class="entity"/"cluster"/"link">` wrapping (`class/renderer-group.ts`), wired into `class/renderer.ts#renderClass`. `svg/g[1][childCount]` (was 718/718) dropped to 166/718 — but landing it UNMASKED a new, larger, universal pre-existing gap in `EntityImageClass`'s own chrome (box padding/rounding, badge-icon shape — `svg/g/g[childCount]`, 538/718) exactly as predicted ("childCount-bail unmasking again... N3's territory") — 0 fixtures reach zero-diff this iteration. Also surfaced: missing edge `<path id/codeLine>` attrs (192/177 fixtures) and a diagnosed-but-unfixed off-by-one uid bug for "classifier reopened as package" fixtures (`class-container.ts#muteClassifierToGroup` doesn't hand its deleted classifier's `creationIndex` to the replacement `Namespace`) — see `ledger.md` N2 for full diagnosis. | 0 new zero-diff (chrome-fidelity gap blocks all); census 0/718·1-3:4·4-10:424·11-30:146·31+:144 | done |
| N3 | `EntityImageClass` box-chrome+geometry pass LANDED: rx/ry rounding, badge as real `<ellipse>`+vector-glyph `<path>` (5 letters' glyph data extracted from the corpus itself, translate-based reuse), badge radius 10→11 + correct header-height/width formulas (`class-badge.ts`, new), badge-before-name draw order, always-two-compartment dividers (fields+methods, 8px empty-section floor each), 0.5 stroke-width, 1px divider inset, no-100px-width-floor, degenerate single-classifier (7,13) margin formula. Also discovered and NOT fixed (STOP-CONDITION-worthy, reported not resolved): `test-results/dot-cache/class/` goldens are STALE relative to the current `oracle/dist/plantuml-oracle.jar` — re-running the SAME jar+flag on a cached fixture's own `in.puml` produces a DIFFERENT `textLength` than the cached `in.svg` (`ArrayList`: cache 60.0469, fresh rebuild 55.2125, matching this port's own `WidthTableMeasurer` exactly) — every text-width-bearing family (`@width`/`@height`/`@viewBox`/`textLength`) is unverifiable against a reliable oracle until the corpus is regenerated (orchestrator decision, not attempted — regenerating dot-cache risks the frozen DOT-gate denominators). See `ledger.md` N3 for the full derivation + evidence. | 0 new zero-diff (blocked by the corpus-staleness finding, not by the chrome fix itself — census 0/718·1-3:7·4-10:278·11-30:58·31+:375, `svg/g/g[childCount]` 538→373) | done |
| N4 | Re-classified against the fresh (2026-07-16) oracle re-capture; 11 mechanisms landed (`ledger.md` N4 for full detail): `theme.colors.background` HColorSet resolution (was never resolved); jar's non-default-background full-canvas `<rect>` (N1's claim it never draws one was wrong, unverified against the fresh oracle); `badgeFill`'s 5 per-kind spot colors (matched jar's `plantuml.skin` `spot{}` block, PREVIOUS constants matched 0 samples); ellipse `strokeWidth`→`stroke-width` key bug; divider `<line>` missing `stroke-width:0.5`; the LARGEST mechanism — member/header text rendering (row height `fontSize` not `*1.4`, ascent-based baseline Y, header-centering indent, always-left-anchored `text-anchor` omission, `textLength`/`lengthAdjust`, hardcoded `#000000` fill, draw-order divider/row interleaving); `Member.visibilityExplicit` threaded for class leaves (was object-only) gating icon reservation; `core/number-format.ts` extraction (`javaFixed4` Java-`%.4f` rounding, shared with klimt) for `textLength`; `formatMemberText`'s spurious `: ` on untyped members; `degenerateSingleClassifier`'s `Math.round`→`Math.floor` whole-pixel rounding fix; a mid-iteration regression (transparent background's root-style `isSolid` check) caught and fixed. First class ratchet pins: **29 fixtures**. | 29/718 new zero-diff; census 29/718·1-3:20·4-10:242·11-30:22·31+:405 | done |
| N5 | Canvas dims + edge path/@d, the two largest N4 remainders. Canvas dims: class's non-degenerate (DOT-driven) path was returning `layoutGraph()`'s own raw `result.width`/`result.height` — dot's internal layout-margin convention, unrelated to jar's real SVG dimension formula — never any ink-extent recipe at all (unlike description's `renderer-ink-extent.ts`, G0/T3). Root-caused via a **debug-instrumented local oracle build** (traced `SvekResult#calculateDimension`/`TextBlockExporter#calculateFinalDimension`/`SvgGraphics#ensureVisible` directly — see ledger for the exact patch/rebuild/run sequence): the real recipe is ink-extent-walk `.delta(15,15)` + `CucaDiagram` margin (0,5,5,0) + a **truncating `(int)(v+1)`** final step, AND the classifier-box ink rule is NOT the classic symmetric `-1`-inset `URectangle` rule — `EntityImageClass` also draws an invisible full-box `UEmpty` reservation that dominates the rect's own max corner by 1px. New `class/layout-ink-extent.ts#computeClassDocumentDims` (pure geometry, no klimt) ports this faithfully. Edge path/@d: `EdgeGeo.points` (well-formed `1+3n` bezier splines, N2) was rendered as straight `L` polyline segments; `buildPathData` now emits the SAME `M...C...[C...]` cubic-bezier chain jar draws (byte-format verified against multi-segment corpus paths), falling back to `L` only for non-spline (2-point) edges. Both mechanisms are class-local, TDD'd (17 new unit tests, all green), jar-verified against 80+ corpus fixtures independent of the census script. | 0 new zero-diff (0-diff bucket unchanged at 29 — blocked by OTHER, already-named remainders: visibility-icon shape, hide/show `$tag` edge cases, `<style>` diagram-type-selector background); census 29/718·1-3:61·4-10:201·11-30:20·31+:407; `svg/@viewBox` 680→598, `svg/@width` 656→540, `svg/@height` 670→483 (largest family closures this mission has landed in one iteration) | done |
| N6 | 1-3-diff bucket (61 fixtures) harvested and classified into 10 diff-path-signature clusters (`ledger.md` N6 table) — genuinely fragmented, not a few universal mechanisms: note-of-member connector shape (~12-20), `(A,B)` n-ary "point" entities (~10), link-URL wrapping (13, README item #7), hide/show tag edge cases (10), `<style>` background (3, N5's own remainder), 2 single-fixture unsurveyed bugs. Per the brief's explicit priority list, drilled **visibility-icon shape/color/fill-vs-stroke** (the largest UNSTARTED family by TRUE reach — 50/718 fixtures use an explicit visibility char, though only 2 sat in the 1-3 bucket, the rest blocked by other issues): jar draws 5 shapes (square/diamond/triangle/circle/circle-always-filled) wrapped in `<g data-visibility-modifier="KIND_FIELD"|"KIND_METHOD">`, FIELD members unfilled (stroke-only), METHOD members filled — this port drew one shape family, always filled, no wrapper. New `class/class-visibility-icon.ts` (`renderVisibilityIcon`, jar-verified against 3 fixtures covering all 5 shapes × both fill rules). Skinparam icon-color overrides NOT wired (1/718 reach, deferred). | 2 new zero-diff (`sigoji-75-mojo941`, `xemupo-45-misi775`); census 31/718·1-3:59·4-10:201·11-30:20·31+:407 | done |
| N7 | Worked N6's fragmented-mechanism queue, largest reach first: **2 mechanisms landed**, 3 diagnosed-but-deep and ledgered (per the brief's explicit permission to skip-and-ledger). Landed: (1) `<style> classDiagram {}`/`root {}` background selector — `core/style-map-element.ts#resolveDocumentBackground` widened its precedence list (was `document`+3 unrelated diagram types only) to cover a bare `root` selector and every DOT-gate diagram type's bare + nested `document` selector, jar-verified precedence (`root` < `document` < diagram-type-scoped `document` < bare diagram-type < that type's nested `document`) against `bikuka-40-pezi068`/`cilaba-36-zogi212`; `zirori-93-jefo337` (N5/N6's third named fixture in this cluster) turned out to be an UNRELATED mechanism (`skinparam mode dark`, a full color-table swap) — misclassified by the N6 diff-signature harvest, newly re-ledgered. (2) `hide`/`show <entity\|$tag\|<<stereotype>>\|*\|@unlinked>` entity-pattern directive (upstream `CommandHideShow2`/`hides2`, structurally distinct from `remove`/`restore`'s `hides2`-sibling `removed` list but sharing the SAME `HideOrShow` matcher) — new `HideShowPatternDirective` AST type + `computeHiddenIds` (generalized `isApplyable`/`foldDirectives`/`buildUnlinkedPredicate` to a `PatternDirective<A>` shape shared with `computeRemovedIds`, zero duplicated logic); hidden classifiers keep their DOT/layout node (creationIndex/uid slot) but draw nothing, and edges touching a hidden classifier are suppressed too (`abel/Link.java#isHidden`'s OR-with-endpoint rule). Both mechanisms are structurally correct (childCount now matches) but neither reaches zero-diff — each unmasked a pre-existing, unrelated residual (element-level style cascade to classifier boxes; ~7-8px multi-component layout offset) — the same "childCount-unmasking" pattern recorded every iteration since N2. Diagnosed-not-fixed (full mechanism + jar evidence in `ledger.md` N7, each ledgered as genuinely deep for a dedicated future iteration): note-of-member connector shape (Opale zigzag-notch polygon + fuzzy substring member matching + unresolved SvekNode-relative coordinate math), `class Foo [[url]]`/`url of X is [[...]]` link wrapping (5-way regex grammar, member/classifier/note/edge/package variants, ~22 reach — genuinely unbuilt, dedicated-iteration scope per the brief's own caution), `(A,B)` n-ary point entities (parser/DOT ALREADY correct — NARROWED to a pure 3-part render-layer gap: shape, per-endpoint-kind edge decoration, invisible-edge suppression — best N8 pickup). | 0 new zero-diff (both landed mechanisms fix real structural mismatches without reaching zero-diff — see residuals above); census 31/718·1-3:52·4-10:194·11-30:20·31+:421 | done |
| N8 | `(A,B)` n-ary point-entity render layer (shape/decoration/invisible-connector, N7's narrowed 3-part scope) landed: `assoc-circle` case in `renderer.ts` (bare `<ellipse>`, no `<g>` wrapper), point-entity edge decoration derived from the couple's own arrow token (`class-assoc-couple.ts`), invisible sibling-circle connector suppressed (`layout.ts`'s `buildEdgeGeos` now checks `rel.invis`). Edge stroke defaults corrected diagram-wide (`strokeWidth:1`/`stroke-dasharray:7,7`, was `1.5`/`'5 5'`, corpus-surveyed 504/510 and 383/388 samples). `muteClassifierToGroup` creationIndex off-by-one (N2 leftover) fixed. Diagnosed-not-fixed: edge `<path @id @codeLine>` (N8's own two contradicting samples), graphviz-ts coordinate-assignment ~7px offset (OUT OF SCOPE). | 0 new zero-diff (structural fixes unmask the graphviz-ts offset, precedented unmasking); census 31/718·1-3:43·4-10:194·11-30:20·31+:430 | done |
| N9 | Edge `<path>` `@id`/`@codeLine` (largest named family, 220/191 reach) landed: traced the real `Link#idCommentForSvg()` rule past N8's two contradicting samples (upstream's `CommandLinkClass.getLinkType()` swaps LinkType's own decor1/decor2 fields — a DIFFERENT swap than this port's arrowhead-driven `swapDirection`, used only for DOT layout direction) — new `Relationship.idEntity1`/`.idEntity2`/`.idEntity1Decor`/`.idEntity2Decor` fields (`ArrowInfo.upOrLeft`, `parseArrowDecorsRaw`, `class-relationship-parser.ts`), reused by inline `extends`/`implements` (`class-declaration-parser.ts`, a wholly separate construction path, always parent-backto-child). Fixed 3 bugs surfaced while jar-validating the matrix: PLUS/SQUARE/CROWFOOT decors collapsed to "none" for id purposes (real for rendering, wrong for `looksLike*Svg`); `leafPortion`'s blind `.`-split broke `namespaceseparator none` and the CLASS_ID root-marker (new nsSep-aware `idLeaf`); unescaped XML-unsafe id chars (new `escapeIdAttr`, matches jar's own no-`>`-escaping quirk). `codeLine`: genuinely absent engine-wide (confirmed) — added minimal parallel-array line-position plumbing (`preprocessor.ts#linePositions` → `BlockUmlBuilder.ts`/`block-extractor.ts` → `UmlSource.linePositions` → `ParseState.currentLine`), purely additive, jar-verified byte-exact including a blank-line-containing fixture. Remaining `@id` mismatches (68/718) are ALL separate, named mechanisms (couples/lollipop synthetic entity naming, note-connector structural gap, `!pragma layout elk`, `[hidden]` bracket, `skinparam groupInheritance` — see N9 queue below), none in this iteration's arrow-matrix scope. | 0 new zero-diff (id/codeLine was one of several remaining diffs on already-multi-diff fixtures, same pattern as every prior mechanism); census 31/718·1-3:43·4-10:194·11-30:21·31+:429 | done |
| N10 | Fresh sub-classification of ALL 687 non-conformant fixtures (not just the 1-3 bucket): 8 already-named mechanisms tagged via puml-source heuristics (note-of-member ~19 real/62 heuristic, couples/lollipop ~24 real/53 heuristic, url-wrap ~22, elk ~4-7, hidden-bracket 1, groupInheritance 1, dark-mode 1), leaving 543 fixtures untagged that fragment into 187 distinct diff-family signatures — confirms N6's fragmentation finding generalizes to the WHOLE corpus, no large hidden universal mechanism remains. Sample-traced 2 of the largest untagged clusters back to the ALREADY-NAMED "~7-8px position/margin residual" (N7)/"ink-extent" (N5) gap via the childCount-unmasking pattern, confirming it (not graphviz-ts alone) now dominates the bulk of the remaining corpus — re-ledgered as the top N11 target. Drilled and LANDED `hide empty members`/`empty fields`/`empty methods`: root-caused to `CommandHideShowByGender.java`'s per-COMPARTMENT (not whole-section) suppression rule — this port suppressed both compartments together only when ALL members were empty, and `empty fields`/`empty methods` were parsed but never consulted (dead directives) engine-wide. New `MemberSuppression {fields, methods}` replaces the old single `suppressMemberSection` boolean throughout `class-layout-helpers.ts`/`layout.ts`; corrected an unverified N3-era unit test in the process. Regression trace (5 fixtures whose diff count rose) found 2 genuinely NEW, unrelated, pre-existing bugs: `parseMemberLine` silently drops Java-style `Type name`/trailing-`;` field syntax (3 fixtures), and the already-named ~7-8px residual (2 fixtures) — both diagnosed via isolated repros/disposable-worktree baseline diff, neither a fault in this iteration's mechanism. | 1 new zero-diff (`mezucu-18-lozi106`); census 32/718·1-3:42·4-10:191·11-30:20·31+:433 | done |
| N11 | Root-caused and fixed the ~7-8px position/margin residual (N7/N10's top target): `SvekResult#calculateDimension` (svek/SvekResult.java:130-136) does TWO things, not one -- N5 ported only the RETURNED dimension (`.delta(15,15)`), never its `moveDelta(6 - minMax.getMinX(), 6 - minMax.getMinY())` side effect, which permanently translates every already-laid-out node/cluster/edge position so the diagram's own ink extent lands at `(6,6)` -- the IDENTICAL mechanism description already ported as `layout-ink-shift.ts#computeInkShift` (G1b/J1, shared `SvekResult` base-class machinery across the whole `CucaDiagram` family). New `layout-ink-extent.ts#computeClassInkShift` (+ shared `buildInkBox` factored out of `computeClassDocumentDims`) computes the shift; `layout.ts#assembleShiftedGeometry` applies it via new `shiftClassifierGeo`/`shiftNamespaceGeo`/`shiftEdgeGeo`/`shiftNoteGeo` (generalizing the pre-existing y-only `layoutMultiPage` helpers to `(dx,dy)`). Pure post-dot-layout position translation -- zero measured node-size change, DOT gate untouched. New `class-geo-builders.ts` (verbatim move of the geo-builder functions out of `layout.ts`, no behavior change) keeps `layout.ts` under the 500-line file cap. Jar-verified zero-residual on `jalexi-21-xoje231`. Sub-classification confirmed the residual is overwhelmingly case A (uniform whole-diagram translate), not per-element or primarily graphviz-ts (N8's own `bosiki-11-xaza958` sub-case re-confirmed still separate and bounded). Full-corpus regression scan: 279 improved / 437 unchanged / 2 diagnosed-not-regressions (pre-existing bugs unmasked -- an `ent0001`/`ent0002` id+childCount swap on a qualified-relationship-reference fixture, and the entirely-unimplemented `scale max N height` directive). Newly discovered, not fixed (explicit DOT-gate risk, deferred): a classifier-width bug on unmarked member rows (`ducoka-05-cuce457`'s `Test Two`, ~18px too wide -- touching it would change measured node size, this mission's own stop condition). | 22 new zero-diff (`deboga-81-zuza232`, `gopalo-51-leje047`, `jalexi-21-xoje231`, `kejivu-76-mipe227`, `lafama-65-zoci799`, `libobe-85-veli517`, `murifo-42-fepu514`, `niboti-81-guja450`, `nomeza-10-laba367`, `padera-25-gite580`, `pecigo-88-bubu786`, `pijode-83-tiba954`, `ponoko-58-sane430`, `pukomu-34-poju929`, `rudoxi-65-cegi339`, `sicazi-62-duco028`, `siluti-87-sefa007`, `sipigu-91-baku027`, `vavure-50-gako950`, `vaxeku-10-peko225`, `xacavi-18-leca211`, `zuxore-81-ruti283`); census 54/718 (was 32/718) · 1-3:50 · 4-10:215 · 11-30:38 · 31+:361 | done |
| N12 | Near-zero harvest (50-fixture 1-3 bucket, 18 clusters classified): landed `skinparam class`/`enum { BackgroundColor }` block resolution (`classifierFill` always uses `classBackground` -- upstream has NO `enum`/`interface` StyleSignature for the classifier box fill at all, `EntityImageClassHeader#getStyleSignature` keys on `SName.class_` unconditionally, jar-verified `pijoji-10-tazo455`) and a `font-family` XML-quote-corruption bug (`core/svg.ts#toSvgFontFamily`, embedded `"` swapped to `'` mirroring upstream's own `FontStack#getSvgFamily`, jar-verified `tipude-10-tizi427`). Primary mandate landed: `class-member-parser.ts#parseMemberLine`'s raw-display fallback (N10/N11 carried item -- upstream member lines are NEVER decomposed past method-vs-field bucketing, `Member.java`'s constructor keeps the whole remainder verbatim; a non-canonical line, e.g. Java-style `Type name` or a trailing `;`, now becomes a `Member.rawDisplay` row instead of silently vanishing, mirrors `parseObjectField`'s identical pre-existing fallback) plus a required companion fix (strip a trailing `[[url]]`/`[[[url]]]` suffix BEFORE structured matching -- without it a URL-suffixed method line fell to the fallback with the bracket syntax embedded literally, a real DOT node-size regression caught by `tests/oracle/object-dot-parity.test.ts`, fixed and re-verified DOT-gate-clean); and `hide|show <visibility> members|fields|methods` (queue #3, `CommandHideShowByVisibility` -- a global hide-adds/show-removes `Set<visibility,field|method>`, distinct from N7's entity-pattern `hides2` and the fixed-target `members`/`empty members` directives; a member with no explicit visibility char is NEVER matched, mirrors upstream's `null`-modifier semantics). Surveyed but NOT fixed per the brief's fix-only-if-small instruction: sprite/font-awesome glyphs in member text (queue #4, ~7-9/718, needs creole-markup-in-member-text + actual glyph rendering) and `!define` macro called inline in a member line (queue #5, ~6-7/718, needs TIM macro-call substitution wired into body-line collection + the same creole gap as #4, jar-verified two-part via `mopelo-04-fose807`). Also surveyed and deferred: `class Collection<T>` generic type-parameter tag box (~15/718, NEWLY SURVEYED, explicit DOT-gate risk) and `skinparam groupInheritance` (reach UPGRADED from N9's 1/718 estimate to 3+/718 confirmed). Full-corpus regression scan (member-parser-fix checkpoint): 40 improved / 62 regressed (childCount-unmasking onto already-named N11 `Test Two` width bug or the macro/creole gap, none a fault of this iteration's mechanisms) / 616 unchanged / 0 zero-diff regressions. | 4 new zero-diff (`fimega-47-xigi097`, `kexecu-14-xesa311`, `pijoji-10-tazo455`, `tipude-10-tizi427`); census 58/718 (was 54/718) · 1-3:58 · 4-10:175 · 11-30:35 · 31+:392 | done |
| N13 | Note-connector family (twice-deferred, largest named mechanism): sub-classified 13 near-zero note fixtures into 4 kinds -- A) member-tip (`note left\|right of X::member`, `CommandFactoryTipOnEntity`/`EntityImageTips`/`Opale`), B) freestanding note + explicit relationship edge, C) plain single-link attached note (`note left of X`), D) `note on link` -- discovering B/C are the SAME upstream mechanism (`EntityImageNote`'s `isOpalisable`/`opaleLine`), and that this port's ENTIRE pre-existing note render path (plain fold + separate dashed line) had NEVER been jar-verified (zero ratchet pins ever used a note). Landed Kind A in full: byte-exact Opale zigzag-notch geometry (`note-opale.ts`, new -- `opalePolygonLeft`/`Right`/`opaleCorner`, degenerate `A0,0` arcs included) + the fuzzy `BodierAbstract#getBestMatch` member-line matcher, wired into `note-layout.ts#mapNoteGeos` (host-offset/flip-corrected direction, per-row anchor math, per-member individual-width stacking fixing a pre-existing multi-tip stacking bug, drop-on-no-match with group-wide abort semantics) and a new `renderer-note.ts` (split out of renderer.ts for the 500-line cap, unwrapped tip draw mirroring `renderAssocPoint`'s precedent). Also corrected note text sizing/font GLOBALLY (both tip and plain notes: `plantuml.skin`'s real `FontSize 13`/`LineThickness 0.5`, `Opale.java`'s real marginX1/X2/Y formula -- previously invented, never verified) and dropped-note ink-extent exclusion. `core/svg.ts#path()` widened with an optional `fill` field (purely additive) for the Opale outline's real background fill. Byte-verified against `cajicu-52-cego765` (both notes, RIGHT and flip-corrected LEFT direction) and `tenobo-24-liga464` (3-tip, 2 merged on one side -- closest near-miss, 3 diffs, traced to the unrelated already-named creole-bold gap). Full-corpus regression scan confirmed 0 zero-diff regressions; 22 fixtures' diff counts rose via the SAME childCount-unmasking pattern every iteration since N2 has recorded, onto a NEWLY-CONFIRMED (via disposable-worktree pre-existence check) classifier-width bug near note-connected classifiers (18-174px deltas), named as the top N14 target. Deferred, fully diagnosed: Kinds B/C (general "opalisable" single-link note, likely the majority of the corpus's remaining plain-note fixtures) and Kind D (`note on link`). | 0 new zero-diff (every target fixture blocked by the newly-confirmed classifier-width bug or the already-named creole gap); census 58/718 (unchanged) · 1-3:44 · 4-10:169 · 11-30:35 · 31+:412 | done |
| N14 | Classifier-width bug (N13's top priority, LANDED): `sectionWidth`/`buildSectionRows` gated the icon-zone reservation per-SECTION (`MethodsOrFieldsArea#hasSmallIcon`), not per-row/unconditionally -- the previous unverified `ICON_WIDTH=18` constant was simply WRONG (correct value 14, `getCircledCharacterRadius()+3`), jar-verified two ways (`ducoka-05-cuce457`'s "Test Two": 93.7 -> 75.7 exact; `canuti-20-jotu614`'s "Aaa": 188.4 exact only with +14). DOT gate re-verified unchanged (708/708) despite the width-formula change. General "opalisable" single-link note (Kind C, N13's second priority) LANDED: `note-opale.ts` gained `opalePolygonUp`/`Down`/`getOpaleStrategy` (byte-exact ports) + `resolveOpaleConnector`/`buildOpaleNoteGeo`; found and fixed THREE sub-bugs while jar-verifying (a per-edge `noArrow` DotInputEdge attribute so graphviz-ts stops reserving its default ~10px arrowhead-clip gap for note connectors, `graph-layout.ts`/`.types.ts`; a wrong `UPolygon`-vs-`UPath` note ink-extent rule, `layout-ink-extent.ts`; a `textLength` floating-point rounding gap). `fezugi-39-fujo327`/`sapodo-57-voda654` reduced from 65+ diffs to exactly 1 (blocked only by the shared, already-named `GMN\d+` note-id generation gap). Two files split to stay under the 500-line cap (`class-member-rows.ts` new, out of `class-layout-helpers.ts`; `resolveOpaleConnector`/`buildOpaleNoteGeo` moved into `note-opale.ts`). Full-corpus regression scan: 158 improved / 8 regressed (all already 31+ bucket before AND after, 0 zero-diff regressions, each traced to an already-named or newly-but-separately-scoped pre-existing mechanism) / 552 unchanged. | 7 new zero-diff (`cojixe-63-vejo525`, `dulavu-67-falo747`, `goveba-73-tixi419`, `paburu-52-feso968`, `ponaxo-71-muze275`, `sipimu-09-joma900`, `zijupe-74-sake513`, ALL from the width fix -- Kind C landed 0 new zero-diff, blocked by the shared GMN-id gap); census 65/718 (was 58/718) · 1-3:52 · 4-10:170 · 11-30:44 · 31+:387 | done |
| N15 | `GMN\d+` note-id phantom-slot mechanism LANDED (N9/N14's top priority): `net.atmp.CucaDiagram#cpt1` is ONE shared counter behind BOTH every real `Entity`'s own `ent%04d` uid AND `getUniqueSequence("GMN")` (a phantom quark-code slot `CommandFactoryNoteOnEntity.java:327` burns BEFORE its own entity slot, for every non-tip attached note -- `CommandFactoryNote`/`CommandFactoryTipOnEntity` have no GMN call). `ast.ts#ClassNote.creationIndex`/`.phantomSlot` + `renderer-uid.ts#assignExact`'s new `'phantom'` Ranked entry (consumes a numbering RANK without writing any uid -- dense re-numbering must NOT collapse this gap the way it correctly collapses a genuinely absent phantom classifier stub). `class Foo [[url]]`/`[[url{tooltip} label]]`/`url of Foo is [[...]]` link-wrap grammar LANDED (README item #7, classifier-level scope): byte-exact 5-way `UrlBuilder.java` grammar port (`class-url.ts`), `Classifier.url` threaded through AST/geo (including the `degenerateSingleClassifier` shortcut path, missed on the first pass), new `core/svg.ts#linkWrap` primitive + `renderer-url.ts#wrapClassifierUrl` (split out since `renderer.ts` is over the 500-line cap) wraps a classifier's whole box content in ONE `<a>` when it has a url and no member row needs a per-row split (visibility icon or its own unmodeled `[[[url]]]`) -- jar-verified byte-exact against `tegoxa-17-kudo421`/`gavimi-70-nuju057`; the per-row-split guard itself was jar-verified NECESSARY via `fugexa-12-zoti674`/`gukuda-51-fuju086`'s childCount mismatch when first omitted. Both DOT gate (708/708) and description ratchet (51/51) re-verified unchanged after each priority. Full-corpus regression scans: Priority 1 31 improved/2 regressed (same-bucket unmasking)/685 unchanged; Priority 2 3 improved/5 regressed (4 same-bucket unmasking on an already-known graphviz-ts-adjacent multi-classifier family; 1 genuine bucket regression, `rakuci-96-tuti371` 11->173, root-caused via byte-diff to a CORRECT new `<a>` wrap unmasking the separate, newly-confirmed namespace/cluster-level url-wrap gap -- kept per this mission's established unmasking precedent, not reverted)/710 unchanged; 0 zero-diff regressions in either scan. | 5 new zero-diff (`fezugi-39-fujo327`, `jobeto-69-dutu189`, `sapodo-57-voda654`, `sicege-73-zete701` -- Priority 1; `tegoxa-17-kudo421` -- Priority 2); census 70/718 (was 65/718) · 1-3:48 · 4-10:169 · 11-30:43 · 31+:388 | done |
| N16 | (retroactive minimal note, G2 N17 backfill -- see `ledger.md` N16 for the full gap description) Member-level `[[[url]]]` per-row `<a>` runs (`stripUrlSuffix` now PARSES the bracket into `Member.ownUrl`, was presence-only; new `renderer-classifier-box.ts` builds url-tagged primitives, `wrapClassifierBody` merges consecutive same-url runs) + Kind B freestanding-note Opale wiring (`note as N1` + a plain relationship line feeds the SAME `isOpalisable` gate Kind C uses, consumed edges FLAGGED not removed per the N15 phantom-slot principle) + the package/namespace folder-tab shape MAJOR FINDING deferred to N17 (104/718 fixtures, DOT-cluster-label-margin hypothesis stated but not verified). Per the commit message only (`e0e5f54`) -- no ledger/README/decision-journal entries were written during the iteration itself. | 5 new zero-diff; census 75/718 (was 70/718) · 1-3:41 · 4-10:169 · 11-30:45 · 31+:388 | done |
| N17 | Package/namespace folder-tab SHAPE landed (largest single mechanism this mission has found, 104/718 direct reach): new `class-namespace-shape.ts` re-expresses `USymbolFolder`'s already-verified tab-notch geometry (`getWTitle`/`getHTitle`/`folderPathD`/`getTitleBaselineOffset`) as pure SVG-string builders, byte-verified against `finono-05-cuvu171`'s exact `<path>`/`<line>`/`<text>` triple; `theme.ts#packageBorder` default corrected `#999999` -> `#000000` (class-only consumer, jar-verified). Outer FOOTPRINT formula derived with jar evidence (dot-cache label dims + direct SVG geometry across 8+ single-classifier single-package fixtures, per the brief's own method): `topPad = getHTitle(...) + 13` (was an invented flat `28`) -- verified on TWO independent font sizes (14pt: htitle=20 -> 33px gap; `skinparam package{FontSize 40}`: htitle=46 -> 59px gap), `NAMESPACE_SIDE_PADDING=16` unchanged on left/right/bottom. The brief's own named "41px vs 33px" pair RESOLVED (not a 3rd formula value): 41px (`pecabi-95-demu756`/`bajotu-30-soku184`) is a package-as-relationship-endpoint anchor node occupying an extra graphviz rank slot inside the cluster, confirmed via `class-dot-graph.ts#buildDotClusters`'s own pre-existing "extra direct member" comment -- NOT landed (needs `anchors` threaded out of `buildDotGraph`, named remainder). DOT gate confirmed EMPIRICALLY unmoved (`svek-dot.ts#compareStructural`'s `clusterOk` never reads label dims at all) per the brief's own caution. Full-corpus scan (104 package-bearing fixtures, disposable worktree): 22 improved / 24 regressed / 58 unchanged / 0 zero-diff regressions -- every regression traced to the anchor case, the title-driven-width case (`pixexi-81-sete111`, NEWLY SURVEYED), `skinparam style strictuml` (`jinibe-02-tebi269`'s `<polygon>` variant, unbuilt), or a package stereotype (`domeki-03-zaga732`, NEWLY DISCOVERED, `Namespace` has no stereotype field). | 0 new zero-diff (every package fixture near zero blocked by a named-not-landed sub-case); census 75/718 (unchanged) · 1-3:43 · 4-10:166 · 11-30:47 · 31+:387 | done |
| N18 | Worked N17's 5 package/namespace sub-cases in priority order. LANDED: (1) a SIXTH, previously-unflagged mechanism found while jar-verifying the anchor case -- namespace title `<text>` was missing `textLength`/`lengthAdjust` and used CSS `font-weight="bold"` instead of jar's actual `"700"` (N17's own "byte-verified" claim never actually checked these; corpus-wide, 0/184 fixtures use `"bold"`, 184/184 use `"700"`) -- `core/svg.ts#TextStyle.fontWeight` widened additively, `renderNamespaceFolder` now computes `textLength` from the already-stored `wtitle` (no new measurer needed). (2) `skinparam packageFontSize`/`packageFontColor`/`packageBorderThickness` threaded into the folder-tab title/outline -- FontSize/FontColor read the PRE-EXISTING generic per-element bucket (`colors.elements.package`, G1 I4b) shared with description's package/folder rendering (an early attempt to add dedicated class-only fields broke a passing test and was reverted), BorderThickness got a genuinely new dedicated theme field. (3) `skinparam style strictuml`'s sharp-corner `<polygon>` folder-tab variant (base case) -- new `folderPolygonPoints`/`renderFolderPolygon`, byte-verified against `jinibe-02-tebi269`'s exact `points="16,6,29.7875,6,..."` output; new `theme.strictUml` field. DIAGNOSED-NOT-LANDED (both instrumented per diagnosis.md before concluding): the anchor-in-cluster footprint's MATH is now correctly wired (`DotGraphParts.anchors` threaded out of `buildDotGraph`, folded into `buildNamespaceGeos`'s min/max walk, unit-tested) but full jar parity is BLOCKED -- this port's own graphviz-ts places the anchor BELOW its sibling classifier (opposite of real graphviz), confirmed via direct `layoutGraph()` instrumentation and a nodeIds-reorder experiment (zero effect) -- a graphviz-ts rank-assignment divergence, same OUT-OF-SCOPE category as the N8-named coordinate-assignment offset. The title-driven package width floor (`pixexi-81-sete111`) is CONFIRMED BLOCKED -- `graphviz-ts`'s public `addSubgraph` API has no numeric label-width parameter at all, so real graphviz's label-width-aware centering cannot be reproduced without a graphviz-ts API change; a pure post-layout width-floor was considered and rejected as not payoff-positive (classifier would still sit at the wrong x). SURVEYED, NOT LANDED: package/namespace stereotype -> `PackageStyle` dispatch + `skinparam packageStyle` -- full Java mechanism read and documented (`Stereotype.getPackageStyle()`'s exact priority rule vs. the flat skinparam, all 12 `PackageStyle` draw routines, RECTANGLE's footprint-formula-UNCHANGED confirmation via `domeki-03-zaga732`) but RECTANGLE's own title-centering + border-color resolution are unverified sub-mechanisms, not a simple shape swap -- deferred rather than landing an unverified partial. NEWLY DISCOVERED: strictuml also appears to suppress the classifier spot-badge (jar 4-child box vs. this port's unconditional 6-child badge box under strictuml, confirmed PRE-EXISTING via the first diff run before any code change) -- a separate, larger mechanism than the corner shape, unsurveyed reach. Package-population re-scan (104 fixtures, disposable worktree): 37 improved / 1 regressed (`jinibe-02-tebi269`, the newly-discovered badge-suppression unmasking) / 66 unchanged / 0 zero-diff regressions. | 0 new zero-diff (every remaining package fixture blocked by a newly-named-and-narrower sub-case); census 75/718 (unchanged) · 1-3:43 · 4-10:166 · 11-30:47 · 31+:387 | done |
| N19 | Couples/lollipop synthetic-entity naming (largest tractable named mechanism, deferred since N9): fresh sub-classification (35 fixtures total: 11 single-coupling, 9 repeat-coupling, 2 double-couple, 13 lollipop). LANDED single-coupling `Association#createNew` naming (jar `"apoint"+N`, N = the raw shared jar counter value at a phantom slot, NOT a dense rank -- traced via `SvgGraphics#applyGroupAttribute`: the classifier's own `<g id>` uses the UNAFFECTED `ent%04d` uid, only the edge's inner `<path id>` (`Link#idCommentForSvg`) reads the name) + lollipop `CommandLinkLollipop` naming (`"<existing>lol"+N`), both via new `Classifier.syntheticIdName`/`.phantomSlot`/`.noUidSlot`/ `.subsumedLinkCreationIndex` + `Relationship.phantomSlot` fields, a `renderer.ts#linkIdForSvg` synthetic-name resolver, and a `renderer-uid.ts#assignExact` phantom-rank extension reusing N15's GMN pattern. Found and fixed TWO additional real jar phantom burns while verifying (`createNew`'s own synthetic default-link when no explicit A-B association exists to subsume; a SUBSUMED explicit association's own creationIndex, previously silently collapsed by dense re-numbering -- see `ledger.md` N19). A required reorder (`ensure(c)` before the circle's phantom burns, matching jar's real quark-resolution order) also fixed a pre-existing C-vs-circle render-order mismatch as a side effect. Repeat-coupling and double-couple deferred (both burn cpt1 in a DIFFERENT relative order, fully diagnosed, not attempted); lollipop's OWN missing display-label text NEWLY DISCOVERED (masks the id fix from `compareSvg`'s diff count entirely via childCount-bail, though the `<path id>` string is independently unit-verified byte-exact). Full-corpus scan: 19 improved / 0 regressed / 699 unchanged / 0 zero-diff regressions. | 0 new zero-diff (every touched fixture blocked by graphviz-ts routing, the lollipop label gap, or another already-named mechanism); census 75/718 (unchanged) · 1-3:43 · 4-10:171 · 11-30:42 · 31+:387 | done |
| N20 | Priority 1: lollipop display-label text LANDED (all 13 target fixtures) -- `class-layout-helpers.ts#measureLollipop` (new) + `renderer.ts#renderLollipop` (new, reuses exported `renderer-classifier-box.ts#renderRow`) draw the circle wrapped in `<g class="entity">` (no `<!--class-->` comment) with the label as an unwrapped sibling AFTER `</g>`, byte-verified against `bososa-44-fipu544`. Half-circle socket (`lollipopKind: 'half'`) confirmed ZERO reach corpus-wide, not implemented. Priority 2: repeat-coupling burn order LANDED (all 9 target fixtures) -- read `createSecondAssociation`/`createInSecond`/`Link#getInv()` directly (not just N19's summary), discovering `getInv()` burns a NEW cpt1 slot AND reorders the draw sequence (`removeLink`/`addLink`, not an in-place mutation) -- `class-assoc-couple.ts`'s `!isRepeatCouple`/`!forceCircleToClass` guards removed (the SAME single-coupling burn code now covers repeat-coupling too), new `invertPriorClassEdge` splices+re-pushes the prior circle's class edge when the conditional getInv() fires, two new classifier-level phantom-rank fields (`invertedClassEdgeOldCreationIndex`/`repeatCoupleInvisLinkCreationIndex`) feed `renderer-uid.ts`. Jar-verified `<path id>` sequence (values AND order) exact on all 9 fixtures. `class-assoc-couple.ts` split into a new `class-assoc-subsume.ts` (pure move, this iteration's own 500-line-cap overflow). Priority 3 (double-couple, 2 fixtures) diagnosed in full via direct Java read (`associationClass`'s 4-entity overload + `insertPointBetween`) -- a STRUCTURALLY DIFFERENT burn grouping (both point names before either entity) -- deferred, not attempted. Full-corpus regression scan (both priorities): 9 improved (repeat-coupling, 43-53 -> uniform 34 diffs) / 13 regressed (lollipop, the SAME childCount-unmasking pattern every iteration since N2 has recorded) / 696 unchanged / 0 zero-diff regressions. Every regressed/improved fixture's residual diffs are EXCLUSIVELY `path/@d` edge-routing coordinates -- the pre-existing graphviz-ts offset named since N8, confirmed via grep (zero `@id`/`childCount` diffs remain anywhere). | 0 new zero-diff (both mechanisms structurally complete, blocked only by graphviz-ts routing); census 75/718 (unchanged) · 1-3:40 · 4-10:161 · 11-30:42 · 31+:400 | done |
| N21 | 1-3-diff bucket harvest (40 fixtures, per-fixture raw diff-triple classification, not just `--families` aggregation). 5 mechanisms LANDED: (1) per-line note `textLength` (`note-layout.ts#measureNote` now returns `lineWidths[]`, was one shared max-line value applied to every row); (2) `<U+XXXX>`/`&#NNN;` text-escape decode in note text (promoted `resolveTextEscapes` out of description's `parse-helpers.ts` into shared `core/text-escapes.ts`); (3) icon-row url-wrap generalization (`renderer-url.ts#wrapClassifierBody`'s N15/N16 `hasIconRow` full-bail removed -- an icon's `<g data-visibility-modifier>` now gets its OWN independent `<a>` run nested inside, via a new `UrlTaggedPrimitive.preWrapped` flag, jar-verified against `jovaxe-68-bube754`); (4) `hide-class`/`show-class` dispatch-gate widened (`class-commands.ts`'s outer `/^(hide|show)\\s/` never matched the `-class` spelling `parseHideShowPatternDirective` already supported); (5) `*` (`IE_MANDATORY`) added as a 5th visibility char in `class-member-parser.ts#stripVisibility` (was `+-#~` only) -- immediately unmasked a pre-existing, UNVERIFIED `buildHeaderRow` wider-box-centering formula bug (kept, per this mission's established unmasking precedent, named for a future iteration). Newly surveyed, not landed (explicit DOT-gate risk or shared-code/cross-diagram-type risk, each deferred): a classifier stereotype text row (`Classifier.stereotype` parsed, NEVER rendered anywhere), `skinparam diagramBorderColor` (shared `TextBlockExporter#maybeDrawBorder`, 1/718 reach), `<style> note { .class {...} } </style>` CSS-class cascade (confirmed near-total style-cascade absence for class, not partial), `remove`/`restore` dense-renumbering (needs a new phantom-rank plumbing path, 1-fixture ROI), nested `|_` member tree-list syntax, embedded diagram blocks in member text, gradient skinparam colors. Full-corpus regression scan: 11 improved / 2 regressed (mechanism 5's own named unmasking) / 705 unchanged / 0 zero-diff regressions. | 5 new zero-diff (`jovaxe-68-bube754`, `kikera-73-zoxa983`, `nekali-92-loda300`, `pacuve-18-gaso238`, `sisolu-74-minu975`); census 80/718 (was 75/718) · 1-3:34 · 4-10:160 · 11-30:42 · 31+:402 | done |

| N22 | Creole-in-member-text subsystem (deferred since N10, combined ~20+ fixture reach): reused the SHARED creole atom engine (`classifyStripeLine`/`buildStripeAtoms`/`buildLiteralAtoms`, built for description by E2r) behind a NEW class-local adapter (`class-member-creole.ts#buildMemberRow`) since class's renderer is a pure-string SVG builder, architecturally incompatible with description's klimt/`TextBlock` adapter (`buildTextBlock`) -- upstream mirror: `MethodsOrFieldsArea#createTextBlock`'s `CreoleMode.SIMPLE_LINE`, which this port's `classifyStripeLine` already reproduces exactly (the two FULL-only patterns it differs by were never ported for EITHER mode). Landed: inline creole markup in member rows (`<b>`/`<color>`/`<size>`/`--strike--`/inline `[[url]]`) -- 1 new zero-diff (`mopelo-04-fose807`), 4 more fixtures reduced to EXACTLY the pre-existing N21-named `centerOffset` residual (text/color/width now byte-exact); a corrected N12 misdiagnosis (`!define`-macro-in-member-line was ALREADY correctly TIM-substituted -- the real gap was always just the missing creole render, not a second TIM-side bug); member-level `{abstract}`/`{static}` -> italic/underline font seeding (a third dead-field gap found while building the font seam); full sprite-atom (`<$name>`) measurement+render wiring via the ALREADY-POPULATED-but-never-consumed `ast.sprites` registry + a new `core/svg.ts#image()` primitive -- unit-tested, zero fixture-level reach this iteration (every corpus sample pairs `<$name>` with the still-unbuilt `<&glyph>` OpenIconic syntax on the same row). Measurement-identity preserved by construction (proven empirically: the full pre-existing 983-test class suite passed unchanged, zero edits). Full-corpus regression scan: 7 improved / 7 regressed (all diagnosed -- 4 the N21 centerOffset residual, 1 the `<&glyph>` gap making a width number closer-but-still-wrong which unmasked more comparator detail, 1 a newly-confirmed separate `skinparam class{AttributeFontSize/Name}` dead-skinparam gap, 1 incidental noise on an already-99-diff fixture) / 704 unchanged / 0 zero-diff regressions. | 1 new zero-diff (`mopelo-04-fose807`); census 81/718 (was 80/718) · 1-3:31 · 4-10:157 · 11-30:43 · 31+:406 | done |
| N23 | Root-caused the `centerOffset`/`buildHeaderRow` wider-box-centering bug (N21-named) by reading `HeaderLayout.java#drawU` directly instead of re-deriving: the real formula splits the slack ASYMMETRICALLY (`h2 = min(circleDim.width/4, suppWith*0.1)`, `h1 = (suppWith-h2)/2`) -- the badge moves by `h1` alone, the header text moves by `h1+h2` -- NOT a shared `centerOffset`. New `ClassifierGeo.rows[].badgeIndent` field (`renderBadge` reads it directly, replacing N4's now-invalid "reverse the text row's indent" trick). Jar-verified byte-exact on 3 independent samples. Also LANDED `skinparam class { AttributeFontSize/AttributeFontName }` (N22-named dead skinparam) -- found it was never even PARSED (not just unconsumed); surprisingly overrides the header text too, not just member rows (jar-verified). Surveyed, deferred (explicit DOT-gate/width-formula risk, only 2/718 reach): the classifier stereotype text row -- Mechanism 1's derivation now gives the exact formula it needs (`HeaderLayout#getDimension`'s `stereoDim` term), named for a dedicated future iteration. Item 4 (double-couple burn order) not attempted -- time budget consumed by two DOT-gate empirical-check passes. Full-corpus regression scans (both mechanisms): 0 regressions of any kind -- Mechanism 1 corrects a wrong-but-close approximation to an exact formula (position-only, cannot regress structure), the FIRST iteration since N2 with a clean "0 regressed" scan. | 20 new zero-diff (19 Mechanism 1 + 1 Mechanism 3); census 101/718 (was 81/718) · 1-3:51 · 4-10:167 · 11-30:47 · 31+:352 | done |

| N24 | 51-fixture near-zero harvest (per-fixture raw diff-triple classification). LANDED: classifier header stereotype text row (the mechanism N21/N22/N23 named and deferred every time, N23's own Mechanism 2 -- full jar formula derived via `HeaderLayout#getDimension`/`#drawU`, `EntityImageClassHeader.java`, `StereotypeDecoration#buildComplex`; NEW `class-stereotype.ts` -- label split/measure/layout + `(CHAR,COLOR)` circled-char-decoration stripping so the badge-customization syntax doesn't draw as garbage text; `buildHeaderRow`/`computeHeaderInfo` MOVED there from `class-layout-helpers.ts`, new `ClassifierGeo.headerRowCount` threaded through BOTH `buildClassifierGeos` AND the separate `degenerateSingleClassifier` path); the post-hoc `<Name> <<stereotype>>` statement (upstream `CommandStereotype`, NEW `class-stereotype-command.ts`, required for `zejize-00-vivu578`); `hide|show [<<pattern>>] stereotype(s)` (upstream `CommandHideShowByGender`'s `PORTION=stereotype` slice -- landed specifically to fix a ZERO-DIFF REGRESSION this iteration's own full-corpus scan caught on `rudoxi-65-cegi339`, diagnosed BEFORE any code change per diagnosis.md); two pre-existing bugs found jar-verifying the above (fully-suppressed-classifier height had a spurious `+4`, unrelated badge-`cy` `28`-constant fallback, BOTH jar-verified on independent stereo AND no-stereo samples); two bugs caught by writing tests AFTER implementation (a hide-stereotype-vs-entity-pattern dispatch-order collision on the bare `hide stereotype` form; the degenerate-path `headerRowCount` field-drop, which the 20 pinned fixtures happened not to expose). Surveyed, NOT landed (each named for a future iteration): `(CHAR,COLOR)` circled-char BADGE customization itself (6 reach), relationship multiplicity/cardinality text render (~28/718 corpus-wide, NEWLY SURVEYED -- measured for DOT sizing only, never drawn), `hide C2 circle`/entity-qualified compound hide, undefined-entity arrow-notation variants (4 direct), note/rect explicit background-color override (3), `skinparam guillemet` (NEWLY DISCOVERED via regression scan, 4), `skinparam classStereotypeFontSize/FontStyle` (NEWLY DISCOVERED, 1). Full-corpus regression scan: 38 improved / 16 regressed (all diagnosed, each traced to an already-named or newly-discovered SEPARATE mechanism) / 662 unchanged / **0 zero-diff regressions**. | 20 new zero-diff (`canoca-50-rufa568`, `cuxuni-25-doxi736`, `difuxu-77-rumu307`, `gajudo-04-lere501`, `giruzo-13-daga579`, `jigafa-29-cusa565`, `jiveta-48-palo127`, `katori-46-dobu700`, `maziju-71-cava125`, `mebezo-52-votu818`, `menejo-70-tazo448`, `nebovu-26-caxe550`, `nucido-62-nodu514`, `pajuba-83-roji161`, `salupu-93-neja895`, `tomoje-73-xoti295`, `vofuni-60-pepo292`, `vuzeka-73-celo405`, `xibibe-37-regi626`, `zejize-00-vivu578`); census 121/718 (was 101/718) · 1-3:48 · 4-10:165 · 11-30:53 · 31+:331 | done |

## Standing rules

Upstream spec: jar cached SVGs + `~/git/plantuml/src/main/java/net/`
(grep `net/`, never just `net/sourceforge/plantuml/`; class model lives
in classdiagram/ + net/atmp/CucaDiagram). Fix at origin. graphviz-ts
OUT OF SCOPE. Complexity playbook, TDD, git-archive baselines. Ledger:
plans/g2-class-svg/ledger.md.

## Re-baseline (2026-07-16, post class-cache re-capture)

N3 proved the class dot-cache was stale (pre-deterministic-text-patch);
orchestrator re-captured via `dot-sync-report.ts --rebuild class`
(decision-journal 2026-07-16). DOT gate verified EXACT against the fresh
oracle (708/708; all five counts unchanged). Fresh-oracle baseline:

```
0 / 718 conformant · 1-3: 16 · 4-10: 269 · 11-30: 55 · 31+: 378 · errors: 0
```

The fresh jar's textLength matches this port's WidthTableMeasurer
per-character — zero-diff is now reachable. N4+ drill against THIS
baseline; the pre-re-capture bucket lines in N0-N3 rows are historical.

## N5 candidates (queued, per N4's ledger "not fixed" section) — STATUS

1. ~~`svg/@viewBox`/`@height`/`@width`~~ — **N5 landed** (ink-extent
   recipe, `class/layout-ink-extent.ts`). Reach dropped 680/656/670 →
   598/540/483. NOT fully closed — two named residuals below.
2. ~~`svg/g/g/path/@d`~~ — **N5 landed** (bezier `C` commands, was `L`
   polyline). Fixture reach unchanged (417/718: the underlying
   graphviz-ts-vs-real-graphviz ROUTING divergence is genuinely
   out-of-scope, per CLAUDE.md), but the RENDERING format itself is now
   correct — the family's diff COUNT going up (71289→74825) is the
   comparator now doing real per-number comparison instead of bailing on
   command-letter mismatch (M,L,L,L vs M,C,C,C), unmasking the
   pre-existing routing gap rather than creating a new one.
3. **`svg/g/g[childCount]` (351/718 at N4)** — not re-classified against
   the N5 baseline; likely still entangled with #4 below plus un-audited
   USymbol/map/json chrome.
4. ~~**Visibility icon shape/color/fill-vs-stroke**~~ — **N6 landed**
   (`class/class-visibility-icon.ts`). 2 new zero-diff pins
   (`sigoji-75-mojo941`, `xemupo-45-misi775`); skinparam icon-color
   overrides + `classAttributeIconSize` still NOT wired (1/718 reach,
   deferred).
5. **Edge `<path>` `@id`/`@codeLine`** (named since N2, still unfixed).
6. **`muteClassifierToGroup` creationIndex off-by-one** (N2's diagnosis,
   still unfixed).
7. **`class Foo [[URL{label}]]` link wrapping** — genuinely unbuilt
   feature (22/718 reach), needs parser + layout + render work.
8. **N5's own residuals, named for N6**:
   - Canvas-dims ink-extent recipe is NOT complete: arrowhead-polygon
     ink contribution (`HACK_X_FOR_POLYGON=10`, x-only) and edge-label/
     row `UText` ink are not modeled — small (typically 0-2px) residuals
     on edge-bearing / labeled fixtures (`dumubu-48-zagi954` etc, see
     `layout-ink-extent.ts`'s own doc comment).
   - `<style> classDiagram { BackGroundColor ... }`/`root { ... }`
     diagram-type-selector background resolution is NOT wired
     (`bikuka-40-pezi068`/`cilaba-36-zogi212`/`zirori-93-jefo337`, 3
     fixtures, `svg/@background` mismatch) — `resolveDocumentBackground`
     only checks `document`/`<type>diagram.document` selectors, not a
     bare diagram-type-name selector (`classDiagram`) or `root`; a
     shared-code (`style-map-element.ts`) change, deferred for
     cross-diagram-type verification time.
   - `hide`/`show` `$tag`/wildcard edge cases (`hide-class`, `hide $*` +
     `show $txn`, `hide *` + `show $z`, `hide aaa` while `aaa`
     participates in a relationship) each show a childCount off-by-one —
     5+ DIFFERENT small mechanisms in the tag/wildcard hide/show
     subsystem, not one shared bug; named, not triaged individually.

## N6 queue (queued, per N6's ledger "not fixed" section) — for N7

1. **Note-of-member connector shape** (`note X of Class::member`): custom
   zigzag connector merged into the note's own outline `<path>`, note drawn
   UNWRAPPED (no `<g class="entity">`); jar silently DROPS a note attached
   to a nonexistent member. ~12-20 fixture reach.
2. **`(A,B)` n-ary "point" association entities**: drawn as a plain 2px
   `<ellipse>`, not a classifier box — genuinely unbuilt entity kind, ~10
   fixture reach.
3. **`class Foo [[URL{label}]]`/`url of Foo is [[...]]` link wrapping**
   (README item #7, unchanged) — ~22/718 reach.
4. **`hide`/`show` `$tag`/wildcard/namespace-nested edge cases** (unchanged
   from N5) — 5+ distinct mechanisms.
5. **`<style> classDiagram {}`/`root {}` background selector** (unchanged
   from N5, 3 fixtures) — deferred pending cross-diagram-type verification.
6. **Arrowhead-polygon + edge-label ink contribution to canvas dims**
   (named since N5, not drilled N6) — typically 0-2px residuals.
7. **Visibility-icon skinparam color overrides** (`skinparam
   icon<Kind>Color`/`icon<Kind>BackgroundColor`) + `classAttributeIconSize`
   — 1/718 reach (`lufide-34-cexu026`).
8. **`Collection<T>` + `skinparam monochrome reverse` + transparent
   background** (`bedogi-86-kala547`) and **`'Liberation Mono'`
   font-family malformed-attribute bug** (`tipude-10-tizi427`) — both
   single-fixture, unsurveyed.
9. **Edge `<path>` `@id`/`@codeLine`** (named since N2, still unfixed).
10. **`muteClassifierToGroup` creationIndex off-by-one** (N2's diagnosis,
    still unfixed).

## N7 queue (queued, per N7's ledger "not fixed" section) — for N8

1. **`(A,B)` n-ary "point" association entities** — NARROWED this
   iteration: parser/DOT already correct (two `assoc-circle` classifiers,
   matches jar exactly, frozen DOT gate already covers it). Pure
   render-layer gap, three parts: (a) no `kind === 'assoc-circle'` special
   case in `renderer.ts` (falls through to a full classifier box instead
   of a bare `<ellipse rx="2" ry="2">` dot, no `<g>` wrapper); (b) edges
   touching an assoc-circle need PLAIN undecorated lines (solid to A/B,
   dashed to the outer entity), not the default dependency-arrow
   decoration; (c) the circle-to-circle connector edge must render
   INVISIBLE (exists in both DOT graphs per the frozen gate, jar just
   never draws it). ~10 fixture reach, best next pickup (scoped, no open
   unknowns).
2. **Note-of-member connector shape** (~12-20 reach) — deep, see N7's
   ledger entry for the full three-piece uncertainty (Opale zigzag math,
   SvekNode-relative coordinate derivation, dropped-note space-reservation
   ambiguity).
3. **`class Foo [[[url]]]`/`url of Foo is [[...]]` link wrapping**
   (README item #7, unchanged) — ~22/718 reach, dedicated-iteration scope
   (5-way URL regex grammar).
4. **`hide`/`show` COMPOUND qualifier forms** (`hide C2 circle`, `hide
   class circled`, `hide <<even>> methods`, `hide private/public/protected
   members`) — distinct upstream command family
   (`CommandHideShowByGender`/`CommandHideShowByVisibility`), not the
   `CommandHideShow2` mechanism N7 landed.
5. **N7's own two new residuals**: element-level `classDiagram {
   BackGroundColor / LineColor }` style cascade to individual classifier
   boxes (not just canvas background, `bikuka-40-pezi068`/
   `cilaba-36-zogi212`); ~7-8px multi-component/namespace-cluster
   position/height offsets unmasked by both landed mechanisms
   (`cikeni-99-kojo447`/`cixote-08-vope282`/etc — may overlap N5's named
   arrowhead-ink residual, not cross-checked).
6. **`skinparam mode dark`** (`zirori-93-jefo337`) — newly discovered,
   full alternate color-table resolution, unrelated to `<style>`
   selectors; was misclassified into the N6 background-selector cluster.
7. **Arrowhead-polygon + edge-label ink contribution to canvas dims**
   (named since N5, still not drilled).
8. **Edge `<path>` `@id`/`@codeLine`** (named since N2, still unfixed).
9. **`muteClassifierToGroup` creationIndex off-by-one** (N2's diagnosis,
   still unfixed).
10. **Visibility-icon skinparam color overrides** + `classAttributeIconSize`
    (1/718 reach, N6's remainder).
11. **`Collection<T>` + `skinparam monochrome reverse` + transparent
    background** (`bedogi-86-kala547`), **`'Liberation Mono'` font-family
    malformed-attribute bug** (`tipude-10-tizi427`) — both single-fixture,
    unsurveyed.

## N9 queue (queued, per N9's ledger "full-corpus scan" section) — for N10

1. **Couples/apoint + lollipop synthetic entity-id naming** — ~24/718
   reach combined. Jar names association-class-couple "point" entities
   `apointN` and lollipop-generated entities `<childname>lolN`; this port's
   `__assocN`/`__lolN` placeholders never get renamed to match. A distinct
   subsystem (synthetic entity id generation at creation time), not an
   arrow-direction/decor mechanism.
2. **Note-connector structural gap** (~19/718 reach, unchanged scope from
   N6/N7's "note-of-member connector shape" item, now confirmed to ALSO
   cover bare note-to-classifier arrows like `N4 .> DrawableAdapter`, not
   just `note X of Class::member`) — jar draws NO `<g class="link">` at all
   for a note-touching edge; folded into the note's own drawing or governed
   by a `GMN\d+` auto-generated note-id scheme this port doesn't have.
3. **`hide`/`show $tag` edge-suppression gaps for note-touching edges**
   (unchanged from N5-N8's "hide/show $tag/wildcard edge cases", ~3-5/718
   reach newly re-confirmed) — an edge from a SHOWN note to a HIDDEN
   classifier is not suppressed (should be, per `Link#isHidden`'s
   OR-with-endpoint rule already ported for classifier-to-classifier edges).
4. **`!pragma layout elk`** (~4/718 reach, NEWLY discovered N9) — jar's SVG
   structure differs entirely under the ELK layout pragma (zero
   `<g class="link">` elements at all, vs this port's normal dot-routed
   output); pre-existing, unrelated to any single mechanism, needs its own
   scoping pass to determine whether ELK support is even in scope.
5. **`[hidden]` explicit style-bracket on an edge** (`A -[hidden]- B`,
   NEWLY discovered N9, 1+ reach) — parsed (`ARROW_STYLE`) and discarded;
   nothing suppresses drawing. Distinct from the couple's own `invis` field
   (N8) — needs its own `hidden` flag threaded from the style bracket
   through to `EdgeGeo`/render suppression.
6. **`skinparam groupInheritance`** (NEWLY discovered N9, 1+ reach) — jar
   groups/merges duplicate identical inheritance edges under this
   skinparam; this port draws separate uniq-suffixed edges instead.
7. **`class Foo [[[url]]]`/`url of Foo is [[...]]` link wrapping**
   (unchanged, ~22/718 reach) — 5-way URL regex grammar, dedicated-iteration
   scope.
8. **Note-of-member connector shape** (~12-20 reach, unchanged from N6/N7) —
   Opale zigzag-notch polygon + fuzzy substring member matching +
   unresolved SvekNode-relative coordinate math.
9. **`hide`/`show` COMPOUND qualifier forms** (unchanged from N7) —
   `CommandHideShowByGender`/`CommandHideShowByVisibility`, distinct
   upstream command family.
10. **Element-level `classDiagram { BackGroundColor / LineColor }` style
    cascade to individual classifier boxes** (unchanged from N7).
11. **~7-8px multi-component/namespace-cluster position/height offsets**
    (unchanged from N7, may overlap the graphviz-ts coordinate-assignment
    offset named since N8 — not cross-checked).
12. **`skinparam mode dark`** (unchanged from N7).
13. **Arrowhead-polygon + edge-label ink contribution to canvas dims**
    (unchanged, named since N5).
14. **Visibility-icon skinparam color overrides** + `classAttributeIconSize`
    (unchanged, 1/718 reach).
15. **`Collection<T>` + `skinparam monochrome reverse` + transparent
    background**, **`'Liberation Mono'` font-family malformed-attribute
    bug** (unchanged, both single-fixture, unsurveyed).
16. **sadamo-18-siva346** (NEWLY discovered N9) — a pathological/degenerate
    generics-heavy stress fixture producing 100+ duplicate relationship
    ids; likely unrelated to any real mechanism, low priority, needs a
    dedicated look to confirm it isn't hiding a genuine parser bug (infinite
    or near-infinite generic instantiation?).
17. **graphviz-ts coordinate-assignment ~7px offset** (unchanged since N8) —
    OUT OF SCOPE per CLAUDE.md (graphviz-ts pinned .tgz); candidate for an
    upstream graphviz-ts issue.

## N10 queue (queued, per N10's fresh full-corpus sub-classification +
## ledger "not fixed" section) — for N11

1. **~7-8px multi-component/box position/margin residual** — UPGRADED to
   top priority this iteration: the fresh full-corpus sub-classification
   confirms it (or something producing the identical byte-signature) is
   the dominant driver of the coarse `svg/@viewBox`/`@width`/`@height` +
   coordinate-family diffs across the MAJORITY of the 543 untagged
   non-conformant fixtures — not just couple/namespace-cluster edge cases
   as previously scoped (N7). Confirmed via 2 freshly-obtained samples
   (`ducoka-05-cuce457`, `pasova-33-toze386`) reaching the SAME 7px
   box-position gap once their childCount is independently fixed. Needs a
   debug-instrumented oracle rebuild (N5's own precedent) to trace
   `SvekResult`/`CucaDiagram` margin application exactly — genuinely the
   highest-value target remaining, but expensive.
2. **`class-member-parser.ts#parseMemberLine` drops non-canonical member
   syntax** (NEWLY DISCOVERED N10) — Java-style `Type name` (space-
   separated, no colon, e.g. `String a1`) and trailing-punctuation
   (`Date d;`) member lines silently return `null` and vanish from the
   AST entirely. Found via a regression trace, NOT a targeted scan — reach
   unsurveyed, minimum 3 fixtures confirmed
   (`cuxuni-25-doxi736`/`difuxu-77-rumu307`/`nebovu-26-caxe550`). Needs a
   semantic decision (Java-style-declaration grammar extension vs. a
   raw-text fallback matching upstream's actual "never decompose, just
   bucket method-vs-field" model) before fixing.
3. **`hide private/public/protected members`** compound-qualifier hide
   (unchanged since N7, `CommandHideShowByGender`/
   `CommandHideShowByVisibility`) — ~8/718 reach (this iteration's grep),
   distinct upstream command family from the `hide empty *` mechanism N10
   just landed.
4. **Sprite/font-awesome icon glyphs inside a member text line**
   (`<$Netw>`/`<&x>`/`<$star*0.25>`) — NEWLY OBSERVED N10, unsurveyed reach.
5. **`!define`-macro used inline inside a member declaration line**
   (`ClassX : SHOW_TYPE(foo) size()`) — NEWLY OBSERVED N10, unsurveyed TIM-
   expansion gap.
6. **Note-of-member connector shape** (~19/718 reach, unchanged since
   N6-N9).
7. **Couples/apoint + lollipop synthetic entity-id naming** (~24/718
   combined, unchanged since N9).
8. **`class Foo [[[url]]]`/`url of Foo is [[...]]` link wrapping** (~22/718,
   unchanged since N6-N9, dedicated-iteration scope).
9. **`!pragma layout elk`** (~4-7/718, unchanged since N9).
10. **`[hidden]` style-bracket edge suppression** (1+/718, unchanged
    since N9).
11. **`skinparam groupInheritance`** (1/718, unchanged since N9).
12. **`skinparam mode dark`** (1/718, unchanged since N7).
13. **Visibility-icon skinparam color overrides** + `classAttributeIconSize`
    (1/718, unchanged since N6).
14. **`Collection<T>` + `skinparam monochrome reverse` + transparent
    background** (`bedogi-86-kala547`), **`'Liberation Mono'` font-family
    malformed-attribute bug** (`tipude-10-tizi427`) — both unchanged,
    single-fixture, still unsurveyed.
15. **`sadamo-18-siva346`** pathological stress fixture (unchanged since
    N9).
16. **graphviz-ts coordinate-assignment ~7px offset** (unchanged since N8)
    — OUT OF SCOPE per CLAUDE.md; may overlap item 1 above, not
    cross-checked which residual dominates on any given fixture.

## N11 queue (queued, per N11's ledger "not fixed" section) — for N12

1. **`Test Two` classifier width bug** (`ducoka-05-cuce457`, NEWLY
   DISCOVERED N11) — a classifier whose ONLY wide content is an unmarked
   (no explicit visibility char) member row measures ~18px too wide (jar
   appears to always reserve a 6px icon zone in the row-width formula, even
   when no row in the classifier uses an explicit icon). Explicit DOT-gate
   risk: fixing it changes `measureClassifier`'s width output, which feeds
   DOT node width directly — needs its own risk assessment/verification
   pass against the frozen 708/708 gate before touching, not a slice-in-
   passing fix.
2. **`kuxosa-67-keko885`'s `ent0001`/`ent0002` id+childCount swap** (NEWLY
   DISCOVERED N11, via the N11 regression scan) — a
   member-qualified-relationship-reference entity-ordering bug
   (`ClassB::b <-- pack.ClassA::a`), possibly related to but not confirmed
   identical to item 7 below (couples/lollipop synthetic naming).
3. **`scale max N height`/`width` directive** (NEWLY DISCOVERED N11, via
   the N11 regression scan, `nadaba-37-zaku242`) — entirely unimplemented;
   jar proportionally rescales the whole canvas, this port ignores the
   directive; unsurveyed reach.
4. **`class-member-parser.ts#parseMemberLine` drops non-canonical member
   syntax** (unchanged since N10) — Java-style `Type name`/trailing-`;`
   field lines silently vanish from the AST.
5. **`hide private/public/protected members`** compound-qualifier hide
   (unchanged since N7/N9/N10).
6. **Sprite/font-awesome icon glyphs inside a member text line**
   (unchanged since N10).
7. **`!define`-macro used inline inside a member declaration line**
   (unchanged since N10).
8. **Note-of-member connector shape** (~19/718 reach, unchanged since
   N6-N10).
9. **Couples/apoint + lollipop synthetic entity-id naming** (~24/718
   combined, unchanged since N9-N10).
10. **`class Foo [[[url]]]`/`url of Foo is [[...]]` link wrapping**
    (~22/718, unchanged since N6-N10, dedicated-iteration scope).
11. **`!pragma layout elk`** (~4-7/718, unchanged since N9-N10).
12. **`[hidden]` style-bracket edge suppression** (1+/718, unchanged since
    N9-N10).
13. **`skinparam groupInheritance`** (1/718, unchanged since N9-N10).
14. **`skinparam mode dark`** (1/718, unchanged since N7-N10).
15. **Edge `<path>` `@id`/`@codeLine` residual families** (couples/lollipop
    naming + note-connector gap, unchanged since N9-N10).
16. **Visibility-icon skinparam color overrides** + `classAttributeIconSize`
    (1/718, unchanged since N6-N10).
17. **`Collection<T>` + `skinparam monochrome reverse` + transparent
    background** (`bedogi-86-kala547`), **`'Liberation Mono'` font-family
    malformed-attribute bug** (`tipude-10-tizi427`) — both unchanged,
    single-fixture, still unsurveyed.
18. **`sadamo-18-siva346`** pathological stress fixture (unchanged since
    N9-N10).
19. **graphviz-ts coordinate-assignment offset** (unchanged since N8) — OUT
    OF SCOPE per CLAUDE.md; narrower now that the ink-shift is landed
    (N8's own `bosiki-11-xaza958` sample re-confirmed still diverging
    after N11's fix, DOT input still byte-equal).

## N12 queue (queued, per N12's ledger "not fixed" section) — for N13

1. **Note-of-member/freestanding-note-connector family** (13 reach in N12's
   own 1-3 bucket alone, ~19-25/718 combined with prior estimates, unchanged
   since N6-N11) — N12 captured the jar's exact merged zigzag-path SVG
   structure for `cajicu-52-cego765` (single `<path>` combining note outline
   + connector notch, no `<g class="entity">` wrapper) as concrete evidence.
2. **`class Collection<T>` generic type-parameter tag box** (NEWLY SURVEYED
   N12, ~15/718 reach) — genuinely unbuilt UML template-parameter notation
   (`TextBlockGeneric`/`HeaderLayout.java`); the classifier's own width/
   height formula also appears to reserve space for it — explicit DOT-gate
   risk, needs its own risk assessment before touching.
3. **`skinparam groupInheritance`** (reach UPGRADED N12 from N9's "1/718"
   spot-estimate to 3+/718 confirmed in the near-zero bucket alone) — needs
   its own Java-source deep-dive and is a DOT-topology change (edge
   count/shape), not render-only.
4. **Sprite/font-awesome glyphs in member text** (surveyed N12: ~7-9/718
   reach in member rows specifically) — needs creole-markup-in-member-text
   support PLUS actual sprite glyph rendering.
5. **`!define` macro called inline in a member line** (surveyed N12:
   ~6-7/718 reach) — needs TIM macro-call substitution wired into body/
   member-line collection PLUS the same creole-markup-in-member-text gap
   as #4 (jar-verified two-part via `mopelo-04-fose807`).
6. **`Test Two` classifier width bug** (`ducoka-05-cuce457`, unchanged
   since N11) — UNMASKED more broadly by N12's member-parser fix (dominates
   most of N12's 62 "regressed" fixtures in the full-corpus scan); still
   not touched, same explicit DOT-gate risk N11 named.
7. **`hide C2 circle` / entity-qualified compound hide forms** (NEWLY
   SURVEYED N12 via `dokego-92-zilu832`, 1+/718 reach) —
   `CommandHideShowByGender`, distinct from N12's landed
   `CommandHideShowByVisibility`.
8. **Undefined-entity arrow-notation variants** (`x-->`, `()-`, `#--`,
   `--{`, `}-`, `<...>`, NEWLY SURVEYED N12 via 8 near-zero fixtures,
   unsurveyed beyond puml-read) — likely several small, distinct
   mechanisms.
9. `kuxosa-67-keko885`'s `ent0001`/`ent0002` id+childCount swap (unchanged
   since N11).
10. `scale max N height`/`width` directive (unchanged since N11).
11. `class Foo [[[url]]]`/`url of Foo is [[...]]` link wrapping (~22/718,
    unchanged since N6-N11, dedicated-iteration scope).
12. `!pragma layout elk` (~4-7/718, unchanged since N9-N11).
13. `[hidden]` style-bracket edge suppression (1+/718, unchanged since
    N9-N11).
14. Edge `<path>` `@id`/`@codeLine` residual families (couples/lollipop
    naming + note-connector gap, unchanged since N9-N11).
15. Couples/apoint + lollipop synthetic entity-id naming (~24/718 combined,
    unchanged since N9-N11).
16. Visibility-icon skinparam color overrides + `classAttributeIconSize`
    (1/718, unchanged since N6-N11).
17. `skinparam mode dark` (1/718, unchanged since N7-N11).
18. `sadamo-18-siva346` pathological stress fixture (unchanged since
    N9-N11).
19. graphviz-ts coordinate-assignment offset (OUT OF SCOPE, unchanged since
    N8-N11).
20. Single-fixture unsurveyed residuals from N12's harvest
    (`gatula-10-bifu561`, `nekali-92-loda300`, `ponaxo-71-muze275`,
    `vudepo-27-cuvo793`, `xitobu-41-lame230`, `zejize-00-vivu578`,
    `vinujo-78-kapo329`) — each read but not drilled to root cause.

**RESOLVED N12, drop from future queues**: `skinparam class`/`enum {
BackgroundColor }` block resolution; `'Liberation Mono'` font-family
malformed-attribute bug (`tipude-10-tizi427`); `parseMemberLine` drops
non-canonical member syntax; `hide private/public/protected members`.
`Collection<T>` + `skinparam monochrome reverse` + transparent background
(`bedogi-86-kala547`) is RENAMED to item #2 above (generic type-parameter
tag box) — N12 confirmed the real mechanism reproduces identically without
`monochrome reverse` at all (`remulu-24-zadi546`).

## N13 queue (queued, per N13's ledger "not fixed" section) — for N14

1. **Classifier-width bug near note-connected classifiers** (NEWLY
   CONFIRMED N13, top priority — 22+ fixtures in N13's own regression scan
   alone, likely much higher corpus-wide once note fixtures reach
   zero-diff-adjacent territory) — a classifier connected (even via an
   INVISIBLE edge) to a note's DOT node measures WIDER than jar's real
   value (18-174px deltas observed). Confirmed PRE-EXISTING (identical
   wrong value at pre-N13 HEAD, via disposable-worktree comparison), not
   this iteration's fault — the SAME "childCount-unmasking" pattern every
   iteration since N2 has recorded. May overlap N11's "Test Two" classifier
   width bug or the "~7-8px position/margin residual" family — not
   cross-checked. Needs a dedicated diagnosis pass (graphviz packing/
   rank-width behavior around edges, possibly a debug-instrumented oracle
   rebuild per N5's precedent).
2. **Kinds B/C: general "opalisable" single-link note** (`EntityImageNote`'s
   `opaleLine`/`opaleLink` mechanism via `GraphvizImageBuilder#isOpalisable`)
   — every plain `note <pos> of X` (single connection) and freestanding
   note-with-one-edge fixture needs the SAME Opale zigzag mechanism N13
   landed for member-tips, but sourced from the DOT-routed edge spline
   (`note-layout.ts#groupEdge`'s existing `edge.points`, translated local to
   the note box) instead of direct host-offset math, with `getOpaleStrategy`
   (nearest-box-edge-to-spline-endpoint) choosing LEFT/RIGHT/UP/DOWN
   dynamically. Kind C (plain attached notes) extends EXISTING
   `note-layout.ts` machinery; Kind B (freestanding note + a REGULAR
   relationship line, e.g. `doseko-41-mavu661`/`sevaxa-72-pudi231`) needs
   NEW plumbing in the relationship-render path (detect a note-touching
   single-connection link, suppress its normal edge draw, route the Opale
   draw through the note's geo instead) — likely dominates the corpus's
   remaining note-bearing non-conformant fixtures; this port's PRE-EXISTING
   plain-note render path was never jar-verified and is now confirmed wrong
   for the common single-link case.
3. **`note on link`** (Kind D, `CommandFactoryNoteOnLink`/`Link#addNote`/
   `CucaNote`) — a structurally different draw site (label near the edge,
   not an Opale box); `class-notes.ts#applyNoteOnLink` parses it but only
   `class-assoc-couple.ts` consumes the result (for the unrelated
   association-class-couple case) — a plain relationship's `linkNote` is
   still silently dropped at render time. Reach unsurveyed.
4. Creole markup inside note text (`<color:#red>`, `**bold**`) — unchanged
   since N10-N12's identical member-text gap, blocks `taxemo-34-buro609`/
   `tenobo-24-liga464` from zero-diff even with N13's structural fix landed.
5. `class Foo [[[url]]]`/`url of Foo is [[...]]` link wrapping (~22/718,
   unchanged since N6-N12, dedicated-iteration scope).
6. `class Collection<T>` generic type-parameter tag box (~15/718, unchanged
   since N12, DOT-gate risk).
7. `skinparam groupInheritance` (3+/718, unchanged since N12, DOT-topology
   change).
8. Sprite/font-awesome glyphs in member text (~7-9/718, unchanged since
   N12).
9. `!define` macro called inline in a member line (~6-7/718, unchanged
   since N12).
10. `Test Two` classifier width bug (`ducoka-05-cuce457`, unchanged since
    N11-N12 — may be the SAME mechanism as item 1 above, not cross-checked).
11. `hide C2 circle` / entity-qualified compound hide forms (unchanged
    since N12).
12. Undefined-entity arrow-notation variants (unchanged since N12).
13. `kuxosa-67-keko885`'s `ent0001`/`ent0002` id+childCount swap (unchanged
    since N11).
14. `scale max N height`/`width` directive (unchanged since N11).
15. `!pragma layout elk` (~4-7/718, unchanged since N9-N12).
16. `[hidden]` style-bracket edge suppression (1+/718, unchanged since
    N9-N12).
17. Couples/apoint + lollipop synthetic entity-id naming (~24/718 combined,
    unchanged since N9-N12).
18. Visibility-icon skinparam color overrides + `classAttributeIconSize`
    (1/718, unchanged since N6-N12).
19. `skinparam mode dark` (1/718, unchanged since N7-N12).
20. `sadamo-18-siva346` pathological stress fixture (unchanged since
    N9-N12).
21. graphviz-ts coordinate-assignment offset (OUT OF SCOPE, unchanged since
    N8-N12).
22. Single-fixture unsurveyed residuals from N12's harvest (unchanged,
    `gatula-10-bifu561`, `nekali-92-loda300`, `ponaxo-71-muze275`,
    `vudepo-27-cuvo793`, `xitobu-41-lame230`, `zejize-00-vivu578`,
    `vinujo-78-kapo329`).

**RESOLVED N13, drop from future queues**: none — the note-connector family
remains partially open (Kinds B/C/D still queued above); N13 only fully
closed Kind A (member-tip notes' STRUCTURAL mechanism — text/creole and the
newly-confirmed classifier-width bug still block those same fixtures from
zero-diff, see items 1 and 4 above).

## N14 queue (queued, per N14's ledger "not fixed" section) — for N15

1. **`GMN\d+` auto-generated note-id scheme** (named since N9, NOW THE
   SINGLE BLOCKER for multiple near-zero Kind-C fixtures --
   `fezugi-39-fujo327`/`sapodo-57-voda654`, both at exactly 1 diff) --
   `CucaDiagram#getUniqueSequence("GMN")` is a diagram-wide counter shared
   with the couples/lollipop synthetic-naming subsystem (item 20 below) --
   confirmed via Java source read to be the SAME mechanism, needs a real
   shared counter threaded through parsing plus a retrofit of the existing
   `__assocN`/`__lolN` placeholder generators.
2. **Kind B: freestanding note + a regular relationship line**
   (`doseko-41-mavu661`/`sevaxa-72-pudi231`, unchanged since N13) -- needs
   NEW relationship-path plumbing, distinct blast radius from Kind C.
3. **`note on link` (Kind D)** -- unchanged since N9/N13, reach unsurveyed.
4. **Creole markup inside note text** (`<color:#red>`, `**bold**`) --
   unchanged since N10-N13.
5. **Per-line `textLength` on multi-line notes** (NEWLY NAMED N14) -- uses
   the note's max-line width for every line instead of each line's own.
6. **`skinparam icon<Kind>Color`/`icon<Kind>BackgroundColor` overrides**
   (unchanged since N6, reach UPGRADED N14 -- `morile-94-muda826`/
   `tagofo-84-nuti362` newly re-confirmed).
7. **~2px uniform position offset across UNCONNECTED sibling classifiers**
   in a multi-component (no-edge) layout (NEWLY DISCOVERED N14,
   `mujopi-06-lusi222`) -- likely graphviz-ts packing margin, needs a
   dedicated diagnosis pass to confirm which side owns it.
8. **`set separator none` + duplicate short classifier names + an
   implicit-target note** (NEWLY DISCOVERED N14, `kejeka-49-kofa156`) --
   rare name-collision edge case, already severely broken pre-iteration.
9. **Classifier color-directive rendering gaps** (`##[bold]red`,
   `#line:color;line.style;text:color`, `<style>`-scoped overrides) --
   surveyed incidentally N14 (`murotu-83-cebo380`/`sosono-24-vuro518`/
   `xokipa-29-rafu481`), unrelated to notes, unsurveyed reach.
10. `class Collection<T>` generic type-parameter tag box (~15/718, unchanged
    since N12, DOT-gate risk).
11. `skinparam groupInheritance` (3+/718, unchanged since N12, DOT-topology
    change).
12. Sprite/font-awesome glyphs in member text (~7-9/718, unchanged since
    N12).
13. `!define` macro called inline in a member line (~6-7/718, unchanged
    since N12).
14. `hide C2 circle` / entity-qualified compound hide forms (unchanged
    since N12).
15. Undefined-entity arrow-notation variants (unchanged since N12).
16. `kuxosa-67-keko885`'s `ent0001`/`ent0002` id+childCount swap (unchanged
    since N11).
17. `scale max N height`/`width` directive (unchanged since N11).
18. `!pragma layout elk` (~4-7/718, unchanged since N9-N13).
19. `[hidden]` style-bracket edge suppression (1+/718, unchanged since
    N9-N13).
20. Couples/apoint + lollipop synthetic entity-id naming (~24/718 combined,
    unchanged since N9-N13 -- SAME subsystem as item 1 above).
21. `class Foo [[[url]]]`/`url of Foo is [[...]]` link wrapping (~22/718,
    unchanged since N6-N13, dedicated-iteration scope).
22. Visibility-icon skinparam color overrides + `classAttributeIconSize`
    (1/718, unchanged since N6-N13 -- see item 6, reach upgraded).
23. `skinparam mode dark` (1/718, unchanged since N7-N13).
24. `sadamo-18-siva346` pathological stress fixture (unchanged since
    N9-N13).
25. graphviz-ts coordinate-assignment offset (OUT OF SCOPE, unchanged since
    N8-N13 -- may overlap item 7, not cross-checked).
26. Single-fixture unsurveyed residuals from N12's harvest (unchanged,
    `gatula-10-bifu561`, `nekali-92-loda300`, `vudepo-27-cuvo793`,
    `xitobu-41-lame230`, `zejize-00-vivu578`, `vinujo-78-kapo329`).

**RESOLVED N14, drop from future queues**: `Test Two` classifier width bug
(`ducoka-05-cuce457`); classifier-width bug near note-connected classifiers
(N13's top-priority item). Kind C (general opalisable single-link attached
note) STRUCTURALLY landed -- the remaining blocker is the shared id-
generation gap (item 1 above), not the Opale mechanism itself.

## N15 queue (queued, per N15's ledger "not fixed" section) — for N16

1. **Namespace/cluster-level `[[url]]` wrapping** (NEWLY CONFIRMED N15,
   `Cluster.java`'s own `startUrl`/`closeUrl` around `<g class="cluster">` --
   jar-verified via `rakuci-96-tuti371`'s `package`/`rectangle` container
   urls) -- separate draw site from `EntityImageClass`, needs
   `Namespace.url` + `NamespaceGeo.url` + a cluster-render wrap, plus
   `class-container.ts#closeContainer`'s empty-descriptive-container
   collapse threading a url the namespace-open command doesn't even parse
   today.
2. **`skinparam topurl`** (NEWLY CONFIRMED N15 via `jinoba-14-firi471`/
   `laluve-92-raxu863`, `UrlBuilder#withTopUrl`'s relative-url prefix) --
   `parseUrlBracket` has no skinparam-context parameter.
3. **Member-level `[[[url]]]` url PARSING** (content, not just N12's
   display-text stripping -- N15 added ONLY presence-detection via
   `Member.hasOwnUrl`) -- needs the per-row `<a>`-split render mechanism
   (`fugexa-12-zoti674`/`gukuda-51-fuju086`/`dasagu-52-vani172`).
4. **Relationship-edge `[[url]]`** (`a --> b [[url]] : label`,
   `fitini-85-kupo803`) -- a separate upstream mechanism (`CommandLinkClass`'s
   own URL group), unsurveyed reach.
5. **Inline creole-embedded url in a member's DISPLAY TEXT**
   (`[[url]] for information`, `cokeje-99-gede231`, distinct from the
   `[[[url]]]` attribute suffix) -- needs the already-named
   creole-markup-in-member-text gap (N10-N14) closed first.
6. **The draw-order-vs-creation-order mismatch for freestanding notes**
   (NEWLY DISCOVERED N15 via `nuxoni-26-xala894`) -- this port's render loop
   draws classifiers-then-notes unconditionally; jar interleaves ALL
   entities by real creation time -- masked whenever the two orderings
   coincidentally produced the same numeric id sequence (N15's own
   `GMN\d+` fix now surfaces the divergence), reach unsurveyed.
7. **Couples/apoint + lollipop synthetic entity-id naming** (~24/718,
   unchanged since N9-N14) -- the SAME `getUniqueSequence` shared-counter
   subsystem N15 just fixed for notes; `__assocN`/`__lolN` (`class-assoc-
   couple.ts`/`class-lollipop.ts`) still need the same `state
   .creationCounter` threading retrofit, not attempted this iteration.
8. **`note on link` (Kind D)** / **Kind B freestanding note + relationship
   line** / **creole markup inside note text** / **per-line `textLength` on
   multi-line notes** (all unchanged since N9-N14).
9. **File-size-cap housekeeping** (NEWLY NOTED N15): `class-declaration-
   parser.ts` (527), `class-commands.ts` (539), `ast.ts` (712),
   `core/svg.ts` (610) are over the 500-line cap after this iteration's
   additions (10-57 lines each, type/grammar/doc-comment growth on files
   already over cap pre-N15) -- `renderer.ts` was addressed (net +5 lines
   via the `renderer-url.ts` split); the other four not split this
   iteration, flagged for a future cleanup pass.
10. Every item unchanged from N14's own queue not superseded above
    (`class Collection<T>` tag box, `skinparam groupInheritance`, sprite/
    font-awesome glyphs, inline `!define` macros, `hide C2 circle`,
    undefined-entity arrow variants, the `ent0001`/`ent0002` id swap,
    `scale max N height`, `!pragma layout elk`, `[hidden]` suppression,
    visibility-icon color overrides, `skinparam mode dark`,
    `sadamo-18-siva346`, graphviz-ts coordinate offset, N12's single-
    fixture unsurveyed residuals) -- see `plans/g2-class-svg/ledger.md`
    N15 for the full renumbered list.

**RESOLVED N15, drop from future queues**: `GMN\d+` auto-generated note-id
scheme (N9-N14's item 1) -- the SHARED COUNTER MECHANISM is now correctly
modeled for notes; couples/lollipop's OWN retrofit (item 7 above) is
separate, still open work.

## N16/N17 queue (queued, per N17's ledger "not fixed" section) — for N18

1. **Anchor-in-cluster footprint case** (`bajotu-30-soku184`/
   `pecabi-95-demu756` pattern, NEWLY DERIVED N17 — any package used as a
   relationship/note endpoint) — needs `class-dot-graph.ts#buildDotGraph`
   to return its internal `anchors` map so `buildNamespaceGeos` can widen
   its topmost-member walk to include the anchor's own dot-assigned
   position, not just `ns.classifiers`.
2. **Title-driven package width floor** (`pixexi-81-sete111`, `skinparam
   package { FontSize N }`, NEWLY SURVEYED N17) — needs a
   `max(contentWidth + 2*padding, wtitle + marginTitleX3 + ...)` width
   floor in `buildNamespaceGeos`, plus verifying graphviz-ts's own
   cluster-label-driven auto-width/centering mirrors jar's (unverified).
3. **`skinparam style strictuml`** (`jinibe-02-tebi269`'s own `<polygon>`
   roundCorner=0 output, NEWLY CONFIRMED N17 as a REGRESSION source once
   the folder-tab shape landed — was previously masked by the plain-rect
   childCount mismatch) — `class-namespace-shape.ts` has no `folderPolygon`
   equivalent; description's `renderer-cluster.ts#isFolderStyled`/
   `buildStyleDefaults` is the existing precedent to port from.
4. **`skinparam packageStyle rect|frame|node|...`** (`mucuxi-36-beku683`'s
   own plain-rect-no-tab output, NEWLY SURVEYED N17) — a DIFFERENT
   `USymbol` entirely per package style, same unmodeled skinparam gap.
5. **Package/namespace stereotypes** (`domeki-03-zaga732`'s `package
   Package2 <<Rectangle>>` + `skinparam packageShadowing<<Xxx>>`, NEWLY
   DISCOVERED N17, confirmed as a regression source) — `ast.ts#Namespace`
   has no stereotype field at all; reach unsurveyed.
6. **`skinparam package { FontColor }`** (`pixexi-81-sete111`, folded into
   item 2's single sample) — no `packageFontColor` theme field exists.
7. **Member-level `[[[url]]]` url PARSING / relationship-edge `[[url]]` /
   inline creole-embedded member url / `note on link` / Kind B
   freestanding-note-plus-relationship-line** — N16's own commit message
   claims these landed; NOT independently re-verified this iteration
   (N16's ledger/README entries were never written — see `ledger.md`'s
   retroactive N16 note). A future iteration should re-survey before
   assuming these are closed.
8. **File-size-cap housekeeping**: `layout.ts` (528 lines, was already
   517 pre-N17, over the 500-line cap before AND after this iteration) —
   not split this iteration, flagged for a future cleanup pass.
9. Every item unchanged from N15's own queue not superseded above
   (`skinparam topurl`, creole markup in note text, per-line `textLength`
   on multi-line notes, visibility-icon skinparam color overrides,
   `Collection<T>` generic tag box, `skinparam groupInheritance`,
   sprite/font-awesome glyphs, inline `!define` macros, `hide C2 circle`,
   undefined-entity arrow variants, the `ent0001`/`ent0002` id swap,
   `scale max N height`, `!pragma layout elk`, `[hidden]` suppression,
   `skinparam mode dark`, `sadamo-18-siva346`, graphviz-ts coordinate
   offset, N12's single-fixture unsurveyed residuals) — see
   `plans/g2-class-svg/ledger.md` N15/N17 for the full renumbered list.

**RESOLVED N17, drop from future queues**: the package/namespace
folder-tab SHAPE mechanism (was the single largest named mechanism this
mission has ever found, 104/718 direct reach) — the base case is now
byte-exact against the jar. The footprint's `topPad` invented-constant bug
is also resolved (was a flat `28`, now the jar-verified `htitle + 13`
formula). The four sub-cases named above (anchor, title-driven-width,
strictuml, packageStyle/stereotype) are NEW, narrower, independently-
scoped remainders — not a re-statement of the original mechanism.

## N18 queue (queued, per N18's ledger "not fixed" section) — for N19

1. **Anchor-in-cluster footprint, full jar parity** (`bajotu-30-soku184`/
   `pecabi-95-demu756`) — the footprint MATH is landed and unit-tested;
   full parity additionally needs a graphviz-ts rank-assignment fix
   (point-anchor vs. sibling-classifier same-cluster tie-break) —
   CONFIRMED out of scope (pinned `.tgz` dependency, diagnosed via direct
   `layoutGraph()` instrumentation + a nodeIds-reorder experiment, zero
   effect). Candidate for an upstream graphviz-ts issue.
2. **Title-driven package width floor + centering** (`pixexi-81-sete111`)
   — CONFIRMED BLOCKED: graphviz-ts's public `addSubgraph` API has no
   numeric label-width/label-height parameter at all (verified against
   `node_modules/graphviz-ts/dist/api/builder.d.ts`); a pure post-layout
   width-floor was considered and rejected (classifier would still sit at
   the wrong x, no net diff-count improvement).
3. **strictuml classifier-spot-badge suppression** (NEWLY DISCOVERED N18,
   blocks `jinibe-02-tebi269`/`mucuxi-36-beku683` from zero-diff) —
   `skinparam style strictuml` loads an entire alternate skin file
   (`/skin/strictuml.skin`, `SkinParam.java:227-232`) that appears to
   ALSO disable the classifier header's circled-letter spot/badge (jar:
   4-child box vs. this port's unconditional 6-child badge box) — reach
   beyond the 2 named fixtures unsurveyed; needs its own Java-source read
   to scope strictuml's FULL effect, not just the folder corner (already
   landed N18).
4. **Package/namespace stereotype -> `PackageStyle` dispatch +
   `skinparam packageStyle`** — full Java mechanism surveyed (N18 ledger
   Mechanism 5: `Stereotype.getPackageStyle()`'s exact priority rule, all
   12 `PackageStyle` enum values + draw routines, RECTANGLE's footprint-
   formula-UNCHANGED confirmation via `domeki-03-zaga732`) but NOT
   implemented — RECTANGLE's own title-centering (vs. FOLDER's left-
   anchor) and border-color resolution (`#181818`/width 1, not
   `packageBorder`/1.5) are unverified sub-mechanisms. Named fixtures:
   `domeki-03-zaga732` (stereotype), `mucuxi-36-beku683`/
   `nijeli-04-ponu844` (skinparam, both also carry strictuml/other
   overrides blocking zero-diff regardless). NODE/CLOUD/DATABASE/FRAME/
   other stereotype-driven styles entirely unsurveyed beyond their own
   Java draw-routine existence.
5. **File-size-cap housekeeping** (WORSENED N18 on 3 files, not newly
   over-cap): `core/svg.ts` (610 -> 618), `theme.ts` (518 -> 540),
   `skinparam.ts` (586 -> 614) all grew while already over the 500-line
   cap (all three were over cap BEFORE N18 too) — none split this
   iteration (shared-code files, cross-diagram-type risk). `layout.ts`
   stayed flat at 528 (net +0 this iteration).
6. Every item unchanged from N17's own queue not superseded above
   (`skinparam topurl`, member-level `[[[url]]]` url PARSING,
   relationship-edge `[[url]]`, inline creole-embedded member url, `note
   on link`, Kind B freestanding-note-plus-relationship-line, creole
   markup in note text, per-line `textLength` on multi-line notes,
   visibility-icon skinparam color overrides, `Collection<T>` generic tag
   box, `skinparam groupInheritance`, sprite/font-awesome glyphs, inline
   `!define` macros, `hide C2 circle`, undefined-entity arrow variants,
   `ent0001`/`ent0002` id swap, `scale max N height`, `!pragma layout
   elk`, `[hidden]` suppression, `skinparam mode dark`, `sadamo-18-
   siva346`, graphviz-ts coordinate offset, N12's single-fixture
   unsurveyed residuals) — see `plans/g2-class-svg/ledger.md` N15/N17/N18
   for the full renumbered list.

**RESOLVED N18, drop from future queues**: namespace title `<text>`
missing `textLength`/`lengthAdjust` + wrong `font-weight` format (fixed
corpus-wide). `packageFontSize`/`packageFontColor`/`packageBorderThickness`
skinparam threading (was entirely absent). The anchor-footprint MATH (was
entirely absent) — the remaining gap is RENAMED/NARROWED to a graphviz-ts
rank-assignment issue (item 1 above). The strictuml folder-tab SHAPE base
case (was entirely absent) — the remaining strictuml gap is RENAMED/
NARROWED to the classifier-badge-suppression sub-mechanism (item 3
above).

## N19 queue (queued, per N19's ledger "deferred, fully diagnosed" section)
## — for N20

1. **Repeat coupling** (`Association#createSecondAssociation`/
   `createInSecond`, 9 fixtures: `bosiki-11-xaza958`, `bunuce-10-vere519`,
   `getufo-87-xeca508`, `jegefa-93-daza492`, `meriso-72-tika033`,
   `radavi-85-samu213`, `rujace-11-vaci539`, `jocozo-25-coke152`,
   `gojole-09-solo793`) — full jar burn order traced (decision-journal.md),
   including a synthetic default-link phantom (ALWAYS burned, unlike
   `createNew`'s conditional one), a CONDITIONAL `getInv()` swap on the
   PRIOR circle's class-edge, and a final invisible sibling-link burn that
   needs `renderer-uid.ts` to consume a rank for an edge FILTERED OUT of
   `geo.edges` entirely (`buildEdgeGeos`'s `if (rel.invis) continue` —
   currently no mechanism exists for a rank-consuming-but-invisible EDGE,
   only classifiers/notes have that shape today). Needs new
   `renderer-uid.ts` architecture, not a slice-in-passing fix.
2. **Double couple `(A,B) . (C,D)`** (`associationClass`'s 4-entity
   overload + module-level `insertPointBetween`, 2 fixtures:
   `begico-70-guva302`, `pibifa-14-leno075`) — a STRUCTURALLY DIFFERENT cpt1
   burn order than Mechanism 1 (BOTH point names burn before either entity,
   not interleaved) — needs its own dedicated implementation in
   `applyDoubleCouple`, cannot reuse `makeCoupleCircle`'s stamping code.
3. **Lollipop's own missing display-label text** (NEWLY DISCOVERED N19, ALL
   13 lollipop fixtures) — `EntityImageLollipopInterface#drawU`'s
   `desc.drawU(...)` call (the entity's display name below/beside the
   circle) has no port-side equivalent; `renderClass`'s classifier loop
   falls through to the generic `renderClassifierBox` (a full class-box
   header) for `kind: 'lollipop'` instead of a small circle+label — reach
   beyond the 13 named fixtures unsurveyed, needs its own
   `renderLollipop`-equivalent special case (mirroring `renderAssocPoint`'s
   precedent) plus circle-radius-relative label centering.
4. Every item unchanged from N18's own queue not superseded above
   (`skinparam topurl`, member-level `[[[url]]]` url PARSING, relationship-
   edge `[[url]]`, inline creole-embedded member url, `note on link`, Kind B
   freestanding-note-plus-relationship-line, creole markup in note text,
   per-line `textLength` on multi-line notes, visibility-icon skinparam
   color overrides, `Collection<T>` generic tag box, `skinparam
   groupInheritance`, sprite/font-awesome glyphs, inline `!define` macros,
   `hide C2 circle`, undefined-entity arrow variants, `ent0001`/`ent0002` id
   swap, `scale max N height`, `!pragma layout elk`, `[hidden]`
   suppression, `skinparam mode dark`, `sadamo-18-siva346`, graphviz-ts
   coordinate offset, N12's single-fixture unsurveyed residuals, anchor-in-
   cluster footprint (graphviz-ts-blocked), title-driven package width
   floor (graphviz-ts-blocked), strictuml classifier-spot-badge
   suppression, package/namespace stereotype -> `PackageStyle` dispatch,
   file-size-cap housekeeping) — see `plans/g2-class-svg/ledger.md`
   N15/N17/N18/N19 for the full renumbered list.

**RESOLVED N19, drop from future queues**: couples/lollipop synthetic-
entity naming for the SINGLE-coupling and lollipop paths (was `~24-35/718`
combined, named since N9) — the remaining gap is NARROWED to the two
deferred sub-cases above (items 1-2), not a re-statement of the original
mechanism.

## N20 queue (queued, per N20's ledger "Priority 3" section) — for N21

1. **Double couple `(A,B) . (C,D)`** (`associationClass`'s 4-entity
   overload + module-level `insertPointBetween`, 2 fixtures:
   `begico-70-guva302`, `pibifa-14-leno075`) — full jar burn order
   re-derived directly (decision-journal.md/ledger.md N20): BOTH point
   names burn consecutively BEFORE either point's own uid (name1, name2,
   uid1, uid2 — NOT interleaved per point like single/repeat-coupling),
   THEN `insertPointBetween(point1)`'s 3-burn shape (conditional phantom +
   2 entity edges), THEN `insertPointBetween(point2)`'s identical 3-burn
   shape, THEN the visible `point1ToPoint2` edge burn LAST. Needs a
   dedicated stamping sequence in `applyDoubleCouple` (cannot reuse
   `makeCoupleCircle`'s per-point ctor-stamp code as-is) — a shared
   `insertPointBetween`-equivalent helper for the two `A-circle/circle-B`
   pairs would avoid duplicating N19/N20's own aEdge/bEdge-stamp logic
   twice. `applyDoubleCouple` currently calls `makeCoupleCircle` TWICE
   WITHOUT a counter (unchanged, zero risk to these 2 fixtures).
2. Every item unchanged from N19's own queue item 4 not superseded above
   (`skinparam topurl`, member-level `[[[url]]]` url PARSING, relationship-
   edge `[[url]]`, inline creole-embedded member url, `note on link`, Kind B
   freestanding-note-plus-relationship-line, creole markup in note text,
   per-line `textLength` on multi-line notes, visibility-icon skinparam
   color overrides, `Collection<T>` generic tag box, `skinparam
   groupInheritance`, sprite/font-awesome glyphs, inline `!define` macros,
   `hide C2 circle`, undefined-entity arrow variants, `ent0001`/`ent0002` id
   swap, `scale max N height`, `!pragma layout elk`, `[hidden]`
   suppression, `skinparam mode dark`, `sadamo-18-siva346`, graphviz-ts
   coordinate offset (now confirmed the SOLE blocker on all 13 lollipop +
   9 repeat-coupling fixtures — a strong future ROI target if graphviz-ts
   is ever brought in scope), N12's single-fixture unsurveyed residuals,
   anchor-in-cluster footprint (graphviz-ts-blocked), title-driven package
   width floor (graphviz-ts-blocked), strictuml classifier-spot-badge
   suppression, package/namespace stereotype -> `PackageStyle` dispatch,
   lollipop half-circle socket shape (ZERO corpus reach, confirmed N20 —
   low priority even if graphviz-ts is ever unblocked), file-size-cap
   housekeeping) — see `plans/g2-class-svg/ledger.md` N15/N17/N18/N19/N20
   for the full renumbered list.

**RESOLVED N20, drop from future queues**: lollipop display-label text (was
13/718, named since N19) — structurally complete, blocked only by
graphviz-ts; repeat-coupling burn order (was 9/718, named since N9) —
structurally complete, blocked only by graphviz-ts. Both narrowed OUT of
this mission's remaining "named mechanism" backlog entirely — the ONLY
remaining blocker for all 22 fixtures combined is the out-of-scope
graphviz-ts coordinate offset.

## N21 queue (queued, per N21's ledger "not fixed"/"newly surveyed" section)
## — for N22

1. **`buildHeaderRow`'s wider-box centering formula** (NEWLY CONFIRMED
   UNVERIFIED N21, blocks `sufide-66-sanu583`/`xajefo-97-julu315` at 36
   diffs each) — `class-layout-helpers.ts#buildHeaderRow`'s `centerOffset =
   (boxWidth - headerWidth) / 2` branch was only ever jar-verified for the
   `boxWidth === headerWidth` (zero-centering) case; the real non-zero-
   centering formula moves the badge and header text in OPPOSITE directions
   from this port's current single-`centerOffset` model, ruling out a
   simple constant fix. Needs a debug-instrumented oracle rebuild (N5's own
   precedent) to re-derive `HeaderLayout#drawU`'s real formula. Likely
   SHARES a root cause with item 2 below (`HeaderLayout#getDimension`'s
   `stereoDim` term, per that formula's own pre-existing doc-comment
   caveat) — best drilled together.
2. **Classifier stereotype text row** (NEWLY SURVEYED N21, `zejize-00-
   vivu578` post-hoc `Foo <<Test>>`, `pajuba-83-roji161` inline STACKED
   `<<A>> <<B>> <<C>>`) — `Classifier.stereotype` is parsed (both inline-
   declaration and `CommandStereotype`'s post-hoc standalone-line form
   would need adding for the latter) but NEVER rendered; `class-badge.ts`'s
   own doc comment already flags this in passing. Explicit DOT-gate risk
   (box width formula needs a `stereoDim` term) — likely the SAME
   underlying formula gap as item 1.
3. **`skinparam diagramBorderColor`/`diagramBorderThickness`** (NEWLY
   SURVEYED N21, `vinujo-78-kapo329`, 1/718 class reach) — a SHARED,
   diagram-type-agnostic mechanism (`core/TextBlockExporter.java
   #maybeDrawBorder`) belonging in `core/klimt/document-shell.ts`
   territory, not class-specific; needs cross-diagram-type verification
   before landing.
4. **`<style> note { .class {...} } </style>` CSS-class cascade**
   (`neruke-07-ruce381`) — confirmed N21 to be the FULL scope of N7's
   already-named "element-level style cascade" gap (class diagrams consume
   `styleMap` NOWHERE except the narrow root-background selector) — a
   near-total absence, not a partial one. Only 6/718 class fixtures use
   `<style>{}` at all.
5. **`remove`/`restore` dense-renumbering** (`zuxoxu-54-pejo512`) — fully
   diagnosed N21: `filterRemovedEntities` drops removed entities from the
   AST BEFORE `assignExact`'s dense-renumbering ever sees their
   `creationIndex`, treating "removed but really created" identically to
   "never created" (a genuinely different upstream semantic — removed
   entities still consumed a real `cpt1` slot at creation time). Needs a
   new phantom-rank field (same shape as N15's GMN/N19's
   `subsumedLinkCreationIndex`) threaded `class-directives.ts` →
   `layout.ts`/`ClassGeometry` → `renderer-uid.ts`. Corpus-wide reach is
   only 1 fixture (the other 3 `remove`/`restore` fixtures are unrelated
   `@unlinked` cases far from zero-diff, or already zero-diff).
6. **Nested `|_` member tree-list syntax** (NEWLY SURVEYED N21,
   `fecolo-08-gepu579`) — genuinely unbuilt; the member-list model has no
   nesting-depth concept at all.
7. **Embedded diagram block inside member text** (NEWLY SURVEYED N21,
   `gadufu-56-votu808`, `{{ ... }}`) — genuinely unbuilt, unsurveyed beyond
   this one sample.
8. **Gradient skinparam colors** (NEWLY SURVEYED N21, `dizuse-83-dabi909`,
   `BackgroundColor #c3d8f4\#6192d1`) — needs `<defs><linearGradient>`
   emission; zero gradient support anywhere in the class pipeline today.
9. **Double couple `(A,B) . (C,D)`** (unchanged since N19/N20,
   `begico-70-guva302`, `pibifa-14-leno075`) — full jar burn order already
   re-derived (ledger.md N20), needs a dedicated `applyDoubleCouple`
   stamping sequence, not attempted N21 (time-boxed in favor of the 1-3
   bucket harvest per the brief's own priority order).
10. Every item unchanged from N20's own queue item 2 not superseded above
    (`skinparam topurl`, member-level `[[[url]]]` url PARSING, relationship-
    edge `[[url]]`, inline creole-embedded member url, `note on link`, Kind B
    freestanding-note-plus-relationship-line, creole markup in note/member
    text, `Collection<T>` generic tag box, `skinparam groupInheritance`,
    sprite/font-awesome glyphs, inline `!define` macros, `hide C2 circle`,
    undefined-entity arrow variants, `ent0001`/`ent0002` id swap, `scale max
    N height`, `!pragma layout elk`, `[hidden]` suppression, `skinparam
    mode dark`, `sadamo-18-siva346`, graphviz-ts coordinate offset (sole
    blocker on 13 lollipop + 9 repeat-coupling fixtures), N12's
    single-fixture unsurveyed residuals, anchor-in-cluster footprint
    (graphviz-ts-blocked), title-driven package width floor
    (graphviz-ts-blocked), strictuml classifier-spot-badge suppression,
    package/namespace stereotype -> `PackageStyle` dispatch, lollipop
    half-circle socket shape (zero reach), file-size-cap housekeeping) —
    see `plans/g2-class-svg/ledger.md` N15/N17/N18/N19/N20/N21 for the
    full renumbered list.

**RESOLVED N21, drop from future queues**: per-line note `textLength`
(named since N14 item 5) — landed. `<U+XXXX>`/`&#NNN;` text-escape decode
in note text (newly named and landed same iteration). Icon-row url-wrap
generalization (N15/N16's own named scoping gap) — landed, the SPLIT
implementation is complete; the remaining `dasagu-52-vani172`-style
per-row `[[[url]]]` background-rect chrome is a SEPARATE, unrelated,
unnamed gap (not attempted, not blocking anything this mission has
pinned). `hide-class`/`show-class` dispatch gap — landed. `*`
(`IE_MANDATORY`) visibility char — landed (the unmasked centering formula
is renamed/narrowed to item 1 above, a pre-existing gap this fix merely
surfaced, not introduced).

## N22 queue (queued, per N22's ledger "regressed"/"deferred" section) — for N23

1. **`buildHeaderRow`'s wider-box centering formula** (UPGRADED priority —
   N21 named it blocking 2 fixtures at 36 diffs; N22 confirms it ALSO now
   blocks `cokeje-99-gede231`/`jerime-86-note748`/`pofime-55-nana952`/
   `sojave-47-pura962` at 36-39 diffs each, all four otherwise fully
   creole-correct — text/color/textLength/font-weight byte-exact, ONLY
   `ellipse/@cx` + badge `path/@d` differ by a uniform +3.25px). Still needs
   a debug-instrumented oracle rebuild (N5's own precedent) to re-derive
   `HeaderLayout#drawU`'s real `centerOffset` formula — likely shares a
   root cause with the classifier-stereotype-row gap (N21 queue item 2),
   best drilled together. Now the single highest-reach named blocker in
   the class mission (6+ fixtures confirmed, likely more once re-surveyed).
2. **`<&glyph>` OpenIconic/FontAwesome-icon rendering** (unchanged scope,
   reach REFINED N22: 7/7 sampled `<$sprite>`-in-member-row fixtures ALSO
   use `<&glyph>` on the same/adjacent row, confirming this is the SOLE
   remaining blocker for every sprite-in-member-text fixture surveyed so
   far — `<$sprite>` support itself is now fully landed and unit-tested,
   N22) — needs vendored glyph-path/font-metric assets, a wholly separate
   feature per CLAUDE.md's own feature-catalog note.
3. **`skinparam class { AttributeFontSize / AttributeFontName }`** (NEWLY
   DISCOVERED N22, `jisanu-32-gado231`) — a per-COMPARTMENT member-text font
   override (distinct from the classifier's general/header font,
   `MethodsOrFieldsArea`'s own `FontConfiguration.create(skinParam, style,
   ...)` call reads a NARROWER style signature than the header's) — this
   port's `measureGenericClassifier`/`class-member-creole.ts#buildMemberRow`
   unconditionally use `{theme.fontFamily, theme.fontSize}` for every member
   row, ignoring this skinparam entirely. Unsurveyed reach beyond the one
   sample.
4. **GrayLevel-encoded `sprite $name [WxH/Nz] { ... }` block sprites in a
   member row combined with title/legend/`note on link`/classifier
   background-color mechanisms** (`lozego-15-coci435`, deeply pre-existing
   broken, 99->101 diffs) — not independently diagnosable; deferred until
   the OTHER mechanisms on that fixture (title creole markup, `note on
   link` background, `#RRGGBB` classifier-level background override) are
   separately landed.
5. Every item unchanged from N21's own queue not superseded above
   (classifier stereotype text row, `skinparam diagramBorderColor`,
   `<style> note {}` CSS-class cascade, `remove`/`restore` dense-
   renumbering, nested `|_` member tree-list syntax, embedded diagram block
   in member text, gradient skinparam colors, double couple, `skinparam
   topurl`, member/relationship-edge `[[url]]` variants beyond inline
   creole (which N22 landed the RENDER half of — the `<a href>` WRAP for an
   inline creole `[[url]]` command remains unbuilt, `CommandCreoleUrl.ts`'s
   own doc comment), `Collection<T>` generic tag box, `skinparam
   groupInheritance`, `hide C2 circle`, undefined-entity arrow variants,
   `ent0001`/`ent0002` id swap, `scale max N height`, `!pragma layout elk`,
   `[hidden]` suppression, `skinparam mode dark`, `sadamo-18-siva346`,
   graphviz-ts coordinate offset, anchor-in-cluster footprint, title-driven
   package width floor, strictuml classifier-spot-badge suppression,
   package/namespace stereotype -> `PackageStyle` dispatch, lollipop
   half-circle socket, file-size-cap housekeeping) — see `plans/g2-class-
   svg/ledger.md` N15-N22 for the full renumbered list.

**RESOLVED N22, drop from future queues**: creole-in-member-text rendering
(inline `<b>`/`<color>`/`<size>`/`--strike--`/`[[url]]` markup) — landed.
`!define`-macro-in-member-line — CLOSED, was a misdiagnosis (N12's own
"TIM substitution not wired" claim was wrong; only the render half was
missing, now fixed). Member-level `{abstract}`/`{static}` -> italic/
underline — landed. `<$sprite>` measurement+render infrastructure — landed
(zero standalone fixture reach until item 2 above lands).

## N23/N24 queue (N23's own queue was never separately written — filled in
## retroactively here per "no anonymous misses"; combined with N24's fresh
## findings) — for N25

1. **Relationship multiplicity/cardinality text not rendered** (`C1 "1" --
   "1" C2`, NEWLY SURVEYED N24, ~28/718 corpus-wide via quoted-multiplicity
   grep, 2 direct near-zero fixtures `dokego-92-zilu832`/`kipure-14-suli112`)
   — `class-layout-helpers.ts#edgeLabelAttrs` already measures
   `fromMultiplicity`/`toMultiplicity` for DOT `taillabel`/`headlabel`
   sizing, but no render path draws the text on the edge itself. Likely
   substantial reach; best next pickup (formula largely un-derived, needs a
   `SvekEdge.java` tail/head label placement read).
2. **`(CHAR[,COLOR])[LABEL]` circled-char BADGE customization** (custom
   badge letter/color via `<<(C,#FF0000)>>`/`<<(S) Stereotype>>` syntax,
   NEWLY SURVEYED N24, 6 direct near-zero fixtures — the TEXT half is now
   correctly stripped by N24's Mechanism 1, only the badge letter/color
   itself remains unbuilt) — `class-badge.ts#badgeFill`/`badgeLetter`
   still dispatch purely on `ClassifierKind`; needs `Classifier`-level
   override fields threaded from `StereotypeDecoration#buildComplex`'s
   `CHAR`/`COLOR` capture.
3. **`hide C2 circle` / entity-qualified compound hide forms**
   (`CommandHideShowByGender`, unchanged since N12, `dokego-92-zilu832`,
   blocked from reaching zero by item 1 above) — structurally confirmed
   this iteration (badge+letter suppressed, header re-centered without
   badge space) but not landed standalone.
4. **Undefined-entity arrow-notation variants** (`<->`, `<...>`, `--{`,
   `}-`, `#--`, `-0)-`, NEWLY SURVEYED N24 via 4 near-zero fixtures
   `kepado-34-risa735`/`medosa-71-ligu412`/`zerofa-77-caro506`/
   `cenubi-27-xova754`) — likely several small, distinct crow's-foot/
   undefined-entity-auto-creation mechanisms, matches the brief's own named
   candidate (~11 corpus-wide estimate).
5. **Note/rect explicit background-color override** (`#F1F1F1` default not
   overridden on a note/member-url rect, NEWLY SURVEYED N24, 3 fixtures
   `foguga-43-nafe816`/`nisune-86-faji869`/`paletu-13-done030`) — distinct
   from classifier-level `BackgroundColor`.
6. **`skinparam guillemet`** (custom stereotype-wrap bracket, `<< >>`/
   `$$ $$`/`[ ]`/`none` instead of the default `«»`, NEWLY DISCOVERED N24
   via the full-corpus regression scan, 4 fixtures) —
   `class-stereotype.ts#wrapGuillemet` hardcodes `«»`.
7. **`skinparam classStereotypeFontSize`/`classStereotypeFontStyle`**
   (per-stereotype font override, a THIRD stereotype-adjacent `FontParam`
   distinct from `CLASS_ATTRIBUTE` (N23) and the base theme font, NEWLY
   DISCOVERED N24, 1 fixture `datugo-88-sote552`) —
   `class-stereotype.ts#CLASS_STEREOTYPE_FONT_SIZE` is a flat constant.
8. **`skinparam groupInheritance`** (unchanged since N9/N12, `pijiju-95-xexi872`).
9. **`skinparam mode dark`** (unchanged since N7, `zirori-93-jefo337`).
10. **`class Collection<T>` generic type-parameter tag box** (unchanged
    since N12/N21/N23 — `HeaderLayout#getDimension`'s `genericDim` term,
    still 0 in this port's model even after N24's stereo work; explicit
    DOT-gate risk).
11. **`sasito-46-padu855`'s space-before-colon bug** (a member's own
    already-typed display renders `counter: string` instead of the source's
    `counter : string`, NEWLY SURVEYED N24, single fixture, root cause not
    traced).
12. Every item unchanged from N22's own queue not superseded above (`<&glyph>`
    OpenIconic/FontAwesome-icon rendering, `skinparam diagramBorderColor`,
    `<style> note {}` CSS-class cascade, `remove`/`restore` dense-
    renumbering, nested `|_` member tree-list syntax, embedded diagram block
    in member text, gradient skinparam colors, double couple, `skinparam
    topurl`, member/relationship-edge `[[url]]` variants beyond inline
    creole, `ent0001`/`ent0002` id swap, `scale max N height`,
    `!pragma layout elk`, `[hidden]` suppression, `sadamo-18-siva346`,
    graphviz-ts coordinate offset, anchor-in-cluster footprint, title-driven
    package width floor, strictuml classifier-spot-badge suppression,
    package/namespace stereotype -> `PackageStyle` dispatch, lollipop
    half-circle socket, file-size-cap housekeeping) — see `plans/g2-class-
    svg/ledger.md` N15-N24 for the full renumbered list.

**RESOLVED N24, drop from future queues**: classifier header stereotype
text row (single AND stacked) — landed. Post-hoc `<Name> <<stereotype>>`
statement — landed. `hide|show [<<pattern>>] stereotype(s)` — landed
(narrower slice: `<<pattern>>`-or-none `GENDER` only, the type-keyword/
entity-id `GENDER` forms for this portion remain unported, zero corpus
reach found). Fully-suppressed-classifier `+4` height bug — fixed. Badge
`cy` `28`-constant fallback bug — fixed.
