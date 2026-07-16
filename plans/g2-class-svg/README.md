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
4. **Visibility icon shape/color/fill-vs-stroke** — unchanged from N4,
   still the largest UNSTARTED mechanism (`sigoji-75-mojo941`'s `polygon`
   vs expected `g` is this exact gap, seen in N5's 1-3-diff drill).
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
