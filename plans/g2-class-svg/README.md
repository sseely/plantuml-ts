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

| N25 | Relationship multiplicity/cardinality end-label text (`C1 "1" -- "1" C2`, N24's own top queue item, ~28/718 corpus-wide reach): full mechanism diagnosed from graphviz C source directly (`lib/label/xlabels.c`/`lib/common/postproc.c`/`lib/dotgen/dotsplines.c`) after empirically ruling out the simpler angle/distance formula (`place_portlabel`) -- `CucaDiagram#getLabeldistance/getLabelangle` are DEAD upstream fields, never read by any `net/` DOT-emission call site, so real placement is graphviz's `addXLabels`/`placeLabels` external-label force-search. LANDED as a real, structurally-correct mechanism: `graphviz-ts` (the vendored engine) already ships a faithful, line-cited port of this ENTIRE algorithm (`label/xlabels.ts` + 2 sibling files), wired into its own layout pipeline, but its PUBLIC `getLayout()` snapshot never exposes the result (ADR-1, internal `Edge` model not re-exported) -- new `core/graph-layout.ts#extractPortLabelPositions` extracts it via `render()`'s own SVG output (a return value previously discarded), regex-scanned by node/edge `<title>` id, mirroring upstream Java's OWN identical raw-SVG-scan technique (`SvekEdge.java#solveLine`'s `getXY(fullSvg, color)`) for the same category of engine-internal-value problem. New `DotInputEdge.attributes.tailLabel`/`.headLabel` (text, additive/optional -- every non-class caller unaffected, verified via all five DOT-gate counts unchanged), `class-layout-helpers.ts#edgeLabelAttrs` now sets them from `rel.fromMultiplicity`/`.toMultiplicity`, `class-geo-builders.ts#attachPortLabels`/`portLabelAnchor` (new -- center-to-baseline-anchor conversion, `CARDINALITY_FONT_SIZE=13` jar-verified against `plantuml.skin`'s `arrow{FontSize 13}` block), `renderer.ts#renderEdge` draws the new `<text>` elements (jar-verified byte-exact attribute SET: `fill="#000000"`, `font-size="13"`, `font-family="sans-serif"`, `lengthAdjust="spacing"`+`textLength`, no `text-anchor`). Neither of the two named direct-target fixtures (`dokego-92-zilu832`, `kipure-14-suli112`) reaches zero-diff -- each is blocked by a SEPARATE, already-named-or-newly-unmasked mechanism (kipure: the unbuilt `-[#color]->` inline edge-color override, newly unmasked; dokego: the unbuilt `hide C2 circle`), and the position itself carries a residual traced to two further out-of-scope causes (the dominant share to the ALREADY-NAMED graphviz-ts spline-routing/edge-length divergence, verified byte-identical pre/post this iteration; a smaller share to a NEWLY-DISCOVERED `graphviz-ts` builder-API gap -- no fixed-size/HTML-table label override exists via the programmatic builder, unlike jar's own `FIXEDSIZE=TRUE` technique, so `graphviz-ts`'s internal placement-search geometry uses its own slightly-mismatched `Times`-LUT text measurement instead of this port's verified sans-serif metrics). Full-corpus regression scan (34-fixture quoted-multiplicity grep population, 12 with cached oracles): 8 regressed (diff-count increases, all pre-existing-non-zero childCount-unmasking, same pattern every iteration since N2) / 3 unchanged (correctly out-of-scope: `!pragma layout elk`, a role-only combined-syntax fixture that never sets `fromMultiplicity`, a grep false positive) / **0 zero-diff regressions**. | 0 new zero-diff (both direct targets blocked by separate mechanisms, see ledger.md N25 mechanism table); census 121/718 (unchanged) · 1-3:46 · 4-10:161 · 11-30:55 · 31+:335 | done |
| N26 | Three N25-named priorities landed (color/style edge override, entity-qualified hide, badge customization), full details `ledger.md` N26. (1) `-[#color]->`/`-[bold\|dashed\|dotted]->`/`-[thickness=N]->` bracket-modifier overrides (`WithLinkType.applyStyle`) -- widened past the literal brief wording after a 13-fixture corpus survey to cover thickness/dashed/dotted/bold too (same already-captured bracket grammar, `hidden`/`norank` explicitly excluded as DOT-affecting); reuses the shared `core/svek/svek-edge-stroke.ts#strokeForStyle` formula description's own edge renderer already uses. (2) Entity-qualified `hide <entity> circle\|members\|fields\|methods` (`CommandHideShowByGender`, GENDER=entity-id) -- widened from the 1 named fixture to an 8-fixture population after survey; type-keyword and `<<stereotype>>` GENDER forms explicitly deferred. Surfaced and fixed a genuine PRE-EXISTING bug while jar-verifying: `measureGenericClassifier`'s `memberAreaWidth` ignored `suppress.fields`/`.methods` (every prior caller happened to never exercise a suppressed-but-content-bearing compartment). (3) Badge `(CHAR,COLOR)` decoration customization (`StereotypeDecoration#buildComplex`) -- COLOR always wired (jar-correct always); LETTER only when it coincides with one of the 5 pre-captured glyphs (C/I/A/E/@), the ~10 other corpus letters deferred (would need new corpus-scraped glyph data). One full-corpus-scan regression (`nagega-30-poso418`, +40 diffs) diagnosed and KEPT (not reverted): the comparator's own `@d`-attribute command-letter-collapse behavior unmasking an unrelated, pre-existing, already-named-category (graphviz-ts) position residual -- both the color AND letter fix independently re-verified byte-exact against jar by name-based extraction. DOT gate (708/708) and description ratchet (51/51) unchanged; all three full-corpus scans (13/27/20 fixtures) showed 0 zero-diff regressions. | 6 new zero-diff (`girebu-21-keva371`, `nirija-04-veti140` -- item 2; `foraso-61-gesu813`, `vevoju-56-medu197` -- the memberAreaWidth fix; `romuco-53-sesu052` -- item 3); census 126/718 (was 121/718) · 1-3:46 · 4-10:157 · 11-30:54 · 31+:335 | done |

| N27 | Fresh full-corpus reclassification (last WHOLE-corpus pass was N10, 17 iterations stale) -- 592 non-conformant fixtures regex-tagged against the N26 queue + per-fixture diff-family-signature clustering for the untagged remainder; refreshed reach table in `ledger.md` N27 (several N9-N26 estimates corrected: groupInheritance 1->7, elk 4->7, bare-hide-fields/methods 1->5; "undefined-entity arrow variants" RENAMED -- it's actually the D6-deferred PLUS/SQUARE/CROWFOOT/PARENTHESIS arrowhead-marker-shape gap, not entity definedness; ONE genuinely NEW mechanism found -- dotted-namespace nesting, `namespace A.B.C {}`/qualified cross-namespace refs, jar creates NESTED per-dot-segment clusters, this port creates one flat cluster, DOT-topology-affecting). Drilled and LANDED 2 mechanisms: (1) `skinparam guillemet <value>` (start/end stereotype-wrapper override, `Guillemet.fromDescription` -- `false`/`<< >>`->literal, `none`->empty, space-value->tokenize; new `theme.colors.graph.guillemetStart/End`, `class-stereotype.ts#wrapGuillemet` now takes an optional pair), all 4 target fixtures reached zero-diff; (2) bare global `hide fields`/`hide methods` (`CommandHideShowByGender`, GENDER absent + no `empty` qualifier -> unconditional, distinct from `hide empty fields`/`hide empty methods` -- new `HideTarget` members + `applyDirectives` branches), corpus-verified 5-fixture reach (N26 believed 1), mechanism correct but 0/5 reached zero (each blocked by a separate larger issue). Surveyed in full, NOT landed (time-budget/risk-bounded per this mission's "survey fully, land only if bounded" precedent): note/rect background-color override (entangled with 2 NEWLY DISCOVERED pre-existing bugs -- freestanding-note `polygon`-vs-`path`+unfilled-fold shape gap, a note id off-by-one); the renamed arrowhead-marker-shape gap (D6 follow-up, needs 4+ new vector marker shapes, bigger than a value-wiring fix); `skinparam groupInheritance` (root-caused to `DotData.java#removeIrrelevantSametail`, a DOT-EMISSION-level edge merge -- correctly OUT of this render-only mission's charter, named for a maintainer scoping decision). Also discovered and fixed a PRE-EXISTING bookkeeping gap: `class.golden.ratchet.test.ts` was stale at 121/121 (5 already-zero-diff fixtures from N26's own landings were never appended to `ratchet.json` -- N26's "126/126 green" claim measured the census count, not the actual ratchet-test count); backfilled those 5 plus this iteration's own 4, DOT-EQUAL re-verified via `dot-sync-report.ts --equal-list` (faster than a full `svg-parity-survey.ts` regeneration, and sufficient since neither mechanism touches DOT topology). Full-corpus regression scans (both mechanisms, full 718-fixture corpus, not sampled): **0 regressions of any kind** for either mechanism. | 4 new zero-diff (`cezazo-40-raja394`, `ribomo-92-naco581`, `topige-52-fiku910`, `zalazo-34-livu931`); census 130/718 (was 126/718) · 1-3:46 · 4-10:153 · 11-30:54 · 31+:335 | done |
| N28 | PLUS/SQUARE/CROWFOOT/PARENTHESIS extremity marker shapes (D6 follow-up, N27's renamed top priority) LANDED, widened to the full crow's-foot IE family (`CIRCLE_CROWFOOT`/`CIRCLE_LINE`/`DOUBLE_LINE`/`LINE_CROWFOOT`, all already-built `ExtremityFactory` shapes reused from description -- `class-arrow-grammar.ts#headToDecor` widened, `ast.ts#LinkDecor` +8 members, `renderer-arrowhead.ts#DECOR_TO_NAME` +8 entries). UNMASKED and LANDED a bigger, universal, previously-unverified mechanism alongside it: the connecting `<path>` was never trimmed for ANY decor kind (triangle/diamond/arrow included, not just the 4 new shapes) -- zero pre-N28 ratchet-pinned fixture ever exercised a real drawn decorated edge. New `renderer-arrowhead.ts#applyDecorTrim` (`SvekEdge#drawU`'s `dotPath.moveStartPoint`/`.moveEndPoint` render-side counterpart, ported for the flat `EdgeGeo.points` list class's renderer uses instead of a `DotPath` object), jar-verified via a LIVE `oracle/dist/plantuml-oracle.jar -tsvg` run (not just the corpus cache) -- corrected 2 stale golden-string unit tests this fix broke, both re-verified against the live jar. `newpage` census-harness bug found and fixed per the brief's own instruction ("check how the census/oracle handles multi-page fixtures before building anything"): `render-fixture-class.ts#renderFixtureClass`'s doc comment already promised page-1-only comparison but the implementation never actually stripped `ast.pages`, silently comparing this port's deliberate all-pages-stacked PRODUCTION behavior (D1/T7, unchanged) against a jar oracle that only ever exports page 1 (`AbstractDiagram.getNbImages()` => 1, unconditionally). Fixed test-harness-only. `mainframe <text>` surveyed (1/718 corpus reach, genuinely new folded-corner-frame geometry needed) and ledgered, not built. note/rect background-color override re-confirmed unchanged from N27 (not re-diagnosed or re-attempted -- remaining budget spent on the two tractable mechanisms above). Full-corpus regression scan (extremity shapes + trim): zero-diff set identical (130=130) / 18 improved / 10 regressed (all the same childCount-unmasking-onto-already-named-residual pattern documented since N2) / **0 zero-diff regressions**. | 2 new zero-diff (`bufogi-69-naba929`, `gevuci-69-fafe469`, both from the `newpage` harness fix); census 132/718 (was 130/718) · 1-3:48 · 4-10:147 · 11-30:54 · 31+:337 | done |
| N29 | Re-attributed-routing-divergence drill (orchestrator's 2026-07-17 falsification follow-up): byte-diffed our ACTUAL production `DotInputGraph` (captured via `setLayoutInputObserver`+`toSvekDot`) against the jar's cached `svek-1.dot` on 5 pure-`path/@d` fixtures -- `farina-07-foti023` (a plain 3-node chain) proved node/edge SET, ORDER, and every attribute were ALREADY byte-identical to the jar's DOT, falsifying hypothesis 1 (declaration order); a standalone graphviz-ts-vs-real-dot repro on the exact same graph found ZERO coordinate difference either, falsifying an engine-level explanation too. Root cause found by diffing the RENDERED `<path d>` instead: a uniform ~11.4px shortfall matching graphviz's *default arrow-length spline-clip reservation* -- `class-dot-graph.ts#buildDotGraph` never set `manualArrowheads: true`, even though class has drawn every arrowhead as an inline extremity polygon (not an SVG `marker-end`) since N1; the shared `graph-layout.ts`/`graph-layout.types.ts` doc comments listing "class" among the marker-end callers were stale since that cutover. LANDED: one field addition (`manualArrowheads: true`) in `class-dot-graph.ts`. Also caught and fixed a pre-existing stale test (`class-newpage-layout.test.ts`): N28's own doc comment already stated the jar-verified-correct edge endpoint (y=109.79/114.79) but the baked-in assertion string was never updated to match it -- confirmed via a fresh live jar run. Full-corpus regression scan: 85 improved / 2 regressed (both +1-diff noise on already-31+-bucket fixtures, same childCount-unmasking pattern since N2) / 631 unchanged / **0 zero-diff regressions**. Ratchet grown 132->162 (164 tests incl. AC2/AC3); DOT gate (708/708 class, 262/262 component, 90/90 usecase, 78/80 object, 267/267 state) and description ratchet (51/51) both re-verified unchanged. Pure-`path/@d` population 41->25 (remaining residual named for N30). | 30 new zero-diff (largest single-mechanism jump this mission has recorded -- `bemuvo-33-jofa419`, `bulena-06-xutu087`, `buvake-41-vulu531`, `cikeni-99-kojo447`, `cuxaji-51-fozu735`, `desoro-94-viti994`, `dojuvi-07-duja723`, `farina-07-foti023`, `funagu-04-dako081`, `gazimo-19-tebe871`, `gubola-32-lofa138`, `jobubo-97-resa133`, `kabune-49-xace122`, `lifuki-73-bito214`, `lonota-83-xeco891`, `nipaci-26-mupo236`, `nitemi-09-nuza697`, `pabuma-15-zuga254`, `pazipa-18-fevi111`, `petune-47-raxa157`, `pexivi-54-ceri875`, `redamu-00-guki879`, `rexexi-22-soga527`, `sacala-27-firo431`, `sipeke-79-zibi282`, `sirati-17-kuje089`, `vuzesi-45-vuvu678`, `xexapu-93-kuto175`, `zekona-69-sifo120`, `zerofa-77-caro506`); census 162/718 (was 132/718) · 1-3:46 · 4-10:131 · 11-30:59 · 31+:320 | done |
| N30 | Continued N29's byte-diff method on the remaining 25-fixture pure-`path/@d` population (orchestrator's recommended 5: `bivize-12-xiko303`, `bunuce-10-vere519`, `cotacu-63-jisi866`, `getufo-87-xeca508`, `gojole-09-solo793`). All structurally byte-identical to jar's DOT (no engine divergence on any tested graph) -- SECOND consecutive seam-gap finding, not a graphviz-ts defect: `bivize`'s rendered `<path d>` was jar's exact 4 control points in REVERSE order -- traced to `SvekEdge.java#solveLine:637-654`'s real algorithm (a UNIVERSAL, type-agnostic, distance-based path-direction normalization keyed on `Link.getEntity1()`/`getEntity2()`, i.e. this port's own N9-verified `idEntity1`/`idEntity2`) versus this port's narrower hardcoded "always reverse hierarchical edges" rule. LANDED: `ast.ts` gains `idEntity1FullId`/`idEntity2FullId` (the non-leaf-stripped sibling of N9's existing fields, populated at both construction sites), new `class-geo-builders.ts#normalizeEdgePoints` replaces the hardcoded reversal with jar's real distance check (falls back to the old rule for couples/lollipop/map rows, where `idEntity1FullId` is absent by construction). A first attempt wiring `idEntity1Decor`/`idEntity2Decor` into arrowhead placement caused a real regression (`rekazo-16-jola519`) -- instrumented per diagnosis.md, found a genuine, separate, pre-existing bug in THOSE fields for cross (`x`) notation (named, not fixed); corrected design derives per-position decor from the already-correct `sourceDecor`/`targetDecor` via a `matchesFromTo` boolean instead, sidestepping the adjacent bug entirely. Full-corpus scan: 36 improved / 2 regressed (both instrumented, not waved off -- traced to a genuinely SEPARATE, pre-existing DOT-rank-assignment divergence on multi-edge-same-pair graphs, confirmed via an untouched non-hierarchical edge in the same fixtures) / 680 unchanged / **0 zero-diff regressions**. Pure-`path/@d` population 25->16 (couples/badge-letter/unsurveyed remainder named for N31). | 9 new zero-diff (`bivize-12-xiko303`, `ducoka-05-cuce457`, `jibili-77-vatu959`, `likivi-72-liki123`, `sarovo-87-roza701`, `sutedi-60-rigi770`, `tejena-50-nodo558`, `xeriju-13-gika499`, `zadova-38-xamu320`); census 171/718 (was 162/718) · 1-3:46 · 4-10:128 · 11-30:58 · 31+:315 | done |
| N31 | Near-zero harvest (47-fixture 1-3 bucket, ~10 signature clusters, no dominant mechanism): 3 mechanisms LANDED. (1) inline `class Foo #color { ... }` classifier background override -- `Classifier.color` was parsed since always (`class-declaration-parser.ts`) but never threaded past the AST; new `ClassifierGeo.color` + `renderer-classifier-box.ts#resolveClassifierBackground` (bare/`back:` compound extraction via `resolveColorToSvgHex`), both geo-builder sites (mirrors N15's url-threading precedent). (2) edge `-[thickness=N]->`/`-[#color]->`/`bold` bracket overrides (N26) never reached the ARROWHEAD polygon/path (only the connecting `<path>` did) -- `renderer-arrowhead.ts#drawExtremityMarkup` hardcoded a default thickness-1 solid stroke unconditionally, unlike `SvekEdge.ts#drawU`'s real `stroke.onlyThickness()` recipe; now reads `edge.strokeWidth ?? 1` + the SAME resolved `colorOverride` the path uses (SQUARE/CIRCLE/PARENTHESIS extremities correctly unaffected -- their own `drawU` hardcodes a jar-verified 1.5 regardless of edge thickness). (3) `Member.typeSeparator` -- `formatMemberText` hardcoded canonical `': '` regardless of the source's own colon spacing; upstream stores member lines close to verbatim (jar-verified `sasito-46-padu855`'s `+counter : string` preserves the space before the colon). Pure-`path/@d` drill (16-fixture population): RE-CONFIRMED N19 repeat-coupling attribution for all 9 `(A,B)` couple-shape fixtures (drilled 5 directly per the brief's "verify what actually blocks them now" instruction) and N26 badge-letter attribution for the other 4 -- neither superseded by N29/N30. 3 fixtures got NEW findings, all surveyed-not-landed: `kuxato-79-muno809` (`skinparam linetype polyline` -- `splines=polyline` is never emitted by DOT-text emission NOR consulted by the real graphviz-ts layout call for either class or description; `graphviz-ts`'s own builder API exposes no `splines` setter -- genuine engine-level gap, OUT OF SCOPE per CLAUDE.md); `pafare-13-raje687`/`mudune-38-kide806` (`skinparam CircledCharacterFontSize` -- completely unwired, would need either glyph-path scaling or new per-size corpus-scraped glyph data PLUS a badge-box node-size change, explicit DOT-gate risk, not a value-wiring fix). `idEntityDecor` cross-notation bug (N30-named item #3): end-to-end-verified against the ONLY `x`-notation fixture in the corpus (`rekazo-16-jola519`) -- rendered `<path id>` is BYTE-IDENTICAL to jar; the field disagreement N30 flagged is upstream's OWN by-design semantics (`NOT_NAVIGABLE != NONE`), not a bug -- closed with NO code change. DOT-rank multi-edge-same-pair divergence: SURVEYED per the brief's explicit instruction -- `duruga-39-lani451`'s cached DOT shows two edges converging on the same node at `minlen=0` (a genuinely rank-tie-eligible graph, not a missing-attribute seam gap like N29/N30's own findings); evidence gathered, no minimal repro built (time-budget-bounded), recommended next step named for a future iteration. Also surveyed, deferred (each its own distinct mechanism, not "small"): childCount+viewBox cluster (18 fixtures, confirmed genuinely fragmented across 4 sampled sub-mechanisms -- generic-type-parameter tag box, namespace-bounds-after-internal-hide, self-loop routing, embedded-diagram-in-member-text); 3 DISTINCT badge/icon spot-color skinparam mechanisms (`stereotypeC`, `<style> spotClass`, `iconXColor`/`iconXBackgroundColor`); `AttributeFontStyle`/`ClassFontStyle` (revealed a genuine header-vs-attribute font-role split a real multi-compartment class needs but N23 didn't, since the enum single-compartment case coincidentally shares one font spec); `remove *`/`restore $tag` uid-renumbering gap. Full-corpus regression scan (2 disposable worktrees, combined): 28 improved / 0 regressed / 686 unchanged / **0 zero-diff regressions**. | 5 new zero-diff (`bisome-32-bevo992`, `foguga-43-nafe816`, `paletu-13-done030`, `ruzibe-92-doti700`, `sasito-46-padu855`); census 176/718 (was 171/718) · 1-3:43 · 4-10:127 · 11-30:57 · 31+:315 | done |
| N32 | Priority-ordered per the brief: 3 mechanisms LANDED. (1) `AttributeFontStyle`/`ClassFontStyle` header-vs-attribute font-role split (N31 cluster 6) -- root-caused `FromSkinparamToStyle.java:185-193` (`element.class.header` cascades from `element.class` when unset, explaining why N23's shared-font model coincidentally worked for the attribute-only case); `theme.ts` gains `classFontSize/Family/Bold/Italic` + `classAttributeFontBold/Italic`, `class-layout-helpers.ts#measureClassifier` builds separate `headerFont`/`attributeFont` (two baselineOffsets), `class-member-creole.ts#memberBaseFont` unions the forced attribute style into each member's own modifiers -- jar-verified `xabije-20-xusi569` (header 14/bold vs attribute 18/italic, genuinely diverge), `tuzipo-08-tixa575`/`covopi-80-sejo503`. (2) badge/icon spot-color trio (N31 cluster 5) -- 2/3 sub-mechanisms landed via REUSE: adding `spotclass`/etc to `ELEMENT_BUCKET_SNAMES` makes `<style> spotClass {...}` work for FREE via the pre-existing per-element-bucket mechanism (`gekofe-43-lufa479`), new `matchStereotypeSpotColorKey` translates the legacy `stereotype<X>BackgroundColor/BorderColor` flat form into the SAME bucket (`bisisi-31-xasa026`); per-visibility `iconXColor` CONFIRMED still separate, not landed (own dedicated wiring needed). (3) `class Foo<T>` generic type-parameter tag box (deferred since N12) -- re-assessed per the brief: `HeaderLayout.java`'s width formula genuinely widens the classifier's MEASURED box (real DOT-gate risk, confirmed not a false alarm), derived the FULL formula from 2 byte-exact samples (`caboco-62-jula911`'s `Foo<Param>`/`Bar<P, Q>`), new `class-stereotype.ts#measureGenericTagDim`/`buildGenericTagGeo` + `ClassifierGeo.genericTag` threaded through both geo-builder sites + `renderer-classifier-box.ts#renderGenericTag`; a SECOND sub-mechanism (`layout-ink-extent.ts#addClassicRectInk`, the file's own documented-but-unimplemented "classic symmetric -1/+1-inset URectangle" rule) was needed for the tag's above-box protrusion to size the canvas correctly. **Empirical DOT-gate check (the brief's explicit instruction) ran AFTER landing: all five counts UNCHANGED (component 262/262, usecase 90/90, class 708/708, object 78/80, state 267/267)** -- safe to land. A THIRD sub-finding (quoted-alias display generics, `class "Foo<int>" as Foo_int`) was jar-verified needed (`zaxate-23-xifa551`/`nesuti-69-giza389`) -- FIRST attempt applied the extraction to all 4 `parseIdDisplay` branches uniformly and IMMEDIATELY broke the DOT gate (707/708, a TIM-macro-substituted C++ template signature's id got truncated, `nagega-30-poso418`); diagnosed, scoped back to `quotedAlias` only (the one branch where `id` is a SEPARATE explicit alias, never derived from `display`), re-verified 708/708 -- the empirical-check protocol catching a real near-miss before it shipped. Item 4 (namespace-bounds-after-internal-hide/self-loop routing) NOT attempted -- time budget fully consumed by the three priority mechanisms, each deeper than expected. Full-corpus regression scan (2 disposable worktrees): 15 improved / 8 regressed (all the SAME childCount/position-cascade-unmasking pattern every iteration since N2 has recorded, 2 sample-diagnosed) / 695 unchanged / **0 zero-diff regressions**. | 7 new zero-diff (`bisisi-31-xasa026`, `caboco-62-jula911`, `covopi-80-sejo503`, `gekofe-43-lufa479`, `nesuti-69-giza389`, `tuzipo-08-tixa575`, `zaxate-23-xifa551`); census 183/718 (was 176/718) · 1-3:41 · 4-10:122 · 11-30:58 · 31+:314 | done |
| N33 | Fresh full-corpus reclassification (535 non-conformant, puml-source heuristic tagger against every N9-N32 named mechanism -- confirms N6/N10/N27's fragmentation finding again, 288/535 untagged, no hidden universal mechanism). DOT-rank multi-edge-same-pair divergence SURVEYED (brief's explicit instruction, N30-named) via the byte-diff method against BOTH real `dot` (confirmed present, `/opt/homebrew/bin/dot` 15.1.0) and `graphviz-ts`'s own `renderSvg` fed jar's exact cached DOT text directly -- BOTH agree with jar's own node order, falsifying an engine divergence a THIRD consecutive time (after N29/N30); root-caused to a REAL seam gap instead: `class-dot-graph.ts#buildDotEdges:186-187` derives DOT tail/head from the arrow-decoration-driven `rel.from`/`rel.to` pair instead of the arrow-decoration-independent, already-N9-verified `rel.idEntity1`/`idEntity2` pair jar's own `Link.getEntity1()`/`getEntity2()` uses -- diagnosed, NOT fixed (explicit DOT-gate risk, wide blast radius, needs its own dedicated iteration). 2 mechanisms LANDED: (1) badge glyph table widened 5->9 letters (P/M/F/? derived by inverting `badgeGlyphPath`'s own translate against jar's cached SVGs, `renezi-40-jupi466`/`jarigi-34-nage684`/`cotacu-63-jisi866`). (2) collapsed-empty `package`/`namespace` draws `EntityImageEmptyPackage`'s folder-tab icon instead of a classifier box (`class-namespace-shape.ts#measureEmptyPackageLeafDim`/`renderEmptyPackageIcon`, new; `class-magma.ts#isCollapsedGroup` exported for reuse) -- 2 real sub-bugs found and fixed while jar-verifying (wrong colors: package-cluster skinparam colors instead of classifier-box defaults; wrong ink-extent rule: `addRectInk`'s classifier-specific `UEmpty`-reservation quirk instead of `addPlainInk`'s plain `UPath` rule) -- geometry/color/position proven byte-exact on `gatula-10-bifu561` in isolation, but 0 DIRECT new zero-diff from this mechanism alone (3 named remainders: a sub-pixel canvas-width residual, a NEWLY-DISCOVERED collapsed-namespace draw-ORDER finding not fully diagnosed across 2 contradictory fixture samples, and one pre-existing unrelated Object/ArrayList swap bug unmasked). Full-corpus regression scan (1 disposable worktree, symlink gotcha diagnosed: `assets/` is git-tracked, only `assets/stdlib/` needed symlinking): 8 improved / 3 regressed (all 3 instrumented/diagnosed, none a fault of the landed mechanisms) / 707 unchanged / **0 zero-diff regressions**. | 3 new zero-diff (`cotacu-63-jisi866`, `jarigi-34-nage684`, `renezi-40-jupi466`); census 186/718 (was 183/718) · 1-3:35 · 4-10:125 · 11-30:58 · 31+:314 | done |
| N34 | Sub-classified the note-of-member family (44-fixture N33 tag) + note-adjacent clusters (style-note-cascade 6, note-on-link 5, note-faint-css 2, note-bg-color 1): 99 note-bearing fixtures total, 87 non-conformant, per-fixture raw-diff-triple inspection (not just family aggregation) sorted into 2 landed mechanisms, 2 surveyed-and-deferred, and 2 newly-discovered false-positive-tagged mechanisms (confirms N9/N13's own "heuristic massively overcounts" finding generalizes here). LANDED: (1) note background color -- explicit `#color` override (`NOTE_COLOR` was non-capturing since N6, same drop pattern the module's own doc comment admitted) threaded through `ClassNote.color`/`PendingNote`/`NoteGeo.color`, plus `<style> note { BackgroundColor }` bare bucket (`'note'` added to `ELEMENT_BUCKET_SNAMES`, N32's `spotclass`-for-free precedent) -- new `class-color-override.ts#resolveBareOrBackColor` (moved out of `renderer-classifier-box.ts`'s previously-private classifier-only helper, now shared with `renderer-note.ts#resolveNoteBackground`); the `.tagname` stereotype-cascade sub-selector (`note { .faint {...} }`) surveyed and deferred as a genuinely new subsystem, not a wiring gap. A REAL regression caught within the iteration (diagnosis.md discipline, full `tests/unit/class/` suite run before declaring done, not just note files): `class-container.ts`'s namespace/package block-open commands ALSO import `NOTE_STEREO`/`NOTE_URL`/`NOTE_COLOR` from `class-notes.ts` -- making `NOTE_COLOR` capturing silently shifted two unrelated capture-group indices there too, fixed same iteration. (2) member-tip `EntityImageTips.java`'s `ySpacing` (10px reserved PER TIP, unconditionally, jar-verified via the cached DOT node height AND a real rendered inter-tip gap) was missing from BOTH the DOT-node height (`groupNodeSize`) and the visual stacking offset (`mapGroupNoteGeos`'s `yOffset`) -- landed alongside a related anchor-X fix (`ClassifierAnchor.rows[].indent`, icon-zone-aware, ASYMMETRIC between the row's left edge -- flat margin regardless of icon -- and right edge -- indent-aware; a first uniform-indent attempt regressed an already-zero-diff fixture by exactly the icon-width delta, caught and corrected same iteration). Kept despite one non-zero-diff regression (`fomofi-36-lova857`, 18->61, diagnosed: an UNRELATED, pre-existing, unbuilt `--`-as-horizontal-rule-in-note-text mechanism already mismeasured this fixture's note height before this iteration). Newly discovered, surveyed, NOT fixed (both false-positive note-tags, NOT note-family mechanisms): a nested-namespace-with-no-direct-classifiers geometry gap (`buildNamespaceGeos` silently drops a namespace's OWN geo when it has zero direct classifiers, even though it's a real DOT cluster with bounded descendant sub-namespaces -- 7 corpus-duplicate fixtures of one source diagram); note attached to a PACKAGE/namespace target (`note top of <package> : text`, jar routes the connector to the package's own cluster anchor, this port's `addNote` only resolves classifier targets -- `pecabi-95-demu756`/`sanixi-31-nofa193`). Full-corpus regression scan (1 disposable worktree): 13 improved / 1 regressed (diagnosed above, kept) / 704 unchanged / **0 zero-diff regressions**. | 6 new zero-diff (`gerima-02-fade831`, `jiceke-84-xoze695`, `rubuxe-58-peba652`, `sanusa-54-keda128`, `tobigu-87-raci272`, `xumeli-52-keso732`); census 192/718 (was 186/718) · 1-3:34 · 4-10:126 · 11-30:57 · 31+:314 | done |
| N35 | Couple/lollipop residual family (37-fixture N33 tag, N19/N20's largest tractable named mechanism, deferred repeat-coupling/double-couple leftover): re-derived the family from scratch via the parser's OWN regexes (not the deleted N33 heuristic tagger) -- confirms the same 37-fixture count independently, sub-classified into 11 single-coupling (4 already zero), 9 repeat-coupling (uniform 16 diffs, pure `path/@d`), 2 double-couple (still `@id`/`childCount`-blocked, N20's burn-order diagnosis re-confirmed unimplemented, not attempted), 13 lollipop, + 2 newly-found couple fixtures absent from N19/N20's own enumeration. Extended the N29/N30/N33 falsification method one layer deeper for the repeat-coupling `@d` residual: `graph-layout.ts#layoutGraph`'s own `getLayout()` API and `graphviz-ts`'s `render()` API disagree with EACH OTHER for the identical graph (no jar involved), with `render()` matching jar's real value -- FALSIFIES the catch-all "graphviz-ts routing offset" label (N8) for this population: not a node-position divergence (positions match byte-exact everywhere checked) but a narrower `getLayout()`-vs-`render()` spline-reconstruction inconsistency INSIDE graphviz-ts itself, classified gvts-genuine, NOT fixed (cross-cutting `src/core/graph-layout.ts` seam shared by every graph diagram type -- same wide-blast-radius deferral reasoning N33 used for `buildDotEdges`). 2 mechanisms LANDED: (1) lollipop display-label ink-extent gap (`layout-ink-extent.ts#addLollipopRowInk`, new) -- the label centered under the fixed 10px circle overhangs it on both sides once wider than the circle, previously uncounted in the document's ink-extent walk, undershooting canvas width by exactly the missing overhang (jar-verified `makoko-44-mapu988`/`paluca-39-desa696`); (2) multiplicity/cardinality tail/head-label `textLength` never rounded through `javaRound4` (`class-geo-builders.ts#portLabelAnchor`, was the ONE measured-width field left as a raw float engine-wide, jar-verified `jaloja-18-tisu915`). Full-corpus regression scans (1 disposable worktree each): Mechanism 1 -- 9 improved / 0 regressed / 709 unchanged / 0 zero-diff regressions; Mechanism 2 -- 28 improved / 0 regressed / 690 unchanged (corpus-wide reach, confirmed beyond the couple/lollipop family via `dokego-92-zilu832`). | 2 new zero-diff (`rudigu-21-lici107`, `ximuza-91-gena795`); census 194/718 (was 192/718) · 1-3:36 · 4-10:127 · 11-30:49 · 31+:312 | done |
| N36 | style-cascade-classifier-bg ancestor cascade (brief priority #1, 23-fixture N33 tag): root-caused upstream's REAL style-matching algorithm (`StyleSignatureBasic#matchAllImpl`'s pure SET-CONTAINMENT test + `StyleStorage#computeMergedStyle`'s registration-order-wins merge) -- a bare `classDiagram {}`/`root {}` selector legitimately cascades down to EVERY more-specific element whose signature includes that SName (classifier box, header/member text, edge stroke) but correctly SKIPS the badge/spot (no `classDiagram` token in its own signature, root-only). New `style-map-element.ts#resolveStyleCascade` (general subset-match resolver, Map-iteration-order = jar's real registration order, no fixed precedence list needed unlike N7's own) + `style-cascade-class.ts#computeClassStyleCascadeOverrides` (8 new Theme fields: box/border/font/header-font/arrow/spot-bg/spot-border/spot-font), wired into `classifierFill`/new `classBorder()` helper/`renderRowText`'s new `isHeader` param/`renderRowAtoms`/`renderBadge`'s new `rootFallback` params/`renderEdge`'s stroke resolution. One regression caught+fixed within the iteration: `resolveColorToSvgHex` echoes an unparseable token (jar's unbuilt `#?black:white` conditional-color ternary) UNCHANGED by design -- a `parseSimpleColor`-gated guard in `cascadeHex` prevents that garbage string from ever overriding the pre-existing hardcoded default. Deferred: the SAME `.tagname` stereotype sub-selector item #3 named for notes, confirmed shared/genuinely-new-subsystem for classifiers too (6 fixtures, `RoundCorner`/`FontStyle` have no Theme field at all yet). Priority #2 (nested-namespace-with-no-direct-classifiers geometry gap, re-derived at 45 real fixtures not N34's 7-fixture estimate) LANDED then REVERTED: structurally correct (uid/childCount now byte-exact) after adding a new `Namespace.dottedImplicit` AST flag to exclude the dotted-namespace-split population (interacts with N27's already-deferred DOT-topology mechanism, scrambled uid order), but the genuinely-targeted explicit-brace-nesting population (12 fixtures) still has an UNRESOLVED nested-cluster padding-formula gap (coordinates uniformly off by a small offset) that inflated diff counts 200-1000x with 0 fixtures reaching zero -- reverted via `git show HEAD:<path>` on the 3 untouched-by-mechanism-1 files, named for a dedicated future iteration with the padding formula as its explicit starting point. Full-corpus regression scan (3 disposable worktrees across both mechanisms' diagnosis): FINAL state (mechanism 1 only) -- 13 improved / 0 regressed / 705 unchanged / **0 zero-diff regressions**. | 3 new zero-diff (`bikuka-40-pezi068`, `cilaba-36-zogi212`, `tolavi-09-jovu646`); census 197/718 (was 194/718) · 1-3:36 · 4-10:126 · 11-30:47 · 31+:312 | done |
| N37 | `.tagname` stereotype-name style-cascade sub-selector (brief priority #1, shared classifier+note subsystem, N34/N36-deferred): extended `style-map-element.ts#resolveStyleCascade` with an optional `stereotypeTags` param (new `parseTagSelector` helper, 100% backward-compatible) reproducing `StyleSignatureBasic#matchAllImpl`'s SECOND (stereotype) subset test alongside N36's existing SName test in ONE pass. New `style-cascade-class.ts#classCascadeRoundCorner` (ancestor-only `RoundCorner` -- NO PRIOR mechanism existed at all, `buildHeaderPrimitive` hardcoded `rx:2.5,ry:2.5` unconditionally) + `classTagCascade` (per-tag background/border/fontColor/roundCorner/fontBold/fontItalic) + `resolveClassTagCascadeEntry`; wired into `classifierFill`/`classBorder`/`buildHeaderPrimitive`'s new rx/ry formula/`renderRowText`'s new `isStereoLabelRow` exclusion (a stacked `<<stereotype>>` LABEL row never adopts the tag's FontColor, jar-verified)/`measureClassifier`'s bold/italic font-spec merge (verified render-only, zero DOT-gate risk -- `FontSpec` has no bold/italic field the measurer reads). A GENUINELY NEW sub-mechanism found jar-verifying `dozude-05-jeve029`: TRIPLE-bracket `<<<mystyle>>>` draws NO visible stereotype text but STILL matches its `.mystyle{}` styling -- bracket count controls DISPLAY independent of STYLE-MATCHING (new `class-stereotype.ts#splitStereotypeTokens`/`splitStereotypeStyleTags`, `ClassifierGeo.stereotypeLabels`). Note side: `ClassNote.stereotype` NEVER captured before this iteration (new `NOTE_STEREO_CAPTURE`, SEPARATE constant from the non-capturing `NOTE_STEREO` namespace-block commands still use, avoiding N34's own capture-group-index regression risk) threaded through all 4 note-creation forms (class-commands.ts 6b/6c/6d/6e) + `NoteGeo.stereotype` + new `style-map-element.ts#computeNoteStyleTagCascade` wired into `renderer-note.ts#resolveNoteBackground`. Surveyed, NOT landed: priority #2 `skinparam classStereotypeFontSize/FontStyle` (12 fixtures, confirmed generic-bucket-mechanism reach but a NEWLY DISCOVERED badge-radius-scaling sub-finding on 2 samples makes a confident DOT-gate-safe attempt premature until that formula is derived) and priority #3 `CircledCharacterFontSize` (N31/N33 reach unchanged, same undiscovered radius formula blocks a confident attempt, not re-surveyed this iteration). Full-corpus regression scan (1 disposable worktree): 8 improved / 0 regressed / 710 unchanged / **0 zero-diff regressions**. | 6 new zero-diff (`dozude-05-jeve029`, `fabuje-68-gona310`, `mebake-99-vifa562`, `neruke-07-ruce381`, `rakici-44-tivo701`, `vukugu-90-kafo811`); census 203/718 (was 197/718) · 1-3:33 · 4-10:124 · 11-30:46 · 31+:312 | done |
| N38 | Badge radius formula LANDED (brief priority #1): derived `resolveBadgeRadius` directly from `SkinParam#getCircledCharacterRadius()` (`skin/SkinParam.java:542-545` -- explicit `circledCharacterRadius` wins, else `floor(circledCharacterFontSize/3)+6`, default fontSize 17 reduces to the pre-existing hardcoded 11), verified 12/12 class-corpus samples byte-exact (formula derived from source, not curve-fit) -- also disambiguates N37's own misattribution: the badge radius is driven ONLY by `circledCharacterFontSize`, NOT the unrelated `classStereotypeFontSize` N37 suspected. Threaded through 5 call sites (`class-badge.ts`'s new `badgeBoxWidth`/`badgeBoxHeight`, `class-layout-helpers.ts#measureGenericClassifier`, `class-stereotype.ts#buildHeaderRow`, `renderer-classifier-box.ts#renderBadge`, `theme.ts`/`skinparam.ts` two new fields) -- DOT-gate empirical-check protocol run per the brief's explicit instruction, all five counts UNCHANGED. Landed alongside a per-`circledCharacterFontSize` 'C' glyph capture table (new `class-badge-sized-glyphs.ts`, split for the 500-line cap) covering the 9 default-Monospaced-family sizes (13-16,18-22) the corpus exercises -- empirically falsified a linear-scale hypothesis first (AWT hinting rounds each point size's contour independently, confirmed via `defipi-14-xunu847`'s real size-18 outline vs a scaled size-17 one, >1% off at several points). Font FAMILY (`circledCharacterFontName`) and STYLE (`circledCharacterFontStyle`) glyph-shape variants surveyed, NOT captured (3 fixtures, combinatorial scope beyond this iteration -- `datugo-88-sote552`/`gateja-70-losi738`/`depulu-53-xoca727`, each ALSO dominated by the separately-scoped, unlanded `classStereotypeFontSize`/`FontName`/`FontStyle` mechanism per-fixture-diagnosed and re-scoped for a dedicated future iteration mirroring N32's header-vs-attribute font-role-split precedent). Full-corpus regression scan (1 disposable worktree, `oracle/dist` needed its OWN symlink beyond N33's `assets/stdlib` precedent -- new gotcha): 19 improved / 0 regressed / 699 unchanged / **0 zero-diff regressions**. | 14 new zero-diff (9 from the font-size/glyph mechanism -- `defipi-14-xunu847`, `fipezi-47-jafu042`, `koloba-22-bolo151`, `macira-65-mugu751`, `mudune-38-kide806`, `munepa-74-lebe963`, `pafare-13-raje687`, `pucebe-24-xebi219`, `zijaso-54-gova798`; 5 bonus wins from the pure-radius-override path the initial reach survey missed -- `fidova-32-dige682`, `satuli-54-jija827`, `tetedu-79-jame815`, `vazizu-95-sari356`, `zebama-63-xoza192`); census 217/718 (was 203/718) · 1-3:34 · 4-10:124 · 11-30:45 · 31+:298 | done |
| N39 | Three mechanisms LANDED (all three brief priorities): (1) `<style>` sequential-block position-scoped `.tagname` cascade (`preprocessor.ts#stylePositions` -> `Classifier.styleGeneration` -> `theme.ts#classTagCascadeGenerations`) -- root-caused `net/atmp/CucaDiagram.java:808-819`'s `Entity#currentStyleBuilder` creation-time snapshot; TRUE class-diagram reach re-derived at 1/11 (the other 10 `<style>`-multi-block corpus fixtures are sequence/activity/deployment/component, a pre-existing corpus-classification artifact) -- `fexuta-62-piko653` byte-exact. (2) `<style> note { FontSize N }` / `skinparam noteFontSize` -- a pure wiring gap (`'note'` was ALREADY in `ELEMENT_BUCKET_SNAMES` since N34, `note-layout.ts`/`renderer-note.ts` just never consulted it) -- `xokipa-29-rafu481` byte-exact. (3) `classStereotypeFontSize`/`FontName`/`FontStyle` -- `FontParam.CLASS_STEREOTYPE`, jar-verified shared by BOTH the stereotype row(s) AND the generic `<T>` tag box (`EntityImageClassHeader.java:124-132`/`:144-148`, identical `FontConfiguration.create` call); UNSET means italic (the upstream default face), not plain -- disambiguated from N38's `circledCharacterFontSize` (badge-only). Reach re-derived from the REAL `test-results/dot-cache/class/` corpus at 12 (9 were absent from the stale `tests/corpus/` mirror); ALL 12 combine FontSize with FontName/FontStyle, so all three landed together. `teluve-08-moco846` byte-exact; `datugo-88-sote552`/`depulu-53-xoca727` drop to their SOLE remaining diff (the already-named N38 glyph-shape gap). DOT-gate empirical-check protocol run once after all three landed (Mechanism 3's own explicitly-flagged node-size risk, matching N32/N38 precedent) -- all five counts UNCHANGED; description gate re-verified after EACH mechanism per the brief's instruction. Item 4 (near-zero harvest): 35-fixture 1-3 bucket re-classified by diff-path signature into 5 small clusters + 15 singletons -- genuinely fragmented (N6/N33 precedent), surveyed not landed. Full-corpus regression scan (3 disposable worktrees, one per mechanism, plus a final combined scan): 7 improved / 0 regressed / 711 unchanged / **0 zero-diff regressions**. | 3 new zero-diff (`fexuta-62-piko653`, `xokipa-29-rafu481`, `teluve-08-moco846`); census 220/718 (was 217/718) · 1-3:35 · 4-10:124 · 11-30:43 · 31+:296 | done |
| N40 | url-wrap residue sub-classified (17-tagged N33 estimate): 3 mechanisms LANDED against a re-derived 22-fixture real reach -- (1) member-own-url icon-column background rect (`VisibilityModifier.java:94-116`'s `withInvisibleRectanble` branch, `class-visibility-icon.ts#renderVisibilityUrlBackground`, gated on the row's OWN url not the classifier fallback), (2) `skinparam pathHoverColor` global CSS hover rule (`renderer.ts#renderClass`, reuses the already-ported-but-unwired `svg-graphics-core.ts#getPathHover` shape), (3) creole inline `[[url]]` `<a>`-wrap (SHARED `core/klimt/creole` engine -- new `CreoleAtomUrl` field on the `'text'` atom + `StripeBuilder#analyzeAndAddInlineWithUrl`, `CommandCreoleUrl.ts`'s own doc-flagged "NOT built" gap from the e2r-creole mission, finally landed for class; description/usecase inherit the same fix since the engine is shared, description gate re-verified green). Priority 2 (tree-member `|_` list syntax) and Priority 3 (OpenIconic `<&glyph>`) both SURVEYED to exact, byte-verified upstream algorithms (`StripeTree.java`/`AtomTree.java`/`Skeleton2.java` for the tree; 6 distinct corpus glyph names + "literal vector path" proof for OpenIconic) but NOT landed -- both are genuinely 3-layer (parser/layout/render) features beyond this iteration's remaining time budget, left as a direct-start derivation for a future iteration. Full-corpus regression scan (1 disposable worktree): 4 improved / 0 regressed / 714 unchanged / **0 zero-diff regressions**. | 2 new zero-diff (`cokeje-99-gede231`, `dasagu-52-vani172`); census 222/718 (was 220/718) · 1-3:34 · 4-10:123 · 11-30:43 · 31+:296 | done |
| N41 | OpenIconic `<&glyph>` inline-atom mechanism LANDED end-to-end (recognize/measure/render, all 6 corpus glyph names -- `x`, `key`, `ban`, `caret-right`, `link-intact`, `thumb-up`): new `core/openiconic-glyphs.ts` ports OpenIconic's OWN resource SVG source (a better approach than N40's capture-from-jar proposal -- the jar ships literal relative-command path data directly, `openiconic/SvgPath.java`) through a full tokenize/absolutize/scale/translate pipeline, byte-verified EXACT against 5 independent jar-cached samples spanning `factor` 1.0/1.16667/2.0 across all of M/L/C/S/A -- caught and fixed a real bug along the way (`Movement#mutoToC`'s null-mirror `S` fallback is `c1=c2`, not the current point). New `openIconicOriginY` Y-position formula, empirically derived + jar-verified. Wired through `core/creole-atoms(-openicon).ts`, `Atom.ts`'s new `ambientFont` field, `StripeSimple.ts`, `class-member-creole.ts`'s new `'vector'` atom kind, new `renderer-openiconic.ts`. **0 new zero-diff**: all 9 corpus-reach fixtures individually diagnosed, each blocked by a DIFFERENT already-existing, unrelated mechanism (multi-line quoted classifier names, tab-stop column alignment, a pre-existing sprite-vs-vector divergence, and a newly-named member-row-height-growth gap for `factor > 1.75` icons) -- none introduced or worsened by this mechanism (full-corpus regression scan: 1 improved, 2 diff-count-INCREASED-but-verified-non-regressions via the childCount-unmasking pattern N2/N13/N40 already established, 0 zero-diff regressions). Priority 1 (tree-member `|_` list) NOT attempted (time budget); N40's own derivation stands unchanged as the starting point. | 0 new zero-diff (all 9 reach fixtures blocked by unrelated mechanisms, each individually diagnosed); census 222/718 (unchanged) · 1-3:34 · 4-10:121 · 11-30:43 · 31+:298 | done |
| N42 | Tree-member `|_` list syntax LANDED end-to-end (mission priority 1, carried N40/N41) -- ported upstream's WHOLE `BodyEnhanced1`/`BodyEnhancedAbstract` "enhanced body" render strategy (block separators `--`/`==`/`..`/`__` + `|_` tree runs), not a tree-only add-on -- N40's assumption that the tree could be isolated was disproven by direct `BodierLikeClassOrObject#isBodyEnhanced` reading. New modules: `class-body-enhanced.ts` (block splitting), `class-body-tree.ts` (`AtomTree`/`Skeleton2` port), `class-body-enhanced-layout.ts` (block-stacking arithmetic, jar-verified byte-exact against 3 fixtures), `renderer-body-enhanced.ts` (exact jar draw order, NOT the classic Y-sort merge). Dependency bugfix: `class-member-parser.ts#stripVisibility`'s missing same-2nd-char guard (`**bold**` was losing its own leading `*`), mirrors `class-object-commands.ts`'s pre-existing identical guard. **3 new zero-diff** (`fecolo-08-gepu579`, `jajebo-21-dada557`, `pacagu-24-nune023`) + 10 further non-tree block-separator fixtures improved substantially (not zero) via the same architecture; 4 regressions diagnosed (0 zero-diff, 2 confirmed childCount-unmasking, 2 narrowed to a named `hide ... members` directive gap in the new path, ledger.md N42 for full detail). | 3 new zero-diff; census 225/718 (was 222) · 1-3:36 · 4-10:116 · 11-30:45 · 31+:296 | done |
| N43 | Mission priority 1 RE-DIAGNOSED: `benemi-22-dufo622`/`xosiza-60-sobu480` were never enhanced-body cases at all (both indent their `--` line, defeating `isBlockSeparatorLine`'s raw-untrimmed check -- N42's own diagnosis was an artifact of `class-hide-visibility.test.ts`'s line-trimming test harness, not the real cached fixtures) -- corrected via direct jar-SVG reading: the real, unfixed mechanism is CREOLE's own `^--([^-]*)--$`/`^==([^=]*)==$`/`^\.\.([^.]*)\.\.$` horizontal-line atom recognition (`CreoleHorizontalLine.java`/`CreoleStripeSimpleParser.java`), independent of `BodyEnhancedAbstract`, applying to ANY simple-line creole text including a lone member row -- named as a new item, NOT landed (creole-atom-level scope). 3 mechanisms LANDED instead: (1) `applyVisibilityHideShow` now filters `classifier.rawBodyLines` too, mirroring upstream's `rawBodyWithoutHidden()` -- real, upstream-faithful, zero census impact (no corpus fixture combines an unindented enhanced body with visibility-hide yet). (2) `tryParseAttribute`'s greedy `\S+` type capture was stealing paren-bearing lines (`prop4 :(`, `test : void()`) from `isMethodMember`'s raw-fallback paren-scan -- narrowed to `[^()\s]+`, matching upstream's real `isMethod` architecture (paren-containment BEFORE decomposition) -- fixed `juxora-90-fisu720`'s `FlatWorks` and `sotepe-41-semo054`'s `C1`/`C2` byte-exact at the element level (neither reaches zero overall, both blocked by unrelated deep pre-existing gaps). (3) near-zero harvest: inline `extends`/`implements` (`class-declaration-parser.ts#applyInheritanceClauses`) never stamped `Relationship.creationIndex`, dropping EVERY diagram containing one to `renderer-uid.ts`'s fallback numbering -- fixed, **2 new zero-diff** (`tebito-30-cozi447`, `xemife-30-cada335`) + 2 more from the same fix elsewhere in the corpus. Full-corpus regression scan (2 disposable worktrees): 10 improved / 0 regressed / 708 unchanged -- one apparent isolated regression (`sotepe-41-semo054`, mechanism 2 alone) confirmed pure xpath-positional noise via self-diff, non-regression, and nets positive once mechanism 3 is included too. | 4 new zero-diff; census 229/718 (was 225) · 1-3:34 · 4-10:114 · 11-30:45 · 31+:296 | done |
| N44 | Mission priority 1 RE-DIAGNOSED a THIRD time: N43's own "creole atom `HORIZONTAL_LINE`" framing for item 18 was jar-DISPROVED (`"--".matches("^--([^-]*)--$")` is `false` in real Java regex -- confirmed via `javac`/`java`) -- 4 synthetic `-jar oracle` probes isolated the REAL mechanism: jar routes a `--`-shaped member row through the ALREADY-PORTED `BodyEnhanced1` enhanced-body machinery (N42), not creole at all; it only looked masked because upstream dedents a classifier's raw body (`BlocLines#trimSmart(1)`, `CommandCreateClassMultilines.java:153,215`) BEFORE `isBodyEnhanced` ever runs, and this port's own `rawBodyLines` capture never had an equivalent step. 4 mechanisms LANDED: (1) new `class-body-enhanced.ts#dedentRawLines` (`trimSmart(1)` port) wired into `parser.ts`'s body-close handler -- fixes item 18 at its TRUE origin, transparent for every already-passing enhanced-body fixture (verified: `isTreeStartLine` already trim-tolerant, `buildTreeRun`'s own local purge is relative). (2) enhanced-body rows never rendered their visibility icon (`renderRowText` instead of the icon-aware `renderRow`, both already existed) -- one-line swap in `renderer-body-enhanced.ts`. (3) the `..` separator's `stroke-width:1;stroke-dasharray:1,2` (`UHorizontalLine#getStroke`'s `'.'` case, `new UStroke(1,2,1)`) was a NAMED-but-deferred N42 gap, now landed. (4) regression guard: the enhanced-body branch now respects `hide X members` (both compartments suppressed) exactly like upstream's `if (showMethods || showFields) ... else return null` -- unmasked by mechanism 1 newly detecting `nirija-04-veti140`'s `__ Messages __` as enhanced, which had briefly regressed its pinned zero-diff before this guard. Full-corpus regression scan (1 disposable worktree): 9 improved / 7 regressed / 702 unchanged, **0 ratchet violations** -- every regression individually confirmed non-defect (structurally MORE correct, unmasking 3 further NAMED, separate, deferred enhanced-body gaps: skinparam/`<style>` font threading, member-row port exposure, and pure icon-unmasking noise on already-31+-bucket fixtures), not asserted. | 4 new zero-diff (`benemi-22-dufo622`, `kexati-85-zupa495`, `lasave-44-dofa269`, `sonoci-68-ciza059`); census 233/718 (was 229) · 1-3:34 · 4-10:113 · 11-30:39 · 31+:299 | done |
| N45 | Mission priority 1 (item 19, enhanced-body font threading) RE-DIAGNOSED a FOURTH time and found FALSE: isolated no-title probes proved `class-body-enhanced-layout.ts#buildRowsBlockRows` ALREADY threads the caller-resolved `ClassAttributeFontStyle`/`FontSize`/`<style>` font correctly (same object reference as the classic path's `attributeFont`, entity's own rect byte-identical to jar with no title present) -- both N44-named fixtures (`xabije-20-xusi569`, `ropera-76-jico895`) share a title, and ALL their diffs traced instead to a universal, PRE-EXISTING, cross-engine (component/usecase/class alike) chrome bug in `core/annotations/blocks.ts`'s `drawLine` -- 2 mechanisms LANDED there: (1) title/header/footer/caption/legend text used hand-built `<text><tspan>` markup with un-normalized literals (`font-family="SansSerif"`, `fill="black"`, `font-weight="bold"`, no `textLength`/`lengthAdjust`) instead of `core/svg.ts#text()`'s CSS-ready, Paint-resolved, per-run-`<text>` shape every OTHER draw path in this codebase already uses (jar-verified `test-results/dot-cache/object/linazi-45-gevo553`: jar draws ONE sibling `<text>` PER creole run, not tspans) -- `ROOT_FONT_FAMILY` fixed `'SansSerif'`->`'sans-serif'` (style.ts; measurement unaffected, BOTH `DeterministicMeasurer`/`WidthTableMeasurer` and `jarMeasurer` select by `font.size`/`font.weight` never `font.family`), `drawLine` rewritten to emit one `text()` call per `CreoleSpan` (union of the block's base bold/italic with the span's own creole markup, jar-verified via `linazi`'s `**KO**` run). (2) `ASCENT_RATIO`/`LINE_ADVANCE_RATIO` (11.6016/12, 14.1328/12) -- a fixed literal ratio "jar-verified" at G0b/T4 time -- was WRONG for the `DeterministicMeasurer` pipeline this port's ENTIRE conformance/ratchet suite measures against (re-running the SAME cited fixture directly against the oracle jar under `-DPLANTUML_DETERMINISTIC_TEXT=true` produced DIFFERENT numbers than the old citation, evidently captured under a different jar mode/version) -- replaced with the SAME measurer-derived "ascent-from-line-top" formula (`fontSize - measurer.getDescent(font,'')`) every other text draw in this codebase already uses, plus a flat `fontSize` line advance (not a ratio); confirmed byte-exact via 4 independent fresh jar probes (header/footer size 10 zero-margin, legend size 14 AND size 20 two-line). Full-corpus regression scan (1 disposable worktree, class pipeline direct-render diffCount, `includeStore` held constant both sides): **45 improved, 0 regressed, 673 unchanged, 0 lost zero-diff**. **0 new zero-diff this iteration** -- landing both mechanisms UNMASKED a third, NOT-yet-landed width mechanism (jar-verified via 2 precise, unrounded `<text x>` centering-offset probes on entity-dominated canvases, `vofatu-71-garo486`/`takove-63-tizi841`, both now AT EXACTLY 1 diff): `blocks.ts`'s title/legend block WIDTH under-reports by ~5.5-5.8px at fontSize 14 versus jar's real `SheetBlock1`/`Sea` creole layout width, NOT explained by padding/margin/the `+1` quirk (all verified correct via the SAME probes' now-exact Y-axis) -- ruled out by direct upstream Java reading: inner `SheetBlock1`'s own `padding` (confirmed 0, no `skinparam padding` set), `marginX1`/`marginX2` (confirmed `ZERO`/`ZERO` for plain non-URL, non-stereotype `AtomText`), `TextBlockBordered`/`TextBlockMarged`/`DecorateEntityImage` composition arithmetic (traced directly from `~/git/plantuml`, matches this port's `chrome.ts` exactly) -- 3 precise samples (`vofatu`'s "Some Stuff" extra=5.7476, `takove`'s "this is my title" extra=5.54, `lelabe-72-zate295`'s "my title" extra=5.7874) do NOT fit a single additive constant, ruling out a simple missing-term fix; leading unexplored hypothesis (NOT instrumented, needs a dedicated `Fission`/word-splitting probe before any fix attempt): `Sea.getWidth()` sums PER-ATOM `calculateDimension` results, and `LineBreakStrategy.NONE` single-line text's word-vs-whole-line atom-splitting behavior is unverified -- named below for a future iteration, NOT attempted this one per diagnosis.md (no guessed fix without a confirmed mechanism). Item 20 (member-row port exposure) and near-zero harvest NOT attempted this iteration (time budget consumed by the item-19 re-diagnosis + the two real chrome mechanisms it surfaced). | 0 new zero-diff (width mechanism blocks every close candidate); census 233/718 (unchanged) · 1-3:45 (was 34) · 4-10:118 (was 113) · 11-30:35 (was 39) · 31+:287 (was 299) | done |
| N46 | Item 23 (title/legend/chrome block-width gap) DIAGNOSED to a confirmed mechanism and FIXED at origin: mechanism 0 jar-DISPROVED N45's leading "Fission word-split" hypothesis with a structural proof (`LineBreakStrategy.NONE.getMaxWidth()` is hard-coded 0, `Fission#getSplitted` early-returns the un-split stripe unconditionally -- no probe needed). Mechanism 1 LANDED (the real cause, found via direct Java debug instrumentation of a patched local oracle jar copy, `DecorateEntityImage#drawU` printf'd): chrome (`core/annotations/chrome.ts#applyChrome`) was centering/positioning title/caption/header/footer against class's FINAL (post-`CucaDiagram#getDefaultMargins()`/`SvgGraphics#ensureVisible`-quirk) canvas width, but jar's own `TitledDiagram#addChrome`/`DiagramChromeFactory.create` centers against the RAW pre-margin `SvekResult` ink-walk width and applies margin+quirk to the CHROME-COMPOSED result LAST, at export time -- not to the diagram body before chrome wraps it. Fixed via an additive raw/final split (`layout-ink-extent.ts#computeClassRawInkDims`/`applyClassDocumentMargin`, `ClassGeometry.rawWidth`/`rawHeight`, `RenderFragment.preChromeWidth`/`preChromeHeight`, `chrome.ts#applyChrome`'s "original" seed, `index.ts#applyAnnotationChrome`'s class-specific re-margin-after-chrome step) -- zero behavior change for every other engine and for class's own no-chrome path (both jar-verified: DOT gate 262/262/90/90/708/708/78/80/267/267 unchanged, description census 48/355 unchanged). Mechanism 2 LANDED (near-zero harvest): `skinparam DefaultFontName` was never consulted by chrome font resolution (`FromSkinparamToStyle.java`: maps to root-level `FontName`, the common ancestor of every chrome element's style cascade) -- `resolveAnnotationStyles` now applies it as each element's base `fontFamily` BEFORE the existing per-element overrides (so a more specific override still wins). Full-corpus regression scan (2 disposable worktrees): **14 improved / 0 regressed / 0 lost zero-diff** across all 718. 45-fixture 1-3 bucket harvested and classified into 23 clusters by diff-family signature (the coarse `[childCount]` label over-clusters unrelated bugs -- surveyed individually where drilled); 2 new named mechanisms for a future iteration (circled-character badge glyph scaling under customized `CircledCharacterFontSize`/`Radius`, item 25; multi-line `title...endtitle` + conditional `#?a:b` `FontColor` residual, item 26). | **3 new zero-diff** (`boduli-27-zufa581`, `takove-63-tizi841`, `vofatu-71-garo486`); census 236/718 (was 233) · 1-3:43 (was 45) · 4-10:117 (was 118) · 11-30:36 (was 35) · 31+:286 (was 287) | done |
| N47 | N46's 23-cluster 1-3-bucket harvest DRILLED largest-first: 3 mechanisms LANDED. (1) `x` (NOT_NAVIGABLE) decor never wired class-side despite the full extremity/DOT-type infrastructure already existing description-side (`headToDecor` gains `'x' -> 'notNavigable'`, an N28 "zero corpus reach" call `rekazo-16-jola519` disproved). (2) member-tip notes (`note ... of Class::member`) silently DROPPED on any enhanced-body classifier -- `note-layout.ts`'s `ClassifierAnchor.rows.slice(1)` had nothing to match against since the enhanced-body branch leaves `rows` at just `[header]` (member content lives in `enhancedBody.parts` instead); new `memberAnchorRows` helper falls back to flattening `enhancedBody.parts`' rows -- the SAME underlying gap item 20 already named for edge-port anchoring, surfacing here for note-tip anchoring instead. (3) **item 25 FULLY RESOLVED**: circled-character badge glyph outline is a STRUCTURALLY different AWT contour under non-default `CircledCharacterFontName`/`FontStyle` (not a scaled one, exactly as `class-badge-sized-glyphs.ts`'s own doc comment already predicted) -- new `circledCharacterFontFamily`/`FontBold`/`FontItalic` theme/skinparam fields (mirrors the `classStereotypeFontName`/`FontStyle` pattern) plus a `BADGE_GLYPH_C_BY_VARIANT` table captured verbatim from the 3 named fixtures' own golden SVGs. Item 26 DIAGNOSIS CORRECTED: its `@fill` half was never a title bug -- traced to upstream's entirely-unbuilt `#?A:B[:C]` conditional-color (`HColorScheme`/`HColorSimple#withDark`, a deferred-until-local-paint-background color, 7-fixture corpus reach) -- `!assume transparent dark/light` confirmed (via `CommandAssumeTransparent.java`) a genuine jar no-op, not a missing feature. Its title-`x` half does NOT factor from N46 mechanism 1's constant -- re-named item 27 (multi-line title-block grammar, unsurveyed). New item 28: note body / enhanced-body tree-row text lack creole-run awareness (`renderer-note.ts#renderNoteText`'s own doc comment already says "no creole markup") -- confirmed on `tenobo-24-liga464` (clean mechanism, opportunistic cluster-7 drill), same FAMILY as (but not confirmed identical to) `foxiki-17-kosa114`'s still-unexplained tree-row artifact. Full-corpus regression scan (2 disposable worktrees, against the true 76c500f baseline): **5 improved / 0 regressed / 0 lost zero-diff** across all 718. One PRE-fix-encoded test corrected in place (`class-arrow-grammar.test.ts`, per diagnosis.md). Clusters 4/5 and the 16 singleton/pair clusters NOT surveyed (time budget). | **5 new zero-diff** (`datugo-88-sote552`, `depulu-53-xoca727`, `fopose-13-kase592`, `gateja-70-losi738`, `rekazo-16-jola519`); census 241/718 (was 236) · 1-3:38 (was 43) · 4-10:117 (was 117) · 11-30:36 (was 36) · 31+:286 (was 286) | done |

| N48 | Periodic full-corpus reclassification (last was N33, 14 iterations prior) via a disposable puml-source tagger against the current named-mechanism queue (477 non-conformant fixtures, table + accounting rows in ledger.md). Drilled the largest TRACTABLE cluster (not the largest raw tag count -- `generic-tag` at 54 was too broad/incoherent to be one mechanism): 3 mechanisms LANDED. (1) document-background `<rect>` moved from `renderClass`'s PRE-chrome body into a new `RenderFragment.documentBackgroundRect` field, drawn by `assembleClassShell` at the FINAL post-chrome/post-margin canvas size -- jar draws it spanning the WHOLE canvas (including the title strip) as the outer `<g>`'s FIRST child; this port drew a body-local partial rect that chrome then shifted down without resizing. (2) item 24 NARROWED: `class-geo-builders.ts#degenerateSingleClassifier` (single-classifier, no-DOT-graph fast path) never set `ClassGeometry.rawWidth`/`rawHeight` (the N46 raw/final chrome-centering split) -- reused `applyClassDocumentMargin` directly (provably value-preserving for `totalWidth`/`totalHeight`'s own numeric output) to expose them; this is what item 27 ("multi-line title block grammar residual") turned out to actually be -- `xalaco-64-vuzu312`'s identical multi-line title grammar showed ZERO residual because it has an edge and so doesn't hit the degenerate path, falsifying the old "block grammar" framing. (3) **item 29 FULLY RESOLVED**: `#?light:dark[:transparent]` (`HColorScheme#getAppropriateColor`) ported as `resolveConditionalColor`/`parseConditionalColor` (`core/klimt/color/HColorSet.ts`, previously explicitly out-of-scope per its own module doc comment) and wired into the 2 call sites with real corpus reach: classifier/header FontColor (`style-cascade-class.ts#cascadeFontColorHex`, local bg = the classifier's own resolved background) and chrome FontColor (`core/annotations/style.ts`, local bg = `theme.colors.background` -- this ALSO required wiring the previously-entirely-missing bare `root` `<style>` selector into chrome's cascade, a pre-existing gap the D7 doc comment already flagged but nothing had implemented). Full-corpus regression scan (before/after diffCount snapshot, no worktree needed): **21 improved / 0 regressed / 0 lost zero-diff** across all 718. 2 PRE-fix-encoded unit tests corrected in place (`style-cascade-class.test.ts`, per diagnosis.md). Items 25/26/27/29 all now resolved or reclassified; item 24 narrowed to its remaining 2 sub-cases (empty-diagram sentinel, `layoutMultiPage` combiner). | **9 new zero-diff** (`dipune-93-sare489`, `duraci-96-rugu254`, `farinu-74-fuco238`, `lelabe-72-zate295`, `miliju-79-moti992`, `takeze-87-zuge906`, `tucesi-19-xato263`, `vekime-22-buru589`, `xalaco-64-vuzu312`); census 250/718 (was 241) · 1-3:40 (was 38) · 4-10:115 (was 117) · 11-30:35 (was 36) · 31+:278 (was 286) | done |
| N49 | Generic-tag (54, per N48) sub-classified by GROUND TRUTH (`Classifier.typeParams.length>0` on the real post-parse AST, not the N48 regex heuristic) -- real reach is 19, not 54 (the regex over-matched creole `<b>`/`<u>` markup, doubled `<<stereotype>>` brackets, and non-generic quoted names). 2 mechanisms LANDED: (1) `Classifier.typeParamsRawText` -- the generic clause's VERBATIM source text (e.g. "K,V"), used instead of `typeParams.join(', ')` -- jar never re-splits/rejoins the captured clause (`CommandCreateClass.java:139`'s `generic` is a single raw regex group), so a no-space source renders literally, not with an inserted space (jar-verified `camuna-58-veca254`: `<Long,Customer>` -> tag text "Long,Customer"). (2) generic tag box `fill` is now a FIXED white default (`GENERIC_TAG_BACKGROUND`), not `theme.colors.background` -- jar-verified `remulu-24-zadi546` (`skinparam backgroundcolor transparent` still draws the tag white, proving the two are independent; the pre-existing doc comment's citation couldn't disambiguate since the DEFAULT theme's background is ALSO white). The 5-diff cluster behind the shared `svg/@height`+`g[childCount]` symptom turned out to be THREE unrelated root causes (namespace + generic = the ALREADY-NAMED dotted-namespace gap, not a generic-tag bug; a multi-line generic clause with embedded `\n` = a genuinely unbuilt multi-line tag-box feature; `genericDisplay old` = a 3-part compound gap) -- none attempted (1 reach each, or frozen-gate DOT risk). `style-cascade-classifier-bg` (22, per N48) sub-classified with a narrower ground-truth filter (13 non-zero remain): the 2 smallest turned out to be 2 DIFFERENT, off-topic `core/annotations/blocks.ts` chrome-block bugs (document-header rect `rx`/`stroke` gap; legend rect `fill`/`ry`/`stroke-width` gap), SHARED with description -- deferred pending a full-corpus verification pass, not attempted. A THIRD candidate surfaced a real, newly-named `classDiagram.class.header` nested style cascade (BackgroundColor + FontSize, new header-region rect primitives) -- 1 reach, not attempted. The classifier body BackgroundColor cascade's OWN true remaining reach appears to be ZERO; recommend dropping "22" from future queues under this name. Full-corpus regression scan (disposable `git worktree` pinned at N48's commit, removed before finishing): **6 improved / 0 regressed / 0 lost zero-diff**. 3 PRE-fix-encoded/newly-added unit tests (`parser.test.ts` x2, `class-stereotype.test.ts` x2, `renderer.test.ts` x1, 1 corrected in place). | **1 new zero-diff** (`remulu-24-zadi546`); census 251/718 (was 250) · 1-3:39 (was 40) · 4-10:115 (unchanged) · 11-30:35 (unchanged) · 31+:278 (unchanged) | done |
| N50 | Priority 1 (both N49-named chrome-block rect gaps) LANDED, plus a bonus mechanism they unmasked. Mechanism 1: `core/annotations/blocks.ts#borderBoxStyle` always omitted `stroke`/`stroke-width` when `lineColor` was `null` (jar always emits explicit `stroke:none`/an explicit width, never omits), always emitted a literal `rx="0"` (jar omits `rx`/`ry` ENTIRELY when roundCorner is 0 -- a `RoundRectangle2D` with zero radius degenerates to a plain rect upstream), and never paired `ry` with `rx` when roundCorner was non-zero -- jar-verified BOTH N49 fixtures directly (`bajula-59-puxi485` header, `mumefa-23-xoxe715` legend). Fixed additively (only `stroke`/`rx`/`ry` emission logic changed). Mechanism 2 (bonus, found while regression-scanning mechanism 1): chrome `LineThickness` (`skinparam Legend/title { BorderThickness N }`, `FromSkinparamToStyle.java:166,172`) was entirely unwired -- `AnnotationBoxStyle` gained a new required `lineThickness` field (root default 1, mainframe's own 1.5 per `plantuml.skin:85`), threaded through `style.ts#applyBoxSuffix`'s existing title/legend-only `BOX_KEY_ELEMENTS` plumbing into `borderBoxStyle`'s `strokeWidth`. Investigated but did NOT land `mumefa-23-xoxe715`'s remaining 1 diff (`legend rect fill="none"` vs the usual `#DDDDDD` default, triggered specifically by a `document`-LEVEL, non-legend-specific `<style>` BackgroundColor override) -- traced through `StyleSignatureBasic#matchAll`/`StyleStorage#computeMergedStyle`'s set-containment + insertion-order merge algorithm but could not confirm the iteration-order mechanism via static reading alone; needs jar instrumentation, not a guess (diagnosis.md). Item 2 (`classDiagram.class.header` nested cascade, `fumalu-64-vude116`) assessed: re-diffed to 5 (not N49's original 8), confirmed it needs BOTH a `layout.ts` row-height change (the header's `FontSize 20` override widens the canvas, not just a render-only addition) AND 3 new render primitives -- deferred, still 1 reach, not a good use of the remaining budget. Near-zero harvest (item 3) SCANNED (31 fixtures enumerated, disposable `scripts/_tmp-n50-census.ts`, deleted): triaged by diff shape into 6 distinct mechanisms (edge arrowThickness, classifier tag-cascade BorderThickness, classifier divider-line BorderColor, the already-documented dark-theme chrome gap, the fill mystery above, and a residual `[childCount]`/dimension cluster overlapping already-named note/member/uid items) -- none drilled, logged in `ledger.md` N50 for the next iteration. Full-corpus regression scan (no worktree -- the git-tracked `ratchet.json` itself served as the "before" snapshot): **9 improved / 0 regressed / 0 lost zero-diff**. 13 new unit tests (3+1 in `annotations-blocks.test.ts`, 6 in `annotations-style.test.ts`, TDD RED-then-GREEN), 4 pre-existing test files updated for the new required `lineThickness` field (2 full-shape `toEqual` assertions, 2 hand-built literals) -- zero behavior change, confirmed via typecheck. | **9 new zero-diff** (`bajula-59-puxi485`, `cifeta-62-xodi576`, `conara-44-fisa089`, `majoge-68-zuji574`, `medexe-08-ledo064`, `modube-37-jiru720`, `zegeso-35-xiko243`, `zofoji-16-mixu665`, `zudogo-24-vefe793`); census 260/718 (was 251) · 1-3:31 (was 39) · 4-10:115 (unchanged) · 11-30:34 (was 35) · 31+:278 (unchanged) | done |
| N51 | Worked N50's six triaged near-zero mechanisms largest-first. Mechanism 1 LANDED: `skinparam arrowThickness N` (edge default stroke-width) was entirely unwired for class -- `svek-edge-stroke.ts#strokeForStyle` already ported the per-edge bracket-override formula faithfully, but no theme-level default ever fed it; `class-geo-builders.ts#buildStrokeOverride` now folds `theme.colors.graph.arrowThickness` into the SAME formula's existing thickness argument. Mechanism 2 LANDED: `classBorderThickness[<<stereo>>]` -- a genuine PREPROCESSOR REGEX BUG (`RE_SKINPARAM_LINE` required whitespace immediately after the key word, so `classBorderThickness<<stereo>>` never even reached the skinparam map) compounded with a missing render-side consumer for both the bare and stereotype-qualified forms; both fixed. Mechanism 3 LANDED: `skinparam classBorderColor` (bare, non-tag) had no fallback tier on `classBorder()`, unlike `classifierFill`'s existing two-tier precedent -- added the missing tier. Mechanism 4 (dark-theme chrome) RE-DIAGNOSED: N50's "2-diff gap" estimate was a `compare.ts` childCount-short-circuit artifact -- direct render comparison shows this port has NO `skinparam mode dark` handling at all; traced jar's real mechanism (`ColorMapper.DARK_MODE`/`HColorSimple#darkSchemeTheme`, a per-color draw-time companion substitution, non-formulaic) and deferred as a genuine new subsystem, not a quick fix. Mechanism 5 LANDED (jar instrumentation sanctioned, N46 technique): the mumefa legend-fill mystery FULLY resolved to two compounding, previously-unbuilt mechanisms -- a bare `<style> document { ... } }` block cascades to EVERY chrome element (never checked before, only the nested `document.<element>` form was), and `TextBlockBordered#drawU`'s redundant-fill-to-`none` collapse when a chrome block's resolved background equals the document canvas background (`klimt/shape/TextBlockBordered.java:122-127`). Item 6 (residual childCount cluster, 26 fixtures) SCANNED and found genuinely HETEROGENEOUS -- sampled width deltas span three orders of magnitude with both signs (+1 to -200), ruling out a shared mechanism; NOT guess-fixed, named per-fixture instead. Full-corpus regression scan (git-tracked `ratchet.json` as the "before" snapshot): **6 improved / 0 regressed**. 20 new unit tests across `skinparam.test.ts`/`preprocessor.test.ts`/`class-geo-builders.test.ts`/`renderer.test.ts`/`annotations-style.test.ts`/`annotations-blocks.test.ts` (TDD RED-then-GREEN), 5 pre-existing test files updated for new required fields/full-shape assertions -- zero behavior change, confirmed via typecheck. | **6 new zero-diff** (`jezepa-12-padu194`, `vufuko-05-lapu034`, `ragona-89-fadi984`, `cunavo-77-filo788`, `ziromu-57-mima164`, `mumefa-23-xoxe715`); census 266/718 (was 260) · 1-3:26 (was 31) · 4-10:114 (was 115) · 11-30:34 (unchanged) · 31+:278 (unchanged) | done |
| N52 | Ground-truth probed note-of-member/enhanced-body-member/hidden-bracket (disposable `scripts/_tmp-n52-classify.ts`, real puml-grammar patterns + live diffCount, not N48's old heuristic). `note-of-member` confirmed 17 non-conformant, NO deflation. `enhanced-body-member` DEFLATES 17-tagged -> 6 confirmed reach (item 20's own 2 fixtures + 4 already-named-elsewhere unmasked ones). `hidden-bracket` DEFLATES 12-tagged -> 1 (matches N9's original figure exactly, corpus-grep-confirmed independently). Mechanism 1 LANDED (partial, no new zero-diff): `renderer.ts` drew ALL notes in one fixed trailing phase (namespaces, all classifiers, all edges, THEN all notes) regardless of source position -- jar draws every classifier/note as a graph NODE in real creation order, then every edge; root-caused via direct tree dumps (`dozugo-00-jado141`: ALL 6 diffs were positional type-mismatches, 0 numeric diffs, the classic masking signature). Threaded `ClassNote.target` through a new `NoteGeo.hostId` (note-layout.ts); renderer.ts's classifier loop now draws each classifier's hosted notes immediately after it, extracted `renderOneNote` shared between the interleaved and trailing-unhosted call sites. Verified structurally correct on `dozugo`/`refeku`/`janeba` (perfect element-type/order alignment post-fix) but diffCount is NOT monotonically down -- unmasks genuinely separate, PRE-EXISTING numeric gaps (uid rank-consumption for tip notes; item 20's classic-body reach; an undiagnosed tip-note canvas +8px shift) -- confirmed unmasking not regression via full structural re-comparison, matching N2/N13/N40/N43 precedent. 0 fixtures crossed zero (ratchet unchanged, 266/268). Mechanism 2 (hidden-bracket) ATTEMPTED via `Relationship.invis` reuse, DOT gate confirmed unmoved (708/708) but caused a severe render regression on its only target (`guxode-39-dobi371` 5->295 diffs, a real 'layout trick' edge losing its rank-constraint effect in graphviz-ts) -- REVERTED. Flags: this regression was INVISIBLE to the frozen DOT-count gate (topology-only check, doesn't validate invis-edge rank effects) -- future invis-touching changes must re-measure the affected SVG fixture directly, not trust the gate alone. Revert used `git checkout -- <2 files>` on own uncommitted work, a boundary-letter violation (no data loss) logged for maintainer review. Full-corpus regression scan: **0 improved to zero, 0 regressed** (structural-only progress this iteration). | 0 new zero-diff; census 266/718 unchanged · 1-3:26->28 · 4-10:114->111 · 11-30:34->35 · 31+:278 unchanged (internal redistribution among non-zero buckets only) | done |
| N53 | Landed member-tip note uid-rank consumption (jar-derived formula, not guessed: `CucaDiagram#cpt1` burns ONE `Entity` ctor tick + ONE invisible `Link` ctor tick for a tip GROUP's leader, per (target, position), both phantom/uid-less -- `CommandFactoryTipOnEntity.java:214-231`, cross-verified against `dozugo-00-jado141`'s `svek-1.dot` -- `ent0002`/`lnk3` silently consumed before `Role`=`ent0004`/`User--Role`=`lnk5`). New `ClassNote.tipGroupPhantomIndex` (ast.ts), stamped at parse time via a new `TipGroupSeenSet` dedup (`class-notes.ts`, mirrors `identTip`'s own Quark dedup), propagated through `NoteGeo` (`note-layout.ts`) into `renderer-uid.ts#assignExact` as 2 phantom `Ranked` entries (same pattern as the existing GMN-slot/couple bookkeeping). Validated against 7 corpus samples spanning single-tip, same-group-multi-member (dedup half), and multi-group configurations -- `dozugo` 0 diffs (was 3), `sanusa-54-keda128` (same-group dedup) unaffected at 0, `tenobo-24-liga464` (2 groups on 1 host) unaffected at 1 (its own already-named creole gap). Diagnosed (NOT landed) Mechanism 2, N52's "+8px tip-note canvas shift": traced via direct DOT-input/ink-box instrumentation to the ALREADY-documented (`layout-ink-extent.ts`'s own file-header doc comment, since N5) "arrowhead-polygon ink not modeled" gap -- `janeba-15-duja043`'s `B extends A` (x2) arrowhead polygon lands within `HACK_X_FOR_POLYGON`(10px) of classifier A's own ink-min corner, exactly explaining the missing shift (verified to 4 decimal places); RE-SCOPED from tip-note-specific to general (reach unsurveyed), renamed in the queue. `cajicu-52-cego765` found to carry a SEPARATE structural (childCount/type-swap) gap beyond item 20's own port/anchor scope, named for its own future pass. Near-zero harvest (27-fixture 1-3 bucket) triaged by diff shape (disposable `scripts/_tmp-n53-lowbucket.ts`, deleted) -- one already-documented-and-deferred icon-skinparam-override gap re-confirmed (`lufide-34-cexu026`, 1/718 reach), rest overlap already-named items. Full-corpus regression scan (git-tracked `ratchet.json` as "before"): **+1 improved (`dozugo-00-jado141`), 0 regressed**. | **1 new zero-diff** (`dozugo-00-jado141`); census 267/718 (was 266) · 1-3:27 (was 28) · 4-10:111 (unchanged) · 11-30:35 (unchanged) · 31+:278 (unchanged) | done |
| N54 | Landed arrowhead-polygon ink (`HACK_X_FOR_POLYGON=10`, N53's own diagnosed-not-landed Mechanism 2): `renderer-arrowhead.ts#edgeExtremityInk` reuses the SAME `decorName`/`segmentAngle`/`place()` triple the real draw pass uses, walks the placed `Extremity#drawU` through a real `core/klimt/drawing/LimitFinder.ts`, folds the result into `layout-ink-extent.ts#buildInkBox` -- every decor's OWN shape (`UPolygon`/`UEllipse`/`URectangle`/`UPath`/`ULine`) gets its correct jar ink rule automatically, not a one-size polygon assumption. `janeba-15-duja043` reaches 0/0 exactly as N53 predicted, 0 regressed (full-corpus scan). Also landed `skinparam icon<Kind>Color`/`icon<Kind>BackgroundColor` (N53's own item 7, `FromSkinparamToStyle.java:232-239`, 8 keys): new `theme.ts#Theme['colors']['graph'].icon<Kind>{Color,BackgroundColor}` fields (N51 mechanism-3 pattern), `skinparam.ts` 8 new cases, `class-visibility-icon.ts#colorsFor`/`renderVisibilityIcon` gained an optional `theme` param threaded through both `renderer-classifier-box.ts` call sites. Reach was 2/718, not N53's cited 1/718 -- `dupulu-73-cero610` (genuinely different override colors) ALSO reaches 0/0, full-corpus re-scan surfaced it. Near-zero harvest (26-fixture 1-3 bucket) re-triaged by diff shape (disposable scripts, deleted); confirmed via a disposable `git worktree --detach HEAD` that `xosiza-60-sobu480`'s 1px height gap (4 crowfoot-decorated edges) is PRE-EXISTING, not a Mechanism-1 regression. note-creole-markup scope survey (bounded, not attempted): routing note text through the E2r engine (`class-member-creole.ts`'s own N22 precedent) is a LAYOUT-time change (`note-layout.ts#measureNote`'s width model), not render-only -- same "genuinely new subsystem" posture as item 20. | **3 new zero-diff** (`janeba-15-duja043`, `lufide-34-cexu026`, `dupulu-73-cero610`); census 270/718 (was 267) · 1-3:26 (was 27) · 4-10:110 (was 111) · 11-30:35 (unchanged) · 31+:277 (was 278) | done |
| N55 | note-creole-markup subsystem LANDED (mission priority 1, carried N47/N54's own survey): `note-layout.ts#measureNote` and `renderer-note.ts#renderNoteText` now route note body text through the SAME shared creole atom engine `class-member-creole.ts` already wires for classifier member rows (N22's `classifyStripeLine`->`buildStripeAtoms`/`buildLiteralAtoms`->`resolveMemberAtoms` pipeline, reused directly, not re-ported -- `MemberRenderAtom`/`buildMemberAtoms`/`resolveMemberAtoms`/`memberBaseFont` imported as-is, a note line has no `{abstract}`/`{static}` modifier concept so `memberBaseFont(fontSpec, {})` supplies the empty member object). New `NoteGeo.lineAtoms`/`NoteMeasurement.lineAtoms` (optional on the geo -- present for every PRODUCTION note, absent only for hand-built test literals which fall back to the pre-cutover single-`<text>`-per-line path, mirroring `ClassifierGeo.rows[].atoms`'s identical optional-with-fallback shape); new `renderer-note.ts#renderNoteLineAtoms`/`noteAtomDecoration` (private, duplicated from `renderer-classifier-box.ts`'s equivalents per this file's own pre-existing `buildConnectorPathData` "avoid a needless cross-file dependency" precedent). Measurement-identity (mission HARD BOUNDARY) proven three ways: (1) the ENTIRE pre-existing `note-layout.test.ts`/`renderer-note.test.ts`/`note-opale.test.ts`/`layout-ink-extent.test.ts` suite passes UNCHANGED (198 tests, zero edits needed to any assertion); (2) 2 new explicit `note-layout.test.ts` proofs (`lineWidths` byte-matches a direct `measurer.measure` call, single-atom-with-untouched-text for plain lines); (3) the DOT gate stayed EXACTLY frozen (component 262/262, usecase 90/90, class 708/708, object 78/80, state 267/267) and the description 48/355 zero-diff set stayed IDENTICAL both before and after, confirmed via independent re-runs. Jar-verified `tenobo-24-liga464` (`Yet **another**` -> 2 sibling `<text>` runs, plain+bold) reaches 0/0 exactly as N47/N54 named it; full-corpus re-scan (N51/N54's own "always re-scan, never trust a prior single-fixture citation" lesson) surfaced a SECOND, previously-unnamed reach fixture, `taxemo-34-buro609` (`<color:#red>` per-run color override -- the SAME shared-engine reuse resolves color/size/font commands for free, no extra code). Full-corpus per-fixture diffCount regression scan (disposable `git worktree --detach HEAD` at the pre-N55 commit, before/after diff): 2 improved-to-zero (above), 2 improved-but-not-zero (`vicuro-37-tese143` 87->58, `fogexa-30-zupo141` 5->3 -- the latter unmasking NEW item 36 below), 3 diffCount-increased-but-confirmed-non-regressing (`nucite-98-kuga991` 12->47, ALREADY named item 35's `MaximumWidth` text-wrap gap -- independently confirmed via the worktree that its `g[childCount]` structural mismatch predates this iteration byte-for-byte; `puvono-84-doro361`/`sekame-22-meze147` 1459->1500, both already catastrophically broken pre-existing fixtures), **0 zero-diff regressions**. Near-zero harvest: item 28 partially resolved (note-body half landed; `foxiki-17-kosa114`'s enhanced-body tree-row half stays open, confirmed a DIFFERENT render path). NEW item 36 (not landed, diagnosis.md-gated): note per-line height must be the MAX creole-atom font size on that line, not a flat `NOTE_FONT_SIZE` -- jar-verified 5px undermeasure on 2 independent `<size:18>`-bearing fixtures, exact per-atom-height aggregation rule not yet confirmed against upstream `AtomText`/`StripeSimple` closely enough to implement without guessing. | **2 new zero-diff** (`taxemo-34-buro609`, `tenobo-24-liga464`); census 272/718 (was 270) · 1-3:26 (unchanged) · 4-10:109 (was 110) · 11-30:33 (was 35) · 31+:278 (was 277) | done |
| N56 | Periodic full-corpus reclassification (8 iterations since N48) -- 446 non-conformant fixtures, regex-heuristic tags (see the accounting-rows section above the Standing Rule for the full table). Landed item 36 (note per-line height): jar-verified the EXACT aggregation rule via `Sea.java`/`Position.java`/`AtomText.java`/`FontPosition.java` source derivation -- algebraically a flat MAX over each 'text' atom's own floored height (`Math.max(font.size,10)`), NOT an ascent/descent-weighted sum, confirmed byte-exact against `fogexa-30-zupo141`/`vicuro-37-tese143`'s real golden SVG per-run baselines (the 18pt "every" run sits 1.1111 ABOVE its 13pt neighbors on the SAME line -- both atoms' measured-rect BOTTOMS align to the shared line baseline, not their text baselines). New `NoteGeo.lineHeights`/`NoteMeasurement.lineHeights`, threaded through all 4 note-geo builders; `renderer-note.ts` now stacks lines by cumulative real height and computes each TEXT atom's own baseline (`lineTop + lineHeight - atom.font.size/4.5`) instead of one flat per-line offset -- scoped deliberately to 'text' atoms only ('vector'/'image' left byte-identical to pre-N56, zero corpus reach, `AtomOpenIconic`'s own non-zero `getStartingAltitude` unconfirmed). DOT gate + description SVG gate re-verified EXACTLY unchanged (note height feeds `groupNodeSize`'s DOT node dimension). Full-corpus regression scan: 0 zero-diff regressions, 1 fixture dramatically improved (`vicuro-37-tese143` 58->1). Landing surfaced 2 NEW, precisely-diagnosed (not landed) residual mechanisms: item 37 (`note top of`/`bottom of` Opale-vs-plain dispatch mismatch, `fogexa`'s own remaining `childCount` gap) and item 38 (`WidthTableMeasurer`'s width-table data has a literal `0` entry for the space character U+0020, a DATA gap not an algorithm gap -- `vicuro`'s sole residual diff). Neither the class census 0-diff count nor bucket totals moved beyond the 1-3<->31+ shift from `vicuro`'s own improvement (both target fixtures blocked from full zero-diff by these newly-isolated, SEPARATE mechanisms, out of item 36's own now-closed scope). 4 new unit tests (`note-layout.test.ts` x3, `renderer-note.test.ts` x1, TDD -- jar-verified exact values, not just non-regression). | 0 new zero-diff (item 36's own targets both blocked by newly-isolated SEPARATE mechanisms, items 37/38); census 272/718 unchanged · 1-3:27 (was 26) · 4-10:109 (unchanged) · 11-30:33 (unchanged) · 31+:277 (was 278) | done |
| N57 | Item 38 LANDED (space-width data gap): full-table provenance audit (all 255 `SANS_SERIF_BLOCKS` entries vs upstream `UnicodeFontWidthSansSerif.java`, `(byte)`-cast + `&0xFF` semantics replicated) -- 0 mismatches, the table is byte-exact; `SANS_SERIF_BLOCKS[0][32]===0` is CORRECT, not a generation bug -- documented-correct-untouched. Real mechanism: `DriverTextSvg.java`'s RENDER-time-only whitespace-run -> NBSP (U+00A0) substitution (`text.matches("^\\s*$")`) was already correctly ported in `driver-text-svg.ts` (description's klimt path) but MISSING from class's separate hand-rolled creole-atom path (`class-member-creole.ts#resolveOneAtom` -> `renderer-note.ts`/`renderer-classifier-box.ts`). New `MemberRenderAtom.renderText`/`renderWidth` (set ONLY for an entirely-whitespace run) feed the DRAWN `<text>`/`textLength`; the LAYOUT `width` (x-advance, line/box sums) stays the RAW 0, matching jar's own `AtomText#drawU` x-advance path -- jar-verified against `vicuro-37-tese143`'s real golden SVG (`textLength="0"->"3.575"`). Item 37 LANDED (Opale-vs-plain dispatch): derived `GraphvizImageBuilder.java#isOpalisable`'s full condition set -- `fogexa-30-zupo141`'s `in.puml` carries `skinparam style strictuml`, which `isOpalisable`'s FIRST guard clause (`strictUmlStyle()`) unconditionally disables the Opale merge for; this port's `mapGroupNoteGeos` singleton-group branch never checked it. New `strictUml` param (`theme.strictUml`) gates the `buildOpaleNoteGeo` attempt off, falling straight to `plainNoteGeo` -- confirmed via direct SVG inspection: `fogexa`'s note now draws the plain folded-corner outline + corner paths (matching jar's shape), not the merged notch. `fogexa` itself stays non-zero-diff (3->3 diffs, unmasking not regression, jar-verified byte-for-byte): 2 NEW, out-of-scope blockers surfaced (connector drawn inline in the note's own group vs jar's separate top-level `<g class="link">`; `strictuml` also suppresses the class-icon ellipse/badge upstream, unported -- both named for the next iteration's queue, not attempted, per diagnosis.md). Full-corpus regression scan (718/718, worktree baseline vs post-fix): 0 regressions, 1 newly zero-diff (`vicuro-37-tese143`, ratchet-added). DOT gate + description gate (51 tests) re-verified EXACTLY unchanged. 5 new/updated unit tests (`class-member-creole.test.ts` x4 new, `note-layout.test.ts` x1 updated -- jar-verified exact values). | 1 new zero-diff (`vicuro-37-tese143`); census 273/718 (was 272) · 1-3:26 (was 27) · 4-10:109 (unchanged) · 11-30:33 (unchanged) · 31+:277 (unchanged); ratchet 273 fixtures / 275 tests (was 272/274) | done |
| N58 | Ground-truth probed the 32-tagged `enhanced-body-member` population (disposable classify script + live diffCount, not the N56 regex tag): confirmed real item-20 reach is STILL exactly the 2 fixtures N44 named (`gojofu-46-xaci340`/`paroxa-83-lofa387`) -- the rest resolve to unrelated mechanisms (literal `::`-named classifiers, `allow_mixing`, `openiconic-glyph`, namespace-qualified-port variants dominated by a separate bug, already-named tree-row/note gaps). Then FULLY DERIVED item 20's jar mechanism from source (`MethodsOrFieldsArea#getPorts`/`BodyEnhanced1#getPorts`/`TextBlockVertical#getPorts`/`EntityImageClass#getPorts`/`SvekNode#appendLabelHtmlSpecialForLink` -- a per-member-row stacked HTML port table, fuzzy-matched via `getElected`/`getScore`), byte-verified against `gojofu-46-xaci340`'s own cached `svek-1.dot` (36/14/26 and 58/14/18 row heights, both classifiers, exact). Discovered the REAL blocker: `graph-layout.ts#addNodes` unconditionally emits `shape:'box'` -- `DotInputNode.shape`/`isPort` (`class-dot-graph.ts`'s shielded-node machinery) is DEAD CODE in the real render pipeline, consumed only by the disconnected `svek-dot-emit.ts` oracle-comparison shadow emitter. Landing item 20 for real means wiring an ENTIRELY NEW HTML-like-port-table node shape + `tailport`/`headport` edge attributes into the real pipeline for the FIRST time (confirmed graphviz-ts's own bundled engine supports both via `initEdgePorts`/`portfnOf`, but this port never wired it) -- a materially larger, DOT-topology-awaiting-maintainer-shaped undertaking than the mission's "land it, verify the gate" framing anticipated for 2 fixtures; NOT landed, full derivation logged in `ledger.md` N58 for reuse. Priority 2: item 40 (`skinparam style strictuml` class-icon/badge suppression) LANDED -- `CucaDiagram#showPortion`'s unconditional `CIRCLED_CHARACTER` guard, threaded as `!strictUml` alongside the existing `hideCircle` gate at both `measureGenericClassifier` and `buildHeaderPrimitive` (mirrors item 37's `theme.strictUml` precedent); jar-verified byte-exact against `fogexa-30-zupo141` (183x153 -> 175x153 canvas, exact match). Item 39 (note-connector placement under `strictuml`) inspected and DECLINED -- needs a new synthetic-edge draw path + NoteGeo dispatch flag + `renderer.ts` draw-order change + a dasharray fix (`4,4`->`7,7`), not "cheap after inspection." Priority 3: near-zero harvest (26-fixture 1-3 bucket) triaged, genuinely fragmented (crowfoot-decor gap, gradient-color, classFontColor automatic, mode-dark, remove/restore+note uid interaction) -- none landed, matching every prior pass's identical finding. Full-corpus regression scan (item 40, disposable worktree): 1 improved (`fogexa` 3->1), 3 non-zero diffCount increases (`ditapa-46-bete946`/`jinibe-02-tebi269`/`mucuxi-36-beku683`, all the ALREADY-NAMED unrelated "strictuml package-style" gap now exposed at finer granularity -- confirmed unmasking via direct inspection, `mucuxi`'s class box itself is now byte-exact), 0 zero-diff regressions. DOT gate + description gate re-verified EXACTLY unchanged (item 40 is render/measurement-only). 3 new unit tests (`layout.test.ts` x1, `renderer.test.ts` x2, TDD). | 0 new zero-diff; census 273/718 unchanged · 1-3:26 (unchanged) · 4-10:108 (was 109) · 11-30:34 (was 33) · 31+:277 (unchanged); ratchet 273 fixtures / 275 tests (unchanged) | done |
| N59 | Investigated mission priority 1 (strictuml package-style gap) first: LANDED `skinparam packageStyle rect|rectangle` (new `theme.packageStyle`, `class-namespace-shape.ts#renderNamespaceRect` -- plain `<rect>`, centered title, no tab notch, jar-verified byte-exact against `mucuxi-36-beku683`) + package-outline "no paint" fill now emits jar's real `fill="none"` (was two INCONSISTENT behaviors: raw `"transparent"` leaking through the strictuml `<polygon>` path, `#00000000` hex on the non-strict `<path>` path -- new `packageFillValue` helper). `jinibe-02-tebi269`/`ditapa-46-bete946`'s much larger FOLDER-style catastrophic ~20px canvas-width/position gap extensively instrumented (blanked the DOT cluster label -- zero effect, ruling out graphviz-ts label-centering; confirmed jar's own cached `svek-1.dot` is STRUCTURALLY IDENTICAL between FOLDER and RECT styles, so the divergence is a jar POST-LAYOUT draw-time `Cluster.java#rectangleArea` difference, not a DOT-emission difference) but root cause NOT identified -- new item 42, ledgered with full ruled-out list. Pivoted to priority 3 (`::`-named classifier gap): ground-truth probe of `bicabi-42-coto932` found the REAL defect was NOT item 20's port-table gap (entity/link counts and qualified-names byte-identical to jar) but relationship-endpoint AUTO-CREATION ORDER -- `class-commands.ts`'s `ensureClassifier` calls used `rel.from`/`rel.to` (already reordered by `ArrowInfo.swapDirection` for hierarchical/single-arrowhead edges) instead of jar's REAL left-to-right SOURCE TEXT order (`CommandLinkClass.executeArg:295-333`, unconditional, independent of arrow semantics). New `Relationship.swapDirection` field threaded through so `class-commands.ts` ensures endpoints in TEXTUAL order. Full-corpus regression scan: **12 fixtures newly reach zero-diff**, 0 zero-diff regressions, 23 others shifted (mix of improved/worsened, all `31+`-bucket unmasking, none crossing the zero boundary) -- the mission's largest single-mechanism win since N17's folder-tab shape. `nadono-22-gidu983`/`garizu-98-nixo496`/`rocere-18-faza042` (the OTHER 3 of the mission's named 4) confirmed UNAFFECTED (endpoints pre-declared before reference) -- real blocker undiagnosed, named remainder. DOT gate + description gate re-verified EXACTLY unchanged both BEFORE (risk-checked immediately, given the structural nature of the order fix) and after. 6 new/updated unit tests (`class-relationship-creation-order.test.ts` x5 new TDD, `parser.test.ts` x1 corrected -- the old assertion encoded the pre-fix bug). Priorities 2 (item 39) and 4 (near-zero harvest) NOT attempted -- budget went entirely to priorities 1 and 3. | **12 new zero-diff**; census 285/718 (was 273) · 1-3:27 (was 26) · 4-10:108 (unchanged) · 11-30:34 (unchanged) · 31+:264 (was 277); ratchet 285 fixtures / 287 tests (was 273/275) | done |
| N60 | Item 42 (FOLDER-strictuml canvas mystery) DIAGNOSED and LANDED via the N46 patched-jar technique after static tracing exhausted 3 ruled-out hypotheses (`FrontierCalculator`, `suppWidthBecauseOfShape`, DOT-emission divergence): jar's `USymbolFolder#asBig` draws a strictuml FOLDER outline as a `UPolygon` (sharp corners), and `LimitFinder#drawUPolygon` carries a literal `HACK_X_FOR_POLYGON=10` ink-walk-only x-padding quirk this port never modeled for namespace outlines (it assumed every namespace draws a `UPath`). Patched 3 classes in a SCRATCH copy of the oracle jar (`oracle/dist/` never touched, debug printlns reverted immediately after), confirmed jar's real `LimitFinder` minMax exactly: `jinibe` (FOLDER) `[6,74]` = raw cluster bbox `[16,64]` ± `HACK_X_FOR_POLYGON`; `mucuxi` (RECT) `[15,63]` = the SAME raw bbox via `LimitFinder#drawRectangle`'s `-1`/`w-1` rule -- both against BYTE-IDENTICAL DOT input, proving the divergence is 100% jar draw-time ink-extent, not graphviz or DOT emission. New `NamespaceGeo.inkShape` field (`'polygon'`\|`'rect'`\|`undefined`), resolved once per diagram from `theme.packageStyle`/`theme.strictUml` (`class-geo-builders.ts#resolveNamespaceInkShape`), dispatched in `layout-ink-extent.ts#addNamespaceInk` (new `addFolderPolygonInk`/`addNamespaceRectInk` ink rules) -- zero signature changes to `computeClassDocumentDims`/`computeClassInkShift` (the field lives on the pre-resolved `NamespaceGeo`, keeping the module theme-free per its own established convention). Full-corpus regression scan: 0 regressions, 3 fixtures dramatically improved (`jinibe` 18->10, `ditapa` 20->12, `mucuxi` 19->10 diffs -- RECT's fix was a byproduct of the SAME dispatch, also correcting a previously-unnoticed Y-axis ink-shift gap). 0 new zero-diff -- all 3 blocked only by the SEPARATE, already-named `NAMESPACE_SIDE_PADDING=16` vs jar's real `~16.32` residual (suspected graphviz-ts-vs-real-graphviz margin divergence, out of this mission's declared scope). Item 39 (fogexa note-connector) re-diagnosed against the EXACT golden SVG (not available to N58) -- confirms N58's mechanism precisely but reveals the REAL remaining blocker is `renderer-uid.ts#assignExact`'s dense-renumbering merge needing a new entry TYPE for a note-connector-promoted-to-edge, sourced from an untraced `creationIndex` -- declined again, too high a regression risk (shared uid machinery) for 1/718 reach without its own dedicated trace. Near-zero harvest (27-fixture 1-3 bucket) triaged: `pofabe-33-kizo628`'s `skinparam monochrome true` gap traced to jar's exact mechanism (`ColorMapper.MONOCHROME`, `gray=floor((R*299+G*587+B*114)/1000)`, verified algebraically to the exact hex) but declined as a genuine chokepoint-level color feature (16 call sites), not a near-zero fix -- matches N58's identical `classFontColor automatic` precedent; `lenunu-95-bame774`'s uniform "-1" id gap traced to a phantom-creationIndex-slot mechanism distinct from item 39's, untraced this iteration. 6 new unit tests (`layout-ink-extent.test.ts` x2, `class-geo-builders.test.ts` x4, TDD -- jar-verified against the patched-jar trace values). DOT gate + description gate re-verified EXACTLY unchanged (render/ink-extent-only change). | 0 new zero-diff (all 3 improved targets blocked by the separate, out-of-scope padding residual); census 285/718 unchanged · 1-3:27 (unchanged) · 4-10:110 (was 108) · 11-30:32 (was 34) · 31+:264 (unchanged); ratchet 285 fixtures / 287 tests (unchanged) | done |

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

## N25 queue — for N26

1. **`-[#color]->` inline edge-color override** (`Relationship.color`,
   `CommandLinkClass`'s `[#color[,thickness]]` bracket syntax — NEWLY
   UNMASKED N25 by the multiplicity-label fix on `kipure-14-suli112`'s
   `Subscriber -[#blue]-> IpSession` edge, previously hidden behind that
   fixture's own childCount mismatch) — `Relationship` has no `color` field
   at all; the stroke color is derived purely from `EDGE_DECORATION_MAP`.
   Reach beyond this one fixture not yet surveyed.
2. **`(CHAR[,COLOR])[LABEL]` circled-char BADGE customization** (custom
   badge letter/color via `<<(C,#FF0000)>>`/`<<(S) Stereotype>>` syntax,
   NEWLY SURVEYED N24, 6 direct near-zero fixtures — the TEXT half is now
   correctly stripped by N24's Mechanism 1, only the badge letter/color
   itself remains unbuilt) — `class-badge.ts#badgeFill`/`badgeLetter`
   still dispatch purely on `ClassifierKind`; needs `Classifier`-level
   override fields threaded from `StereotypeDecoration#buildComplex`'s
   `CHAR`/`COLOR` capture.
3. **`hide C2 circle` / entity-qualified compound hide forms**
   (`CommandHideShowByGender`, unchanged since N12, `dokego-92-zilu832` —
   NOW the SOLE blocker on that fixture's C1-C2 edge after N25's
   multiplicity-label fix landed; C2's box is 49.9375x48 in this port vs
   jar's real 23.9375x40, a real geometry difference) — structurally
   confirmed (badge+letter suppressed, header re-centered without badge
   space) but not landed standalone.
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
11a. **`graphviz-ts` builder API has no fixed-size/HTML-table label
    override** (NEWLY DISCOVERED N25, `node_modules/graphviz-ts/src/api/
    builder.ts#addEdge` -- plain `Record<string,string>` attrs only, no
    HTML-label marking path) -- causes a small (~1-4px) position residual
    on the multiplicity-label mechanism's OTHERWISE-clean tail-side
    placements, since `graphviz-ts`'s internal `xladjust` search sizes the
    label with its own `Times`-LUT measurement instead of an explicit
    jar-style `FIXEDSIZE=TRUE WIDTH=/HEIGHT=` override. Fixing this cleanly
    needs either a `graphviz-ts` change (OUT OF SCOPE) or a second,
    DOT-text-based `renderSvg()` layout pass purely for label sizing --
    genuinely unbuilt, named for a dedicated future iteration if the
    multiplicity mechanism's residual reach turns out to matter once items
    1/3 above are cleared.
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

**LANDED N25, structurally complete but NOT fully "resolved"** (kept in a
future queue only via its two blocking sub-items above, items 1/3/11a --
the mechanism itself needs no further work): relationship multiplicity/
cardinality end-label text render — real graphviz placement algorithm
(`xlabels.c` external-label force-search) reused via `graphviz-ts`'s own
already-vendored port, extracted through its `render()` SVG output. Every
corpus fixture whose multiplicity-blocking edge has NO `[#color]` override,
NO `hide circle`, and whose edge spline endpoint already matches jar's own
routing exactly should now reach (or come very close to) zero-diff — none
of the 12 cached-oracle fixtures sampled this iteration happened to be that
clean; a future iteration re-surveying the full ~28/718 population once
items 1/3 above are cleared may find some.

## N26 queue — for N27

1. **Custom badge LETTER beyond the 5 pre-captured glyphs** (C/I/A/E/@ —
   N26 landed the COLOR half unconditionally plus the letter for the
   coincidental A/E overlaps; corpus also uses R/M/J/O/P/W/D/F/Q/S/X and
   `$sprite` names, ~15+ distinct fixtures across the 20-fixture badge
   population) — needs new corpus-scraped vector `d` glyph data per
   letter, the same technique `class-badge.ts`'s original 5 used (N3).
2. **Type-keyword GENDER hide form** (`hide class circled`/`hide object
   members`/etc — `CommandHideShowByGender`'s GENDER = a type keyword,
   applies to EVERY classifier of that kind, N26-narrowed from the
   entity-id form landed this iteration) — blocks `nujiga-81-peno983`/
   `vokulo-90-fado357`/`jijovu-48-gole133`/`xofumu-51-jozi528` (their
   entity-scoped sibling directives already land correctly per N26; only
   the type-keyword line itself remains unmatched/dropped).
3. **`<<stereotype>>` GENDER hide form for non-`stereotype` portions**
   (`hide <<even>> methods` — distinct from the ALREADY-LANDED N24
   `hide|show [<<pattern>>] stereotype(s)` PORTION=stereotype slice; this
   is the SAME `<<pattern>>` GENDER applied to `circle`/`members`/
   `fields`/`methods` instead) — blocks `jijovu-48-gole133`/
   `xofumu-51-jozi528`.
4. **Undefined-entity arrow-notation variants** (unchanged since N24/N25,
   `<->`, `<...>`, `--{`, `}-`, `#--`, `-0)-`) — ~11 corpus-wide estimate.
5. **Note/rect explicit background-color override** (unchanged since N24,
   3 fixtures).
6. **`skinparam guillemet`** (unchanged since N24, 4 fixtures).
7. **`skinparam classStereotypeFontSize`/`classStereotypeFontStyle`**
   (unchanged since N24, 1 fixture).
8. **`skinparam groupInheritance`** (unchanged since N9/N12).
9. **`skinparam mode dark`** (unchanged since N7).
10. **`class Collection<T>` generic type-parameter tag box** (unchanged
    since N12/N21/N23/N25, explicit DOT-gate risk).
11. **`sasito-46-padu855`'s space-before-colon bug** (unchanged since N24,
    single fixture, root cause not traced).
12. **Bare (non-"empty") global `hide methods`/`hide fields`** (NEWLY
    DISCOVERED N26 via `cutasu-32-zete658`'s own `hide methods` line --
    distinct from the already-built `hide empty methods`/`hide empty
    fields` AND from N26's own entity-scoped `hide <entity> methods`;
    zero further corpus reach found beyond this one fixture, low
    priority).
13. **`graphviz-ts` fixed-size (HTML `FIXEDSIZE`) label-sizing API gap**
    (unchanged since N25, item 11a there) — deferred, needs a
    `graphviz-ts` change or a second DOT-text-only layout pass.
14. Every item unchanged from N22's own queue not superseded above
    (`<&glyph>` OpenIconic/FontAwesome-icon rendering, `skinparam
    diagramBorderColor`, `<style> note {}` CSS-class cascade, `remove`/
    `restore` dense-renumbering, nested `|_` member tree-list syntax,
    embedded diagram block in member text, gradient skinparam colors,
    double couple, `skinparam topurl`, member/relationship-edge `[[url]]`
    variants beyond inline creole, `ent0001`/`ent0002` id swap, `scale max
    N height`, `!pragma layout elk`, `[hidden]` suppression,
    `sadamo-18-siva346`, graphviz-ts coordinate offset, anchor-in-cluster
    footprint, title-driven package width floor, strictuml
    classifier-spot-badge suppression, package/namespace stereotype ->
    `PackageStyle` dispatch, lollipop half-circle socket, file-size-cap
    housekeeping) — see `plans/g2-class-svg/ledger.md` N15-N26 for the
    full renumbered list.

**RESOLVED N26, drop from future queues**: `-[#color]->`/`-[bold\|dashed\|
dotted]->`/`-[thickness=N]->` inline bracket-modifier overrides — landed
(color/thickness/dashed/dotted/bold; `hidden`/`norank` intentionally out
of scope, DOT-affecting). Entity-qualified `hide <entity> circle\|members\|
fields\|methods` (GENDER = bare/quoted entity id only) — landed. The
`memberAreaWidth`-ignores-suppression pre-existing bug — fixed. Badge
`(CHAR,COLOR)` COLOR half, plus the LETTER half for the 5 coincidental
known-glyph matches — landed (LETTER for other custom chars remains open,
item 1 above). The two blocking sub-items N25 itself named for the
multiplicity-label mechanism (items 1/3 in its own queue) are now BOTH
cleared at the mechanism level — a future iteration re-surveying the
~28/718 multiplicity population (per N25's own closing note) may find
additional zero-diff fixtures now that the color-override and
entity-circle blockers are gone.

## N27 queue — for N28

1. **Dotted-namespace nesting** (NEWLY DISCOVERED N27, ≥7 direct reach —
   `namespace A.B.C { }` and `set namespaceSeparator .` + qualified
   cross-namespace refs like `.BaseClass <|-- X`) — jar creates a NESTED
   cluster per dot-separated segment (`Revelate` > `Legacy` > `Base` >
   `Biz`, 4 levels for a 4-segment name, shared-prefix segments reused
   across sibling namespaces); this port creates ONE FLAT cluster per
   full dotted name. Likely DOT-topology-affecting (cluster hierarchy is
   part of DOT emission) — needs a frozen-gate risk assessment before
   attempting. `dudimi-83-mimo845`/`dujinu-38-badu006`/`duvuti-29-lugi970`/
   `gaxipe-22-maxa852`/`joguva-54-tevo966`/`pareli-69-cixe116`/
   `xodopa-41-tazo512` all share the identical "Revelate.Legacy.Base.Biz"
   pattern (likely duplicate corpus submissions of the same upstream
   issue) — true corpus-wide reach beyond this cluster not yet surveyed.
2. **PLUS/SQUARE/CROWFOOT/PARENTHESIS arrowhead marker shapes** (RENAMED
   N27 from "undefined-entity arrow-notation variants" — NOT about entity
   definedness at all, confirmed via `cenubi-27-xova754`/`zerofa-77-
   caro506`, both classes fully declared) — `class-arrow-grammar.ts
   #headToDecor`'s own doc comment already documents this as the `D6`
   scope decision from the EARLIER `class-dot-sync` mission ("DOT parity,
   not SVG rendering") — now squarely in scope for G2. Needs 4+ new
   small-vector marker shapes with real placement-offset geometry
   (`LinkDecor.PLUS`/`SQUARE`/`CROWFOOT`/`PARENTHESIS`), not a value-
   wiring fix. ~8/718 direct reach confirmed (`cenubi-27-xova754`,
   `gekope-01-ricu859`, `kepado-34-risa735`, `medosa-71-ligu412`,
   `zerofa-77-caro506`, `zuramo-86-liku129`, + 2 more with confounding
   other features) — NOTE: the crow's-foot IE-notation samples this
   iteration's overbroad regex separately flagged
   (`xosiza-60-sobu480`'s `|o--o|`/`||--||`/`}o--o{`/`}|--|{`) are
   NOT part of this bucket — those already render correctly with
   ALREADY-BUILT decor kinds.
3. **Note/rect explicit background-color override** (unchanged reach
   since N24, ~5 corpus-wide once `note on link` overlap is excluded) —
   full mechanism diagnosed N27 (`ledger.md` N27): `NOTE_COLOR`'s
   regex group is deliberately non-capturing (a documented earlier-
   mission scope limit), needs re-indexing 4-6 downstream regex
   handlers + `ClassNote.backgroundColor` + `NoteGeo` + THREE render
   functions. Entangled with 2 NEWLY DISCOVERED separate bugs that would
   ALSO block zero-diff: the freestanding "plain-fold" note render path
   (`renderNote`, `renderer-note.ts`) draws a `<polygon>` + unfilled
   `stroke-width:0.5` fold triangle where jar draws TWO `<path>`
   elements, the fold FILLED (bg color) at `stroke-width:1`, closed
   4-point shape — this is the ENTIRE plain-fold path N13 already
   flagged as never jar-verified; and a note id off-by-one on
   Opale-attached notes when a freestanding note appears earlier in
   source order (root cause unconfirmed).
4. **Type-keyword GENDER hide form** (unchanged since N26, 5 reach —
   `hide class circled`/`hide object members`/etc).
5. **`<<stereotype>>` GENDER hide form for non-`stereotype` portions**
   (unchanged since N26, 2 reach, subset of item 4's population).
6. **Custom badge LETTER beyond the 5 pre-captured glyphs** (unchanged
   since N26, ~15+ reach).
7. **`note on link` Kind D** (unchanged since N13, 5 reach).
8. **`skinparam groupInheritance`** (reach CORRECTED N27: 7, was believed
   1-3 since N9/N12) — root-caused via `~/git/plantuml/.../dot/
   DotData.java#removeIrrelevantSametail`: this is a DOT-EMISSION-level
   edge-merge (builds a `Neighborhood` shared-tail structure, changes
   node degree/rank), NOT a render-only mechanism — directly risks the
   FROZEN class DOT gate. Flagging for a MAINTAINER SCOPING DECISION:
   likely belongs to a dedicated DOT-emission mission, not G2's
   render-only charter, rather than being silently dropped from the
   queue.
9. **`!pragma layout elk`** (reach CORRECTED N27: 7, was believed 4-7
   since N9) — jar's ELK output has a wholly different SVG structure
   (zero `<g class="link">` elements); needs its own scoping pass to
   determine if it's even in mission scope, unchanged conclusion since
   N9.
10. **`skinparam mode dark`** (unchanged since N7, 1 reach).
11. **`skinparam classStereotypeFontSize`/`classStereotypeFontStyle`**
    (unchanged since N24, 1 reach).
12. **`class Collection<T>` generic type-parameter tag box** (unchanged
    since N12/N21/N23/N25, ~15 reach, explicit DOT-gate risk).
13. **Double-couple** (4-entity `associationClass` overload, unchanged
    since N19/N20, 2 reach).
14. **`newpage` (multi-page diagram)** (NEWLY NAMED N27, ≥2 reach —
    `bufogi-69-naba929`/`gevuci-69-fafe469`) — unbuilt directive, this
    port renders only the first page.
15. **`mainframe <text>`** (NEWLY NAMED N27, ≥1 reach —
    `jakaja-15-faze022`) — unbuilt annotation directive.
16. Every item unchanged from N26's own queue item 14 not superseded
    above (`<&glyph>` OpenIconic/FontAwesome-icon rendering, `skinparam
    diagramBorderColor`, `<style> note {}` CSS-class cascade, `remove`/
    `restore` dense-renumbering, nested `|_` member tree-list syntax,
    embedded diagram block in member text, gradient skinparam colors,
    `skinparam topurl`, member/relationship-edge `[[url]]` variants
    beyond inline creole, `ent0001`/`ent0002` id swap, `scale max N
    height`, `[hidden]` suppression, `sadamo-18-siva346`, graphviz-ts
    coordinate offset, anchor-in-cluster footprint, title-driven package
    width floor, strictuml classifier-spot-badge suppression,
    package/namespace stereotype -> `PackageStyle` dispatch, lollipop
    half-circle socket, file-size-cap housekeeping — several already-
    over-cap files (`ast.ts` 973, `skinparam.ts` 669, `class-directives
    .ts` 614, `theme.ts` 567, `class-layout-helpers.ts` 556) grew
    slightly further this iteration's threading, none newly crossed the
    cap) — see `plans/g2-class-svg/ledger.md` N15-N27 for the full
    renumbered list.

**RESOLVED N27, drop from future queues**: `skinparam guillemet <value>`
— landed (all 4 target fixtures reached zero-diff). Bare global `hide
fields`/`hide methods` — landed (mechanism correct, corpus reach
corrected 1→5, 0/5 reached zero-diff, each blocked by a separate larger
issue, named individually above where relevant). "Undefined-entity arrow-
notation variants" as originally named — RENAMED to item 2 above (D6
arrowhead-marker-shape gap), do not re-queue under the old name.

## N37 queue — for N38

1. **`class-dot-graph.ts#buildDotEdges`'s DOT tail/head derivation**
   (NEWLY ROOT-CAUSED N33, the DOT-rank multi-edge-same-pair survey's own
   finding) — uses the arrow-decoration-driven `rel.from`/`rel.to` pair
   instead of the arrow-decoration-independent, already-N9-verified
   `rel.idEntity1`/`idEntity2` pair for non-hierarchical relationship DOT
   edges. Confirmed via byte-diff against both real `dot` and
   `graphviz-ts` fed jar's exact cached DOT text (`duruga-39-lani451`) —
   NOT a graphviz-ts engine divergence (third consecutive confirmation
   after N29/N30). Real DOT-emission-level fix, explicit frozen-gate
   risk, wide blast radius (`from`/`to` threading spans the whole edge
   pipeline) — needs its own dedicated iteration with the N32 empirical
   dot-sync-report-before/after protocol, not a queue add-on.
2. **Collapsed-empty-namespace draw ORDER** (NEWLY DISCOVERED N33,
   `xitobu-41-lame230`/`kepado-34-risa735`) — a collapsed-empty
   `package`/`namespace`'s position among sibling classifiers in
   `ast.classifiers` (the array `renderer.ts`'s classifier loop iterates
   in draw order) does not always match jar's real source-declaration
   order; instrumented probes found `gatula-10-bifu561`/
   `jarigi-34-nage684`'s own empty packages land correctly (matching
   jar) while `xitobu`/`kepado` do not, with NO single consistent
   mechanism found across the 2 contradictory samples (genuinely
   inconclusive, not a guessed fix) — needs a dedicated drill sampling
   MORE of the corpus-wide `dotted-namespace`/`groupInheritance`-adjacent
   population before attempting a fix.
3. **Stereotype-decorated / dotted-namespace-nested empty package sizing**
   (N33's own Mechanism 2 remainder — `daxeno-00-kasu166`'s `<<Database>>`
   stereotype block, `cocube-46-tusu692`'s `boo1.boo2` dotted nesting) —
   `measureEmptyPackageLeafDim` assumes no stereotype block (`stereoBlock
   = TextBlockUtils.empty(0,0)` in jar's own ctor, true for every N33
   sample but not universally); a stereotyped empty package needs the
   FULL `EntityImageEmptyPackage` ctor's `stereoBlock` sizing merged in.
   Dotted-namespace nesting is item 4 below (DOT-topology risk,
   unrelated to the sizing formula itself).
4. **`skinparam groupInheritance`** (7 reach, N9/N12/N27/N33 unchanged) —
   real DOT-emission-level edge-merge (`DotData.java
   #removeIrrelevantSametail`), flagged for the SAME maintainer scoping
   decision N27 raised (dedicated DOT-emission mission vs G2's
   render-only charter) — still not re-litigated.
5. **Dotted-namespace nesting** (22 reach, CONFIRMED up from N27's "≥7"
   estimate via N33's fresh reclassification) — jar creates NESTED
   clusters per dot-separated segment, this port creates ONE FLAT
   cluster; likely DOT-topology-affecting, same maintainer scoping
   decision as item 4.
6. **`skinparam CircledCharacterFontSize`** (21+10 reach, CONFIRMED far
   higher than N31's own "2 reach" sample) — completely unwired, needs
   either glyph-path scaling or new per-size corpus-scraped glyph data
   PLUS a badge-box node-size change, explicit DOT-gate risk. N37: SAME
   undiscovered badge-radius formula item 8 below needs — likely the SAME
   fix serves both, derive the formula there first.
7. Every item unchanged from N27's own queue not superseded above
   (note-of-member connector shape, 44 reach; couple/lollipop
   repeat-coupling, 37 reach; badge-custom-
   letter beyond P/M/F/?, 17 reach; `class Collection<T>` generic tag box beyond the
   landed quoted-alias case; `!pragma layout elk`; `[hidden]` bracket;
   `skinparam mode dark`; type-keyword/`<<stereotype>>` GENDER hide
   forms; `note on link` Kind D; double-couple; `newpage`/`mainframe`
   remainders;
   `skinparam diagramBorderColor`; `<style> note {}` CSS-class cascade;
   `remove`/`restore` dense-renumbering;
   embedded diagram block in member text; gradient skinparam
   colors; `skinparam topurl`; `ent0001`/`ent0002` id swap; `scale max N
   height`; anchor-in-cluster footprint; title-driven package width
   floor; strictuml classifier-spot-badge suppression; package/namespace
   stereotype -> `PackageStyle` dispatch; lollipop half-circle socket;
   per-visibility icon color; `AttributeFontStyle` header/attribute font
   role split remainder) — see `plans/g2-class-svg/ledger.md` N15-N37 for
   the full renumbered list. `<&glyph>` OpenIconic/FontAwesome icon
   rendering and nested `|_` member tree-list syntax MOVED to items 11/12
   below (N40 surveyed both to exact byte-verified algorithms); url-wrap
   variants MOVED to item 13 below (N40 sub-classified the 17-reach
   estimate and landed the tractable subset).
8. **`skinparam classStereotypeFontSize`/`classStereotypeFontStyle`**
   (NEWLY SURVEYED N37, 12 reach — `datugo-88-sote552`/`befasi-62-
   vimu310`/`depulu-53-xoca727`/`mububu-79-nalu431`/`puvono-84-doro361`/
   `ribove-58-tefu515`/`sekame-22-meze147`/`soboro-52-pevi612`/`teluve-
   08-moco846`/`zakuta-81-pese010`/`ziruni-05-fona846`/`zosaxa-86-
   mora157`) — the generic `<sname>StereotypeFontSize` bucket mechanism
   already covers this (just needs `'class'` added to
   `ELEMENT_BUCKET_SNAMES`), BUT jar-verified `datugo`/`depulu` samples
   show the badge ellipse `rx`/`ry`/`cx`/`cy` ALSO shifts when this
   skinparam is set (radius itself changes, not just re-centering) —
   an undiscovered badge-radius formula this iteration did NOT derive,
   explicit DOT-gate risk (same family as item 6). Recommended next
   step: derive the radius formula from `datugo`/`depulu`'s own byte-
   exact deltas FIRST — likely serves item 6 too.
9. **`<style>` block position-scoped merge** (NEWLY DISCOVERED N37,
   `fexuta-62-piko653`) — this port's `buildTheme` (index.ts Stage 3a)
   merges EVERY `<style>` block in a diagram into ONE flat StyleMap
   up front, position-independent (last-registered-globally wins); jar's
   real behavior is apparently POSITION-SCOPED (a `<style>` block only
   affects declarations textually AFTER it — `fexuta`'s 2 separate
   `.a{}` blocks with different colors, applied to classifiers declared
   before/after each, resolve to the SAME (last) color in this port but
   DIFFERENT colors in jar). Cross-cutting: the merge strategy is shared
   by EVERY diagram type's `<style>` handling, not class-only — needs a
   maintainer scoping decision (same posture as items 4/5's DOT-emission
   flag) before attempting, well beyond a single mechanism's scope.
10. **`<style> note { FontSize N }`** (NEWLY DISCOVERED N37,
    `xokipa-29-rafu481`) — `NOTE_FONT_SIZE = 13` is hardcoded in BOTH
    `renderer-note.ts` and note sizing; never reads
    `theme.colors.elements.note.fontSize` despite that bucket already
    being populated by the pre-existing generic per-element mechanism —
    a pure wiring gap (no new bucket-collection code needed), narrow
    scope, good near-zero candidate for a future iteration.
11. **Nested `|_` member tree-list syntax** — LANDED N42 (see
    `plans/g2-class-svg/ledger.md` N42; RESOLVED, drop from future
    queues). The full upstream `BodyEnhanced1`/`BodyEnhancedAbstract`
    "enhanced body" render strategy (block separators + tree runs) was
    ported, not just the tree — 3 of 7 corpus-reach fixtures reach
    zero-diff (`fecolo-08-gepu579`, `jajebo-21-dada557`, `pacagu-24-
    nune023`); `sonoci-68-ciza059`/`foxiki-17-kosa114` improved
    substantially (residual gaps named in the ledger); `kacico-91-
    bati232` is OUT OF SCOPE (tree syntax inside a `legend`, a different
    subsystem); `juxora-90-fisu720` improved for its tree classifiers,
    diagnosed remainder is an unrelated non-tree width gap.
12. **OpenIconic `<&glyph>`** (9 reach, 6 distinct glyph names —
    SURVEYED N40, NOT landed): corpus-wide grep found exactly `x`,
    `key`, `ban`, `caret-right`, `link-intact`, `thumb-up` — small
    enough for N33's badge-letter "capture-and-translate from the
    corpus's own jar SVG" technique (jar-verified `rideze-59-lizu265`:
    `<&ban>` renders a literal vector `<path>` outline, fill = the
    active creole color). Needs a NEW inline-atom recognizer in
    `core/creole-atoms.ts` (alongside the existing `<$sprite>`/`<img>`
    scan) + per-glyph path/viewBox capture for all 6 names + a
    scale/color/position formula from the `scale=`/`color=` option
    syntax. Every one of the 9 fixtures currently shows LARGE
    canvas-dimension deltas (unrecognized markup garbles the row's
    measured width) — not near-zero.
13. **url-wrap variants** (N40 sub-classified the N33 17-reach estimate
    against a re-derived 22-fixture real reach — 3 mechanisms LANDED,
    see ledger N40; 4 fixtures remain genuinely tractable-adjacent:
    `sejuzo-42-fini523`'s member-parsing gap named below, item 14) —
    the residual 14 deep (26-330 diff) fixtures are blocked by
    UNRELATED already-named childCount/uid mechanisms (item 1's own
    `ent0003`/`ent0004` family, `topurl` items 2/9 above), confirmed
    NOT url-mechanism-shaped by direct diff-dump — do not re-queue this
    item as a whole; the specific named sub-items above are the real
    remaining scope.
14. **`[[url]] : TYPE`-shaped single-field member section-split gap**
    (NEWLY DISCOVERED N40, `sejuzo-42-fini523`, 1+ reach) — a
    classifier whose ONLY field is `[[url{tooltip} label]] : TYPE`
    draws with an EXTRA empty-section divider + an 8px row-Y offset +
    a stray leading space in the rendered `" : TYPE"` (jar emits
    `": TYPE"` bare) — a member-parsing/section-split root cause NOT
    instrumented this iteration (mechanism 3's own url-wrap fix landed
    cleanly; this residual is a separate, newly-surfaced gap in how the
    fields/methods section boundary is computed for this exact member
    shape). Root cause NOT diagnosed — needs instrumentation before any
    fix attempt, per diagnosis.md.
15. **RESOLVED N43 as originally framed, drop from future queues under
    this name** — N42's "hide members not wired into the enhanced-body
    render path" diagnosis for `benemi-22-dufo622`/`xosiza-60-sobu480` was
    WRONG (see ledger.md N43 mechanism 0): both fixtures indent their `--`
    line, so `isBlockSeparatorLine`'s raw-untrimmed check never triggers
    `isEnhancedBody` for either — neither reaches `class-body-enhanced-
    layout.ts` at all; N42's diagnosis was an artifact of its own test
    harness (`class-hide-visibility.test.ts` trims every line before
    parsing). The WIRING GAP itself was still real (upstream's
    `rawBodyWithoutHidden()` — visibility-hide only, not bare `hide
    members`/`fields`/`methods`) and is LANDED (ledger.md N43 mechanism 1),
    but closes zero named fixtures since neither ever needed it. The REAL,
    still-open mechanism behind both fixtures is item 18 below (creole
    horizontal-line atom recognition) — re-queue there, not here.
16. **RESOLVED N43, drop from future queues** — re-diagnosed: `juxora-90-
    fisu720`'s apparent "FlatBar width formula" gap was actually
    `FlatWorks` (a DIFFERENT, non-enhanced-body classifier in the same
    fixture) misclassifying `**Foo (Model)**`/`prop4 :(` as FIELDS instead
    of METHODS — `tryParseAttribute`'s greedy `\S+` type capture matched
    paren-bearing "types" (`"("`, `"void()"`), stealing them from
    `isMethodMember`'s raw-fallback paren-scan. FIXED (ledger.md N43
    mechanism 2, `[^()\s]+` type capture) — `FlatWorks`/`FlatBar` both now
    byte-exact at the element level. `FlatBar`'s OWN block-separator width
    formula was NEVER actually wrong; the `111.487` vs `81.2125` reading
    was a downstream artifact of `FlatWorks`'s misclassification shifting
    which SVG index `compareSvg` compared FlatBar against — confirmed via
    isolated `layoutClass` width computation (matched jar exactly even
    before the fix).
17. **Title/legend creole markup does not resolve `<$sprite>` atoms**
    (PRE-EXISTING, unmasked N42 via `rotisi-30-loge424`'s childCount
    comparator now descending past a previously-masking classifier bug)
    — a `title`/`legend` annotation's OWN creole text block renders a
    sprite reference (`<$bug16>`) as literal escaped text (`&lt;$bug16&gt;`
    in ONE `<text>`/`<tspan>`) instead of the jar's real 6-element
    text+image-interleaved structure. Annotation-rendering scope, NOT
    `class-body-enhanced.ts`/classifier-body scope — a different render
    subsystem (`core/annotations/` or similar), unsurveyed.
18. **RESOLVED N44, drop from future queues under this name** — N43's own
    "creole atom `HORIZONTAL_LINE`" framing (ledger.md N43 mechanism 0) was
    jar-DISPROVED (ledger.md N44 mechanism 0: `"--".matches("^--([^-]*)--$")`
    is `false` in real Java regex, confirmed via `javac`/`java` directly —
    the pattern needs >=4 chars, a bare `--` can never match it). The REAL
    mechanism: jar routes a `--`-shaped member row through the ALREADY-
    PORTED `BodyEnhanced1` enhanced-body machinery (N42), not creole at
    all — it only looked masked because upstream dedents a classifier's raw
    body (`BlocLines#trimSmart(1)`, `CommandCreateClassMultilines.java
    :153,215`) BEFORE `isBodyEnhanced` ever runs, and this port's own
    `rawBodyLines` capture never had an equivalent step. LANDED: new
    `class-body-enhanced.ts#dedentRawLines` (`trimSmart(1)` port), wired
    into `parser.ts`'s body-close handler — fixes item 18 at its TRUE
    origin (a parser-level dedent gap, not a creole-atom gap), transparent
    for every already-passing enhanced-body fixture. Landing it unmasked 3
    further separate gaps, all LANDED alongside (enhanced-body visibility-
    icon rendering, `..` separator dash-array, `hide X members` suppression
    respect) — see ledger.md N44 mechanisms 1-4. **4 new zero-diff**
    (`benemi-22-dufo622`, `kexati-85-zupa495`, `lasave-44-dofa269`,
    `sonoci-68-ciza059`).
19. **RESOLVED N45 as originally framed, drop from future queues under
    this name** — N44's "enhanced-body skinparam/`<style>` font threading"
    diagnosis for `xabije-20-xusi569`/`ropera-76-jico895` was WRONG (see
    ledger.md N45 mechanism 0): an isolated no-title probe proves
    `class-body-enhanced-layout.ts#buildRowsBlockRows` ALREADY threads the
    resolved `ClassAttributeFontStyle`/`FontSize`/`<style>` font correctly
    (member rows already draw `font-size="18" font-style="italic"`,
    entity's own rect byte-identical to jar with no title present). The
    REAL, still-open mechanism behind both fixtures is item 23 below (a
    `blocks.ts` title/legend block-width gap unmasked by N45's OTHER two
    landed chrome fixes) — re-queue there, not here.
20. **Enhanced-body member-row EDGE-port anchor exposure** (NEWLY
    DISCOVERED N44, `gojofu-46-xaci340`/`paroxa-83-lofa387`, 2+ reach —
    unmasked by item 18's fix) — `User::id`-shaped cross-classifier member
    references (`left to right direction` diagrams) need a specific member
    ROW's own anchor position for edge routing; the classic path's port
    machinery (`MethodsOrFieldsArea#getPorts`) has no enhanced-body
    equivalent. NARROWED N47: the SAME underlying gap ("enhanced-body
    classifiers expose no member-row anchor data outside `enhancedBody
    .parts`") also blocked member-TIP NOTES (`note ... of Class::member`)
    from resolving on an enhanced-body host — that consumer is FIXED
    (`note-layout.ts#memberAnchorRows`, see ledger.md N47). This item now
    covers ONLY the edge-routing-port consumer, still unsurveyed beyond
    the 2 N44 fixtures — needs a jar-verified port-position formula before
    attempting.
21. **`==` separator double-hline** (NEWLY NAMED N44,
    `UHorizontalLine#drawHLine`'s `if (style == '=') drawSimpleHline(...,
    y + 2)` — zero corpus reach among N44's newly-triggered fixtures, all
    of which use `--`/`..`) — same class of gap as the now-fixed `.`
    dasharray (item 18's mechanism 3); likely reachable once more
    uniformly-indented `==` bodies surface in a future survey.
22. **`xosiza-60-sobu480`'s residual 1px `svg/@height` gap** (NEWLY NAMED
    N44 — down from 105 diffs to 2 after item 18's fix; `Entity`'s own box
    is now byte-exact) — the remaining delta traces to sibling classifiers'
    crow's-foot link routing shifting slightly now that `Entity`'s real
    (smaller, correct) height feeds the SVG-channel geometry extraction.
    SVG-channel standing-rule territory (`extractPortLabelPositions`/
    `frontier-shadow-layout.ts`) — explicitly out of scope per the standing
    rule until the class census reaches parity.
23. **RESOLVED N46, drop from future queues** — the `blocks.ts` title/
    legend block-width framing was itself a misdiagnosis: `buildAnnotationBlock`
    was never wrong (jar-verified byte-exact, `skinparam titleBackgroundColor
    yellow` probe reading the drawn `<rect width>` directly). The REAL
    mechanism (ledger.md N46): `chrome.ts#applyChrome` centered/positioned
    title/caption/header/footer against class's FINAL (post-document-margin/
    `SvgGraphics#ensureVisible`-quirk) canvas width, when jar's own
    `TitledDiagram#addChrome`/`DiagramChromeFactory.create` centers against
    the RAW pre-margin `SvekResult` ink-walk width and applies margin+quirk
    to the fully chrome-composed result LAST, at export time. Fixed via a
    raw/final dimension split threaded through `layout-ink-extent.ts`,
    `ClassGeometry`, `RenderFragment`, `chrome.ts#applyChrome`, and
    `index.ts#applyAnnotationChrome`'s class-specific re-margin-after-chrome
    step — additive/opt-in, zero behavior change for every other engine and
    for class's own no-chrome path (DOT gate + description census both
    unchanged). **3 new zero-diff** (`boduli-27-zufa581` — also needed
    mechanism 2 below — `takove-63-tizi841`, `vofatu-71-garo486`). The
    "Fission word-split" hypothesis this item was originally framed around
    was jar-DISPROVED (`LineBreakStrategy.NONE.getMaxWidth()` is hard-coded
    0, so `Fission#getSplitted` early-returns unconditionally) — do not
    re-queue under that framing either.

24. **`ClassGeometry.rawWidth`/`rawHeight` left `undefined` for 2 geometry-
    construction paths (NARROWED N48 — was 3)** (NEWLY NAMED N46, item 23's
    fix only threads the raw/final split through `assembleShiftedGeometry`'s
    main DOT-driven path) — `class-geo-builders.ts#degenerateSingleClassifier`
    FIXED N48 (see ledger.md N48 mechanism 2 — also resolved the old item 27
    "multi-line title block grammar" misdiagnosis, which was actually this
    same gap). Still open: the empty-diagram sentinel and
    `layout.ts#layoutMultiPage`'s page-stacking combiner both still fall
    back to `totalWidth`/`totalHeight` (today's pre-N46 behavior) when
    composing chrome, meaning an empty-diagram or multi-page diagram WITH a
    title/legend/caption/header/footer may still show item 23's OLD
    symptom. Unsurveyed reach (likely small — both are narrow corpus
    slices) — needs its own diagnosis.md pass before fixing (jar's own
    `SvekResult`/`TextBlockExporter` split for THOSE two code paths hasn't
    been independently verified, only the main path and the degenerate
    path have).

25. **RESOLVED N47, drop from future queues** — circled-character badge
    glyph outline under a customized `CircledCharacterFontName`/
    `FontStyle` was a STRUCTURALLY different AWT contour, not a scaled
    one (confirmed exactly what `class-badge-sized-glyphs.ts`'s own doc
    comment already predicted). Fixed via new `circledCharacterFontFamily`/
    `FontBold`/`FontItalic` theme/skinparam fields (mirrors the existing
    `classStereotypeFontName`/`FontStyle` pattern) plus a `BADGE_GLYPH_C_
    BY_VARIANT` capture table (3 entries, read verbatim off each fixture's
    own golden SVG — see `plans/g2-class-svg/ledger.md` N47 mechanism 3).
    **3 new zero-diff** (`datugo-88-sote552`, `depulu-53-xoca727`,
    `gateja-70-losi738`). The size/radius half of this skinparam family was
    ALREADY correct since N38 — only the family/style-driven OUTLINE was
    missing.

26. **RESOLVED N47 as originally framed, drop from future queues under
    this name** — N46's "roughly half of item 23's constant" framing for
    the `lelabe-72-zate295`/`miliju-79-moti992`/`vekime-22-buru589` cluster
    was WRONG on BOTH counts (see ledger.md N47): the `@fill` diff was
    NEVER a title bug at all — it traces to upstream's `#?A:B[:C]`
    conditional-color syntax (`klimt/color/HColorSet.java#parseColor`'s
    `"?"`-prefixed branch → `HColorScheme`/`HColorSimple#withDark`, a color
    DEFERRED until resolved against the ACTUAL local paint background at
    each specific draw site — entirely unbuilt in this port, 7-fixture
    corpus reach beyond these 3). `!assume transparent dark`/`light`
    (present on 2 of the 3) is CONFIRMED (via `CommandAssumeTransparent
    .java`) a genuine, deliberate jar NO-OP — do not attempt to wire it.
    Re-queued as item 29 (conditional-color subsystem) below; the title-`x`
    half is re-queued separately as item 27 (does not factor from item
    23's constant). Do not re-queue under the old "half of item 23" framing.

29. **RESOLVED N48, drop from future queues** — `#?light:dark[:transparent]`
    (`HColorScheme#getAppropriateColor`) ported end-to-end as
    `resolveConditionalColor`/`parseConditionalColor`
    (`core/klimt/color/HColorSet.ts`) and wired into the 2 call sites with
    real corpus reach: classifier/header FontColor (`style-cascade-
    class.ts#cascadeFontColorHex`, local bg = the classifier's own resolved
    background) and chrome FontColor (`core/annotations/style.ts`, local bg
    = `theme.colors.background`, which ALSO required wiring the previously
    entirely-missing bare `root` `<style>` selector into chrome's cascade).
    The "no 3rd color + transparent local bg" case resolves to `colorLight`
    regardless of `!assume transparent dark`/`light` (confirmed a genuine
    no-op both directions, jar-verified `lelabe-72-zate295`/`vekime-22-
    buru589`) — see `plans/g2-class-svg/ledger.md` N48 mechanism 3 for the
    full jar-verified algorithm and both call sites. **7 fixtures closed**
    (all of item 29's own named corpus reach).

27. **RESOLVED N48, drop from future queues under this name** — was a
    MISDIAGNOSIS: the "multi-line title block grammar" framing (N47) was
    falsified by `xalaco-64-vuzu312`, which uses the IDENTICAL multi-line
    `title\n...\nendtitle` grammar yet shows ZERO title-`x` residual. The
    REAL mechanism was item 24's degenerate-single-classifier
    `rawWidth`/`rawHeight` gap — every item-27-named fixture happens to be
    a single-classifier, no-edge diagram (the `degenerateSingleClassifier`
    fast path), which `xalaco` (2 classifiers + an edge) does not hit. Fixed
    alongside item 24's narrowing, see `plans/g2-class-svg/ledger.md` N48
    mechanism 2. Do not re-queue under the "block grammar" framing.

28. **Note body creole-run awareness — RESOLVED N55 for the NOTE-BODY half** (NEWLY DISCOVERED N47, opportunistic cluster-7 drill; LANDED N55):
    `renderer-note.ts#renderNoteText`'s own doc comment used to state "no
    creole markup" — a note line with embedded `**bold**`/`//italic//`/
    `<color:...>`/etc. markup drew as ONE literal `<text>` (the raw,
    un-rendered source string) instead of one `<text>` PER creole run.
    Fixed by routing note text through the SAME shared creole atom engine
    `class-member-creole.ts` already wires for classifier member rows (N22
    precedent) — `note-layout.ts#measureNote` now builds+resolves
    `NoteGeo.lineAtoms` per line (measurement-identity proven: plain
    no-markup text is byte-identical to the pre-cutover direct
    `measurer.measure` call, verified both by the existing test suite
    passing UNCHANGED and by 2 new explicit `note-layout.test.ts` proofs);
    `renderer-note.ts#renderNoteText` draws each line's per-atom run
    sequence via a new `renderNoteLineAtoms` (falls back to the old
    single-`<text>`-per-line path when `lineAtoms` is absent, for hand-built
    test `NoteGeo` literals only — mirrors `renderRowText`'s identical
    `row.atoms` optional-with-fallback precedent). Jar-verified
    `tenobo-24-liga464`: "Yet **another**" now draws 2 sibling `<text>`
    elements ("Yet " plain + "another" bold) — **0/0**. Bonus reach beyond
    the originally-named fixture: `taxemo-34-buro609` (`<color:#red>`
    per-run color override) ALSO reaches **0/0** — the SAME "shared
    engine, not a re-port" reuse picks up color/size/font commands for
    free, matching N54's own "always re-scan the full corpus" lesson.
    Full-corpus regression scan (per-fixture diffCount before/after via a
    disposable `git worktree --detach HEAD` at the pre-N55 commit): 2
    improved-to-zero (above), 3 diffCount-INCREASED-but-non-regressing
    (`nucite-98-kuga991` 12->47, `puvono-84-doro361`/`sekame-22-meze147`
    1459->1500 — all three confirmed via the worktree comparison to be
    ALREADY severely structurally broken before this iteration for an
    UNRELATED reason, `g[childCount]` mismatches predating this change
    byte-for-byte identical; a note-width correction mechanically cascades
    more numeric deltas through an already-diverged downstream coordinate
    chain, the same "unmasking, not regression" pattern N2/N13/N40/N43
    already established), 2 improved-but-not-zero
    (`vicuro-37-tese143`/`fogexa-30-zupo141`). **SAME FAMILY, STILL OPEN**:
    the enhanced-body tree-row half (`foxiki-17-kosa114`'s still-open
    tree-row artifact, N46 cluster 1) — that fixture's extra `<text>` is a
    near-empty leading run (textLength 3.85, SAME x as the bold run) which
    does not cleanly match a plain-prefix/bold-suffix split; still needs
    its own probe, NOT subsumed by the note-body fix (different render
    path — `renderer-body-enhanced.ts`, not `renderer-note.ts`).

30. **Multi-line generic-tag box** (NEWLY NAMED N49, `zubevi-64-fume582`,
    1 confirmed reach) — when a generic clause's source text contains
    embedded `\n` line-break directives between params (`class
    MyClass<S extends SomeClass,\nA extends AnotherClass,\nY
    YetAnotherClass>`), jar builds the tag block via the SAME creole-aware
    multi-line `Display.getWithNewlines(...).create(...)` machinery every
    OTHER display text uses (`EntityImageClassHeader.java:144`), drawing
    ONE `<text>` PER param line, individually center-aligned, in a
    taller/narrower box (height = N stacked rows) — NOT the single wide
    comma-joined line this port's tag box has always produced
    (`class-stereotype.ts#buildGenericTagGeo`'s `text` field is a single
    string). A real, substantial feature (line-split + per-line centering
    + height-stacking, mirroring `TextBlockGeneric`), out of proportion to
    its 1-fixture reach.
31. **`skinparam genericDisplay old`** (NEWLY NAMED N49, `bijevi-38-
    duza931`, 1 confirmed reach — no other corpus fixture sets this
    skinparam) — a 3-part compound gap: (a) `displayGenericWithOldFashion`
    (`SkinParam.java:1150-1153`) is unported entirely — when set, jar
    suppresses the separate tag box and appends `<generic>` back onto the
    LAST line of the classifier's own display text
    (`EntityImageClassHeader.java:90-105`, `Display#addGeneric`); (b) this
    port's classifier-name row renders literal `\n` (backslash+n) as-is
    instead of splitting a quoted multi-line display name into a real line
    break (independent, pre-existing gap, unmasked by this fixture); (c)
    both must land together to reach zero-diff on this specific fixture.
34. **`classDiagram.class.header` nested style cascade** (NEWLY NAMED N49,
    `fumalu-64-vude116`, 1 confirmed reach; RE-ASSESSED N50) — `<style>
    class { header { BackgroundColor ...; FontSize N } } }` is entirely
    unwired: jar draws the classifier's header ROW with its own background
    color as a SEPARATE rect layered on top of the body (bounded to just
    the header row), plus a matching divider-strip rect, plus an
    outline-only redraw of the body border on top — and the header's
    `FontSize` override does not cascade either (this port keeps the
    unchanged 14pt). N50 confirmed this is a MULTI-LAYER feature: the
    `FontSize` override changes the classifier's own measured header-row
    height, a `layout.ts` concern (canvas width shifts by 2px), not just a
    render-only addition — needs new header-region rect primitives in the
    renderer PLUS a new nested selector level in the style cascade PLUS a
    layout-height change. Still 1 confirmed reach — not a quick fix.
35. **`<style> class { MaximumWidth N } }` text-wrap cascade** (NEWLY
    NAMED N49, `nufini-44-jofo787`/`nucite-98-kuga991`, found opportunistically
    while surveying bare `class { ... }` selectors — reach beyond these 2
    unsurveyed) — a classifier's `MaximumWidth` style property (text-wrap
    width) is unimplemented; jar wraps long member/name text into multiple
    lines (`g[N][childCount]` off by ~15-17 per fixture, implying several
    extra wrapped text/line elements), this port keeps everything on one
    line. Unrelated to background cascade — a real text-wrapping feature
    gap.

36. **RESOLVED N56, drop from future queues** — note per-line height ==
    the MAX of every 'text' atom's own height on that line (`Math.max
    (atom.font.size, 10)`), NOT a flat `NOTE_FONT_SIZE` (NEWLY DISCOVERED
    N55, note-creole-markup cutover follow-on — `fogexa-30-zupo141`/
    `vicuro-37-tese143`). N56 jar-verified the EXACT aggregation rule via
    `Sea.java`/`Position.java`/`AtomText.java`/`FontPosition.java` source
    derivation (NOT ascent/descent-weighted summation, as N55 had flagged
    as the open question — for every NORMAL, non-superscript/subscript
    atom `FontPosition.getSpace() == 0`, `Sea#doAlign` aligns every atom's
    measured-rect BOTTOM to a shared y=0, so `getHeight() == getMaxY() -
    getMinY()` reduces algebraically to a flat MAX over each atom's own
    floored height), cross-checked byte-exact against BOTH fixtures' real
    golden SVG per-run baselines (`fogexa`: "In java," @ y=26.1111 (13pt),
    "every" @ y=25 (18pt `<size:18>` run) on the SAME line, delta 1.1111 ==
    the two sizes' own `size/4.5` descent difference; the NEXT line's
    baseline sits exactly 18 -- not 13 -- below, proving the cumulative
    stack advances by each line's own MAX height, not a flat constant).
    Landed: `note-layout.ts#measureNote`/new `noteLineHeight` helper (per-
    line height, box height = sum of per-line heights + margin) + new
    `NoteGeo.lineHeights`/`NoteMeasurement.lineHeights` field, threaded
    through all 4 geo builders (`buildTipNoteGeo`/`droppedNoteGeo`/
    `plainNoteGeo`/`note-opale.ts#buildOpaleNoteGeo`); `renderer-note.ts
    #renderNoteText`/`renderNoteLineAtoms` now stack lines by cumulative
    real height and compute each TEXT atom's OWN baseline
    (`lineTop + lineHeight - atom.font.size/4.5`) instead of one flat
    per-line offset. Deliberately scoped to 'text' atoms only --
    'vector'/'image' atom height contribution and `AtomOpenIconic`'s own
    non-zero `getStartingAltitude` (`-3*factor`) are UNCONFIRMED by any
    corpus fixture (zero note+image/vector reach found), so their
    placement rule was left BYTE-IDENTICAL to the pre-N56 formula rather
    than guessed (`renderer-note.ts#renderNoteLineAtoms`'s own doc comment
    names this scoping decision explicitly). Regression-safe: every
    pre-existing note-layout/renderer-note test passes UNCHANGED (the
    flat-line case reduces algebraically to the old formula, confirmed,
    not just asserted), DOT gate + description SVG gate both re-verified
    EXACTLY unchanged (note height feeds `groupNodeSize`'s DOT graph node
    dimension). Full-corpus regression scan: 0 zero-diff regressions, 0
    newly-non-conformant fixtures, 1 fixture dramatically improved
    (`vicuro-37-tese143` 58->1 diffs). Class census UNCHANGED at 272/718
    (neither `fogexa`/`vicuro` fully reached 0 -- both blocked by SEPARATE,
    newly-precise-diagnosed residual mechanisms, items 37/38 below, NOT
    part of item 36's own now-closed scope).

**RESOLVED N50, drop from future queues** — both chrome-block rect gaps
named N49 (`core/annotations/blocks.ts#borderBoxStyle`'s `rx`/`stroke`
omission-vs-literal-zero shape, and the legend-block's `ry`/`stroke-width`
half of item 33) — landed as ONE mechanism (`rx`/`ry` paired and omitted
together when `roundCorner` is 0, `stroke`/`stroke-width` always explicit).
`mumefa-23-xoxe715`'s remaining `fill="none"` diff was NOT part of this
mechanism (a different, unconfirmed StyleStorage-iteration-order question —
see `ledger.md` N50, re-queued under a precise new name, do not conflate
with the rx/stroke gap that IS resolved). A bonus mechanism (chrome
`LineThickness`/`skinparam Legend|title { BorderThickness N }`, previously
entirely unwired) was also landed in the same iteration — do not re-queue
either name.

**RESOLVED N49, drop from future queues** — `style-cascade-classifier-bg`
(the 22-fixture N48 residue count, itself narrowed from N36's original
23): re-probed with a narrower ground-truth filter (`<style>` block +
`BackgroundColor`/`BackColor` literal present, not just `<style>`
presence) — 13 non-zero remain, but EVERY ONE checked (the 2 smallest,
directly, plus a 3rd surfaced opportunistically) is driven by a DIFFERENT
mechanism than classifier-body BackgroundColor cascade (items 32/33/34
above — 2 off-topic shared chrome-block bugs plus one genuinely-new
`class.header` nested selector). The classifier body BackgroundColor
cascade's OWN true remaining reach (N36/N37's own landed mechanism)
appears to be ZERO. Do not re-queue under the "style-cascade-classifier-
bg" name; re-queue only under items 32/33/34's own names if pursued.

**RESOLVED N33, drop from future queues**: badge-custom-letter for
P/M/F/? specifically (the other 5 letters `badge-custom-letter`'s own
17-reach tag still names remain open). "DOT-rank multi-edge-same-pair
divergence — unsurveyed" — SURVEYED, verdict SEAM GAP, re-queued under
item 1 above with a real root cause, do not re-queue under the old
"unsurveyed" framing.

**RESOLVED N39, drop from future queues** (gap in this file noticed
while updating for N40 — N39's own ledger entry landed all three, this
list was never updated to match): item 8 (`classStereotypeFontSize`/
`FontName`/`FontStyle`), item 9 (`<style>` block position-scoped
merge), item 10 (`<style> note { FontSize N }`) — all three LANDED
N39, see `plans/g2-class-svg/ledger.md` N39. Do not re-queue.

**RESOLVED N36, drop from future queues**: "`<style>`-cascade classifier
background, 23 reach" — landed (N36's own priority #1). The `.tagname`
stereotype sub-selector half was deferred at N36, then LANDED N37 (see
`ledger.md` N37) — do not re-queue under either name.

**RESOLVED N54, drop from future queues**: "arrowhead-polygon ink
(`UPolygon`, `HACK_X_FOR_POLYGON=10`) not modeled in `layout-ink-
extent.ts#buildInkBox`" (N53's own renamed item 1) — LANDED via
`renderer-arrowhead.ts#edgeExtremityInk` (real `LimitFinder` reuse, not a
re-derived polygon-only formula). "`lufide-34-cexu026`'s icon-color-
skinparam-override gap" (N53's own item 7) — LANDED (`skinparam
icon<Kind>Color`/`icon<Kind>BackgroundColor`, 8 keys); reach was 2/718
(`dupulu-73-cero610` also resolved), not the originally-cited 1/718 — see
`ledger.md` N54.

**RESOLVED N55, drop from future queues**: item 28's NOTE-BODY half
("note body ... text lack creole-run awareness", NAMED N47) — LANDED
(`note-layout.ts#measureNote`/`renderer-note.ts#renderNoteText` now
route through the shared `class-member-creole.ts` engine, N22's own
precedent reused directly). `foxiki-17-kosa114`'s enhanced-body
tree-row half of item 28 is UNRESOLVED — do not conflate with the
note-body mechanism that IS resolved; see item 28's own updated text.
A NEW item 36 (note per-line height = max creole-atom font size, not a
flat `NOTE_FONT_SIZE`) was discovered while landing this mechanism —
diagnosed, NOT landed, see `ledger.md` N55.

**RESOLVED N56, drop from future queues**: item 36 (note per-line height)
— LANDED, jar-verified via source derivation + byte-exact golden-SVG
cross-check, see item 36's own updated text above and `ledger.md` N56.

37. **`note top of`/`note bottom of` single-link notes draw as a merged
    Opale zigzag-notch shape when jar draws the OLD plain fold + SEPARATE
    dashed connector line instead** (NEWLY DIAGNOSED N56, surfaced while
    verifying item 36's landing against `fogexa-30-zupo141`'s own
    residual `svg/g[1][childCount]: 2 vs 3` diff — unsurveyed reach
    beyond this 1 fixture). Jar's real golden SVG draws THREE separate
    top-level elements for this fixture (class box, plain folded-corner
    note box `<path d="M6,6 L6,60 L138.9125,60 L138.9125,16 L128.9125,6
    L6,6"/>`, and a SEPARATE `stroke-dasharray:7,7` connector `<path
    id="GMN2-dummy">` curving from the note's bottom edge to the class);
    this port's `note-opale.ts#resolveOpaleConnector`/`mapGroupNoteGeos`
    instead merges the box+connector into ONE Opale zigzag-notch path (a
    triangular notch cut into the note's own bottom edge) for this
    fixture, TWO top-level elements instead of three. G2/N14's own
    `EntityImageNote.java#opaleLine` precedent established the Opale merge
    IS jar's real behavior for SOME single-link notes — this fixture
    proves the port's current dispatch condition (which notes qualify for
    the merge vs the plain+separate-line shape) is not yet an exact match
    for jar's own. Root cause NOT yet isolated to a specific file:line
    condition (diagnosis.md: confirmed WHERE the two diverge, not yet WHY
    jar picks plain-vs-Opale for this specific case) — needs its own
    dedicated diagnosis pass reading `EntityImageNote.java`'s real
    dispatch condition before attempting a fix.
38. **`DeterministicMeasurer`/`WidthTableMeasurer`'s width-table data has
    a literal `0` entry for the space character (U+0020, block 0 index
    32)** (NEWLY DIAGNOSED N56, surfaced by item 36's own landing —
    `vicuro-37-tese143`'s sole residual diff after item 36 closed
    everything else: `svg/g[1]/g[2]/text[3]/@textLength: actual="0"
    expected="3.575"`, a bare `" "` creole run split off by the SAME
    `<size:18>`/`<u>` markup item 36's own fixtures exercise). Jar's real
    deterministic-mode width table gives a 13pt space `textLength=3.575`
    (confirmed against BOTH `fogexa`/`vicuro`'s real golden SVGs, byte-
    identical); `measurer-width-table.data.ts#SANS_SERIF_BLOCKS[0][32]`
    is literally `0`, so ANY isolated-space creole run (a creole command
    boundary that splits text at a space, e.g. `<size:N>word</size>
    <u>word2</u>`) measures 0-width regardless of font size — confirmed
    via direct `WidthTableMeasurer.measure(' ', ...)` probe (`{width:0,
    height:13}`). Root cause is a DATA gap, not an algorithm gap (the
    `charWidth`/`measure` code path is correct per the class's own 2026-
    07-10 doc-comment re-verification, which did not happen to sample the
    space character) — likely a trim()-strips-whitespace bug in whatever
    script originally generated `measurer-width-table.data.ts` (ADR-001
    S1-impl, an earlier mission), NOT something to patch with a single
    hardcoded magic value without first re-verifying that generation
    pipeline (would risk masking the SAME root cause for other
    whitespace-adjacent table entries). Unsurveyed corpus-wide reach
    (likely small but non-zero — any creole-split bare-space run,
    anywhere a `StringMeasurer` measures one, not note-specific) — needs
    its own dedicated pass that re-examines the width-table generation
    methodology, not a quick single-value patch.

## N56 periodic full-corpus reclassification (last was N48, 8 iterations
## ago) — 446 non-conformant fixtures, regex-heuristic tags (reach is an
## upper bound per N48/N49/N52's own established precedent; a fixture can
## carry a tag and still be blocked by something else)

Baseline (unchanged before/after this iteration): `272/718 · 1-3:26→27 ·
4-10:109 · 11-30:33 · 31+:278→277 · errors:0` (the +1/-1 1-3↔31+ shift is
item 36's own `vicuro-37-tese143` improvement, 58→1 diffs — see item 36's
resolution note above).

```
 32  enhanced-body-member              16  note-creole-markup
 15  url-wrap                          13  note-of-member
 10  dotted-namespace                   9  circledCharFontSize
  9  circledCharFontStyle               7  pragma-elk
  6  openiconic-glyph                   6  strictuml
  6  embedded-diagram-member            6  groupInheritance
  5  note-on-link                       4  wrapWidth-note
  3  class-header-style                 3  maximumwidth-style
  2  scale-max                          2  lollipop-socket
  2  topurl                             2  AttributeFontStyle
  2  visibility-icon-color              1  genericDisplay-old
  1  hidden-bracket                     1  mainframe
  1  newpage                            1  double-couple
  1  gradient-color                     1  diagramBorderColor
315  untagged
```

Untagged bucket breakdown: `1-3: 14 · 4-10: 66 · 11-30: 27 · 31+: 208`
(heavily skewed toward 31+, matching every prior reclassification's own
"no single hidden universal mechanism remains" finding). Cross-tabulated
230/315 untagged fixtures (73%) against the family-level `svg/g/g/path/@d`
scan (`--families`, 300/718 fixtures, 45250 raw diffs, the single largest
family) — 207 of those 230 sit in the 31+ bucket, confirming the
untagged/31+ population is dominated by the ALREADY-NAMED gvts-genuine
DOT-routing divergence, not an undiscovered mechanism.

### Accounting rows (carried forward per the brief's explicit instruction;
### none re-drilled this iteration beyond item 36 — budget went to jar-
### verifying + landing that mechanism)

- **gvts-genuine** (confirmed engine-level, OUT OF SCOPE per CLAUDE.md, no
  `graphviz-ts` API surface exists for these): the dominant `svg/g/g/
  path/@d` family (300/718 fixtures, 45250 raw diffs, unchanged this
  iteration) — subsumes the previously-separately-tracked `getLayout`-
  vs-`render` consumer-side gap (N35, largest single named item), the
  `splines` setter gap (N31, `skinparam linetype polyline`, 1 direct + 2
  tagged reach), and the anchor-rank/label-width gaps (N18). None
  re-surveyed this iteration.
- **fenced** (real, identified, NOT-yet-fixed bugs in this port's OWN
  construction, wide blast radius, need dedicated iteration budget per
  N32's empirical-verification protocol): `class-dot-graph.ts
  #buildDotEdges`'s `rel.from`/`rel.to` vs `rel.idEntity1`/`idEntity2`
  direction gap (N33/N37, explicit DOT-gate risk) — not attempted.
- **DOT-topology-awaiting-maintainer** (real DOT-emission-level changes,
  frozen-gate risk, need the N27-raised scoping decision before touching):
  `skinparam groupInheritance` (6 tagged / 7 confirmed reach, `DotData
  .java#removeIrrelevantSametail`); dotted-namespace nesting (10 tagged /
  13-22 confirmed reach depending on survey method — jar creates NESTED
  clusters per dot-separated segment, this port creates ONE FLAT cluster).
  Neither attempted this iteration.
- **mode-dark ColorMapper subsystem**: `skinparam mode dark` (1 tagged
  reach this iteration's heuristic scan) — unattempted, unchanged from
  N27's own original naming; genuinely small named reach, still not
  re-surveyed for a wider corpus-scan-driven reach figure.
- **item 20** (enhanced-body member-row EDGE-port anchor exposure) —
  **N58: ground-truth CONFIRMED reach is still exactly the 2 fixtures N44
  named** (`gojofu-46-xaci340`/`paroxa-83-lofa387`; the 32-tagged N56
  population resolves almost entirely to unrelated mechanisms — see
  `ledger.md` N58). **N58 also fully derived the jar mechanism from source
  and byte-verified it against `gojofu`'s cached `svek-1.dot`** — reusable
  without re-deriving. **NOT landed**: `graph-layout.ts#addNodes`
  unconditionally emits `shape:'box'`, meaning `class-dot-graph.ts`'s
  `isPort`/`shieldedClassifierIds` machinery is DEAD CODE in the real
  pipeline (only consumed by the disconnected `svek-dot-emit.ts` oracle-
  comparison shadow emitter) — landing item 20 requires wiring an entirely
  NEW HTML-like port-table node shape + `tailport`/`headport` edge
  attributes into the real render pipeline for the FIRST time, a
  DOT-topology-awaiting-maintainer-shaped undertaking, not a same-iteration
  land-and-verify. Flagged for maintainer scoping decision (`decision-
  journal.md` N58).
- **item 35** (`<style> class { MaximumWidth N } }` text-wrap cascade) —
  `maximumwidth-style` tag: 3 reach this iteration (up from N49's 2 named
  fixtures) — unattempted, unimplemented text-wrapping feature.
- **item 36** (note per-line height) — **RESOLVED N56**, see above; drop
  from this accounting on the NEXT reclassification.

### New items surfaced (not part of the tag table above — found via item
### 36's own regression verification, not the corpus-wide tag scan)

Item 37 (`note top of`/`bottom of` Opale-vs-plain dispatch gap) and item
38 (`WidthTableMeasurer`'s space-character width-table entry is a literal
`0`) — diagnosed N56, **BOTH LANDED N57** (see that row above): item 38 was
a missing render-time NBSP-substitution port (the width-table `0` itself is
byte-exact-verified CORRECT, not a bug); item 37 was a missing
`strictUmlStyle()` guard in the Opale-eligibility gate. Neither was
reachable via a puml-source regex tag (both are measurer/renderer-internal
gaps, not markup-driven), a reminder that the tag table above is
necessarily incomplete for internal-mechanism bugs.

### New items surfaced N57 (found while jar-verifying item 37's fix against
### `fogexa-30-zupo141` directly — neither landed, both narrowly scoped)

- **item 39** (note-connector placement under `strictuml`): once item 37's
  fix correctly demotes an `isOpalisable`-failing note to the plain-box
  shape, jar draws its connector as a SEPARATE top-level `<g class="link">`
  sibling (the note's synthetic attachment edge routed through the NORMAL
  edge-rendering pipeline, since it's no longer swallowed by
  `SvekEdge#drawU`'s `if (opale) return;`) — this port still draws it
  INLINE inside the note's own `<g class="entity">` (`renderer-note.ts
  #renderNote`'s `buildConnectorPathData` call), matching only the
  ALREADY-non-opalisable-for-other-reasons case (freestanding note, no
  target). `fogexa`'s own `svg/g[1][childCount]` diff (2 vs jar's 3) is
  this mechanism, confirmed via direct SVG inspection, not the shape gap.
  **N58: inspected and DECLINED** — needs a new synthetic-edge draw path
  (reusing the NORMAL edge renderer, not `buildConnectorPathData`), a new
  NoteGeo dispatch flag, a `renderer.ts` draw-order change, AND a stroke-
  dasharray fix (`4,4`→`7,7`, the demoted connector also switches to the
  ordinary edge stroke pattern once it's no longer opale-merged) — not
  "cheap after inspection," genuinely a small new subsystem. Still queued,
  not attempted
  item 37 fixed. Needs its own dispatch-condition read (does the synthetic
  note-edge get excluded from the normal edge list ONLY when Opale
  succeeds, or unconditionally? — `note-layout.ts#groupEdge`'s "`noArrow:
  true` always" doc comment suggests unconditional exclusion today, which
  would need to become CONDITIONAL on `strictUml`/Opale-eligibility).
  **N60: re-diagnosed against the EXACT golden SVG byte-for-byte** (N58
  inferred the mechanism from source reading alone) — confirms N58's
  mechanism exactly (separate top-level `<g class="link">`, `stroke-
  dasharray:7,7`, positioned after the class group) but reveals the REAL
  remaining blocker: `renderer-uid.ts#assignExact`'s dense-renumbering
  merge has no entry TYPE for "a note's connector promoted to a real
  edge" — jar's real `lnk4` needs its own `creationIndex` slot, correctly
  interleaved with the note's own `ent0003` slot (which already works
  today). The `creationIndex` SOURCE for this synthetic slot is untraced
  (may not exist on `ast.ts#ClassNote` at all yet). Declined again: the
  uid merge is shared, load-bearing machinery for EVERY note+edge class
  fixture — getting a new entry kind's ordering wrong silently corrupts
  ids diagram-wide, too high a regression risk for a 1/718-reach target
  without first tracing the `creationIndex` source as its OWN dedicated
  investigation. Full re-diagnosis in `ledger.md` N60.
- **item 40** (`strictuml` class-icon suppression): **LANDED N58** —
  `CucaDiagram#showPortion`'s unconditional `EntityPortion
  .CIRCLED_CHARACTER` guard (`if (strictUmlStyle() && portion ==
  CIRCLED_CHARACTER) return false;`, checked BEFORE any hide/show
  command), threaded as a new `strictUml` term alongside the existing
  `hideCircle` gate in `measureGenericClassifier` (`class-layout-
  helpers.ts`) and `buildHeaderPrimitive` (`renderer-classifier-box.ts`).
  Jar-verified byte-exact against `fogexa-30-zupo141`: canvas 183x153 →
  175x153 (exact jar match), `dummy` class rect 77.85x48 → 51.85x40 (exact
  jar match, reusing the already-verified `hide circle` width/height
  formula path unchanged). Does NOT resolve the separately-tracked
  `circledCharFontSize`/`circledCharFontStyle` tags or the bare
  `strictuml` tag's OTHER reach (package folder-tab shape under
  `strictuml`/`packageStyle rect`, confirmed a DIFFERENT, still-open
  mechanism via `jinibe-02-tebi269`/`mucuxi-36-beku683`/`ditapa-46-
  bete946`'s N58 regression-scan inspection — logged as a candidate item
  42 for a future iteration, not diagnosed to full mechanism yet).

Also confirmed via the SAME direct inspection: the pre-existing `trin`
(leading/trailing-whitespace trim) gap in mixed creole runs — jar's
`DriverTextSvg.draw` trims a MIXED atom's rendered text (`"In java, "` ->
`"In java,"`, textLength UNCHANGED since the trimmed space already
contributed 0 width) before drawing; this port's `renderNoteLineAtoms`/
`renderRowAtoms` draw `atom.text` untrimmed. Zero corpus reach confirmed
for item 38's own gate (both `fogexa`/`vicuro`'s in-scope diffs are
unaffected — `textLength` matches exactly either way, only the literal
`<text>` CONTENT would differ) — named as a candidate item 41 for a future
iteration's own jar-verification pass, not attempted here (out of item
37/38's diagnosed scope; `code-principles.md`'s "don't guess/extend beyond
verified need" applies to production fixes, not just to writing this
note).

### item 42 (N59 formalized, N60 LANDED) — strictuml package-style
### canvas gap: BOTH RECT and FOLDER sub-cases now resolved at the
### ink-extent layer; only the small universal residual remains

`skinparam packageStyle rect|rectangle` splits into TWO independent
sub-mechanisms, confirmed via `mucuxi-36-beku683` (RECT) vs `jinibe-02-
tebi269`/`ditapa-46-bete946` (default FOLDER, both under `strictuml`):

- **RECT shape + fill — LANDED N59**: new `theme.packageStyle`,
  `class-namespace-shape.ts#renderNamespaceRect` (plain `<rect>`, centered
  title, no hline/tab-notch) + `packageFillValue` ("no paint" background →
  literal `fill="none"`, jar's real convention for package/cluster outlines,
  DISTINCT from the shared `resolveColorToSvgHex`'s `#00000000` convention
  most other shapes use). `mucuxi-36-beku683`'s childCount/shape mismatch is
  gone; a small ~0.32px/side residual remains (see below).
- **FOLDER-style position/margin — LANDED N60**: root cause found via the
  N46 patched-jar technique (static tracing had ruled out `FrontierCalculator`,
  `suppWidthBecauseOfShape`, and DOT-emission divergence — all 3 exhausted
  without a positive hit). The REAL mechanism: `USymbolFolder#asBig` draws
  a FOLDER-style outline as a `UPolygon` (sharp corners) whenever
  `strictUmlStyle()` forces `roundCorner=0` — and jar's `LimitFinder
  #drawUPolygon` carries a literal `HACK_X_FOR_POLYGON = 10` ink-walk-only
  padding quirk for ANY `UPolygon` (x padded 10 on both sides, y untouched)
  that this port's `layout-ink-extent.ts` never modeled for namespace
  outlines (it assumed every namespace draws a `UPath`, true only for the
  non-strict default). New `NamespaceGeo.inkShape` field (`'polygon'` |
  `'rect'` | `undefined`), resolved once per diagram from `theme.packageStyle`/
  `theme.strictUml`, dispatched in `layout-ink-extent.ts#addNamespaceInk`.
  Full mechanism + jar-instrumented evidence in `ledger.md` N60. Both
  `jinibe`/`ditapa`'s ~20-21px canatvas-width gap and RECT's own smaller
  `URectangle` ink-rule gap (a byproduct fix, same root `buildInkBox`
  dispatch) are closed; full-corpus regression scan: 0 regressions, 3
  fixtures improved (18→10, 20→12, 19→10 diffs), 0 new zero-diff (all 3
  blocked only by the separate small residual below).
- **Small universal residual** (both RECT and FOLDER, NOT chased N60):
  jar's real classifier-to-package-edge padding is `~16.32`, not this
  port's flat `NAMESPACE_SIDE_PADDING=16` — a SEPARATE, much smaller
  (~0.32-1px) mechanism. N60 traced this specifically to the CLASSIFIER's
  own dot-assigned X position (not the namespace box's own padding
  constant, which only affects the namespace box's OWN bounds, not
  classifier placement inside it) — suspected graphviz-ts-vs-real-graphviz
  margin/nodesep default divergence, which per this mission's CLAUDE.md is
  OUT OF SCOPE (graphviz-ts internals). Blocks all 3 named fixtures from
  reaching zero-diff despite the catastrophic mechanism's full closure.

## Standing rule (maintainer, 2026-07-17): SVG-channel extraction until parity

Geometry extraction from graphviz-ts stays on the SVG-text scan
(upstream Java's own architecture — the jar reads the same quantized
channel) until the census reaches parity. Do NOT cut over to internal
graph/layout data mid-mission; a structured graphviz-ts API cutover
happens as its own post-parity task. Extraction call sites:
`src/core/graph-layout.ts#extractPortLabelPositions`,
`src/diagrams/class/frontier-shadow-layout.ts`.
