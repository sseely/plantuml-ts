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
