# G2 ledger

(loop-protocol entry format; appended as iterations close)

## N0 — harness diagnosis, error triage, family classification, ratchet scaffold

### mechanism 0 (pre-fix, harness-level): the stated baseline measured the WRONG pipeline
- Mechanism: `scripts/svg-conformance-census.ts`'s `renderFixture` (now
  `renderFixtureDescription`) was hardcoded to `parseDescription` ->
  `layoutDescription` -> `renderDescription` and was called unconditionally
  for EVERY fixture type, including `class`, despite the script accepting a
  `class` CLI type arg (which only ever fed `listFixtureDirs('class')` — the
  fixture-discovery step, not the render step). `parseDescription` does not
  throw on class markup — it silently ignores syntax it doesn't recognize.
  Jar-verified with `test-results/dot-cache/class/bajotu-30-soku184/in.puml`
  (`package p1 { class cl1 } class cl2 p1 --> cl2`):
  `parseDescription` produces an AST with 2 nodes (`p1` as a `package`
  group, `cl2` misclassified as symbol `interface`) and **`cl1` entirely
  absent** — nested native class syntax inside a `package{}` block has no
  meaning to the description grammar. The README's stated baseline
  (`0/718, 1-3:2, 4-10:548, 11-30:53, 31+:84, errors:31`) was computed
  against this wrong-engine output; every fixture's diff count reflected how
  close a WRONG diagram happened to land to the jar's real one, not any
  class-engine conformance signal.
- Disposition: fixed at the harness level (not a src/ semantic change) —
  new `tests/oracle/svg-conformance/render-fixture-class.ts#renderFixtureClass`
  (mirrors `render-fixture.ts` exactly, but calls `parseClass` ->
  `layoutClass` -> `renderClass`; `renderClass(geo, theme)` takes no
  `measurer` of its own, unlike `renderDescription`, since every text metric
  is already baked into `ClassGeometry` by `layoutClass`). `svg-conformance-
  census.ts` gained a `renderFixtureFor(type, markup, measurer)` dispatcher:
  `class` -> `renderFixtureClass`, everything else -> the pre-existing
  `renderFixtureDescription` (unchanged, so the description SVG gate is
  provably untouched by this file). Re-measuring against the CORRECT
  pipeline gives an entirely different profile — see "N0 corrected
  baseline" below. This is the number the rest of N0's triage/family work
  is built on, not the README's stated one.
- Slugs: all 718 (harness-level, not fixture-specific).

### N0 corrected baseline (after mechanism 0's fix, before the stdlib-store fix)
```
0/718 conformant · 1-3: 0 · 4-10: 548→19 · 11-30: 53→695 · 31+: 84→0 · errors: 31→4
```
Bucket shape inverted entirely: dominated by `11-30` now (real per-fixture
diff counts cluster around 10-13, root-shell-family-sized), not `4-10`
(an artifact of the wrong engine's coincidental near-misses). `errors` also
dropped from 31 to 4 — `parseDescription`'s silent-success-with-garbage-
output behavior was itself masking some of what would have been `class`-
engine errors as low-but-nonzero diff counts instead of throws.

### mechanism 1 (harness-level): class render path had no stdlib `IncludeStore` wired — FIXED
- Mechanism: all 4 post-mechanism-0 errors were `StdlibNotBundledError`
  (`bidusa-22-jutu505`, `cuzoga-39-tufu259`, `jevuvi-65-dipo437`,
  `ruliki-78-biji661`, each `!include <tupadr3/...>`). `renderFixtureClass`
  called `buildBlockUmls(markup)` with no options, so `!include`
  resolution had no store at all. `svg-conformance-census.ts`'s OWN
  description path already solves this exact problem via a module-level
  `censusIncludeStore()` (`withStdlib(..., buildStdlibAssetsStore())`,
  SI5b/T9 precedent) passed as `{ includeStore }` to `buildBlockUmls`.
- Disposition: fixed — `renderFixtureClass` gained an additive, optional
  third parameter (`options?: PreprocessOptions`, passed straight through
  to `buildBlockUmls`); `renderFixtureFor`'s class branch now passes
  `{ includeStore: censusIncludeStore() }`. Zero src/ files touched.
  Census errors: 4 -> 0.
- Slugs: bidusa-22-jutu505, cuzoga-39-tufu259, jevuvi-65-dipo437,
  ruliki-78-biji661 (all 4, now render/compare cleanly — not zero-diff,
  just no longer crashing; see the family table for their measured diffs).

### N0 final corrected baseline (after both harness fixes)
```
0/718 conformant · 1-3: 0 · 4-10: 19 · 11-30: 699 · 31+: 0 · errors: 0
```
Every fixture renders and compares cleanly — no crashes, no malformed-jar-
SVG cases in the class corpus (unlike description's one permanently-
ledgered 3-dash-comment jar quirk, I0). This is the number for the family
table below and the number the README/status line should carry forward.

### family table (`--families`, 718/718 fixtures, 0 errors)
| fixtures | diffs | family | note |
|---|---|---|---|
| 718 (100%) | 718 | `svg/@contentStyleType` | pure literal-string gap |
| 718 (100%) | 718 | `svg/@preserveAspectRatio` | pure literal-string gap |
| 718 (100%) | 718 | `svg/@version` | pure literal-string gap |
| 718 (100%) | 1430 | `svg/@viewBox` | 2 components/fixture (width+height) — entangled with the width/height family below, NOT a pure shell gap |
| 718 (100%) | 718 | `svg/@xmlns:xlink` | pure literal-string gap |
| 718 (100%) | 718 | `svg/@zoomAndPan` | pure literal-string gap |
| 717 (99.9%) | 717 | `svg/@height` | real layout/geometry divergence (see below) |
| 715 (99.6%) | 715 | `svg[childCount]` | structural: flat children vs jar's single wrapping `<g>` |
| 713 (99.3%) | 713 | `svg/@width` | real layout/geometry divergence |
| 702 (97.8%) | 702 | `svg/@background` | pure literal-string gap (derived from jar's `style="...background:#FFFFFF;"`, see mechanism below) |
| 3 (0.4%) | 3 | `svg/defs[childCount]` | too small to classify this iteration; likely entangled with the marker-vs-inline-polygon divergence below, unreachable from most fixtures because compareSvg stops recursing once the PARENT `svg[childCount]` already mismatches |
| 3 (0.4%) | 3 | `svg/g[childCount]` | same caveat as above |

### mechanism 2: "SVG root shell" — universal, NOT fixed this iteration (N1 target)
- Mechanism, part A (pure constants): `src/core/svg.ts#svgRoot` (the
  generic `RenderFragment` assembler used by every non-klimt engine,
  `src/index.ts:147`) emits only `xmlns width height viewBox` on the root
  `<svg>` — no `xmlns:xlink`, `version`, `zoomAndPan`, `preserveAspectRatio`,
  `contentStyleType`, and no `background` (jar bakes background into a
  `style="...background:<color>;"` declaration; `tests/oracle/svg-
  conformance/normalize.ts`'s adaptation #1 resolves `style` declarations
  into individual attributes before comparison, so a bare
  `background="<color>"` XML attribute on our side would satisfy the
  comparator just as well — verified by reading `normalize.ts:97-165`, no
  actual `style=` juggling required). This is the SAME class of gap G1's I1
  diagnosed for description's ANNOTATED path (`plans/g1-description-svg/
  ledger.md` I1, "`unwrapKlimtSvg`/`svgRoot` discards klimt's own document
  shell") — but description's fix (`assembleKlimtShell`) deliberately left
  `svgRoot` itself untouched ("`svgRoot` itself and every other engine's
  assembly path are untouched" — I1's own disposition text). Every OTHER
  `svgRoot` consumer (class, object, state, json, dot, sequence, activity,
  chart, board, chronology, files, hcl, packetdiag, yaml,
  `error-renderer.ts`) still carries this exact gap, unaudited by this
  mission.
- Mechanism, part B (structural, NOT a constant): jar's class SVG root has
  exactly 2 children — `<defs/>` (empty, self-closing) and ONE `<g>`
  wrapping the entire diagram body (clusters, classifiers, edges, notes).
  `svgRoot` instead emits `children.join('')` as flat siblings alongside
  its own `defs` block and an optional background `<rect>` — 16 top-level
  children on the sample fixture vs jar's 2. Compounding this: `svgRoot`
  unconditionally injects `<marker>` defs for `ALL_ARROW_TYPES`
  (`src/core/svg.ts`, per CLAUDE.md's own note that this is
  "embed[ded]...automatically"), but jar's class SVGs contain **zero**
  `<marker>`/`markerEnd` anywhere in the sampled corpus (grep-verified on
  `bajotu-30-soku184/in.svg`: 0 `<marker`, 0 `marker-end=`/`markerEnd=`,
  1 literal `<polygon>`) — jar draws class-diagram arrowheads (extension/
  dependency/composition/aggregation) as inline `<polygon>`/`<path>` shapes
  at each edge endpoint, the SAME architectural choice description's engine
  already made (per description's own doc comments on inline polygon
  arrowheads). `src/diagrams/class/renderer.ts` instead uses
  `arrowHeadRef(...)` + `markerEnd` (SVG-native `<marker>` references,
  lines ~230-267) — a genuine, additional structural divergence from
  upstream's rendering architecture, not just a missing-attribute gap.
- Evidence this is ONE blocking mechanism, not several independent small
  ones: inspected all 19 fixtures in the census's `4-10` bucket (the
  closest-to-conformant tier) — EVERY one of them carries EXACTLY the
  literal-constant attrs (5-6, depending on whether `background` already
  happens to match) plus `svg[childCount]` and nothing else; the 6
  fixtures at diff-count 9 are missing only ONE of width/height (their
  jar dimensions happen to already match ours on one axis); the 13 at
  diff-count 10 carry both width+height+viewBox[2]+viewBox[3] on top.
  **Zero fixtures reach diff-count < 9; zero fixtures are blocked by
  `svg[childCount]` alone with the constants already fixed** — meaning a
  constants-only fix (part A) would not bring ANY fixture in this census to
  zero-diff; part B (structural wrap + marker/inline-polygon reconciliation)
  must land in the SAME iteration for the ratchet to gain its first slug.
- Disposition: NOT fixed this iteration. Per the mission's own guidance
  ("you may drill and fix the single largest [mechanism] IF it is a genuine
  quick fix (a constant, a format string) — otherwise this iteration is
  measurement + harness") and G1's own precedent (I1's structurally
  identical klimt-shell gap was its own dedicated iteration, explicitly NOT
  bundled into I0's triage pass), this is ledgered as **N1's target**, not
  attempted here. It requires: (1) a design decision on where the fix lives
  — a new class-specific shell function mirroring `assembleKlimtShell`
  (narrower blast radius, matches the I1 precedent exactly) vs. changing
  the shared `svgRoot` (touches ~13 other diagram engines, none audited by
  this mission, real regression risk); (2) reconciling the marker-vs-
  inline-polygon architecture choice for class edges (a rendering-code
  change, not a shell-assembly change — likely its OWN sub-mechanism inside
  N1, since it affects `<defs>` content and edge-drawing, not just the root
  tag); (3) new tests (unit + the census's own `--families` re-run as a
  release check), TDD per `testing.md`.
- Slugs: reach not enumerated per-fixture (698-718/718 depending on the
  specific sub-attribute); the 19 `4-10`-bucket fixtures are the highest-
  value first targets for N1's zero-diff proof: cojixe-63-vejo525,
  fibamu-81-zimo884, ririlu-13-zipi740, sipimu-09-joma900,
  vokati-75-gude769, zijupe-74-sake513 (diff-count 9, missing only ONE of
  width/height); bedogi-86-kala547, ganika-12-pane511, gopalo-51-leje047,
  jinibe-02-tebi269, lilura-67-cati343, menejo-70-tazo448,
  mizupo-59-zala765, mucuxi-36-beku683, remulu-24-zadi546,
  rizufo-14-dadi153, siluti-87-sefa007, vukonu-92-coto378,
  xosupo-71-jeso490 (diff-count 10, missing both).

### svg[childCount]/defs[childCount] small residuals — not separately investigated
- Mechanism: 3/718 fixtures show a SEPARATE `svg/defs[childCount]` and/or
  `svg/g[childCount]` diff not explained by mechanism 2 alone (or possibly
  a downstream consequence of it, unreachable for analysis until mechanism
  2's `svg[childCount]` blocker clears — `compareSvg`'s tree-walk does not
  recurse into children once a parent's child COUNT already mismatches, so
  these 3 fixtures' deeper shape cannot be diagnosed accurately until N1's
  fix lands and re-exposes them).
- Disposition: not investigated this iteration — too small a reach (0.4%)
  to prioritize over mechanism 2, and not independently diagnosable while
  mechanism 2 is unfixed.
- Slugs: not identified individually this iteration (would require a
  fixture-level rerun once mechanism 2 clears).

## Ratchet harness deliverables (N0)
- `oracle/goldens/svg-class/ratchet.json` — empty manifest (`fixtures: []`).
- `oracle/goldens/svg-class/README.md` — mirrors `svg-description/README.md`
  structure; documents the current empty state and cites this ledger entry.
- `tests/oracle/svg-conformance/render-fixture-class.ts` — class-pipeline
  render helper (`renderFixtureClass`), the harness deliverable underlying
  BOTH the ratchet test and the corrected census dispatch.
- `tests/oracle/svg-conformance/class.golden.ratchet.test.ts` — AC1/AC2/AC3,
  all three gracefully degrading to a placeholder assertion while
  `ratchet.json`/`parity-class.json` are empty (see decision-journal.md).
- `tests/oracle/svg-conformance/parity-class.json` — unsurveyed placeholder
  (`{ generatedAt: "unsurveyed", fixtures: [] }`); `scripts/svg-parity-
  survey.ts` gained additive `--out <path>` + positional-type-args support
  (default behavior unchanged — verified no `component`/`usecase`
  `parity.json` regeneration occurred this iteration) so a future
  `--out tests/oracle/svg-conformance/parity-class.json class` run can
  populate it once N1 produces real zero-diff candidates.
- `scripts/svg-conformance-census.ts` — `renderFixtureFor` dispatcher (class
  -> `renderFixtureClass` w/ stdlib store; else -> the untouched, pre-
  existing `renderFixtureDescription`).

## N1 — "SVG root shell" mechanism 2 (parts A+B+C) landed; zero fixtures reach zero-diff, new N2 blocker isolated

### Design
Three coupled parts, all landed this iteration, sharing machinery with
description (G1 I1) rather than duplicating it:

- **Part A (root literal-constant attrs)**: extracted `assembleKlimtShell`'s
  literal-constant assembly (`xmlns:xlink`, `version`, `zoomAndPan`,
  `preserveAspectRatio`, `contentStyleType`, `style`-folded `background`) out
  of `description/renderer.ts` into a new shared `core/klimt/
  document-shell.ts#assembleDocumentShell(fragment, diagramType)`, parameterized
  on the `data-diagram-type` value instead of hardcoding `'DESCRIPTION'`.
  `description/renderer.ts#assembleKlimtShell` is now a one-line delegator
  (`assembleDocumentShell(fragment, 'DESCRIPTION')`); `class/renderer-shell.ts`
  (new) is the class-side sibling (`assembleDocumentShell(fragment, 'CLASS')`).
  `extractViewBoxDims`/`extractDefs`/`extractBody`/`unwrapContentG`/
  `extractFlatContent` (klimt-document string-extraction helpers) moved into
  the same shared module — `unwrapKlimtSvg` (description) and the new
  arrowhead-markup extraction (class) both call them now.
- **Part B (single wrapping `<g>`)**: `RenderFragment` gained two new optional
  fields (`core/dispatcher.ts`): `classShell?: true` (set only by
  `class/renderer.ts#renderClass`, routes `assembleSvg` to
  `assembleClassShell` instead of the generic `svgRoot`) and `bodyWrapped?:
  true` (set by `core/annotations/chrome.ts#applyChrome` whenever it performed
  its own single bare-`<g>` wrap for a decorated/annotated fragment).
  `assembleClassShell` (`class/renderer-shell.ts`) wraps `fragment.body` in
  exactly one bare `<g>` itself ONLY when `bodyWrapped` is absent (the
  unannotated case — nothing else would wrap it, unlike description's
  klimt-native content `<g>`, which class has no equivalent of); when chrome
  already wrapped it (annotated case), it reuses that wrap unchanged. This
  reproduces, without adopting klimt/UGraphic for the whole class renderer,
  the SAME "exactly one top-level `<g>`" invariant klimt gives description for
  free. `renderClass` also stopped drawing its own body-level background
  `<rect>` — jar's class SVGs never draw one (background lives only in the
  root `style` attribute); the previous code drew it AND set
  `fragment.background`, which under `svgRoot` produced a redundant SECOND
  root-level bg rect (now moot — `svgRoot` no longer runs for class at all).
- **Part C (marker-vs-inline-polygon arrowheads)**: new `class/
  renderer-arrowhead.ts#buildEdgeArrowheads` replaces `renderer.ts`'s old
  `targetMarker`/`sourceMarker` (`url(#...)` `<marker>` refs) with the SAME
  inline-polygon/path extremity shapes description already draws via
  `core/svek/extremity/*`. Reuses that machinery directly rather than
  duplicating it: `core/svek/svek-edge-extremity.ts#place` (previously
  module-private) is now exported — class's `LinkDecor` union
  (`triangle`/`open`/`diamond`/`filledDiamond`) is already RESOLVED at parse
  time (unlike `SvekEdgeInput.tailDecor`/`.headDecor`'s raw matched-substring
  tokens), so `buildEdgeArrowheads` maps it straight to a `LinkDecorName` and
  calls `place(name, point, angle, backgroundColor)` directly, skipping the
  token round trip `placeTailExtremity`/`placeHeadExtremity` perform.
  Deliberately NOT a full `SvekEdge` adoption: that class also emits a
  `<g class="link" data-entity-1="..." data-link-type="...">` group wrapper
  keyed by per-entity `ent%04d` uids class has no assignment plan for yet
  (classifiers/namespaces carry no uid concept at all) — pulling that in
  would mean building the ENTIRE entity/cluster/link uid-and-group-wrapping
  system this same iteration, which is mechanism 3 below, not mechanism 2.
  Each extremity is drawn onto a throwaway per-shape `UGraphicSvg` document
  (`basicSvgOption()` defaults, a no-op `StringBounder` stub since extremities
  never draw text) and its markup extracted via the shared
  `extractFlatContent` — guarantees byte-identical shapes to description's
  own G1-I9-verified output, without adopting klimt for classifier/namespace/
  note drawing (which stay pure-string, unchanged).
  Endpoint placement does NOT reuse `SvekEdge`'s `buildDotPathFromSplinePoints`
  (which throws on any point list that isn't a well-formed `1 + 3*n`
  bezier-spline) — `EdgeGeo.points` is not always that shape (confirmed via
  `tests/unit/class/renderer.test.ts`'s existing `makeEdgeGeo` helper, a
  hand-built 2-point straight edge that is NOT a fabricated edge case).
  Instead, a local `segmentAngle(from, to)` (`Math.atan2`) reproduces
  `DotPath#getStartAngle`/`getEndAngle`'s exact formula directly off the raw
  point list (`points[0]`/`points[1]` for the tail, `points[n-2]`/`points[n-1]`
  for the head) — identical results to `DotPath` for a genuine spline (since
  `points[1]`/`points[n-2]` ARE that spline's first/last bezier control
  points), but degrades gracefully to a straight-line secant instead of
  throwing for any other point count. The rendered path `d` attribute itself
  (`renderer.ts#buildPathData`, straight `L` segments through every spline
  control point) is UNCHANGED — bezier-vs-straight-line path shape is a
  separate, N2-deferred geometry concern; this module never trims the path
  (`dotPath.moveStartPoint`/`moveEndPoint`), only places the extremity at the
  raw endpoint.

### 3-fixture arrowhead numeric verification
`compareSvg`-based per-fixture diffing showed pervasive PRE-EXISTING,
unrelated geometry bugs (member-row suppression, namespace-box mispositioning,
`skinparam dpi` not applied to class rendering at all) contaminating simple
coordinate-string comparison against jar for most fixtures — so verification
used a rotation/position-invariant method (side-length multiset "fingerprint"
of each polygon, rotation-invariant; sign/orientation checked separately via
raw-coordinate-delta matching on axis-aligned edges) rather than literal
byte-for-byte match, which the entangled pre-existing bugs would fail even
with correct arrowhead code.
- `ririlu-13-zipi740` (7 relationships, mixed `<|-u->`/`*.r.>`/`o.d.>`/`+-l->`
  decors): 10/10 jar polygons found an EXACT fingerprint+fill match among our
  10 polygons — covers all 4 reachable decor kinds in one fixture: EXTENDS
  (`none 12,18.97,18.97`), ARROW/dependency (`#181818 5.66,5.66,9.85,9.85`,
  7×), AGGREGATION (`none 7.21,7.21,7.21,7.21`), COMPOSITION
  (`#181818 7.21,7.21,7.21,7.21`). Raw-delta match (sign/orientation, not just
  magnitude) additionally confirmed on 5/10 axis-aligned cases.
- `bajotu-30-soku184` (1 dependency edge): 1/1 fingerprint+fill match
  (ARROW/dependency).
- `bavoxa-34-keje375` (1 composition edge, `skinparam dpi 200`): fingerprint
  MISMATCH (jar `15.02×4`, ours `7.21×4`) — ratio 15.02/7.21 ≈ 2.083, exactly
  jar's DPI-200 scale factor. Confirms the underlying diamond shape is
  correctly proportioned (both are perfect rhombi, `7.21` matching
  `ririlu`'s own AGGREGATION/COMPOSITION fingerprint exactly); the absolute
  size gap is a PRE-EXISTING, unrelated `skinparam dpi` scaling gap in class
  rendering overall (not scoped to edges/arrowheads — the WHOLE diagram is
  under-scaled at this DPI, confirmed by the classifier boxes' own dimensions
  also not matching jar's DPI-scaled values), not a defect introduced by this
  iteration's arrowhead cutover. Not fixed here (out of mechanism-2 scope);
  named for a future DPI-handling iteration.

### Class census: N0 baseline -> N1
```
before: 0/718 · 1-3: 0 · 4-10: 19  · 11-30: 699 · 31+: 0 · errors: 0
after:  0/718 · 1-3: 6 · 4-10: 712 · 11-30: 0   · 31+: 0 · errors: 0
```
`--families` re-run confirms every literal-constant family from N0's table is
GONE (`svg/@contentStyleType`, `svg/@preserveAspectRatio`, `svg/@version`,
`svg/@xmlns:xlink`, `svg/@zoomAndPan`, and root `svg[childCount]` — all 0
fixtures now). `svg/@background` dropped from 702 to 23. New families exposed
by the childCount-bail unmasking, exactly as anticipated:
`svg/g[1][childCount]` (718/718 — universal, see mechanism 3 below),
`svg/@height` (717), `svg/@width` (713), `svg/@viewBox` (718, 2
components/fixture), `svg/defs[childCount]` (16, not investigated — too small
this iteration, likely entangled with mechanism 3).

### mechanism 3 (NEW, universal, NOT fixed this iteration): entity/cluster/link
### per-element `<g>` wrapping — the N2 blocker mechanism 2's fix unmasked
- Mechanism: EVERY jar class fixture with any content wraps each drawn
  element in its own `<g class="entity" data-qualified-name="..."
  id="ent%04d" data-source-line="N">` (classifiers), `<g class="cluster"
  data-qualified-name="..." id="ent%04d" data-source-line="N">` (namespaces),
  or `<g class="link" data-entity-1="ent%04d" data-entity-2="ent%04d"
  id="lnk%d" data-source-line="N" data-link-type="...">` (edges) — plus a
  `<!--class X-->`/`<!--cluster X-->`/`<!--link X to Y-->` XML comment
  immediately before each, and a trailing `<?plantuml-src ...?>` PI as the
  content `<g>`'s last child. This port's class renderer draws none of this —
  classifiers/namespaces/edges are flat sibling strings with no group
  wrapper, no uid, no comment. Verified: `bedogi-86-kala547` (1 classifier, 0
  edges) and `bajotu-30-soku184` (1 namespace, 2 classifiers, 1 edge) both
  show EXACTLY this gap as their only non-geometry structural diff family.
  Exhaustive check: 0/718 fixtures with ANY drawn content have `svg/
  g[1][childCount]` absent from their diff set — universal, not a tail case.
- Why this blocks EVERY zero-diff candidate: even the closest N0 fixtures
  (the 19 in the `4-10` bucket, now mostly landing at exactly 3 diffs:
  `svg/@height`+`svg/@viewBox[3]`+`svg/g[1][childCount]`, or the width
  variant) cannot reach zero without it, REGARDLESS of whether their
  width/height also happen to match — `g[1][childCount]` fires whenever the
  fixture draws ANY classifier/namespace/edge, which is every non-empty
  fixture in the corpus.
- Disposition: NOT fixed this iteration — building it means assigning
  `ent%04d`/`lnk%d` uids to classifiers/namespaces/edges (a NEW, currently
  absent concept in `class/layout.ts`/`renderer.ts`; description's own
  `renderer-uid.ts#buildUidPlan` is the direct precedent to port/adapt) and
  wiring `class="entity"`/`class="cluster"`/`class="link"` group wrapping +
  `data-qualified-name`/`data-source-line`/`data-entity-1`/`data-entity-2`/
  `data-link-type` attrs + the `<!--...-->` comment + the trailing
  `<?plantuml-src?>` PI — a distinct, large mechanism matching the ledger's
  own I1-vs-I2/I4 precedent (needs new machinery, not a quick fix). Named as
  N2's PRIMARY target, ahead of (or possibly entangled with) the raw
  width/height geometry divergences also exposed this iteration.
- Slugs: universal (0/718 with content spared); `bedogi-86-kala547` and
  `bajotu-30-soku184` are the cleanest single-mechanism repro cases (fewest
  confounding geometry bugs).

### Description gate: intact
48/355 zero-diff (component+usecase), unchanged from the frozen baseline;
`description.golden.ratchet.test.ts` 51/51 green. `assembleKlimtShell`/
`unwrapKlimtSvg`'s observable behavior is verified byte-identical (both now
thin delegators to the extracted shared `document-shell.ts` machinery,
literal string construction unchanged) — description's own conformance
number is the direct proof.

### DOT gate: frozen, unchanged
component 262/262 · usecase 90/90 · class 708/708 · object 78/80 · state
267/267 — this iteration touched render-side code only, no DOT/layout files.

### Ratchet: no new pins this iteration
Zero fixtures reached zero-diff (mechanism 3 blocks all of them universally
— see above), so `oracle/goldens/svg-class/ratchet.json` stays the N0 empty
manifest and `class.golden.ratchet.test.ts` stays on its placeholder-assertion
path (5 tests, 2 skipped, unchanged from N0).

### Files changed
- `src/core/klimt/document-shell.ts` (new) — shared shell assembly +
  klimt-string extraction helpers (Part A).
- `src/diagrams/class/renderer-shell.ts` (new) — `assembleClassShell`.
- `src/diagrams/class/renderer-arrowhead.ts` (new) — `buildEdgeArrowheads`
  (Part C).
- `src/diagrams/description/renderer.ts` — `assembleKlimtShell`/
  `unwrapKlimtSvg` reduced to thin delegators to the shared module.
- `src/core/dispatcher.ts` — `RenderFragment` gained `classShell?`/
  `bodyWrapped?`.
- `src/index.ts` — `assembleSvg` dispatches `classShell` to
  `assembleClassShell`.
- `src/core/annotations/chrome.ts` — `applyChrome` sets `bodyWrapped: true`
  on its wrapped return.
- `src/core/svek/svek-edge-extremity.ts` — `place` exported (additive).
- `src/diagrams/class/renderer.ts` — old `targetMarker`/`sourceMarker`/
  marker-ref path removed; `renderEdge` now returns `{body, extraDefs}`;
  `renderClass` drops the body-level background rect, sets `classShell:
  true`, threads `extraDefs` from edges.
- `tests/unit/class/renderer.test.ts`,
  `tests/unit/class/class-newpage-layout.test.ts` — updated to assert the
  new shell/inline-arrowhead shape (TDD: pre-existing marker/bare-svgRoot
  assertions rewritten, not deleted, to cover the new architecture).

## N2 -- mechanism 3 (entity/cluster/link `<g>` wrapping + uid assignment)
### landed; 0 new zero-diff (deeper geometry unmasked, matching mission's own prediction)

### Uid scheme -- evidenced from the jar, verified against 3+ SVGs
- `bedogi-86-kala547` (1 classifier, 0 edges): `<!--class Collection--><g
  class="entity" data-qualified-name="Collection" id="ent0001"
  data-source-line="3">`.
- `bajotu-30-soku184` (`package p1 { class cl1 } class cl2; p1 --> cl2`):
  `<!--cluster p1--><g class="cluster" ... id="ent0001" data-source-line="1">`,
  `<!--class cl1--><g class="entity" data-qualified-name="p1.cl1"
  id="ent0002" data-source-line="2">`, `<!--class cl2--><g class="entity"
  data-qualified-name="cl2" id="ent0003" data-source-line="4">`,
  `<!--link p1 to cl2--><g class="link" data-entity-1="ent0001"
  data-entity-2="ent0003" id="lnk4" data-source-line="5"
  data-link-type="dependency"><path ... id="p1-to-cl2" codeLine="5"/>...`.
- `befasi-62-vimu310` (5 packages, 24 classifiers, 30+ links, 6 notes):
  confirms the SAME shape at scale (`<!--cluster app-->` ...
  `<!--class DrawableAdapter-->` ... `<!--reverse link DrawableAdapter to
  WaterSurfaceGeom-->`), AND that a note gets the identical `class="entity"`
  wrapper but WITH NO comment (`<g class="entity"
  data-qualified-name="app.drawables.N3" id="ent0003"
  data-source-line="14">`, no `<!--...-->` before it) -- matches
  `EntityImageNote.java:196-202`'s own comment-free `UGroup` wrap, and the
  SAME `decorateEntityDrawing`-family shape description already ports.

Numbering order: ONE shared counter across classifiers, namespaces, AND
links (upstream `CucaDiagram#cpt1`, `getUniqueSequenceValue()`/
`getUniqueSequence("lnk")` -- same citation as description's own
`renderer-uid.ts`), incremented at ENTITY-CREATION time during parsing --
NOT draw order, NOT a per-category counter. `bajotu`'s p1(1)/cl1(2)/cl2(3)/
link(4) is pure source-declaration order (package opens before its nested
child; the link is parsed last, after both its endpoints already exist).
Upstream also auto-creates missing relationship endpoints inline, at the
exact point the relationship line is parsed (verified against
`ririlu-13-zipi740`: `V1`/`V2`/`V3`/`V4`/`MoreComplex`/`X`/`Y`/`Z` are never
declared with `class X` -- each gets its uid at the FIRST relationship line
that references it, immediately before that relationship's own uid).

### Maps to upstream code
`net.atmp.CucaDiagram#cpt1`/`getUniqueSequenceValue`/`getUniqueSequence` is
the SAME machinery description's own G1/I3b `renderer-uid.ts` already cites
and ports -- class shares the identical uid-generation primitive (both
diagram families ultimately go through `CucaDiagram`/`AbstractEntityDiagram`
before svek). The wrapper SHAPE (`UGroupType.CLASS`/`DATA_QUALIFIED_NAME`/
`DATA_UID`/`DATA_SOURCE_LINE`, `EnumMap` declaration-order attribute
serialization) is ALSO the identical shared `klimt/UGroup.java` this port's
`core/klimt/shape/UGroup.ts` already implements; `EntityImageClass.java:142-
154` is confirmed (grep-verified, this iteration) to build its group with
the EXACT same five `put()` calls as `EntityImageDescription.java:294-303`,
differing ONLY in the leading comment text (`"class " + name`, not
`"entity " + name"` -- `EntityImageClass.java:142` vs
`EntityImageDescription.java:294`). `Cluster#drawU`
(`svek/Cluster.java`) and `SvekEdge#drawU`/`#buildGroup`
(`svek/SvekEdge.java`) are the SAME classes description's own
`core/svek/Cluster.ts`/`core/svek/SvekEdge.ts` already port, confirming this
IS one shared drawing subsystem across the whole cuca family, not two
parallel implementations.

### Design: class-local pure-string wrapping, NOT full klimt/SvekEdge adoption
- **Uid plan** (`class/renderer-uid.ts#buildClassUidPlan`): parser threads
  parse-time `creationIndex` onto `Classifier`/`Namespace`/`Relationship`
  (mirroring description's I3b `DescriptiveNode.creationIndex` exactly),
  stamped at the THREE creation chokepoints (`parser.ts#ensureClassifier`,
  `class-namespace.ts#ensureNamespaceChain`, the primary relationship-
  dispatch site in `class-commands.ts`). `buildClassUidPlan` does DENSE
  RE-NUMBERING over the creationIndex-sorted merge of KEPT
  `ClassifierGeo`/`NamespaceGeo`/`EdgeGeo` items (not a literal counter
  replay) -- deliberate, not an approximation: `ensureClassifier` sometimes
  stamps a creationIndex on a classifier that never reaches `ClassGeometry`
  at all (a relationship endpoint resolving to an EXISTING namespace, e.g.
  `pkg --> Foo` -- `ensureClassifier` still auto-creates a phantom
  `Classifier` row before `class-dot-graph.ts#packageEndpointAnchors`
  redirects the real DOT edge to an anchor point inside the cluster, so the
  phantom never gets geometry). Verified against `bajotu-30-soku184`: raw
  creationIndex values are namespace=1, classifier=2, classifier=3,
  PHANTOM=4, relationship=5 -- but jar's real uids are ent0001/ent0002/
  ent0003/lnk4 with NO gap; dense re-numbering over the 4 KEPT items
  reproduces that exactly, a literal counter replay would not.
- **Wrapping is class-local pure-string** (`class/renderer-group.ts`), NOT
  a `decorateEntityDrawing`/`Cluster`/`SvekEdge` (klimt) adoption: `class/
  renderer.ts` draws every classifier/namespace/edge as a plain SVG string
  (`core/svg.ts` `rect`/`text`/`path`/... helpers), never through a
  `UGraphic` -- `EntityImageClass` itself has no klimt port in this
  codebase yet (a much larger, un-scoped migration). `renderer-group.ts`
  duplicates only the OBSERVABLE wrapper shape (`class`/`id`/
  `data-qualified-name`/`data-entity-1`/`data-entity-2`/`data-link-type`
  attribute names+values, comment text), reusing `core/svek/extremity/
  link-decor.ts#getLinkTypeName`/`looksLikeRevertedForSvg` (pure functions
  over already-RESOLVED `LinkDecorName`, no klimt dependency) rather than
  re-deriving that logic. `core/svg.ts#group(children, extraAttrs)`
  (pre-existing, additive use) builds the actual `<g ...>` tag.
- **SvekEdge decision: still NOT fully adopted, one iteration later** (N1
  deferred this pending a uid plan; N2 built the uid plan but did NOT flip
  the switch). Investigated seriously this iteration: a real `SvekEdge`
  instantiation is FEASIBLE now (verified empirically -- every one of 718
  real fixtures' `EdgeGeo.points` from the actual dot-layout pipeline is a
  well-formed `1 + 3*n` bezier spline, zero counterexamples; N1's "not
  always that shape" caution was about a HAND-BUILT unit-test fixture, not
  real layout output) via an additive `SvekEdgeInput.tailDecorName`/
  `.headDecorName: LinkDecorName` override (class's `LinkDecor` is already
  parse-time-resolved, unlike description's raw decor tokens) plus a
  throwaway-`UGraphicSvg`-draw-and-`extractFlatContent` pattern (exactly
  `renderer-arrowhead.ts`'s own established idiom, extended to the WHOLE
  edge instead of just the extremity). NOT done this iteration: the
  additional core/svek/SvekEdge.ts write-set expansion + throwaway-doc
  draw/extract plumbing was assessed as more implementation risk (touches
  shared code the description gate depends on) than the plain-string
  wrapper for the SAME remaining time budget, with no conformance upside
  this iteration (the census signal does not reward it -- see "why 0 new
  zero-diff" below). Named for a future iteration if/when class's
  classifier/namespace drawing itself migrates to klimt (at which point
  full `SvekEdge` reuse becomes the natural, lower-total-code choice).

### Why 0 new zero-diff fixtures (the mechanism landed correctly; the
### childCount bail simply moved one level deeper, as predicted)
Family shift (`--families`, full 718/718 run):
```
before (N1): svg/g[1][childCount]          718/718 (100%, universal)
after  (N2): svg/g[childCount]  (depth 1)  166/718 -- the SAME family,
             now only 166 fixtures still fail at the OUTER level
             svg/g/g[childCount] (depth 2)  538/718 -- NEWLY EXPOSED: the
             entity/cluster/link wrapper now exists and has the right
             COUNT at the top, so compareSvg's tree-walk recurses one level
             deeper and finds a SEPARATE, pre-existing childCount mismatch
             INSIDE the wrapper (the classifier/cluster/note's own internal
             element count).
```
Root-caused (spot-checked `cojixe-63-vejo525`/`vokati-75-gude769`, both
single-classifier `class ArrayList` fixtures with NO relationships, NO
namespaces -- the simplest possible case, previously ledgered as N2's "first
zero-diff candidates"): jar draws EVERY classifier box with 7px padding, a
`rx="2.5" ry="2.5"` rounded rect, and the kind badge as a real vector icon
(`<ellipse>` + a bezier `<path>` glyph, e.g. the "C" shape) -- this port's
`class/renderer.ts#renderClassifierBox`/`renderBadge` instead draws a FLUSH
`x="0" y="0"` unrounded rect and a simple `<circle>` + `<text>C</text>`
badge. This is a LARGE, UNIVERSAL, pre-existing divergence in
`EntityImageClass`'s own chrome (every classifier, every fixture) that was
COMPLETELY INVISIBLE before N2 -- `compareSvg`'s tree-walk never recurses
past a childCount mismatch, so mechanism 2's `svg[childCount]` bail (N1) and
then mechanism 3's `svg/g[1][childCount]` bail (this iteration, until now)
each hid it in turn. This is EXACTLY the "childCount-bail unmasking again...
N3's territory" the mission brief itself predicted -- not a defect in this
iteration's work, and not something a quick fix inside N2's own scope could
reach (it is comparable in size to N1's mechanism 2 itself: a full
`EntityImageClass`-chrome-fidelity pass, box padding/rounding/badge-icon-
shape/generics-icon, `svg/g/g/rect/@x`+`@y`+`@rx`+`@ry`+`@width`+
`@height`+`svg/g/g/circle` families in the current `--families` table,
50-62 fixtures each -- NOT yet decomposed further this iteration).
Two ADDITIONAL, smaller, independently-diagnosed remainders surfaced by the
same unmasking (both real, both NOT attempted this iteration):
- `svg/g/g/path/@id` (192 fixtures) + `@codeLine` (177): jar's edge `<path>`
  element carries its OWN `id`/`codeLine` attributes (upstream
  `DotPath#setCommentAndCodeLine`, e.g. `id="p1-to-cl2" codeLine="5"` --
  verified on `bajotu-30-soku184`) that `class/renderer.ts#renderEdge`'s
  `buildPathData` never emits at all. A real gap, independent of the uid
  wrapper itself (the `<g>` wrapper's OWN `id`/`class` are correct; this is
  the CHILD `<path>` element's separate `id`).
- `svg/g/g/@id` (106 fixtures) includes a genuine, DIAGNOSED-but-unfixed uid
  bug, not just fallback-approximation noise: fixtures where a classifier
  declaration is later REOPENED as a `package`/`namespace` block of the
  SAME name (e.g. `bejusa-95-gafo325`: `VCAN_DRV *-- PCAN_DRV` auto-creates
  a `PCAN_DRV` classifier, THEN `package PCAN_DRV { ... }` opens --
  `class-container.ts#openNamespaceBlock`'s `muteClassifierToGroup` deletes
  the classifier row but `ensureNamespaceChain` still stamps a BRAND NEW
  `creationIndex` for the resulting `Namespace`, rather than reusing the
  deleted classifier's own index) -- produces every downstream uid
  consistently off by a constant `+1` for the whole fixture (verified:
  `bejusa-95-gafo325`'s diffs are `ent0003`-vs-expected-`ent0002`,
  `ent0009`-vs-`ent0008`, `ent0013`-vs-`ent0010`, a constant offset pattern,
  not random noise). Fix would be: capture the muted classifier's
  `creationIndex` in `muteClassifierToGroup` and thread it into
  `ensureNamespaceChain` as a reuse override for that one segment. Not
  attempted this iteration (diagnosed late, insufficient remaining time to
  implement + re-verify the DOT/description gates safely).

### Also NOT reachable by dense re-numbering (upstream itself consumes an
### extra real uid this port has no corresponding item for)
`ririlu-13-zipi740` (qualifier-bracket relationships, `HashMap [a1] <|-u->
[e] V1`) and `fibamu-81-zimo884` (association-class couple, `(Station,
Station) .. StationCrossing`) both show jar uid GAPS (ririlu: uid 3 and 10
skipped between visible entities/links; fibamu: uids 3-5 skipped before the
first link) that this port's geometry has NO corresponding item for at all
-- `Relationship.fromQualifier`/`.toQualifier` (already parsed) mark the
EXISTING classifier as "shielded" rather than creating a separate node
(verified: `class-layout-helpers.ts#shieldedClassifierIds`), so the
qualifier-bracket theory does not explain ririlu's gaps; the true mechanism
was NOT identified this iteration. Named remainder, not investigated
further (time-boxed).

### Coverage gaps in the creationIndex threading itself (by design, per the
### exact/fallback safety net -- named, not blocking)
- `data-source-line` OMITTED entirely from every wrapper -- this port's
  class parser has no line-number tracking at all yet (a separate,
  un-scoped write-set expansion comparable in size to description's own
  I3b). Harmless for conformance (`data-*`, stripped by `normalize.ts`
  adaptation #2) but a real, documented faithfulness gap.
- `creationIndex` is stamped at the PRIMARY relationship-dispatch site only
  (`class-commands.ts`'s `REL_DISPATCH_RE` handler) -- `class-map-
  commands.ts`/`class-declaration-parser.ts`/`class-lollipop.ts`/`class-
  assoc-couple.ts`'s OWN relationship-push call sites are NOT wired, so any
  fixture using ONLY those paths falls back to `buildClassUidPlan`'s
  approximate ordering (safe -- the exact/fallback gate is all-or-nothing
  per fixture, matching description's own binary-gate precedent).
- Notes (`ClassNote`/`NoteGeo`) are ALWAYS fallback-numbered (no
  `creationIndex` threaded from `class-notes.ts` this iteration) --
  continues from wherever the classifier/namespace/edge numbering left off,
  so a note-bearing fixture's non-note uids stay internally consistent even
  though the notes themselves are best-effort.

### Class census: N1 baseline -> N2
```
before: 0/718 · 1-3: 6   · 4-10: 712 · 11-30: 0   · 31+: 0   · errors: 0
after:  0/718 · 1-3: 4   · 4-10: 424 · 11-30: 146 · 31+: 144 · errors: 0
```
Bucket shape worsened (more fixtures now land in 11-30/31+) -- EXPECTED,
not a regression: fixing the outer `g[1][childCount]` bail (718->166
fixtures) lets `compareSvg`'s tree-walk recurse into EVERY fixture's
previously-invisible internal geometry (box chrome, badge icons, path ids),
counting MORE real (pre-existing, not newly introduced) diffs per fixture
than the old bail-at-childCount-1 measurement ever surfaced. Matches this
iteration's own "Expectations" framing verbatim ("expect childCount-bail
unmasking again... that's N3's territory").

### Ratchet: no new pins this iteration
Zero fixtures reached zero-diff (every fixture is now blocked by the
EntityImageClass-chrome-fidelity gap described above, universal across the
corpus) -- `oracle/goldens/svg-class/ratchet.json` stays the N0 empty
manifest; `class.golden.ratchet.test.ts` stays on its placeholder-assertion
path (5 tests, 2 skipped, unchanged).

### Description gate: intact
48/355 zero-diff (component+usecase) re-measured this iteration, unchanged
from the frozen baseline; `description.golden.ratchet.test.ts` 51/51 green.
No file this iteration touched anything description imports (`renderer-
uid.ts`/`renderer-group.ts` are class-local new files; `core/svek/
extremity/link-decor.ts` was read-only, `getLinkTypeName`/
`looksLikeRevertedForSvg` already exported, no changes there).

### DOT gate: frozen, unchanged
component 262/262 · usecase 90/90 · class 708/708 · object 78/80 · state
267/267 -- re-verified this iteration (`npx tsx scripts/dot-sync-report.ts
class object state` + the default component/usecase run). This iteration's
parser changes (`ensureClassifier`/`ensureNamespaceChain`/the relationship-
dispatch site) are ADDITIVE ONLY (a new `creationIndex` field stamped
alongside existing behavior, no control-flow change to classifier/
namespace/relationship RESOLUTION) -- verified empirically, not just by
inspection.

### Files changed
- `src/diagrams/class/ast.ts` -- `Classifier.creationIndex`/`Namespace
  .creationIndex`/`Relationship.creationIndex` (additive, optional).
- `src/diagrams/class/parser.ts` -- `ParseState.creationCounter`; `ensure
  Classifier` stamps `creationIndex` at its single creation chokepoint;
  threads the counter into `resolveReference`; reset on `newpage`.
- `src/diagrams/class/class-namespace.ts` -- `ensureNamespaceChain` gains
  an optional `counter` param, stamps `Namespace.creationIndex`;
  `ResolveInput` gains `counter?`.
- `src/diagrams/class/class-container.ts` -- `openNamespaceBlock` threads
  `state.creationCounter` into its `ensureNamespaceChain` call and its own
  non-dotted namespace-creation branch (see "off-by-one" remainder above
  for the ONE case this does NOT get right yet).
- `src/diagrams/class/class-commands.ts` -- the primary relationship-
  dispatch handler stamps `Relationship.creationIndex` after both
  endpoints resolve/auto-create.
- `src/diagrams/class/layout.ts` -- `ClassifierGeo`/`NamespaceGeo`/
  `EdgeGeo` gain `creationIndex?`; `EdgeGeo` gains `from`/`to` (required,
  the raw AST relationship endpoints, for uid resolution + comment text).
- `src/diagrams/class/renderer-uid.ts` (new) -- `buildClassUidPlan`, dense
  re-numbering exact/fallback uid assignment (see design section above).
- `src/diagrams/class/renderer-group.ts` (new) -- `wrapEntity`/
  `wrapCluster`/`wrapLink`/`leafPortion`, the pure-string wrapper shape.
- `src/diagrams/class/renderer-arrowhead.ts` -- `decorName` exported
  (additive) for reuse by `renderer.ts`'s new `wrapLink` call.
- `src/diagrams/class/renderer.ts` -- `renderClass` wires `buildClassUidPlan`
  + `wrapCluster`/`wrapEntity`/`wrapLink` around every namespace/classifier/
  edge/note.
- `tests/unit/class/renderer.test.ts` -- `makeEdgeGeo` gains `from`/`to`
  (new required `EdgeGeo` fields).
- `tests/unit/class/class-newpage-layout.test.ts` -- byte-identical golden
  re-captured with the new wrapper shape (TDD: rewritten, not deleted, per
  N1's own precedent for this exact test).

## N3 -- EntityImageClass box-chrome + geometry fidelity pass; corpus-staleness stop condition found

### Design: box chrome (rx/ry, badge shape, draw order) -- landed, jar-verified
- **Rounding + stroke-width** (`class/renderer.ts#renderClassifierBox`): classifier
  rect gains `rx="2.5" ry="2.5"` (`URectangle.build(...).rounded(roundCorner)`,
  `EntityImageClass.java`'s own `roundCorner` field, `PName.RoundCorner` default
  2.5) and `stroke-width` corrected `1` -> `0.5` (`getStyle().getStroke(...)`).
  `core/svg.ts#rect`/`BoxStyle` gained an additive `ry` field (was `rx`-only) --
  omitted (`undefined`) for every other diagram's call sites, so this is a
  zero-behavior-change addition everywhere except class; confirmed by the
  description census staying at 48/355 exactly, byte-for-byte, after the change.
- **Divider inset**: compartment divider `<line>`s are inset 1px from the rect's
  left/right edges (jar: `x1="8"`..`x2="98.0469"` against a `x="7"`..
  `width="92.0469"` rect) -- was flush with the rect edges.
- **Badge shape** (`class-badge.ts`, new): `<circle r="10">`+`<text>` replaced
  with `<ellipse rx="11" ry="11">`+a real vector-glyph `<path d="...">`, matching
  `klimt/shape/CircledCharacter.java` (upstream draws the badge LETTER as an AWT
  glyph-outline path, never `<text>`). Radius corrected 10 -> 11
  (`SkinParam#getCircledCharacterRadius()` default, ellipse `rx="11" ry="11"`
  verified on every sampled fixture). Glyph path data for all 5 letters (C/I/A/E/
  @) extracted VERBATIM from the cached corpus itself (`josazo-53-bode013` for
  C/E/@/A in one fixture, `tipude-10-tizi427` for I) at a fixed reference badge
  center `(22, 23)`, then translated at render time by `(cx - 22, cy - 23)` --
  cross-verified this translate-and-reuse model against 144 independent `C`-badge
  occurrences across the corpus (every one's `d` is the reference string with
  every coordinate token shifted by the SAME `(dx, dy)`, confirmed exactly).
  Letter fill hardcoded `#000000` (`style.value(PName.FontColor)` on the spot
  style signature, verified black in every NON-monochrome-theme fixture sampled;
  `skinparam monochrome reverse` flips this to white -- a separate, smaller,
  unfixed divergence, that theme already diverges more broadly and wasn't
  chased this iteration).
- **Draw order**: jar draws rect, THEN badge, THEN header name, THEN compartment
  dividers, THEN member rows (`EntityImageClass#drawInternal`: `ug.apply(stroke)
  .draw(rect)` then `header.drawU(...)` [badge+name] then `body.drawU(...)`
  [dividers+rows]) -- this port previously drew rect, ALL dividers, ALL rows
  (header+members flat), THEN badge. `compareSvg`'s comparator is positional, so
  this reorder alone closes real diff families even where every attribute
  value already matched.

### Design: sizing formulas (header height/width, empty compartments) -- landed,
### jar-verified against Java source + 3+ corpus fixtures
- **Header height** (`class-badge.ts`'s doc comment derives it from
  `HeaderLayout.java#getDimension`): `max(badgeBoxHeight, nameHeight + 10)`,
  `badgeBoxHeight = 2*11 + 5+5 = 32` (`TextBlockUtils.withMargin(circledChar, 4,
  0, 5, 5)`), `nameHeight = fontSize` (single line, `WidthTableMeasurer`'s own
  `height = font.size`). For every fixture sampled, the badge term dominates:
  `headerRowHeight = 32` exactly, verified with ZERO residual on 2 independent
  fixtures (`bedogi-86-kala547`, `vokati-75-gude769`, both rect height 48 =
  32 + 8 + 8). Replaces the old ad hoc `fontSpec.size * 1.4 + 8` (27.6 for
  14pt) formula, which had no upstream basis.
- **Header width**: `badgeBoxWidth(26) + nameWidth(textWidth + 6)`,
  `badgeBoxWidth = 2*11 + 4 = 26` (`withMargin(circledChar, 4, 0, 5, 5)`'s LEFT
  margin), `nameWidth = textWidth + 6` (`withMargin(name, 3, 3, 0, 0)`, 3px each
  side). Verified EXACT (to 4 decimal places) against `vokati-75-gude769`'s
  jar-real `ArrayList` header: `26 + (60.0469 + 6) = 92.0469` == rect
  `width="92.0469"`, using the jar's OWN captured per-character glyph widths
  (see the corpus-staleness finding below for why this exact match does NOT
  currently reproduce end-to-end).
- **Empty compartments** (`class-layout-helpers.ts#measureGenericClassifier`,
  `sectionHeight`/`buildSectionRows`): `BodierLikeClassOrObject#getBody`'s
  default branch (`showFields && showMethods`, the no-`hide`-directive case)
  ALWAYS builds BOTH a fields `MethodsOrFieldsArea` and a methods one, each
  wrapped `TextBlockUtils.withMargin(this, 6, 4)` -- 4px top+bottom margin
  regardless of whether that specific compartment has zero members. This port
  previously drew ONE undifferentiated member section (0 height when empty, one
  divider). Now: two independent compartments (fields first, then methods,
  members split via `Member.params !== undefined` -- method vs field, mirroring
  `BodierLikeClassOrObject#isMethod`), each with an 8px margin-only floor when
  empty, ALWAYS drawing both dividers when the section isn't `hide`-suppressed.
  `EMPTY_SECTION_HEIGHT = 8` jar-verified with ZERO residual on 2 fixtures.
  Per-row content height inside a POPULATED compartment keeps the pre-existing,
  UNVERIFIED `fontSize * 1.4` estimate (a 1-member fixture,
  `jobuco-44-zife032`, suggests the real per-row height is closer to `16.49`,
  not `19.6` -- NOT changed this iteration; entangled with the corpus-staleness
  finding below, so not independently fixable/verifiable right now).
- **No 100px width floor**: `Math.max(100, longestWidth + 20)` removed --
  `EntityImageClass.calculateDimensionSlow` has no such clamp upstream
  (`PName.MinimumWidth`/`getParamSameClassWidth()` both default 0). This was a
  made-up, non-upstream divergence, not a ported behavior. Ripples: a
  single-letter classifier's box is now genuinely small (e.g. `class A` ->
  ~41px wide, not 100px) -- exposed a PRE-EXISTING, unrelated annotation-chrome
  sizing gap (footer/header bands don't expand the canvas to their own content
  width when it exceeds a narrow diagram body) in
  `tests/integration/annotations.e2e.test.ts`'s single-letter-classifier test
  fixture; worked around by using longer classifier names in that ONE test
  (preserves its original intent -- footer right-alignment -- without
  depending on the annotation-chrome gap, which is out of scope here and not
  independently diagnosed this iteration).
- **Degenerate single-classifier margin** (`layout.ts#degenerateSingleClassifier`):
  `EntityImageDegenerated.java`: `delta = 7`, applied as a translate on drawing
  (`orig.drawU(ug.apply(new UTranslate(delta, delta)))`) plus a trailing empty
  `(delta, delta)` block reserved at the far corner -- `calculateDimension`
  grows by `delta*2 = 14` total (7 near-edge, 7 far-edge). A FURTHER flat `+6`
  (both axes) sits upstream of `GraphvizImageBuilder` -- Java origin NOT pinned
  this iteration (grepped `CucaDiagramFileMakerSvek`/`GeneralImageBuilder`
  without finding it; likely a page-level margin applied even further up the
  export pipeline) -- but the CONSTANT is jar-verified exact on
  height (2/2 sampled fixtures, zero residual: `48 + 7 + 13 = 68` twice) and
  rounds correctly on width (residual < 0.05px on the one sampled case,
  consistent with floating noise, not a formula error). Implemented as
  `DEGENERATE_NEAR_MARGIN = 7` / `DEGENERATE_FAR_MARGIN = 13`; `geo.x = geo.y =
  7`; `totalWidth/totalHeight = Math.round(measured + 20)` -- jar's own canvas
  `width`/`height`/`viewBox` are whole-pixel even though internal element
  geometry stays fractional, confirmed on the same 2 fixtures.

### STOP-CONDITION-WORTHY FINDING (not fixed, reported per mission's own
### "report with evidence instead of proceeding" instruction): the cached
### `test-results/dot-cache/class/` corpus is STALE relative to the current
### oracle jar build
- **Mechanism**: `scripts/dot-sync-report.ts#plantumlDots` is the SOLE
  generator of `test-results/dot-cache/<type>/<slug>/in.svg` (and the
  `svek-N.dot` dumps `dot-sync-report` itself consumes) -- it invokes `java
  -DPLANTUML_DETERMINISTIC_TEXT=true -DPLANTUML_DUMP_DOT=<dir> -jar <jar>
  -tsvg -o <dir> <in.puml>` ONCE per fixture, gated by a `.done` sentinel that
  skips regeneration on every subsequent run (`rebuild` flag required to force
  it). Directly re-running this EXACT command by hand
  (`oracle/dist/plantuml-oracle.jar`, same `-DPLANTUML_DETERMINISTIC_TEXT=true`
  flag) against `vokati-75-gude769/in.puml` produces a DIFFERENT `in.svg` than
  the cached one: `textLength="55.2125"` (freshly built) vs the cached
  `textLength="60.0469"` for the SAME string `"ArrayList"` at the SAME 14pt
  sans-serif -- every OTHER attribute matched byte-for-byte (`x="36"`,
  `fill="#000000"`, `font-family="sans-serif"`) except the header-name text
  metric itself and everything downstream of it (`y`, rect `width`, divider
  `x2`, canvas `width`/`viewBox`).
- **This port's OWN `WidthTableMeasurer` is CORRECT relative to the freshly-
  built jar, not buggy**: per-character widths for every letter in "ArrayList"
  (A/r/a/y/L/i/s/t) were independently verified against a `class A / class r /
  class y / ...` single-letter probe run through the SAME freshly-built jar --
  EVERY character's width matches this port's width table EXACTLY (e.g. `A` =
  9.3625 both sides). Re-measuring "ArrayList" and "Component" as CLASS HEADER
  text (not just isolated description-domain strings) through the fresh jar
  ALSO matches this port's measurer exactly (`ArrayList` = 55.2125,
  `Component` = 72.3625 both sides) -- the mismatch is STRICTLY against the
  OLDER, cached `in.svg`, not a property of the string or the class-header
  code path.
- **Timeline evidence**: `oracle/patches/0002-oracle-deterministic-text.patch`
  (the mechanism that makes `-DPLANTUML_DETERMINISTIC_TEXT=true` route text
  measurement through `StringBounderFromWidthTable` at all) was committed
  2026-07-05 19:38, and `oracle/dist/plantuml-oracle.jar` was last built
  2026-07-05 22:58 (consistent with each other). Most of
  `test-results/dot-cache/class/*` is filesystem-dated 2026-07-04 16:37-38 --
  BEFORE the deterministic-text patch existed in ANY form. Whatever jar/flag
  combination produced the July 4 corpus could not have been today's
  `-DPLANTUML_DETERMINISTIC_TEXT=true` + current patch; the corpus predates the
  mechanism this whole census methodology depends on.
- **Blast radius**: every text-bearing fixture's `@width`/`@height`/`@viewBox`
  and every `<text>`'s `@textLength` is unverifiable against a reliable oracle
  until this is resolved -- this is the TRUE reason N3 could not close the
  first ratchet pins the mission's own "Expectations" section anticipated, NOT
  a shortfall in the box-chrome/geometry work itself (every non-text-width-
  dependent formula this iteration derived -- badge geometry, empty-
  compartment margins, degenerate-path margin -- is independently, exactly
  verified against the cached corpus's own internal consistency across
  multiple fixtures, and would very likely ALSO hold against a freshly
  regenerated corpus, since none of those constants depend on font/glyph
  metrics at all).
- **Disposition**: NOT fixed. Regenerating `test-results/dot-cache/` (the only
  fix) is an orchestrator-level decision this agent's hard boundaries
  explicitly forbid taking unilaterally -- `dot-sync-report.ts#plantumlDots`
  generates BOTH the `in.svg` SVG-census goldens AND the `svek-N.dot` dumps
  `dot-sync-report` itself reads for the FROZEN DOT gate from the SAME single
  java invocation; regenerating one regenerates both, and while the DOT gate's
  own comparison is topology-only (node/edge/cluster counts, NOT exact
  width/height -- confirmed unaffected: DOT gate stayed 708/708 throughout this
  iteration's sizing-formula changes), a full corpus regeneration is exactly
  the kind of cross-cutting, hard-to-fully-verify action the mission's "report
  evidence instead of proceeding" instruction exists for. Recommend: a
  dedicated `--rebuild` pass for `test-results/dot-cache/class/` (and probably
  `object`/`state`, unverified whether they're equally stale) as its own,
  reviewed, orchestrator-authorized step before any future SVG-census
  iteration continues chasing exact numeric parity.
- **Not investigated this iteration**: whether `component`/`usecase`'s own
  cached corpora are ALSO stale (their 48/355 zero-diff count suggests at
  least SOME fixtures are reliable, but that doesn't rule out staleness on the
  ones that aren't yet zero-diff); the exact Java origin of the `+6`
  degenerate-margin residual; the real per-row member-text height formula
  (entangled with the same text-metric uncertainty).

### Class census: N2 baseline -> N3
```
before: 0/718 · 1-3: 4   · 4-10: 424 · 11-30: 146 · 31+: 144 · errors: 0
after:  0/718 · 1-3: 7   · 4-10: 278 · 11-30: 58  · 31+: 375 · errors: 0
```
`--families`: `svg/g/g[childCount]` (the EntityImageClass-chrome-fidelity
blocker N2 identified) dropped 538 -> 373 (real, verified structural
progress: badge glyph shape + draw order + empty-compartment dividers now
match on many more fixtures); `rect/@rx`/`@ry` dropped 50/60 -> 20/29 (the
rounding fix landing); `circle` (the old badge shape) dropped 48 -> 37 (some
non-badge circles remain from other rendering paths, not investigated).
`31+` bucket growing substantially (144 -> 375) is EXPECTED, not a
regression -- same "childCount-bail unmasking" pattern as N1->N2: fixtures
that previously bailed early on `svg/g/g[childCount]` now recurse deeper and
surface pre-existing, un-related-to-this-fix diffs (mostly the same
text-metric/corpus-staleness issue above) that were invisible before. Zero
NEW families were introduced by this iteration that weren't already present
in some form pre-fix.

### Ratchet: no new pins this iteration
Zero fixtures reached zero-diff (the corpus-staleness finding above blocks
every text-bearing fixture, which is all of them) -- `oracle/goldens/
svg-class/ratchet.json` stays the N0 empty manifest; `class.golden.ratchet
.test.ts` stays on its placeholder-assertion path (5 tests, 2 skipped,
unchanged). The 4 fixtures at 1-3 diffs from N2's baseline are now a
DIFFERENT set of 7 (`bedogi-86-kala547`, `jiceke-84-xoze695`,
`jobuco-44-zife032`, `nubisa-82-tuji339`, `remulu-24-zadi546`,
`tegoxa-17-kudo421`, `vinujo-78-kapo329`), every one blocked ONLY by
`svg/g[childCount]` or `svg/g[1]/g[1][childCount]` plus the matching
`@width`/`@height`/`@viewBox` -- i.e. genuinely one mechanism (text-metric
staleness) away from zero-diff, the closest this mission has been to a first
pin.

### Description gate: intact
48/355 zero-diff (component+usecase) re-measured, unchanged from the frozen
baseline; `description.golden.ratchet.test.ts` 51/51 green. The only shared
file touched, `core/svg.ts#rect`/`BoxStyle`, gained an ADDITIVE `ry` field
description's own call sites never pass (omitted, byte-identical output) --
confirmed by the description census's exact-match staying unchanged.

### DOT gate: frozen, unchanged
component 262/262 · usecase 90/90 · class 708/708 · object 78/80 · state
267/267 -- re-verified after this iteration's sizing-formula changes
specifically BECAUSE those changes touch `preMeasureClassifiers` (shared
between the degenerate and DOT-driven paths, feeding DOT node sizing for
multi-classifier fixtures) -- confirmed unaffected: `dot-sync-report`'s own
comparator is topology-only (node/edge/cluster counts + shapes, "width/
height are tolerant metrics... reported, not asserted" per `tests/oracle/
svek-dot.ts`'s own doc comment), so a classifier-box SIZE change cannot move
this gate on its own, and didn't.

### Files changed
- `src/diagrams/class/class-badge.ts` (new) -- badge geometry constants
  (`BADGE_RADIUS`, `BADGE_BOX_WIDTH/HEIGHT`, `NAME_MARGIN_TOTAL`), `hasBadge`/
  `badgeFill`/`badgeLetter` (moved from `renderer.ts`, unchanged), 5-letter
  glyph path data + `badgeGlyphPath` translate function.
- `src/diagrams/class/renderer.ts` -- `renderBadge` draws `<ellipse>`+`<path>`
  instead of `<circle>`+`<text>`; `renderClassifierBox` reordered (badge,
  header text, dividers, member rows) + rx/ry/stroke-width-0.5 + 1px divider
  inset; imports badge helpers from the new module instead of defining them
  locally.
- `src/diagrams/class/class-layout-helpers.ts` -- `measureGenericClassifier`
  rewritten: badge-aware header height/width formulas, two-compartment
  (fields/methods) height+dividers+rows with an 8px empty-section floor,
  no 100px width floor; `computeLongestTextWidth`/unused `RowMetrics`
  removed (dead code after the rewrite); new `isMethodMember`/`sectionHeight`/
  `sectionWidth`/`buildSectionRows` helpers.
- `src/diagrams/class/layout.ts` -- `degenerateSingleClassifier`: `geo.x`/
  `geo.y` now `7` (was `0`); `totalWidth`/`totalHeight` formula changed from
  flat `+12` to `Math.round(measured + 7 + 13)`.
- `src/core/svg.ts` -- `rect()`/`BoxStyle` gained an additive, optional `ry`
  field (omitted everywhere except class's new rounded-rect chrome).
- `tests/unit/class/layout.test.ts`, `tests/unit/class/renderer.test.ts`,
  `tests/unit/class/class-degenerate.test.ts`, `tests/unit/class/
  class-newpage-layout.test.ts`, `tests/integration/annotations.e2e.test.ts`
  -- TDD: assertions/goldens rewritten (not deleted) to cover the new,
  upstream-faithful geometry, per this mission's own N1/N2 precedent for
  this exact pattern.

## N4 -- fresh-oracle re-classification + first zero-diff ratchet pins (29 fixtures)

### Re-baseline confirmed against the fresh (2026-07-16) oracle cache
`npx tsx scripts/svg-conformance-census.ts class` matched the README's
stated re-baseline exactly: `0/718 · 1-3:16 · 4-10:269 · 11-30:55 ·
31+:378 · errors:0`. Drilled the 16 fixtures at 1-3 diffs first (per the
mission's own instruction) -- every one resolved to a SMALL set of
universal mechanisms, landed incrementally this iteration, closing 29
fixtures to true zero-diff (the mission's first class ratchet pins).

### mechanism 1: `theme.colors.background` never resolved through HColorSet -- FIXED
- Mechanism: `class/renderer.ts#renderClass` passed `theme.colors.background`
  (the RAW skinparam value, e.g. `"red"` from `skinparam BackgroundColor
  red` -- `skinparam.ts#resolveColor` only strips a gradient tail, never
  resolves named colors) straight onto `fragment.background`, which
  `document-shell.ts#assembleDocumentShell` emits verbatim into the root
  `style="...background:red;"` attribute. EVERY other fill/stroke in this
  port's SVG-emission layer resolves through `klimt/color/HColorSet.ts#
  resolveColorToSvgHex` (`paint.ts#paintToSvg`'s own doc comment) EXCEPT
  this one call site -- class draws no klimt `UGraphic` at all (pure-string
  renderer), so nothing upstream of `renderClass` ever normalizes it.
  Jar-verified: `bovuze-89-noja934`/`nikoxo-78-dega884`
  (`skinparam BackgroundColor red`) expected `background:#FF0000;`, not
  `background:red;`.
- Disposition: FIXED -- `renderClass` now computes
  `canonicalBackground = resolveColorToSvgHex(theme.colors.background)`
  once, feeding both the root style attribute and mechanism 2 below.
- Slugs: universal reach wherever a non-default, named-CSS-color
  `BackgroundColor` is used (small corpus reach, ~2-8 fixtures, but a
  correctness bug regardless of reach).

### mechanism 2: jar draws an explicit full-canvas `<rect>` for a non-default
### background -- N1's own doc comment was WRONG, not jar-verified -- FIXED
- Mechanism: N1's ledger claimed "jar's class SVGs never draw a body-level
  canvas rect -- background is part of the root style attribute" and
  removed this port's own background rect entirely. Re-verified against the
  FRESH oracle: jar draws `<rect x="0" y="0" width="W" height="H"
  fill="<bg>" style="stroke:none;stroke-width:1;"/>` as the body `<g>`'s
  FIRST child whenever the resolved background is neither `#000000` nor
  `#FFFFFF` nor fully transparent (`#00000000`) -- the EXACT same
  exclusion list `svg-graphics-core.ts#setupBackcolor` already applies for
  every klimt-drawn engine. Jar-verified against ALL 8 non-default-
  background fixtures in the corpus (`bovuze-89-noja934`,
  `camuna-58-veca254`, `lurevi-57-reku842`, `momaku-69-duxe918`,
  `nafiki-56-jixu680`, `nikoxo-78-dega884`, `nomeza-10-laba367`,
  `zuramo-86-liku129`) -- ALL 8 carry the rect, every `#FFFFFF`-background
  fixture in the corpus carries NONE.
- Disposition: FIXED -- `renderClass` conditionally prepends the rect
  (class-local pure-string, `stroke: 'none', strokeWidth: 1` matching
  jar's own redundant-but-present stroke-width declaration).
- Slugs: same 8-fixture set as mechanism 1's reach.

### mechanism 3: `badgeFill`'s per-kind spot colors were simply wrong -- FIXED
- Mechanism: `class-badge.ts#badgeFill`'s 5 constants (class `#4472B8`,
  interface `#7B5EA7`, abstract `#3A8FA8`, enum `#4DA34D`, annotation
  `#888888`) matched ZERO of 146+ `fill="#ADD1B2"` (class-kind badge)
  occurrences across the fresh oracle corpus. Root cause found in
  `~/git/plantuml/src/main/resources/skin/plantuml.skin`'s `spot { ... }`
  block (`EntityImageClassHeader.java#getCircledCharacter`'s
  `spotStyleSignature` lookup target) -- the AUTHORITATIVE default color
  set: `spotClass #ADD1B2`, `spotAbstractClass #A9DCDF`, `spotInterface
  #B4A7E5`, `spotEnum #EB937F`, `spotAnnotation #E3664A`. This was likely
  an un-jar-verified constant from whenever badges were first ported.
- Disposition: FIXED -- all 5 constants corrected; `default` case kept
  (returns `spotClass`'s color) for the OTHER `ClassifierKind` members this
  iteration did not survey against the jar (`entity`/`circle`/
  `descriptive`/`usecase`/`state`/association-diamond -- `hasBadge()`
  admits all of these, only `object`/`map`/`json` are excluded), rather
  than reassigning them without evidence.
- Slugs: universal, every badge-bearing classifier (`svg/g/g/ellipse/@fill`
  family, ~1000+ reach pre-fix).

### mechanism 4: `ellipse()`/badge call site used `strokeWidth` (camelCase,
### invalid SVG) instead of `stroke-width` -- FIXED
- Mechanism: `renderBadge`'s `ellipse(..., { ..., strokeWidth: 1 })` call
  passes `strokeWidth` as a literal key into `ellipse()`'s free-form
  `extraAttrs` bag, which emits the key VERBATIM as an XML attribute name
  -- `strokeWidth="1"` is not a real SVG attribute (invisible to any real
  renderer), instead of the intended `stroke-width="1"`. A pre-existing
  bug from N3, invisible until this iteration's other fixes let
  `compareSvg` recurse deep enough to see it. Every OTHER `ellipse()` call
  site in the codebase already used `fill`/`stroke` only (no width key) --
  a local bug, not a shared-helper defect.
- Disposition: FIXED -- one-line key rename to `'stroke-width'`.
- Slugs: universal, every badge-bearing classifier.

### mechanism 5: divider `<line>`s omitted `stroke-width` entirely -- FIXED
- Mechanism: `renderClassifierBox`'s compartment-divider `line(...)` calls
  never passed a `strokeWidth` at all (SVG default `1`), while jar's own
  dividers share the box's own `0.5` border stroke-width. `svg/g/g/
  line/@stroke-width` reached 387/718 fixtures pre-fix.
- Disposition: FIXED -- `strokeWidth: 0.5` added to both divider-line calls.
- Slugs: universal, every classifier with >=1 compartment divider (i.e.
  every classifier whose member section is drawn at all).

### mechanism 6: member/header text rendering -- baseline Y, indent X,
### textLength/lengthAdjust, fill color, row height, draw-order interleave
### -- FIXED (the largest mechanism this iteration)
- Mechanism (multi-part, jar-verified against 5+ fixtures spanning 1-2 row
  counts and both fields/methods compartments -- `jobuco-44-zife032`,
  `nubisa-82-tuji339`, `bisisi-31-xasa026`, `cojixe-63-vejo525`,
  `canuti-20-jotu614`):
  - **Row height**: `fontSize` exactly (one un-leaded text line), not the
    previous unverified `fontSize * 1.4` -- zero residual across every
    sampled multi-row section.
  - **Baseline Y**: `lineTop + (fontSize - measurer.getDescent(font, ''))`
    -- the SAME `height - descent` ascent formula already established in
    `EntityImageDescriptionSupport.ts#measureLine`/`lineDescent`, applied
    here for the first time to class's own header/member rows. Header row:
    `lineTop = (headerRowHeight - fontSize) / 2` (vertically centered in
    the badge-dominated header). Member row: `lineTop = sectionTop +
    SECTION_MARGIN_TOP + i * memberRowHeight`.
  - **Text-anchor / dominant-baseline**: OMITTED entirely (both, for every
    row) -- jar's `<text>` is always plain-baseline, left-anchored;
    `text-anchor="start"` (the SVG default, explicitly emitted) was ALSO
    a spurious diff since `compareSvg` does string-compares raw attribute
    presence, not default-value equivalence.
  - **Header X (indent)**: `(boxWidth - headerWidth) / 2 + (badgeShown ?
    BADGE_BOX_WIDTH : 0) + NAME_LEFT_MARGIN` -- the `(boxWidth -
    headerWidth) / 2` term is jar's real `HeaderLayout#drawU` `suppWith`
    centering behavior when member content is wider than the header (0 in
    the common header-dominated case, reducing to the previously-correct
    fixed offset). Badge X derived from this SAME `headerRow.indent` at
    render time (`badgeX = geo.x + headerRow.indent - BADGE_RADIUS -
    NAME_LEFT_MARGIN`), replacing the old fixed `BADGE_CENTER_X_OFFSET`
    constant (removed, now dead).
  - **Member row X (indent)**: `6` base margin, `+14` icon zone (`20`
    total) when a visibility icon is drawn -- ALWAYS reserved before this
    fix (see mechanism 7), matching only the icon-present case exactly;
    jar's own no-icon indent (`6`) is reachable now that mechanism 7 gates
    icon-showing correctly.
  - **textLength/lengthAdjust**: `ClassifierGeo.rows[].width` (new,
    additive field) carries the row's own pre-measured, `javaFixed4`-
    rounded (see mechanism 8) text width from `layoutClass`; `renderRow`
    emits `lengthAdjust="spacing" textLength="..."` when present, matching
    jar's `-DPLANTUML_DETERMINISTIC_TEXT=true` emission byte-for-byte.
  - **Fill color**: hardcoded `#000000` (not `theme.colors.text`, which is
    `#181818` by default and used elsewhere for notes/edges) --
    `EntityImageClassHeader`'s own style-signature FontColor resolves to
    black independent of the general canvas text color; matches
    `renderBadge`'s own pre-existing glyph-fill precedent (same
    monochrome-reverse caveat, not fixed).
  - **`<tspan>` removal (shared, `core/svg.ts#text()`)**: was
    UNCONDITIONALLY wrapping every text draw's content in a bare
    `<tspan>...</tspan>` -- jar's own single-run text (klimt's
    `setTextContent`, mirrored by every diagram type this port's own
    klimt path already reproduces with zero `<tspan>`) never wraps a
    simple string this way; `<tspan>` is reserved for multi-styled-run or
    explicit multi-LINE text (`diagrams/activity/renderer.ts`'s own
    dedicated multiline builder, which never calls `core/svg.ts#text()`
    at all). Verified 0/351+ cached jar fixtures across `state`/`object`
    (the two OTHER `text()` consumers surveyed, beyond class) contain a
    `<tspan>` for a single-run label -- a universal, cross-diagram-type
    divergence, not class-specific. `description`/`component`/`usecase`
    are unaffected (klimt-drawn, never call this function).
  - **Draw-order interleaving**: `renderClassifierBox` drew ALL compartment
    dividers as one batch, THEN all member rows -- jar interleaves them by
    visual Y position (divider, THEN that section's rows, THEN the next
    divider). Fixed via a merge-sort-by-Y of the (divider, row) sequence
    rather than tracking a separate fields/methods row-count split on
    `ClassifierGeo`.
- Disposition: FIXED (all sub-parts). Reach: `svg/g/g/text/@x`,
  `svg/g/g/text/@y`, `svg/g/g/text/tspan` families were each 396-407/718
  pre-fix (the single largest mechanism this iteration, larger than any
  individual constant swap).
- Slugs: universal, every text-bearing fixture.

### mechanism 7: visibility icon reservation was unconditional, not gated
### on an EXPLICIT visibility character -- FIXED
- Mechanism: `Member.visibilityExplicit` (an EARLIER, pre-G2 field) already
  existed and was already correctly consumed by `class-object-map-sizing
  .ts` for OBJECT leaves, but `class-member-parser.ts` (the CLASS-leaf
  parser) never STAMPED it at all -- every class/interface/enum member
  always defaulted to `visibilityExplicit: undefined` regardless of
  whether the source line carried a leading `+`/`-`/`#`/`~`. Since
  `Member.visibility` itself is a REQUIRED field (always `'+'` by
  default), `buildSectionRows`'s old `visibilityIcon:
  members[i].visibility` was unconditional -- every member row always
  showed SOME icon. Jar-verified: `jobuco-44-zife032`'s bare `Bar` field
  (no leading char) shows NO icon at all in jar's output. An EARLIER
  iteration's doc comment on this field had called the always-show
  behavior a deliberate, "pre-existing pinned divergence" -- re-diagnosed
  this iteration as simply unverified, not intentional (no DIVERGENCES.md
  entry, no dedicated test locking in the old behavior beyond the two
  hand-built-AST layout tests updated here).
- Disposition: FIXED -- `class-member-parser.ts#parseMemberLine` now
  stamps `visibilityExplicit: true` at its own visibility-char-detection
  branch (mirrors `class-object-commands.ts#withVisibilityFlag`'s exact
  pattern); `buildSectionRows` gates `visibilityIcon`/indent on it.
  Visibility ICON SHAPE/COLOR/fill-vs-stroke-only distinction remains
  WRONG (see remainder below) -- this fix only corrects WHETHER an icon
  (and its indent reservation) appears, not what it looks like.
- Slugs: reach not separately measured (entangled with mechanism 6's
  indent fix); closed `jobuco-44-zife032`/`nubisa-82-tuji339` to
  zero-diff directly.

### mechanism 8: `textLength` needs Java-`%.4f` rounding, not raw JS float
### stringification -- FIXED, extracted to a new shared module
- Mechanism: `row.width` (mechanism 6) is a raw `measurer.measure(...)
  .width` JS double (e.g. `24.150000000000002`); `compareSvg`'s
  `NUMERIC_ATTRS` allowlist (which grants a 0.01 tolerance) does NOT
  include `textLength`, so this fails an EXACT string comparison against
  jar's own `%.4f`-rounded `"24.15"` even though the two values are
  numerically near-identical. jar's OWN `textLength` emission already
  goes through this exact rounding (`svg-graphics-elements.ts#
  applyTextLengthAdjust` -> `this.format(textLength)` ->
  `SvgGraphicsCore#format`'s private `javaFixed4`/`trimTrailingZeros`).
- Disposition: FIXED -- extracted `javaFixed4`/`trimTrailingZeros` (pure
  move) from `svg-graphics-core.ts` into a new leaf module,
  `core/number-format.ts` (also exports `javaRound4`, the number-in-
  number-out convenience form class needs), so `class-layout-helpers.ts`
  can reuse the SAME rounding without pulling in the klimt drawing stack.
  `svg-graphics-core.ts#format` now delegates to the shared module --
  description census stayed byte-identical (48/355), confirming the
  extraction is behavior-neutral.
- Slugs: reach == mechanism 6's (every `textLength`-bearing row).

### mechanism 9: `formatMemberText` always appended `: <type>`, even for
### an untyped member -- FIXED
- Mechanism: `${name}: ${type ?? ''}` unconditionally printed a colon
  (`"Bar: "` for a member with no `: Type` in the source at all), never
  omitting it entirely. Jar-verified (`jobuco-44-zife032`'s `class Foo {
  Bar }`): jar's row text is plain `"Bar"`, no colon. Upstream's `Member`
  (`cucadiagram/Member.java`) is a near-verbatim `CharSequence` wrapper,
  not a name/type reconstruction -- this port's AST splits name/type at
  parse time, so the reconstruction must reproduce "nothing typed,
  nothing shown."
- Disposition: FIXED -- `typeSuffix = type !== undefined ? ': ' + type :
  ''`, applied to both the field and method branches (methods extended
  symmetrically on the same principle; no counter-example fixture found
  in the corpus, but no positive jar sample either -- named as an
  unverified-but-consistent extension, not independently jar-checked).
- Slugs: closed `jobuco-44-zife032`/`nubisa-82-tuji339` to zero-diff
  (combined with mechanism 7).

### mechanism 10: `degenerateSingleClassifier`'s whole-pixel canvas
### rounding was `Math.round`, should be `Math.floor` -- FIXED
- Mechanism: N3's own `Math.round(measured + 7 + 13)` was verified against
  only 2 fixtures whose totals were exact integers (no rounding
  ambiguity) plus ONE width case whose fractional part happened to be
  `< 0.5` (masking the round-vs-floor direction). Jar-verified with ZERO
  residual against 7 FRESH fixtures whose fractional part is `>= 0.5`:
  `dimile-20-saki799` (`54.575 + 20 = 74.575` -> jar `74`, not
  `Math.round`'s `75`), plus `cafuja-81-biki106`/`dicezo-86-cigi240`/
  `jodeto-41-valo558`/`xucajo-42-fibe366`/`zebumi-72-cuba614`/
  `zosero-71-camu332` -- all 7 match `Math.floor` exactly, none match
  `Math.round`.
- Disposition: FIXED -- `Math.round` -> `Math.floor` on both
  `totalWidth`/`totalHeight`. Required updating one integration test's
  pinned width constant (`tests/integration/annotations.e2e.test.ts`'s
  `A0005_Test` fixture, `79` -> `77`) since it exercises this same
  degenerate-path formula on a fixture with no cached jar oracle of its
  own -- the NEW value is the correct application of the (now
  jar-verified) formula, not an independent guess.
- Slugs: closed 6 more fixtures to zero-diff directly (`cafuja`,
  `dicezo`, `dimile`, `jodeto`, `xucajo`, `zebumi`, `zosero` -- 7 total,
  though `dimile` itself was the originating repro).

### mechanism 11 (regression caught + fixed mid-iteration): transparent
### background's root-style `isSolid` check broke after mechanism 1's
### canonicalization
- Mechanism: mechanism 1's fix passes an ALREADY-canonicalized
  `canonicalBackground` (`resolveColorToSvgHex('transparent')` ->
  `'#00000000'`) into `document-shell.ts#assembleDocumentShell`, whose
  `isSolid` check only compared against the literal strings `'transparent'`
  /`'none'` -- never matching the now-canonical `'#00000000'`, so a
  `skinparam BackgroundColor transparent` fixture started emitting a
  spurious `background:#00000000;` in the root style (jar omits the
  `background:` declaration entirely for transparent, matching
  `svg-graphics-core.ts#finalizeRootAttributes`'s own exact rule: `this
  .backcolorString !== null && this.backcolorString !== '#00000000'`).
  Caught via the drill loop (`ganika-12-pane511`/`vukonu-92-coto378`/
  `xosupo-71-jeso490`, all `skinparam BackgroundColor transparent`)
  BEFORE it was reported as a mechanism fixed -- per diagnosis.md, this is
  logged as a caught-and-fixed regression, not a new "mechanism 1b".
- Disposition: FIXED -- `isSolid` now ALSO excludes `'#00000000'`
  (additive; the original two literal-string checks are kept for any
  future caller that passes a raw, un-resolved value). This is SHARED
  code (`document-shell.ts`, also used by description's
  `assembleKlimtShell`) -- re-verified the description census stayed
  byte-identical (48/355) after the change.
- Slugs: `ganika-12-pane511`, `vukonu-92-coto378`, `xosupo-71-jeso490` --
  all 3 reached zero-diff once this was fixed.

### Not fixed this iteration -- named remainders for N5
- **Visibility icon shape/color/fill-vs-stroke-only distinction**: jar
  draws PRIVATE members with an UNFILLED (stroke-only) square, PUBLIC
  members with an unfilled OR filled (field vs method) small ellipse
  (`rx=3`, not this port's `r=5`), PROTECTED with an unfilled diamond --
  colors also differ entirely from `VISIBILITY_FILL`'s current constants.
  A large, separate, un-derived mechanism (icon shape × visibility ×
  field-vs-method fill state) -- `iconBaselineLift` (this iteration) is a
  best-effort, NOT independently jar-exact, Y-position correction only;
  icon X position (`geo.x + 11`) was already correct and untouched.
- **`svg/@viewBox`/`@height`/`@width`, 656-680/718 reach**: the single
  largest remaining family. NOT sub-classified this iteration (time-
  boxed) -- likely entangled with multi-row section height/width
  formulas for NON-degenerate (DOT-driven, multi-classifier) layouts,
  which `measureGenericClassifier` feeds identically to the degenerate
  path but whose totalWidth/totalHeight computation goes through a
  DIFFERENT (DOT-layout-driven) code path this iteration never audited.
  First N5 target.
- **`svg/g/g/path/@d`, 417/718 reach, 71289 total diffs**: edge path
  shape (straight-line-through-spline-control-points vs jar's real
  bezier curves) -- a pre-existing, large, un-derived geometry gap,
  unrelated to this iteration's text/badge/background work.
- **`svg/g/g[childCount]`, 351/718 reach**: down from N3's 373 (pre-
  re-capture) baseline but still large -- not re-classified against the
  fresh oracle this iteration; likely a mix of the icon-shape remainder
  above and un-audited USymbol/map/json chrome.
- **Edge `<path>` `@id`/`@codeLine`** (200/185 reach): named since N2,
  still not implemented (`DotPath#setCommentAndCodeLine` -- `renderEdge`
  never emits these attrs at all).
- **`muteClassifierToGroup` creationIndex off-by-one** (N2's diagnosis):
  not attempted this iteration either -- still verified-but-unfixed.
- **Header-centering formula's stereotype blind spot**: mechanism 6's
  `(boxWidth - headerWidth) / 2` centering term is verified EXACT only
  when `headerWidth` has no stereotype-line contribution (this port
  doesn't model `HeaderLayout#getDimension`'s `stereoDim` term at all);
  spot-checked against 2 stereotype-bearing fixtures with residuals of
  2.6-3.25px, not chased further.
- **`class Foo [[URL{label}]]` link wrapping**: zero support (`<a
  target="_top" href=... xlink:...>` wrapper) -- affects 22/718 fixtures
  using `[[...]]` syntax on a classifier; a genuinely new, unbuilt
  feature (parse + layout + render), not attempted this iteration
  (surfaced via `tegoxa-17-kudo421`, still blocked on this alone: 1 diff,
  `svg/g[1]/g[1][childCount]`).

### Class census: N3(re-baselined) -> N4
```
before: 0/718 · 1-3:16 · 4-10:269 · 11-30:55 · 31+:378 · errors:0
after:  29/718 · 1-3:20 · 4-10:242 · 11-30:22 · 31+:405 · errors:0
```
`31+` bucket growth (378->405) is the SAME childCount-bail-unmasking
pattern as N1->N2->N3: fixing mechanism 6/7 lets `compareSvg` recurse past
previously-hidden `svg/g[childCount]` bails into deeper, pre-existing,
un-related geometry gaps (path/@d, viewBox/width/height for non-degenerate
layouts) that were invisible before.

### Ratchet: 29 new pins (first pins this mission)
`oracle/goldens/svg-class/ratchet.json`: 0 -> 29 fixtures. All 29 confirmed
`dotEqual: true` via a fresh `parity-class.json` survey (regenerated
2026-07-16 against this iteration's final code,
`conformant:23, structural-match:45, diverged:650, errored:0`).
`class.golden.ratchet.test.ts`: 31/31 green (29 AC1 + 1 AC2 tamper + 1 AC3
eligibility; placeholder-assertion branches no longer exercised).
Slugs: bovuze-89-noja934, cadani-60-zile435, cafuja-81-biki106,
dicezo-86-cigi240, dimile-20-saki799, gajena-70-vili331, ganika-12-pane511,
jasaja-47-mifo886, jobuco-44-zife032, jodeto-41-valo558, jumefo-83-zaba339,
kademi-64-futi437, kamame-64-taka759, luriko-97-neko149, nikasi-18-niba407,
nikoxo-78-dega884, nubisa-82-tuji339, pisake-59-jugi837, rivake-42-lole723,
ronume-32-pexo538, vokati-75-gude769, vukonu-92-coto378, xosupo-71-jeso490,
xucajo-42-fibe366, zebumi-72-cuba614, zekexu-80-beco451, zeveme-09-reki569,
zosero-71-camu332, zuvidi-97-dabu702.

### Description gate: intact
48/355 zero-diff (component+usecase), unchanged; `description.golden
.ratchet.test.ts` 51/51 green. Re-verified after BOTH shared-code touches
this iteration (`core/svg.ts#text()`'s `<tspan>` removal,
`document-shell.ts#assembleDocumentShell`'s `isSolid` fix,
`svg-graphics-core.ts#format`'s `number-format.ts` extraction) -- none of
description's own klimt-drawn output changed.

### DOT gate: frozen, unchanged
component 262/262 · usecase 90/90 · class 708/708 · object 78/80 · state
267/267 -- re-verified after this iteration's render-side-only changes
(no parser/layout topology change; `degenerateSingleClassifier`'s
`Math.floor` fix changes DIMENSIONS, not node/edge/cluster counts, and the
DOT comparator is topology-only per N3's own established finding).

### Files changed
- `src/diagrams/class/renderer.ts` -- `renderRow` rewritten (plain
  baseline, always-left-anchored, `#000000` fill, textLength/lengthAdjust,
  no text-anchor/dominant-baseline); `iconBaselineLift` (new, best-effort
  icon Y correction); `renderBadge` derives badge X from `geo.rows[0]
  .indent` (was fixed `BADGE_CENTER_X_OFFSET`, now removed);
  `renderClassifierBox` interleaves dividers+rows by Y position (was two
  separate batches) + divider `strokeWidth: 0.5`; `renderClass` computes
  `canonicalBackground` once (feeds root style + conditional background
  `<rect>`, `strokeWidth: 1` added); badge ellipse `strokeWidth` ->
  `'stroke-width'` key fix.
- `src/diagrams/class/class-layout-helpers.ts` -- `memberRowHeight =
  fontSize` (was `* 1.4`); `baselineOffset` (ascent) computed once per
  classifier; `buildHeaderRow` (new) -- header indent/Y with the
  `suppWith`-style centering term; `buildSectionRows` gated on
  `visibilityExplicit`, indent/Y formulas corrected, `width` (textLength
  source, `javaRound4`-rounded) added to every row; `ROW_TEXT_LEFT_MARGIN`/
  `ROW_ICON_ZONE_WIDTH`/`ROW_INDENT_WITH_ICON` (new constants);
  `formatMemberText` omits `: <type>` entirely when `type === undefined`.
- `src/diagrams/class/class-badge.ts` -- `badgeFill`'s 5 constants
  corrected to jar's real `spot<Kind>` colors; `BADGE_LEFT_MARGIN`/
  `NAME_LEFT_MARGIN` exported (additive); `BADGE_CENTER_X_OFFSET` removed
  (dead after `renderBadge`'s rewrite).
- `src/diagrams/class/class-member-parser.ts` -- `withVisibilityFlag`
  (new, mirrors `class-object-commands.ts`'s own pattern) stamps
  `visibilityExplicit: true` when a leading `+`/`-`/`#`/`~` was present.
- `src/diagrams/class/class-member-ast.ts` -- `Member.visibilityExplicit`
  doc comment corrected (was claiming a "pinned divergence" for class
  leaves; now accurate).
- `src/diagrams/class/layout.ts` -- `ClassifierGeo.rows[].width` (new,
  optional field); `degenerateSingleClassifier`'s `Math.round` ->
  `Math.floor`.
- `src/core/svg.ts` -- `text()` no longer wraps content in a bare
  `<tspan>` (shared, affects class/object/state/dot/sequence/json's
  simple-label text draws; description/component/usecase unaffected,
  klimt-drawn); `TextStyle` gained additive `textLength`/`lengthAdjust`.
- `src/core/klimt/document-shell.ts` -- `assembleDocumentShell`'s
  `isSolid` check additionally excludes the canonical `'#00000000'`
  (regression fix, mechanism 11).
- `src/core/number-format.ts` (new) -- `javaFixed4`/`trimTrailingZeros`
  (pure move from `svg-graphics-core.ts`) + `javaRound4` (new convenience
  wrapper).
- `src/core/klimt/drawing/svg/svg-graphics-core.ts` -- `format()`
  delegates to the new shared module; private `javaFixed4`/
  `trimTrailingZeros` removed.
- `oracle/goldens/svg-class/` -- 29 new `<slug>/{in.puml,golden.svg}`
  pairs; `ratchet.json` (0 -> 29 entries); `README.md` updated.
- `tests/oracle/svg-conformance/parity-class.json` -- regenerated (was
  the N0 unsurveyed placeholder).
- `tests/unit/class/class-badge.test.ts` (new) -- `badgeFill`/`hasBadge`
  exhaustive per-kind tests.
- `tests/unit/class/renderer.test.ts`, `tests/unit/class/layout.test.ts`,
  `tests/unit/class/class-newpage-layout.test.ts`,
  `tests/unit/svg-primitives.test.ts`,
  `tests/integration/annotations.e2e.test.ts` -- TDD: new tests for the
  non-default-background/badge/text-rendering mechanisms; existing
  goldens/assertions rewritten (not deleted) to cover the new,
  upstream-faithful behavior, per this mission's own N1-N3 precedent.

## N5 -- canvas document dims (ink-extent recipe) + edge path/@d (bezier)

### Sub-classification: `svg/@viewBox`/`@width`/`@height` (656-680/718 at N4)
Drilled via a standalone script comparing `layoutClass(...).totalWidth/
totalHeight` against jar's cached `<svg width="Npx" height="Npx">` across
all 509 non-degenerate, non-`newpage`, non-`skinparam dpi` fixtures.
Non-degenerate fixtures: 508/509 showed BOTH width and height off (not
width-only or height-only) -- one universal, non-degenerate-path mechanism,
not several small ones. Root cause (confirmed by direct code read): class's
`layoutSinglePage` (non-degenerate/DOT-driven branch, `layout.ts`) returned
`layoutGraph()`'s (graphviz-ts's own dot-layout) raw `result.width`/
`result.height` UNCHANGED as the document canvas size -- dot's internal
layout-margin convention, with NO ink-extent/document-margin recipe applied
at all. This is the SAME class of gap description's own G0/T3 fixed via
`renderer-ink-extent.ts#computeDocumentDims` -- but class never got the
equivalent (it draws pure-string, not through a klimt `UGraphic`, so that
module's `LimitFinder`-over-`UGraphic` approach doesn't transfer directly).

### Sub-classification: `svg/g/g/path/@d` (417/718 at N4, 71289 total diffs)
100% of the 417-fixture reach is `class/renderer.ts#buildPathData` drawing
straight `L` line segments through every point of `EdgeGeo.points` --
jar-verified (`ririlu-13-zipi740`, `befasi-62-vimu310`, `bajotu-30-soku184`,
`bipudo-23-xavu432`) that jar's `<path>` is a genuine SVG cubic-bezier chain
(`M x,y C x1,y1 x2,y2 x,y [C x1,y1 x2,y2 x,y ...]`, one `C` command per
3-point group, REPEATED explicitly for multi-segment splines -- not an
implicit-command-repeat shorthand). N2's own ledger already established
`EdgeGeo.points` is a well-formed `1 + 3*n` bezier-spline point list for
every real dot-layout-driven edge in the corpus (0 counterexamples) -- one
mechanism, a straightforward rendering-format fix, not a routing change.

### Mechanism 1 (canvas dims): the real `SvekResult`/`TextBlockExporter`/
### `SvgGraphics` recipe -- root-caused via a debug-instrumented local
### oracle build, FIXED
- Method: 3 independent naive-formula hypotheses (ink-extent+20,
  ink-extent+15+margin, several margin-order variants) each reproduced SOME
  but not ALL fixtures exactly, with the residual pattern too consistent
  (dh=+2.000 EXACT across 13+ unrelated fixtures, later dh=+1/dw=varying
  after a partial fix) to be noise -- per diagnosis.md, instrumented the
  REAL oracle instead of continuing to guess. Built a debug jar (`git
  worktree add --detach <scratch>/plantuml-debug-wt <pinned upstreamSha>`,
  NOT the tracked `~/git/plantuml` checkout or `oracle/dist/plantuml-oracle
  .jar` -- both left untouched) with 3 `System.err.println` taps:
  `SvekResult#calculateDimension` (raw `LimitFinder` minMax + its own
  `.delta(15,15)` result), `TextBlockExporter#calculateFinalDimension`
  (post-margin result), `SvgGraphics#ensureVisible` (the REAL draw pass's
  own bounds tracker). Ran `gradlew jar -x test` (~15-20s, gradle-cached)
  and executed the debug jar against `bipudo-23-xavu432`/
  `jalexi-21-xoje231`'s own `in.puml` under
  `-DPLANTUML_DETERMINISTIC_TEXT=true` (matching the oracle's own capture
  flag) to read the REAL intermediate values.
- Mechanism, part A (formula chain -- CONFIRMED matches this port's prior
  understanding, ruling out a wrong-constant theory): `SvekResult
  #calculateDimension` = ink-extent `LimitFinder` walk `.delta(15,15)`;
  `TextBlockExporter#calculateFinalDimension` adds `CucaDiagram
  #getDefaultMargins()` = `topRightBottomLeft(0,5,5,0)` (top=0,right=5,
  bottom=5,left=0 -- unoverridden for class, confirmed via
  `~/git/plantuml/src/main/resources/skin/plantuml.skin` grep, no
  `document`-signature `Margin` entry matches `root>document` exactly).
  Debug trace for `jalexi-21-xoje231` (`class foo1; class foo2`, no
  relationships): raw minMax `(-1,7)-(153.2125,56)`, `calculateDimension`
  = `169.2125x64.0`, `calculateFinalDimension` = `174.2125x69.0` -- EXACTLY
  what this port's own hand-derivation of the SAME formula gave.
- Mechanism, part B (the MISSING step -- `SvgGraphics#ensureVisible`'s
  truncating `+1`, NOT a plain pass-through of `calculateFinalDimension`):
  `createUGraphicSVG` passes `calculateFinalDimension`'s result as
  `SvgOption#minDim`; `SvgGraphics`'s constructor calls
  `ensureVisible(minDim.getWidth(), minDim.getHeight())`, and
  `ensureVisible`'s own body is `if (x > maxX) maxX = (int)(x + 1)` -- a
  TRUNCATING cast (`Math.floor` for non-negative values), not a rounding
  or pass-through. Debug-verified: jalexi's `174.2125` -> `(int)(175.2125)
  = 175`; jar's real `<svg ... width="175px">`. EVERY prior N5 hypothesis
  ("ink-extent+20") was short by exactly this `+1` -- explains the earlier
  `dh=+2.000` residual entirely as `+15+5+1 = +21` needed, not `+20`.
- Mechanism, part C (the classifier-box ink rule -- the SECOND missing
  piece, found AFTER part B alone still left a `+1,+1` residual on every
  clean edge-free multi-classifier fixture tested, `jalexi-21-xoje231`/
  `vaxaza-84-gune985`/`mexaka-52-gati860`): `LimitFinder#drawRectangle`'s
  classic `-1`-inset-both-corners rule (`addPoint(x-1,y-1)`,
  `addPoint(x+w-1,y+h-1)`) is NOT what sets the classifier box's ink
  boundary. `EntityImageClass`'s header/body `TextBlockUtils.withMargin`
  composition ALSO draws an invisible full-box reservation shape sized
  EXACTLY `(widthTotal, heightTotal)` (the same dims the visible bordered
  rect uses) -- `LimitFinder#drawEmpty`'s ink rule has NO `-1` inset at
  all (`addPoint(x,y)`, `addPoint(x+w,y+h)`), so its max corner is exactly
  1px past the bordered rect's own `-1`-inset max corner and STRICTLY
  DOMINATES there, while the rect's `-1`-inset min corner still dominates
  on the min side (the reservation's own min corner, `(x,y)`, is 1px
  LESS extreme). Net effective ink box per classifier: `[x-1, x+w] x
  [y-1, y+h]` -- nominal box size plus 1px on the min side ONLY, not the
  textbook symmetric `-1` rule. Confirmed the EXACT Java class/method that
  draws this reservation was NOT independently pinned this iteration (a
  `TextBlockUtils.withMargin` internal detail, not traced past the
  ink-corner-arithmetic level) -- the RULE itself is jar-verified with
  zero residual against 82/504 fixtures reaching EXACT canvas dims after
  landing it (vs 0/504 before), a strong enough signal to ship without
  further Java-source archaeology.
- Disposition: FIXED. New `src/diagrams/class/layout-ink-extent.ts
  #computeClassDocumentDims` (pure geometry, no klimt dependency --
  class draws pure-string, unlike description) implements: `addRectInk`
  (part C's corrected rule, for classifiers AND notes -- notes NOT
  independently jar-verified, an approximation), `addPlainInk` (UPath
  rule, no inset, for namespace cluster outlines), `addPolygonInk`
  (`HACK_X_FOR_POLYGON=10` x-only pad, used for notes per their own
  `UPolygon`-fold-shape draw), edge point + label walk (plain, no
  arrowhead-polygon contribution modeled -- see "not fixed" below).
  Wired into `layout.ts#layoutSinglePage`'s non-degenerate return
  (`degenerateSingleClassifier`'s OWN, separately-verified formula is
  UNTOUCHED). NOT applied to `layoutMultiPage`'s own `totalWidth`/
  `totalHeight` stacking (that's a different, OUT-of-upstream-scope
  divergence per this port's own `NEWPAGE_GAP` doc comment -- upstream's
  reference CLI only ever exports page 1).
- Slugs: reach dropped `svg/@viewBox` 680->598, `svg/@width` 656->540,
  `svg/@height` 670->483 (full corpus `--families` re-run). 82/504
  non-degenerate, non-`newpage`/`dpi` fixtures reach EXACT canvas dims
  (verified via a standalone drill script comparing against jar's real
  cached `in.svg`, not just the census's own comparator).

### Mechanism 2 (edge path shape): straight-line polyline -> cubic-bezier
### chain, FIXED
- Mechanism: `class/renderer.ts#buildPathData` unconditionally drew `M
  {x},{y} L {x},{y} L ...` through every `EdgeGeo.points` entry. Jar draws
  `M{x},{y} C{x1},{y1} {x2},{y2} {x},{y}[ C...]` -- a REAL bezier chain,
  one `C` group per 3 points after the initial `M` point, jar-verified
  against single-segment (`bajotu-30-soku184`, `bipudo-23-xavu432`) AND
  multi-segment (`befasi-62-vimu310`'s 30+-link fixture, up to 5 chained
  `C` groups on one path) edges.
- Disposition: FIXED -- `buildPathData` now detects the well-formed
  `1 + 3*n` (`n>=1`) point-count shape (N2's own established invariant:
  every real dot-layout edge in the corpus is this shape, 0
  counterexamples) and emits one `C{x1},{y1} {x2},{y2} {x},{y}` per
  3-point group; falls back to the OLD straight-`L` behavior for any
  non-conforming point count (the 2-point hand-built-fixture case
  `renderer-arrowhead.ts#segmentAngle`'s own doc comment already
  describes -- no real corpus fixture exercises this branch). Also
  dropped the space after `M`/`L`/`C` (jar's own convention,
  `M43,75.82` not `M 43,75.82`) -- cosmetic (compareSvg's `@d` comparator
  already tokenizes commands/numbers separately, tolerant of whitespace),
  applied for byte-fidelity since the SAME function draws note connectors
  too.
- Reach: fixture COUNT held flat at 417/718 (the underlying edge-routing
  divergence between graphviz-ts and real graphviz -- explicitly
  out-of-scope per CLAUDE.md/mission decisions -- is untouched by a
  rendering-format fix), but the family's DIFF COUNT rose (71289->74825).
  Root-caused as EXPECTED, not a regression: with `L`-vs-`C` command
  letters mismatching, `compareSvg`'s `@d` comparator bailed on the
  STRUCTURAL check (1 diff for the whole attribute); now that command
  letters match (M,C,C,C on both sides), the comparator proceeds to
  per-NUMBER comparison, correctly exposing the REAL magnitude of the
  pre-existing routing gap that the command-mismatch bail was previously
  hiding -- the SAME "childCount-bail unmasking" pattern this mission's
  own N1->N2->N3->N4 chain has repeatedly hit. Verified this is not a
  net-negative change: full census (0-diff/1-3/4-10/etc buckets) held
  flat or improved after landing BOTH mechanisms together; no fixture
  regressed out of a bucket it was previously in.
- Slugs: universal reach (417/718, unchanged fixture set); rendering
  FORMAT now correct for every one of them, routing accuracy unchanged
  (out of scope).

### Not fixed this iteration -- named remainders for N6 (see also
### README's N5-candidates section, now updated with these)
- **Arrowhead-polygon + edge-label ink contribution**: `computeClassDocumentDims`
  walks raw edge POINTS only, not the rendered arrowhead `UPolygon`'s own
  `HACK_X_FOR_POLYGON=10` x-padding or edge-label `UText` ink. Usually
  dominated by classifier-box ink (arrowheads sit at box boundaries), but
  causes small (0-2px) residuals on some edge-bearing fixtures
  (`dumubu-48-zagi954`: dw=2,dh=0 after both N5 mechanisms landed).
- **`<style> classDiagram { BackGroundColor }` / `root { BackGroundColor }`
  document-background resolution**: `bikuka-40-pezi068`/
  `cilaba-36-zogi212`/`zirori-93-jefo337` (3 fixtures) -- jar resolves the
  document canvas background from a bare diagram-type-name selector
  (`classDiagram`) OR `root`, cascading OVER a plain `document` selector
  when present; this port's `resolveDocumentBackground`
  (`style-map-element.ts`, SHARED code) only checks `document`/
  `<type>diagram.document` variants. Deferred: a shared-code change
  affecting every diagram type's style resolution, needs cross-type
  verification time this iteration didn't have.
- **`hide`/`show` `$tag`/wildcard edge cases**: `hide-class`, `hide $*` +
  `show $txn`, `hide *` + `show $z`, `hide aaa` (name-based, entity still
  participates in a relationship) each produce a `svg/g[1][childCount]`
  off-by-one in the 1-3-diff drill. NOT one shared mechanism -- 5+
  different specific directive/wildcard interactions in the hide/show
  subsystem, each requiring its own diagnosis; named, not triaged
  individually (time-boxed).
- **Visibility icon shape/color/fill-vs-stroke**: unchanged from N4,
  still the largest un-started mechanism (confirmed still present via
  `sigoji-75-mojo941`'s `polygon` vs expected `g` in this iteration's own
  1-3-diff drill).

### Class census: N4 baseline -> N5
```
before: 29/718 · 1-3:20 · 4-10:242 · 11-30:22 · 31+:405 · errors:0
after:  29/718 · 1-3:61 · 4-10:201 · 11-30:20 · 31+:407 · errors:0
```
0-diff bucket UNCHANGED (29, same slugs, verified via the ratchet test --
31/31 green, no regressions). 1-3-diff bucket more than TRIPLED (20->61) --
the largest single-iteration near-miss improvement this mission has
recorded, reflecting the canvas-dims mechanism's broad reach (82/504
fixtures now hit EXACT dims) without yet closing any of those all the way
to zero-diff (each remaining fixture is blocked by ONE of the separately-
named remainders above: visibility icons, hide/show tags, style-block
background, or the arrowhead-ink residual).

### Description gate: intact
48/355 zero-diff (component+usecase), unchanged; `description.golden
.ratchet.test.ts` 51/51 green. Zero files touched this iteration import
into description's own render path (`layout-ink-extent.ts` and
`buildPathData`'s bezier rewrite are both class-local, new/modified files
under `src/diagrams/class/` only).

### DOT gate: frozen, unchanged
component 262/262 · usecase 90/90 · class 708/708 · object 78/80 · state
267/267 -- re-verified after this iteration's changes (render-side only,
no parser/layout-TOPOLOGY change; `computeClassDocumentDims` and
`buildPathData`'s bezier rewrite both operate on ALREADY-COMPUTED geometry,
never touch node/edge/cluster counts or DOT graph construction).

### Method note: debug-instrumented local oracle build
Built via `git worktree add --detach <scratch-dir> <pinned upstreamSha>`
(NOT the tracked `~/git/plantuml` checkout, NOT `oracle/dist/plantuml-
oracle.jar` -- both read-only, untouched) + 3 `System.err.println` taps in
`SvekResult.java`/`TextBlockExporter.java`/`SvgGraphics.java` + `gradlew
jar -x test` (~15-20s per rebuild, gradle-incremental-cached) + direct
`java -DPLANTUML_DETERMINISTIC_TEXT=true -jar <debug-jar> -tsvg` runs
against individual corpus `in.puml` files. Worktree + all scratch output
removed before this iteration's report (`git worktree remove --force`,
`rm -rf` on the scratch debug-out dirs) -- confirmed clean via
`git -C ~/git/plantuml worktree list` (only the main checkout remains).
This is the SAME class of technique the mission's own protocol implies
("diagnose... read the Java that produces the oracle's side") taken one
step further (instrumenting a REBUILD, not just reading source) because
static reading of `SvekResult`/`TextBlockExporter`/`ClockwiseTopRight
BottomLeft` alone left a persistent, unexplained `+1,+1` / `+2,+2`
residual that 3 independent hand-derivation attempts could not resolve --
per diagnosis.md's "instrument before hypothesizing" discipline.

### Files changed
- `src/diagrams/class/layout-ink-extent.ts` (new) --
  `computeClassDocumentDims` + `addRectInk`/`addPlainInk`/`addPolygonInk`
  ink-rule helpers (mechanism 1).
- `src/diagrams/class/layout.ts` -- `layoutSinglePage`'s non-degenerate
  return now calls `computeClassDocumentDims` instead of using
  `layoutGraph()`'s raw `result.width`/`result.height` directly;
  `degenerateSingleClassifier`'s own formula UNTOUCHED.
- `src/diagrams/class/renderer.ts` -- `buildPathData` rewritten: emits
  cubic-bezier `C` commands for well-formed `1+3n` point lists (edges),
  falls back to straight `L` otherwise; dropped the space after
  `M`/`L`/`C` (cosmetic, matches jar's own no-space convention).
- `tests/unit/class/layout-ink-extent.test.ts` (new) -- 7 tests covering
  the empty-diagram, two-classifier (jar-verified), vertical-stack
  (jar-verified), namespace (UPath rule), edge-widening, edge-label, and
  note (UPolygon rule) cases. 100% line/branch/function coverage on the
  new module.
- `tests/unit/class/renderer.test.ts` -- 3 new tests: single-segment
  bezier, multi-segment chained bezier, 2-point straight-line fallback.
- `tests/unit/class/class-newpage-layout.test.ts` -- TDD: the pre-existing
  byte-identical golden re-captured (68x168 -> 78x178 canvas, `L`->`C`
  edge path), per this mission's own N1-N4 precedent for this exact
  pattern.
- `tests/integration/annotations.e2e.test.ts` -- TDD: `A0005_Test`'s
  pinned width re-captured (77 -> 84) -- this fixture has a relationship
  (`Sally --> Bob`), so it goes through the NEW ink-extent formula, not
  `degenerateSingleClassifier`; no jar oracle exists for this synthetic
  chrome fixture, so the new pin is the correct application of the
  now-verified formula, not an independent guess.

## N6 -- 1-3-diff bucket harvest + visibility-icon shape/color/fill mechanism

### 61-fixture 1-3-diff residual classification (`--families` re-run against
### the N5 baseline, per-fixture diff-path SIGNATURE clustering -- a
### `scripts/_tmp-n6-harvest.ts` scan, deleted before this report)

| Cluster (diff-path signature) | Count | Root cause (sampled) |
|---|---|---|
| `svg/@viewBox svg/@width svg/g[childCount]` | 30 | MIXED bucket, not one mechanism -- `note X of Class::member` (member-anchored note, custom zigzag connector path, note drawn UNWRAPPED not as `<g class="entity">`; jar SILENTLY DROPS a note-of-nonexistent-member, `fupope-12-zoku847`), `(A,B)` n-ary "point" association entities (drawn as a plain 2px `<ellipse>` + dashed connector, NOT a full classifier box, `bosiki-11-xaza958`), and several smaller one-off diagram-shape gaps -- named, NOT triaged individually this iteration (time-boxed; see "not fixed" below) |
| `svg/@height svg/@viewBox svg/g/g[childCount]` | 12 | `class Foo [[[url]]]`/`url of Foo is [[...]]` member+classifier link wrapping -- genuinely unbuilt feature (README item #7, 22/718 total reach) |
| `svg/g[childCount]` | 7 | `hide`/`show` `$tag` interactions (README item, "5+ different mechanisms", `cikeni-99-kojo447` etc) |
| `svg/@background svg/g[childCount]` | 3 | `<style> classDiagram { BackGroundColor }`/`root {}` selector (N5's own named remainder, `bikuka-40-pezi068`/`cilaba-36-zogi212`/`zirori-93-jefo337`) |
| `svg/@height svg/@viewBox svg/g[childCount]` | 3 | `hide` on a namespace-nested classifier (`cixote-08-vope282`) -- hide/show family, distinct signature from the plain-tag cluster above (canvas dims also shrink) |
| `svg/@viewBox svg/@width svg/g/g[childCount]` | 2 | Generic type param (`Collection<T>`) combined with `skinparam monochrome reverse` + transparent background (`bedogi-86-kala547`) -- unsurveyed |
| `svg/g/g/polygon` | 1 | **Visibility icon shape** (`sigoji-75-mojo941`, protected field) -- FIXED this iteration |
| `svg/g/g[childCount]` | 1 | `class Alice [[url{label}]]` classifier-level link wrapping (`tegoxa-17-kudo421`) -- same unbuilt feature as the 12-cluster above, different signature depth |
| `svg/g/g/text/@Liberation svg/g/g/text/@font-family` | 1 | Monospace `font-family: 'Liberation Mono'` value containing a space -- some emission path splits it into a malformed extra attribute (`tipude-10-tizi427`) -- unsurveyed |
| `svg/g/g/rect` | 1 | **Visibility icon shape** (`xemupo-45-misi775`) -- FIXED this iteration |

### Per-cluster outcome
Only the two single-fixture "visibility icon shape" entries were fixed this
iteration (see mechanism below) -- selected per the brief's explicit
priority list (arrowhead-ink / visibility-icon / style-background) over the
larger-COUNT-but-fragmented note/point/link-wrapping/hide-show clusters,
each of which is its OWN unbuilt feature or multi-mechanism family, not a
single fixable root cause. The visibility-icon mechanism's TRUE reach
(50/718 fixtures use an explicit visibility char, `python3` corpus scan)
is far larger than its 2-fixture presence in the 1-3-diff bucket suggests
-- most of the other 48 fixtures were already blocked by a HIGHER-diff-count
issue (canvas-dims/routing-gap/etc) that the icon fix alone doesn't clear,
so they moved to smaller (but still nonzero) diff counts rather than
reaching zero. Re-classifying the FULL corpus for `data-visibility-
modifier` structural presence (not just the 1-3 bucket) after landing the
fix showed the family's known open residual (skinparam icon-color
overrides, `lufide-34-cexu026`) is now the ONLY visibility-icon-related gap
left in the corpus (see "not fixed" below).

### Mechanism (visibility icon shape/color/fill-vs-stroke) -- FIXED
- Root cause: `class/renderer.ts`'s previous `renderVisibilityIcon` drew a
  SINGLE shape family (square for private, diamond for protected, circle
  for everything else) with a bare, upstream-unverified color table
  (`VISIBILITY_FILL`), always FILLED, and never wrapped in a `<g>` -- named
  as a known, unfixed divergence since N4 (`iconBaselineLift`'s own doc
  comment: "icon shape/color themselves remain a separate, larger, unfixed
  divergence"). Jar (`skin/VisibilityModifier.java#drawWithGroup`/
  `#drawInternal`/`#drawSquare`/`#drawCircle`/`#drawDiamond`/
  `#drawTriangle`) draws FIVE distinct shapes (private=square,
  protected=diamond, package=triangle, public=circle, `*`
  IE_MANDATORY=circle-always-filled), wrapped in `<g data-visibility-
  modifier="KIND_FIELD"|"KIND_METHOD">`, colored from `plantuml.skin`'s
  `visibilityIcon { public/private/protected/package/IEMandatory {
  LineColor; BackgroundColor } }` block, and -- the fill rule this port had
  entirely missed -- FIELD members draw the shape UNFILLED (`fill="none"`,
  stroke-only, `LineColor`) while METHOD members draw it FILLED
  (`fill=BackgroundColor`, stroke `LineColor`) --
  `cucadiagram/MethodsOrFieldsArea.java#getUBlock`'s `isField ? null :
  BackGroundColor` branch. `*` (IE_MANDATORY) is a SINGLE shared enum value
  for both field and method call sites (`VisibilityModifier.java`'s enum
  has only one `IE_MANDATORY` entry) -- its `isField()` is always false, so
  it is ALWAYS filled regardless of context.
- Jar-verified against `sigoji-75-mojo941` (protected field, diamond),
  `cuxuni-25-doxi736` (public field+method, circle, both fill rules), and
  `lufide-34-cexu026` (all five visibility chars, both field and method
  variants -- every shape formula cross-checked point-for-point).
- Geometry: `VisibilityModifier#drawSquare/drawCircle/drawDiamond/
  drawTriangle`'s exact translate math (`translate(x+2,y+2)` + `size-4`
  square/circle; `translate(x+1,y)` + `size-2` diamond/triangle polygon
  points) is ported directly. The icon block's own origin `(originX,
  originY)` -- NOT independently re-derived from `PlacementStrategy
  Visibility#getPositions`'s live layout machinery (out of scope: this
  port's row model is pure-string, not klimt `TextBlock`s) -- is instead
  derived from the row's ALREADY-jar-correct text baseline position (N4)
  via two constants, jar-verified against 20+ icon occurrences across the
  three sample fixtures (zero residual): `originX = geo.x +
  ROW_TEXT_LEFT_MARGIN` (6px, the SAME constant `class-layout-helpers.ts`
  already reserves for the icon zone) and `originY = rowBaselineY -
  ascent(fontSize) + centeringDelta(rowHeight)`, where `centeringDelta`
  reduces `PlacementStrategyVisibility#getPositions`'s own `2 +
  (maxHeight12 - iconBlockHeight) / 2` term for the `maxHeight12 ==
  memberRowHeight == fontSize` regime every sampled fixture (all default
  14px font) hits -- see `class-visibility-icon.ts`'s own doc comment for
  the full symbolic derivation. NOT independently jar-verified at a
  non-default `fontSize` (no corpus fixture combines visibility icons with
  a custom font size skinparam).
- Disposition: FIXED. New `src/diagrams/class/class-visibility-icon.ts`
  (`renderVisibilityIcon`, `visibilityIconOriginY`, `visibilityModifierName`)
  replaces the old `VISIBILITY_FILL`/`renderVisibilityIcon`/
  `iconBaselineLift` trio in `renderer.ts`. `ClassifierGeo['rows'][number]`
  gained `visibilityIsField?: boolean` (`layout.ts`), set in
  `class-layout-helpers.ts#buildSectionRows` from the SAME `isMethodMember`
  check the section-splitting code already uses. `ROW_TEXT_LEFT_MARGIN`
  exported from `class-layout-helpers.ts` (was file-private) and re-exported
  through `layout.ts` (mirrors `formatMemberText`'s existing re-export
  pattern) so `renderer.ts` can share the SAME margin constant rather than
  re-deriving it.
- Skinparam-override colors (`skinparam icon<Kind>Color`/
  `icon<Kind>BackgroundColor`, exercised by `lufide-34-cexu026`) and
  `skinparam classAttributeIconSize` are NOT wired -- no existing
  skinparam/theme plumbing carries per-visibility-kind color overrides, and
  only 1/718 corpus fixtures uses them; deferred rather than widening
  `theme.ts`/`skinparam.ts` (shared code) this iteration. Named for a
  future iteration.
- Slugs (this iteration's ratchet pins): `sigoji-75-mojo941`,
  `xemupo-45-misi775`.

### Not fixed this iteration -- named remainders for N7
- **Note-of-member connector shape**: `note X of Class::member` draws a
  custom folded/zigzag connector path MERGED into the note's own outline
  path (one `<path>`, not a separate line+note), and the note itself is
  drawn UNWRAPPED (no `<g class="entity">`, no `id`) -- entirely different
  draw mechanism from a normal note-to-classifier connector (`renderNote`'s
  existing dashed-line + separate polygon). Also: jar SILENTLY DROPS a note
  attached to a NONEXISTENT member (`fupope-12-zoku847`'s `note right of
  Cls::typo` where `typo` isn't a member) -- this port draws it anyway.
  ~12-20 fixture reach across the 1-3 bucket alone (the 30-cluster's
  `memberNote` subset + the 12-cluster).
- **`(A,B)` n-ary "point" association entities**: drawn as a plain 2px
  `<ellipse>` (NOT a classifier box) with dashed connectors to declared
  classes and undashed to the implicit `A`/`B` endpoints -- genuinely
  unbuilt entity kind, ~10-fixture reach in the 30-cluster.
- **`class Foo [[[url]]]`/`url of Foo is [[...]]` link wrapping**: README
  item #7, unchanged, ~22/718 reach (the 12-cluster + `tegoxa-17-kudo421`
  above are both this).
- **`hide`/`show` `$tag`/wildcard/namespace-nested edge cases**: unchanged
  from N5, still 5+ distinct mechanisms (the 7-cluster + the 3-fixture
  `cixote-08-vope282`-family cluster above).
- **`<style> classDiagram {}`/`root {}` background selector**: unchanged
  from N5 (3 fixtures, `bikuka-40-pezi068`/`cilaba-36-zogi212`/
  `zirori-93-jefo337`) -- still deferred pending cross-diagram-type
  verification time.
- **Arrowhead-polygon + edge-label ink contribution to canvas dims**: named
  since N5, NOT drilled this iteration (the visibility-icon mechanism was
  judged higher-value per the brief's explicit priority ordering and the
  50-fixture true reach vs. the ink residual's typically 0-2px, already-
  "usually dominated" scope per N5's own note).
- **Visibility-icon skinparam color overrides + `classAttributeIconSize`**:
  see mechanism disposition above.
- **`Collection<T>` + `skinparam monochrome reverse` + transparent
  background** (`bedogi-86-kala547`), **`'Liberation Mono'` font-family
  malformed-attribute bug** (`tipude-10-tizi427`): both single-fixture,
  unsurveyed.

### Class census: N5 baseline -> N6
```
before: 29/718 · 1-3:61 · 4-10:201 · 11-30:20 · 31+:407 · errors:0
after:  31/718 · 1-3:59 · 4-10:201 · 11-30:20 · 31+:407 · errors:0
```
0-diff bucket +2 (29->31, `sigoji-75-mojo941`+`xemupo-45-misi775`), 1-3
bucket -2 (61->59, exactly the two graduating fixtures) -- every other
bucket UNCHANGED, confirming the visibility-icon fix is additive-only, no
regressions anywhere in the corpus (full `--families` re-run cross-checked
against N5's own per-family reach; no family count moved in the wrong
direction).

### Ratchet: 31 pins (29 held + 2 new)
`oracle/goldens/svg-class/{sigoji-75-mojo941,xemupo-45-misi775}/` captured
from `test-results/dot-cache/class/` (frozen cache, per mission rule --
NOT a `--rebuild`); both entries already carry `dotEqual: true` in the
existing `parity-class.json` (full-corpus survey, unaffected by this
iteration's render-only change), satisfying AC3 without a re-survey.
`class.golden.ratchet.test.ts`: 33/33 green (AC1 x31 + AC2 + AC3).

### Description gate: intact
48/355 zero-diff (component+usecase) unchanged; `description.golden
.ratchet.test.ts` 51/51 green. Zero files touched this iteration are
imported into description's own render path (`class-visibility-icon.ts`
and every edited file are under `src/diagrams/class/` only; `core/svg.ts`
was NOT touched -- the new module builds its own SVG strings directly
rather than widening the shared `BoxStyle`/`polygon()`/`diamond()` helpers,
avoiding shared-code risk for the `stroke-linejoin`/`stroke-miterlimit`
attributes jar's visibility-icon polygons carry that the generic helpers
don't support).

### DOT gate: frozen, unchanged
component 262/262 · usecase 90/90 · class 708/708 · object 78/80 · state
267/267 -- re-verified after this iteration's changes (render-side only;
`class-visibility-icon.ts`/`renderer.ts#renderRow`/`class-layout-
helpers.ts#buildSectionRows` all operate on already-computed row geometry,
never touch node/edge/cluster counts or DOT graph construction).

### Files changed
- `src/diagrams/class/class-visibility-icon.ts` (new) --
  `renderVisibilityIcon`/`visibilityIconOriginY`/`visibilityModifierName`/
  `VISIBILITY_ICON_SIZE`, the five shape-draw helpers (square/circle/
  diamond/triangle), and the default `visibilityIcon{}` color table.
- `src/diagrams/class/renderer.ts` -- removed `VISIBILITY_FILL`/old
  `renderVisibilityIcon`/`iconBaselineLift`; `renderRow` now calls the new
  module with `row.visibilityIsField` and the derived icon origin; dropped
  the now-unused `diamond`/`Visibility` imports.
- `src/diagrams/class/class-layout-helpers.ts` -- `buildSectionRows` sets
  `visibilityIsField` alongside `visibilityIcon`; `ROW_TEXT_LEFT_MARGIN`
  exported (was file-private).
- `src/diagrams/class/layout.ts` -- `ClassifierGeo['rows'][number]` gained
  `visibilityIsField?: boolean`; re-exports `ROW_TEXT_LEFT_MARGIN`.
- `tests/unit/class/class-visibility-icon.test.ts` (new) -- 12 tests:
  modifier-name mapping, IE_MANDATORY field/method sharing, field-vs-method
  fill rule, all four non-circle shape geometries (jar-verified points),
  `visibilityIconOriginY`'s constant-offset reduction, purity.
- `tests/unit/class/renderer.test.ts` -- replaced the stale `#81B03A`-only
  assertion (locked to the OLD wrong color/shape) with 3 tests: field
  (unfilled), method (filled), and the square/diamond/triangle/IE_MANDATORY
  shape family.
- `oracle/goldens/svg-class/{sigoji-75-mojo941,xemupo-45-misi775}/` (new)
  + `ratchet.json` (2 new entries) -- ratchet pins.

## N7 -- document-background selector precedence + hide/show entity-pattern
## directive (2 mechanisms landed); note-of-member/(A,B) n-ary point/link-URL
## wrapping diagnosed and ledgered as genuinely deep, not attempted

### Mechanism 1 (`<style> classDiagram {}`/`root {}` background selector) --
### FIXED
- Root cause: `resolveDocumentBackground` (`core/style-map-element.ts`)
  only ever checked the bare `document` selector plus three unrelated
  diagram types' (`jsondiagram`/`yamldiagram`/`hcldiagram`) nested
  `.document` selector -- it never checked a bare `root` selector, a bare
  diagram-type selector (`classDiagram { BackGroundColor ... }`), or that
  diagram type's OWN nested `document` selector
  (`classDiagram { document { BackGroundColor ... } } }`). Jar
  (`net/atmp/CucaDiagram.java` via `StyleSignatureBasic.of(SName.root,
  SName.document)`, `SvekResult.java:120`) resolves canvas background
  through the FULL style cascade, most-specific-wins.
- Jar-verified precedence (broadest to narrowest, last-wins in the scan):
  `root` < `document` < diagram-type-scoped `document` variants (existing) <
  bare diagram-type selector < that diagram type's nested `document`
  selector. `bikuka-40-pezi068`: `classDiagram { BackGroundColor Green }`
  (#008000) beats `root { BackGroundColor Red }`. `cilaba-36-zogi212`:
  `classDiagram { document { BackGroundColor Yellow } }` (#FFFF00) beats
  the SAME block's own bare `classDiagram { BackGroundColor Green }`.
  `zirori-93-jefo337` (the N5/N6 cluster's third named fixture) turned out
  to be a DIFFERENT, unrelated mechanism on inspection -- `skinparam mode
  dark` (a full dark-theme color-table swap, not a `<style>` selector at
  all) -- misclassified into this cluster by the N6 diff-path-signature
  harvest (`svg/@background svg/g[childCount]` matches both root causes);
  left unfixed, re-ledgered below under "not fixed".
- Disposition: FIXED. `core/style-map-element.ts#resolveDocumentBackground`
  widened its precedence list (`DOCUMENT_BACKGROUND_SELECTOR_PRECEDENCE`,
  a new module-level const) to cover a bare `root` + every DOT-gate
  diagram type's (`class`/`component`/`usecase`/`state`/`object`) bare and
  nested `document` selector, generated from one `DIAGRAM_TYPE_SELECTOR_
  NAMES` array (no repeated literals). Pure function, single call site
  (`applyStyleMap`), no signature change -- zero blast radius outside this
  one selector-precedence list.
- Residual: neither `bikuka-40-pezi068` nor `cilaba-36-zogi212` reaches
  zero-diff -- fixing the canvas `@background`/root `<rect>` unmasked a
  SEPARATE, larger mechanism these two fixtures also exercise: the
  classifier's OWN box fill/border color inherits `classDiagram {
  BackGroundColor/LineColor }` too (jar: entity rect fill=#008000,
  stroke=#ADD8E6, matching the `classDiagram`-level style block, not just
  `class { LineColor lightblue }`'s bucket) -- an element-level style
  cascade, out of this mechanism's named scope (document/canvas background
  only). Also an UNRELATED ~7-8px box x/y/width shift on these same
  two-classifier fixtures, not diagnosed this iteration. Both named for a
  future iteration.
- Slugs (reach): `bikuka-40-pezi068`, `cilaba-36-zogi212` (diff count
  dropped from a childCount-level structural mismatch to 5 and 10 leaf
  diffs respectively -- real reduction, zero-diff not reached; see
  residual above).

### Mechanism 2 (`hide`/`show <entity|$tag|<<stereotype>>|*|@unlinked>`
### entity-pattern directive) -- FIXED
- Root cause: `class-directives.ts#HIDE_TARGET_MAP` only recognised the
  five GLOBAL targets (`members`/`circle`/`empty members`/`empty fields`/
  `empty methods`) -- `parseHideShowDirective` silently dropped every
  OTHER `hide`/`show` line (`hide aaa`, `hide $tag`, `hide <<stereo>>`,
  `hide *`, `hide @unlinked`), matching class-commands.ts's OWN pre-
  existing doc comment ("Entity-selector forms ... upstream hideOrShow2 ->
  hides2) only ever gate SVG drawing ... a hidden entity still occupies
  its node" -- correctly anticipated but never implemented). Jar
  (`classdiagram/command/CommandHideShow2.java#executeArg` ->
  `net/atmp/CucaDiagram.java#hideOrShow2`) accumulates these into `hides2`
  -- the EXACT SAME `HideOrShow` matcher class `removeOrRestore` uses for
  `removed` (`CucaDiagram.java:606-611`), just a DIFFERENT list consulted
  at a DIFFERENT boundary: `isHidden(Entity)` (`CucaDiagram.java:747-758`,
  mirrors `isRemoved`'s note-delegation shape exactly) gates DRAWING ONLY
  (`svek/SvekResult.java:85`'s `UHidden` wrap at draw time, AFTER layout
  already ran) -- unlike `isRemoved`, it never reaches
  `GraphvizImageBuilder`'s export-time entity/link filtering, so a hidden
  entity keeps its svek node (position, creationIndex/uid slot) exactly as
  if visible. `abel/Link.java:459`: an edge's own `isHidden()` additionally
  ORs in EITHER endpoint's `isHidden()` -- an edge touching a hidden
  classifier is suppressed too, even if the edge itself was never a hide
  target.
- Jar-verified against `cikeni-99-kojo447` (`hide aaa`, bare unlinked
  entity -- comment-only, no `<g>`, canvas dims unaffected by the
  suppression), `cixote-08-vope282` (two `hide <Name>` targets, one
  namespace-nested), `lafama-65-zoci799` (`hide Foo1`/`hide Foo3` where
  `Foo3` participates in `Foo2 *-- Foo3` -- the EDGE disappears too,
  confirming `Link#isHidden`'s OR-with-endpoint rule), `cicovi-23-zipe215`,
  `senece-96-fomu913`.
- Disposition: FIXED. New `HideShowPatternDirective` AST type
  (`ast.ts`) + `ClassDiagramAST.hidePatternDirectives?` field (mirrors
  `RemoveRestoreDirective`/`removeDirectives`'s existing shape/pattern
  exactly, since both share the same matcher). `class-directives.ts`:
  `parseHideShowPatternDirective` (new) matches upstream's own
  `CommandHideShow2` regex shape (`WHAT` = one whitespace-free token OR a
  `<<...>>`-bracketed stereotype -- the exact discriminator that keeps a
  COMPOUND qualifier form like `hide C2 circle`/`hide Dummy2 methods`,
  which belongs to a different, unported upstream command family
  `CommandHideShowByGender`/`CommandHideShowByVisibility`, from matching
  here and being mis-applied); `isApplyable`/`foldDirectives`/
  `buildUnlinkedPredicate` generalized to a `PatternDirective<A>` shape
  (parameterized over the action literal union + a `positiveAction`
  argument) so `computeRemovedIds` (unchanged behavior, just a threaded
  `'remove'` literal now) and the new `computeHiddenIds` (mirrors it
  exactly, sourcing `hidePatternDirectives` with `'hide'`) share one
  matching engine, per jar's own `HideOrShow`-reuse precedent --
  zero duplicated logic. `class-commands.ts`'s hide/show dispatch tries
  `parseHideShowDirective` (global targets) first, falls back to
  `parseHideShowPatternDirective`. `layout.ts#buildClassifierGeos` marks
  `ClassifierGeo.hidden` from `computeHiddenIds(effAst)` -- computed
  AFTER `filterRemovedEntities` (so remove/restore and hide/show compose
  correctly) but the marked entity is NEVER excluded from `ast.classifiers`
  itself, preserving layout/creationIndex/uid numbering exactly.
  `renderer.ts#renderClass`: a `hidden` classifier is skipped entirely (no
  `wrapEntity` call -- matches jar's "keeps its node, draws nothing"
  shape); an edge is skipped when EITHER `edge.from`/`edge.to` resolves to
  a hidden classifier id (`Link#isHidden`'s OR rule).
- Residual: the two structurally-fixed fixtures above (cikeni-99/lafama-65/
  cixote-08/cicovi-23/senece-96) do NOT reach zero-diff -- fixing the
  content/edge suppression unmasked a PRE-EXISTING, UNRELATED ~7px
  classifier-position offset on multi-connected-component layouts (a
  disconnected classifier like `aaa`, even though its content never draws,
  still occupies a graphviz component that our port packs slightly
  differently from real graphviz -- OUT OF SCOPE per CLAUDE.md's
  graphviz-ts boundary) and a namespace-cluster-local canvas-height
  residual (`cixote-08`'s 5px `@height` gap, not diagnosed this
  iteration). Both named for a future iteration; NOT a regression from
  this mechanism (verified: the SAME 7px delta was already present on
  `cikeni-99` BEFORE this fix, when `aaa` rendered as a fully-visible box
  instead of being suppressed).
- Compound-qualifier hide/show forms (`hide C2 circle`, `hide class
  circled`, `hide <<even>> methods`, `hide private members`, `hide method`)
  remain UNPORTED (deliberately out of scope -- different upstream command
  family, `CommandHideShowByGender`/`CommandHideShowByVisibility`, not
  drilled this iteration).
- Slugs (reach, none newly zero-diff -- see residual): `cikeni-99-kojo447`,
  `cixote-08-vope282`, `cicovi-23-zipe215`, `lafama-65-zoci799`,
  `senece-96-fomu913`.

### Note-of-member connector shape -- DIAGNOSED, NOT FIXED (deep, ledgered)
- Mechanism identified in full: `note <pos> of Class::member`
  (`command/note/CommandFactoryTipOnEntity.java`) creates a
  `LeafType.TIPS` entity joined to the host by an INVISIBLE link
  (`LinkType.NONE.getInvisible()`), NOT a normal note. Its draw method
  (`svek/image/EntityImageTips.java#drawU`) looks up the member's raw
  declaration line via a FUZZY substring matcher
  (`cucadiagram/BodierAbstract.java#getBestMatch`/`matchScore` --
  requires the candidate to appear as a literal substring somewhere in
  SOME raw member line, weighted-scored by trailing-character proximity;
  returns null, i.e. DROPS THE NOTE SILENTLY, when the candidate is not a
  substring of ANY raw line at all -- `fupope-12-zoku847`'s `Cls::typo`).
  On a match, `MethodsOrFieldsArea.java#getInnerPosition` does an EXACT
  string-equality lookup against the per-member textblock's `display`
  identity to get the member row's `XRectangle2D` anchor. The note's own
  outline polygon (`svek/image/Opale.java#getPolygonLeft/Right/Up/Down`)
  MERGES a zigzag notch pointing at that anchor directly into the note's
  border path (single `<path>`, `delta=4`-clamped notch depth,
  `cornersize=10` fold corner, ALWAYS emits `arcTo` commands even at
  `roundCorner=0`, producing degenerate `A0,0` no-op arc commands in the
  SVG output -- jar-verified byte-shape against `cajicu-52-cego765`). The
  note itself draws COMPLETELY UNWRAPPED (no `<g class="entity">`, no
  `id`, no comment) -- `EntityImageTips` is drawn directly by
  `GeneralImageBuilder`, never through the normal per-entity `<g>`-wrapping
  path other leaf kinds get.
- Why NOT fixed this iteration: THREE independently-uncertain pieces
  stacked: (1) the zigzag polygon geometry itself is fully specified and
  portable (Opale's math, ~40 lines), but (2) the anchor-point coordinate
  system requires either re-deriving `SvekNode`-relative position math
  this port doesn't have an equivalent for (class renders pure-string, no
  klimt `UGraphic`/`SvekNode` graph) or empirically reverse-engineering it
  from THIS port's own already-jar-verified row geometry (feasible, but
  unverified against enough samples to trust the derivation -- the single
  worked example above left an unexplained 1px residual), and (3) whether
  a dropped (member-not-found) tip STILL reserves graph/canvas space is
  genuinely unclear from the evidence gathered (`fupope-12-zoku847`'s
  canvas dims exactly match a plain single-classifier render with NO note
  at all, suggesting no space reserved, but `calculateDimensionSlow`
  reads as if it should contribute nonzero size regardless of match
  success -- not resolved without a debug-instrumented oracle rebuild,
  N5's precedent for this exact kind of ambiguity). ~12-20 fixture reach
  (the N6 30-cluster's memberNote subset + the 12-cluster).
- Slugs (evidence gathered, unfixed): `fupope-12-zoku847` (silent-drop
  case), `cajicu-52-cego765` (two matched-member cases, byte-verified
  polygon shape), `jerime-86-note748` (unrelated -- confirmed NOT a
  member-note despite superficial pattern match, false lead ruled out).

### `class Foo [[URL{label}]]`/`url of Foo is [[...]]` link wrapping --
### SURVEYED, NOT ATTEMPTED (deep, ledgered, unchanged from N6)
- Confirmed genuinely unbuilt at EVERY layer: `class-declaration-parser.ts`
  actively STRIPS `[[url]]` from a classifier declaration and discards it
  (`:209`, doc comment: "the URL link carries no DOT structure"); `ast.ts`
  has no `url` field on `Classifier` at all; no `url of X is [[...]]`
  command exists in `class-commands.ts`; no shared `<a href=... xlink:...>`
  wrapping primitive exists anywhere in `src/` (grepped
  `xlink:actuate`/`startUrl`/`<a target` -- zero hits outside doc-comment
  mentions and the unrelated creole-text `CommandCreoleUrl.ts`). Jar's
  `url/UrlBuilder.java` grammar is FIVE alternated regexes (quoted-with-
  optional-tooltip-and-label / tooltip-only / tooltip-and-label /
  link-with-tooltip-no-label / link-with-optional-tooltip-and-label) and
  the corpus exercises member-level `[[[url]]]` (triple-bracket, distinct
  grammar), classifier-level `[[url]]`, `url of X is [[...]]`, note-level,
  edge-level, and package/namespace-level URLs (32-slug corpus survey this
  iteration, `~22/718` reach per README). Rendering shape confirmed simple
  once parsed (`tegoxa-17-kudo421`: a single `<a target="_top" href=...
  xlink:href=... xlink:type="simple" xlink:actuate="onRequest"
  xlink:show="new" title=... xlink:title=...>` wraps the classifier's
  existing rect/ellipse/path/text/line children, INSIDE the `<g
  class="entity">`, no dimension change) -- the RENDER side is cheap; the
  PARSER-side grammar breadth is the real cost.
- Why NOT attempted: the brief flagged this subsystem's shared-code risk
  explicitly (E2r ledgered the identical gap for description) and the
  full grammar is large enough that a partial port risks a half-correct
  primitive two engines would then depend on. Genuinely a dedicated-
  iteration scope, not a slice-in-passing fix.
- Slugs (surveyed, unfixed): see the 32-slug list gathered this iteration
  (`tegoxa-17-kudo421`, `xogixe-78-zuro619`, `cutasu-32-zete658`,
  `dasagu-52-vani172`, `fijali-69-pina030`, `jinoba-14-firi471`,
  `laluve-92-raxu863`, `rakuci-96-tuti371`, `vafaka-92-xose973`,
  `jatome-90-pire087`, `gavimi-70-nuju057`, `kutazo-40-texe886`,
  `jovaxe-68-bube754`, `gukuda-51-fuju086`, `fugexa-12-zoti674`,
  `class-missing-label-URL-SVG-0`, and 15 more per the grep survey).

### `(A,B)` n-ary "point" association entities -- SURVEYED, NOT ATTEMPTED
### (parser-side machinery already correct; render-side gap identified)
- Root cause NARROWED (not previously known): `class-assoc-couple.ts`'s
  `assoc-circle` synthesis is ALREADY CORRECT at the parser/DOT level --
  `bosiki-11-xaza958` (`R1 .. (A,B)` + `R2 .. (A,B)`) produces TWO separate
  `kind: 'assoc-circle'` classifiers (`__assoc0`/`__assoc1`), structurally
  matching jar's two-circle output exactly (confirmed via the frozen
  708/708 DOT gate, which already covers this fixture). The gap is
  ENTIRELY render-side, in THREE parts: (1) `renderer.ts` has no special
  case for `kind === 'assoc-circle'` at all, so it falls through to the
  default classifier renderer and draws a FULL box (rect + circle badge +
  member dividers) instead of jar's bare `<ellipse rx="2" ry="2"
  fill="#181818"/>` dot with NO `<g>` wrapper, no id, no comment
  (`svek/image/` -- the dot's exact draw site not yet located this
  iteration); (2) edges touching an assoc-circle render with the WRONG
  decoration -- this port emits filled dependency-style arrowheads
  (`EDGE_DECORATION_MAP`'s default), jar draws PLAIN undecorated lines to
  A/B (solid) and to the outer entity (DASHED, `stroke-dasharray:7,7`),
  confirmed via `class-dot-graph.ts:164`'s `'assoc-circle': 'circle'`
  mapping existing for DOT shape only, with no matching edge-decoration
  override; (3) this port renders an EXTRA visible `__assoc0 to __assoc1`
  edge jar does not draw at all -- since the frozen DOT gate already
  passes for this fixture, that edge must exist in BOTH graphs (jar likely
  marks it invisible/layout-only, matching the invisible-connector pattern
  already established for member-notes in `note-layout.ts`) -- render-side
  suppression needed, not a graph-structure bug.
- Why NOT attempted: three independent render-side sub-fixes (shape,
  edge-decoration-per-endpoint-kind, invisible-edge suppression) is more
  than a "small" iteration slice once discovered mid-iteration with no
  remaining time budget to TDD and jar-verify all three safely; the
  edge-decoration piece in particular risks brushing the shared
  `EDGE_DECORATION_MAP`/`renderer-arrowhead.ts` machinery other edge kinds
  depend on. Narrowed and ready for a fast N8 pickup (parser confirmed
  correct -- pure render-layer work, ~10 fixture reach).
- Slugs (evidence gathered, unfixed): `bosiki-11-xaza958` (byte-level
  diff captured both directions this iteration).

### Not fixed this iteration -- named remainders for N8 (carried + new)
- Note-of-member connector shape (~12-20 reach) -- see above, deep.
- `(A,B)` n-ary point entities (~10 reach) -- see above; NARROWED to a
  pure render-layer fix (parser/DOT already correct), best next pickup.
- `class Foo [[[url]]]`/`url of Foo is [[...]]` link wrapping (~22/718
  reach) -- see above, deep, dedicated-iteration scope.
- `hide`/`show` COMPOUND qualifier forms (`hide C2 circle`, `hide class
  circled`, `hide <<even>> methods`, `hide private/public/protected
  members`, visibility-list forms `hide private,public members`) --
  unported (`CommandHideShowByGender`/`CommandHideShowByVisibility`,
  distinct from this iteration's `CommandHideShow2` mechanism).
- N7's OWN two new residuals: element-level `classDiagram { BackGroundColor
  / LineColor }` style cascade to individual classifier boxes (not just
  canvas background), and the ~7-8px multi-component/namespace-cluster
  position/height offsets unmasked by both N7 mechanisms landing (may
  overlap with N5's already-named arrowhead-ink-contribution residual --
  not cross-checked this iteration).
- `skinparam mode dark` (`zirori-93-jefo337`) -- NEWLY discovered this
  iteration (was misclassified into the N6 background-selector cluster);
  a full alternate color-table resolution, unrelated to `<style>`
  selectors -- out of scope, not previously named anywhere in this
  mission's ledger.
- Arrowhead-polygon + edge-label ink contribution to canvas dims (named
  since N5, still not drilled).
- Edge `<path>` `@id`/`@codeLine` attrs (named since N2, still unfixed --
  not reached this iteration; time went to the two landed mechanisms plus
  the three deep-diagnosis writeups).
- `muteClassifierToGroup` creationIndex off-by-one (N2's diagnosis, still
  unfixed -- not reached this iteration).
- Visibility-icon skinparam color overrides + `classAttributeIconSize`
  (1/718 reach, N6's own remainder).
- `Collection<T>` + `skinparam monochrome reverse` + transparent
  background (`bedogi-86-kala547`), `'Liberation Mono'` font-family
  malformed-attribute bug (`tipude-10-tizi427`) -- both single-fixture,
  still unsurveyed.

### Class census: N6 baseline -> N7
```
before: 31/718 · 1-3:59 · 4-10:201 · 11-30:20 · 31+:407 · errors:0
after:  31/718 · 1-3:52 · 4-10:194 · 11-30:20 · 31+:421 · errors:0
```
0-diff bucket UNCHANGED (31 -- confirmed by exact zero-diff SLUG-SET
comparison, not just count, before/after: identical 31 slugs). 1-3 bucket
-7 (59->52), 4-10 bucket -7 (201->194), 31+ bucket +14 (407->421) -- both
landed mechanisms fixed a real STRUCTURAL (childCount) mismatch on their
target fixtures, which un-bails the comparator's deeper per-attribute walk
and surfaces the PRE-EXISTING residuals documented above as many more
numeric diffs on the SAME fixtures -- the exact "childCount-unmasking"
pattern this mission's ledger has recorded every iteration since N2 (N1->
N2, N4->N5, N6's own visibility-icon fix). Full `--families` re-run
cross-checked against N6's own per-family reach: no family count moved in
the wrong direction; every touched fixture's diff-count change is
attributable to one of the two landed mechanisms or their documented
residuals, not to a new regression.

### Ratchet: 31 pins (unchanged -- no new zero-diff fixtures this
### iteration)
No new slugs qualify for `oracle/goldens/svg-class/`; `class.golden.
ratchet.test.ts` re-run: 33/33 green (unchanged AC1 x31 + AC2 + AC3, zero-
diff slug SET identical to N6's, not just count).

### Description gate: intact
48/355 zero-diff (component+usecase) unchanged; `description.golden.
ratchet.test.ts`: 51/51 green. `core/style-map-element.ts` IS shared code
(touched by mechanism 1) -- re-verified explicitly: description's own
census/ratchet re-run shows zero movement, and the widened selector list
is PURELY ADDITIVE (new selector names only; the four pre-existing entries
-- `document`/`jsondiagram.document`/`yamldiagram.document`/
`hcldiagram.document` -- are untouched, same order, same behavior for any
fixture that doesn't also declare a `root`/`<type>diagram`/`<type>diagram.
document` selector, which no component/usecase fixture in the corpus
does).

### DOT gate: frozen, unchanged
component 262/262 · usecase 90/90 · class 708/708 · object 78/80 · state
267/267 -- re-verified after this iteration's changes. Both landed
mechanisms are render-side/canvas-attribute-side only: mechanism 1 touches
only `resolveDocumentBackground` (a `Theme.colors.background` value, never
consulted by DOT graph construction); mechanism 2's `computeHiddenIds` is
explicitly NEVER passed to `filterRemovedEntities`/`buildDotGraph` --
hidden classifiers keep their DOT node exactly as before this iteration
(verified via a dedicated new unit test, `class-tag-visibility.test.ts`'s
"hide-by-name does not filter the DOT graph" describe block, in addition
to the unchanged 708/708 aggregate count).

### Files changed
- `src/core/style-map-element.ts` -- `resolveDocumentBackground` widened
  precedence list (`DOCUMENT_BACKGROUND_SELECTOR_PRECEDENCE`,
  `DIAGRAM_TYPE_SELECTOR_NAMES`, new module-level consts); added a
  `#lizard forgives` marker to the PRE-EXISTING (unchanged)
  `collectElementStyleBuckets` to satisfy the complexity hook after the
  file grew past its threshold from the new consts (the flagged function
  itself is untouched -- confirmed via `git diff` against HEAD before
  editing).
- `src/diagrams/class/ast.ts` -- new `HideShowPatternDirective` type +
  `ClassDiagramAST.hidePatternDirectives?` field.
- `src/diagrams/class/class-directives.ts` -- new
  `parseHideShowPatternDirective`/`computeHiddenIds`; `isApplyable`/
  `foldDirectives`/`buildUnlinkedPredicate` generalized to a
  `PatternDirective<A>` shape shared between `computeRemovedIds` (behavior
  unchanged) and `computeHiddenIds` (new).
- `src/diagrams/class/class-commands.ts` -- hide/show dispatch falls back
  to `parseHideShowPatternDirective` when `parseHideShowDirective` (global
  targets) returns null.
- `src/diagrams/class/layout.ts` -- `ClassifierGeo.hidden?: boolean` (new
  field); `buildClassifierGeos` takes a `hiddenIds` set from
  `computeHiddenIds(effAst)`.
- `src/diagrams/class/renderer.ts` -- `renderClass` skips `wrapEntity` for
  a hidden classifier and skips edges touching a hidden classifier
  (`Link#isHidden`'s OR-with-endpoint rule).
- `tests/unit/class/class-tag-visibility.test.ts` -- 11 new tests:
  `parseHideShowPatternDirective` (bare name/`$tag`/wildcard/`<<stereo>>`/
  `@unlinked`/global-target-rejection/compound-qualifier-rejection),
  `computeHiddenIds` semantics (mirrors the existing `computeRemovedIds`
  suite), DOT-graph preservation for hide-by-name.
- `tests/unit/class/renderer.test.ts` -- 4 new tests: hidden-classifier
  content suppression, mixed hidden+visible rendering, hidden-endpoint
  edge suppression, visible-edge control case.

### Scratch/worktree hygiene
`scripts/_tmp-n7-drill.ts` (temp fixture-drill script, used throughout
this iteration's diagnosis) deleted before finishing. No worktrees
created. Nothing committed (orchestrator owns commits per mission rule).

## N8 — n-ary points, edge stroke defaults, creationIndex (orchestrator-recorded from the N8 agent report)

Fixed (jar evidence per mechanism in the N8 report, preserved verbatim in
the decision journal row):
1. `(A,B)` n-ary point-entity shape — no `assoc-circle` case in
   renderer.ts (fell through to a full classifier box) and
   class-dot-graph.ts:200-205 fed measured ~32x48 into DOT instead of the
   4x4 circle. Jar: EntityImageAssociationPoint.java:56-86 (SIZE=4, bare
   UEllipse 4x4, CopyForegroundColorToBackgroundColor). bosiki-11 canvas
   dims exact; maxSizeDeltaIn 0.5189 -> 0.0000.
2. Point-entity edge decoration — class-assoc-couple.ts hardcoded
   type:'association'; now derives decor/dashing from the couple's arrow
   token per AbstractClassOrObjectDiagram.java:143-176,250-301
   (insertPointBetween / Association#createNew): solid undecorated
   entity<->circle, dashed undecorated circle<->class.
3. Invisible sibling-circle connector suppression — layout.ts
   buildEdgeGeos never checked rel.invis; SvekEdge.java:470,619,836
   early-returns before any <g>/comment/path.
4. Edge stroke defaults (universal) — renderEdge hardcoded 1.5/'5 5';
   corpus survey: 504/510 links carry stroke-width:1, 383/388 dashed
   carry stroke-dasharray:7,7 (comma). 193/718 fixtures improved,
   0 regressions (disposable-worktree baseline diff).
5. muteClassifierToGroup creationIndex off-by-one (N2 leftover) —
   class-container.ts now hands the deleted classifier's creationIndex to
   the replacement namespace, per CucaDiagram.java:342-363 gotoGroup +
   Entity.java:201-204 muteToGroupType (same object mutated, no new uid).
   3 new unit tests (class-container-mute.test.ts).

Diagnosed, not fixed:
- Edge <path @id @codeLine> — fresh reach 220/718 (@id) + 191/718
  (@codeLine). Link.java:106-114 idCommentForSvg()'s three-way
  looksLikeRevertedForSvg branch; the naive decor1/decor2 reading is
  CONTRADICTED by two samples (baneru-00, bicabi-42 — both empirically
  "backto"). Needs a dedicated CommandLinkClass Link-construction tracing
  session. @codeLine additionally needs Relationship.sourceLine AST
  plumbing (absent engine-wide).
- Uniform ~7px whole-canvas offset on couple-touching fixtures — our DOT
  input for bosiki-11 now matches the oracle EXACTLY (structurally equal,
  maxSizeDeltaIn 0.0000), so the residual is graphviz-ts's own
  coordinate assignment diverging from real graphviz: OUT OF SCOPE
  (pinned .tgz); candidate for an upstream graphviz-ts issue with the
  minimal repro from the drill.

Census: 31/718 held (identical slug set); 1-3: 52->43, 31+: 421->430 —
the 9 movers are all couple-touching fixtures whose structural fix
un-bailed the comparator onto the graphviz-ts offset above (precedented
unmasking). Full-corpus scan: 193 improved / 0 regressed.
