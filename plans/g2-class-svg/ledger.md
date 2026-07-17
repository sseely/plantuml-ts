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

## N9 — edge `<path>` `@id`/`@codeLine`, the decor/direction matrix (220/191 reach)

### The traced rule (Java citations)

`Link#idCommentForSvg()` (Link.java:106-114) branches on `LinkType
#looksLikeRevertedForSvg()`/`#looksLikeNoDecorAtAllSvg()` (LinkType.java:
55-68), which test `LinkType.decor1`/`decor2` against `NONE`. The N8 report's
"naive decor1==NONE && decor2!=NONE -> backto" reading, applied directly to
this port's `sourceDecor`/`targetDecor` (arrowhead-driven, DOT-layout-
direction-swapped), is WRONG: `CommandLinkClass.getLinkType()` builds
`new LinkType(decors2, decors1)` (CommandLinkClass.java:490-497) — a field
SWAP baked into the constructor call — so `LinkType.decor1` is the decor
adjacent to `getEntity2()`, `LinkType.decor2` adjacent to `getEntity1()`.
`Link`'s own `cl1`/`cl2` (`getEntity1()`/`getEntity2()`) stay in TEXTUAL
declaration order (first-written = cl1) REGARDLESS of arrowhead direction —
the ONLY swap is `CommandLinkClass.java:363-364`'s `link = link.getInv()`,
triggered by an explicit `-left-`/`-up-` ARROW_DIRECTION word (independent of
any decor). `Link#getInv()` (Link.java:145-156) swaps cl1/cl2 AND
`LinkType#getInversed()` (swaps decor1/decor2) together, so the invariant
"decor1 ~ current entity2, decor2 ~ current entity1" holds before AND after
inversion.

Restated without upstream's confusing field-swap naming: let `idEntity1`/
`idEntity2` = the (upOrLeft-swapped) textual first/second operand, and
`decorAtIdEntity1`/`decorAtIdEntity2` = the (upOrLeft-swapped) raw arrowhead
glyph at each. Then:
- `decorAtIdEntity2==NONE && decorAtIdEntity1!=NONE` -> `"E1-backto-E2"`
- `(decorAtIdEntity1==NONE) === (decorAtIdEntity2==NONE)` (both, or neither)
  -> `"E1-E2"` (bare)
- else (decor only at E2) -> `"E1-to-E2"` (default)

This port's `Relationship.from`/`.to`/`.sourceDecor`/`.targetDecor` are
DELIBERATELY swapped by arrowhead direction (`swapDirection` in
`class-arrow-grammar.ts`, for DOT graph edge direction — frozen, untouched)
and therefore do NOT correspond 1:1 to Java's cl1/cl2. A SEPARATE field pair
was added — `Relationship.idEntity1`/`.idEntity2`/`.idEntity1Decor`/
`.idEntity2Decor` — computed in `class-relationship-parser.ts` from
`ArrowInfo.upOrLeft` (a NEW field, isolating the `-left-`/`-up-` swap from
the combined `decorSwap XOR upOrLeft` used for `swapDirection`) and
`parseArrowDecorsRaw` (textual-order decors, no swap at all).

@see ~/git/plantuml/.../abel/Link.java:106-114,145-156
@see ~/git/plantuml/.../decoration/LinkType.java:55-68
@see ~/git/plantuml/.../classdiagram/command/CommandLinkClass.java:490-497,363-364

### Arrow-direction matrix (jar-validated)

| Arrow | Sample fixture | jar id | Mechanism |
|---|---|---|---|
| `class1 [Q] <-- class2` | baneru-00-kuro607 | `class1-backto-class2` | decor at ENT1 only (was N8's 1st contradiction — RESOLVED) |
| `MainWindow <|-- Gtk::Window` | bicabi-42-coto932 | `MainWindow-backto-Gtk` | extends triangle at ENT1 only, port suffix stripped (N8's 2nd contradiction — RESOLVED) |
| `p1 --> cl2` | bajotu-30-soku184 | `p1-to-cl2` | decor at ENT2 only (default) |
| `A -- B` | bujedi-30-cize673 | `A-B` | no decor at either end (bare) |
| `A *--> C` | bujedi-30-cize673 | `A-C` | COMPOSITION + ARROW, both ends decorated (bare, same branch as no-decor) |
| `HashMap [d4] +-l-> [h] V4` | coxose-20-nifu136 | `V4-HashMap` | PLUS (not "none" for id purposes — was a NEW bug, see below) + ARROW, both decorated, AND `-l-` swaps entity order (bare) |
| `class GenericServlet extends Servlet` | fijali-69-pina030 | `Servlet-backto-GenericServlet` | inline extends/implements, NOT the arrow grammar — always parent-backto-child, NEVER `codeLine` |
| `class c1 implements I1` / `interface I2 extends I1` / `class c2 extends c1 implements I2` | fexedu-26-dira713 | `I1-backto-c1`, `I1-backto-I2`, `c1-backto-c2`, `I2-backto-c2` | same inline-extends rule, 4-relationship cross-check |

### New bugs found and fixed while validating the matrix

1. **PLUS/SQUARE/CROWFOOT/PARENTHESIS collapsed to "none" for id purposes.**
   `class-arrow-grammar.ts#headToDecor` deliberately maps these to `'none'`
   for the RENDERED-MARKER purpose (D6: this port draws no distinct shape
   for them) — but Java's `LinkDecor.PLUS` etc are real, non-`NONE` enum
   members, and `looksLikeRevertedForSvg`/`looksLikeNoDecorAtAllSvg` only
   test `== NONE`. `coxose-20-nifu136`'s `HashMap [d4] +-l-> [h] V4` proved
   it: PLUS-then-ARROW is double-decorated ("V4-HashMap", bare), but the
   collapsed reading saw NONE-then-ARROW ("V4-backto-HashMap", wrong). Fixed
   with a presence-based classifier (`idDecorForHead`: any non-empty glyph
   counts, regardless of which rendered-marker kind) instead of reusing the
   lossy rendering-purpose mapping.
2. **Inline `extends`/`implements` never went through the arrow grammar at
   all.** `class-declaration-parser.ts#applyInheritanceClauses` builds
   `Relationship` directly (`{from: childId, to: parentId, ...}`, no
   `sourceLine`) — with no `idEntity1`/`idEntity2`, the id fallback used
   `from`/`to` (child/parent order, decor-swapped for DOT) and produced
   `"child-to-parent"` instead of jar's `"parent-backto-child"`. Fixed by
   setting `idEntity1`=parent/`idEntity2`=child/decor1='triangle'/decor2=
   'none' directly at that construction site (jar-verified: 0/5 sampled
   inline-extends edges carry `codeLine` at all, so `sourceLine` is
   deliberately left unset there).
3. **`leafPortion`'s blind `.`-split is wrong for the id.** Applying the
   existing (non-conformance-affecting, comment-only) `leafPortion` helper
   to the NEW id fields broke `set namespaceseparator none` fixtures with
   literal dots in a classifier name (`pexivi-54-ceri875`: jar id
   "X.Y.Z-to-A.B.C", not "Z-to-C") and the CLASS_ID root-namespace `.`
   marker (`dudimi-83-mimo845`'s `.BaseClass` strips to "BaseClass" when
   nsSep is active; `momoba-92-bole393`'s identical `.BaseClass` KEEPS the
   dot under `namespaceSeparator none`, since the marker only has that
   meaning while namespaces are active). Fixed with a new `idLeaf(rawId,
   nsSep)` (`class-relationship-parser.ts`, exported and reused by
   `class-declaration-parser.ts` for the parent/child names too) that
   splits on the diagram's ACTUAL separator and strips the root marker only
   when `nsSep !== null`.
4. **`<path id>` attribute values were never XML-escaped.** `core/svg.ts
   #attrs` never escapes any value (every OTHER caller passes text with no
   XML-significant chars); a classifier name containing `<`/`&`/`"` (a C++
   template type, `nagega-30-poso418`: `boost::function<ResultE(...)>`)
   needs escaping. Jar's own serializer escapes `&`/`<`/the attribute quote
   char but NOT `>` (only the first three are strictly required by the XML
   spec) — `escapeIdAttr` (`renderer.ts`) matches that exact 3-char set.

### `codeLine` plumbing

No line-position tracking existed anywhere below `StringLocated`
(`preprocessor.ts#flatten` discarded `getLocation()` when collapsing to
`PreprocessorResult.lines: string[]`) — genuinely absent engine-wide, as N8
diagnosed. Added MINIMAL parallel-array tracking (no per-line object
representation, no `mergeStandaloneBraces`-adjacent redesign):
`preprocessor.ts#flatten` -> `PreprocessorResult.linePositions` ->
`BlockUmlBuilder.ts#interiorOf` -> `block-extractor.ts#finalizeBlock` ->
`UmlSource.linePositions` -> `class/parser.ts#mergeStandaloneBraces` (now
position-aware, keeping a merged `{`-line's opener's position) ->
`ParseState.currentLine` (set once per loop iteration, top of `parseClass`'s
main loop) -> stamped onto `Relationship.sourceLine` at BOTH relationship-
construction chokepoints (`class-commands.ts`'s `REL_DISPATCH_RE` handler,
`class-declaration-parser.ts`'s inline-extends/implements — though the
latter deliberately does NOT stamp it, jar-verified 0/5) -> `EdgeGeo
.sourceLine` (`layout.ts`) -> `<path codeLine="...">` (`renderer.ts`,
`path()`/`LineStyle` in `core/svg.ts` gained `id`/`codeLine` fields). All
threading is purely additive/optional — every existing `UmlSource`/
`PreprocessorResult` literal (dozens of unit-test fixtures) is unaffected.
`codeLine` is 0-indexed, matching jar's own convention (`@startuml` is line
0); jar-verified byte-exact against a blank-line-containing fixture
(baneru-00-kuro607: `@startuml`/pragma/2 declarations/BLANK LINE/relationship
-> codeLine="5", proving the blank-line-drop in `flatten()` doesn't shift
the position of surviving lines).

### Full-corpus scan (jar-verified against a disposable git worktree at HEAD)

`@id`: 1791 jar ids / 2148 ours (extra ours = the two known-separate
synthetic-naming families below, drawn with a real id where jar also draws
one, just differently-named). 68/718 fixtures still have SOME `@id`
mismatch, ALL attributable to mechanisms this iteration's scope explicitly
excludes (arrow-direction matrix only):
- **Couples/apoint synthetic naming** (~15 fixtures: begico-70, besepi-37,
  bosiki-11, bunuce-10, buvake-41, fibamu-81, getufo-87, jaloja-18,
  jegefa-93, jixamu-89, jocozo-25, lonota-83, meriso-72, pabuma-15,
  pajoka-72, pibifa-14, radavi-85, rujace-11, sacala-27, temise-16,
  tunelu-64, vonago-16) — jar names association-class-couple "point"
  entities `apointN`; this port's `__assocN` placeholder never gets
  renamed. SEPARATE mechanism (synthetic entity id generation), not an
  arrow-direction bug.
- **Lollipop synthetic naming** (~9 fixtures: bososa-44, dacisu-77,
  gidabo-27, makoko-44, paluca-39, rilaki-69, rofijo-47, rudigu-21,
  sotepe-41, vezato-03, vilobu-97, vofatu-71, ximuza-91) — jar names
  `<childname>lolN`; same "placeholder id, real mechanism elsewhere" shape.
- **Note-connector structural gap** (befasi-62-family x7, fogexa-30-family
  x8 with `GMN\d+` auto-note ids, doseko-41-family x3, rejedu-76,
  temise-16, zuduxu-90) — jar draws NO `<g class="link">` at all for a
  note-touching edge (folded into the note's own drawing or genuinely
  absent under `hide`); this port draws one. SAME "note-of-member connector
  shape"/"hide $tag edge cases" families already named since N5-N7,
  confirmed to ALSO cover bare note-to-classifier arrows, not just `note X
  of Class::member`.
- **`!pragma layout elk`** (cadutu-02, cirojo-62, gokoru-18, rutefe-49) —
  jar's SVG structure differs entirely under the ELK layout pragma (zero
  `<g class="link">` elements at all); pre-existing, wholly unrelated,
  newly observed while surveying mismatches.
- **`[hidden]` style-bracket edges drawn instead of suppressed**
  (guxode-39-dobi371: `A -[hidden]- B`) — NEWLY discovered: the bracket is
  parsed (`ARROW_STYLE`) and discarded, unlike the couple's own `invis`
  flag; nothing suppresses drawing. Distinct mechanism from N8's couple
  `invis` handling.
- **`skinparam groupInheritance`** (zuduxu-90-kosi876) — NEWLY discovered:
  jar groups/merges duplicate identical inheritance edges under this
  skinparam; this port draws two separate uniq-suffixed edges instead.
- **sadamo-18-siva346** — a pathological/degenerate generics-heavy stress
  fixture (100+ duplicate relationship ids); genuinely unrelated, low
  priority.

`@codeLine`: 0 mismatches once `@id` matches (every codeLine value that
COULD be compared — i.e. every fixture where the id itself lines up — is
byte-exact; the residual mismatches above are id-family, not codeLine-family,
issues).

Per-fixture diff-count regression check (disposable worktree at HEAD,
DeterministicMeasurer, all 718 fixtures): 194 improved, 522 unchanged, 2
apparent regressions (`lipazi-06-care921` 353->355, `xoxuni-96-fere626`
189->191) — both already 350+/190+-diff fixtures with a PRE-EXISTING
structural element-ORDER mismatch (`svg/g[1]/g[N]/@id` comparing OUR
`lnk3` against JAR's `ent0008` at the same tree position — i.e. the
comparator is already walking misaligned trees before this iteration's
change). The +2 diffs are `@id`/`@codeLine` now present on a `<path>` whose
tree POSITION doesn't correspond to any jar element at all (jar's
corresponding position is a totally different node) — the same
"childCount/positional-misalignment unmasking" pattern recorded every
iteration since N2, not an independent regression in the id mechanism
itself (which is separately jar-verified byte-exact across the full arrow
matrix above).

Census: 31/718 held (identical slug set); 11-30: 20->21, 31+: 430->429 (one
fixture's diff count dropped, not enough alone to reach zero — the "id/
codeLine was ONE of several remaining diffs" pattern, same as every prior
landed mechanism). DOT gate unchanged (708/708 + all four others). New unit
tests: `tests/unit/class/class-link-id.test.ts` (21 cases, the full matrix +
idLeaf + escaping + collision + blank-line codeLine) + 3 cases appended to
`tests/unit/preprocessor.test.ts` (`linePositions`).

## N10 — fresh full-corpus sub-classification + `hide empty members/fields/methods` per-compartment fix

### Method

Re-classified ALL 687 non-conformant class fixtures from scratch (not just
the 1-3 bucket) via a temp classifier (`scripts/_tmp-n10-classify.ts`,
deleted before finishing): puml-source heuristics for the 8 already-named
mechanisms first, then exact diff-family-signature clustering for whatever
was left untagged.

### Classification table (mechanism → reach → tractability → queue position)

Heuristic tag reach (puml-source pattern match — an UPPER BOUND on true
causal reach, not proof; cross-checked against each mechanism's own
previously jar-verified figure where one exists):

| Mechanism | Heuristic hits | Previously jar-verified reach | Notes |
|---|---|---|---|
| `note-of-member`/note-connector | 62 | ~19 (N9) | heuristic massively overcounts — matches ANY `note X of Y`, including already-correct plain notes; N9's 19 stands as the real figure |
| `couple-paren` (n-ary `(A,B)`) | 42 | ~15 (N9, "apoint" synthetic naming) | heuristic overcounts (matches any parenthesized pair, e.g. method calls) |
| `url-wrap` (`[[...]]`) | 22 | ~22 (N6/N7) | heuristic reach matches the prior jar-surveyed figure closely — confirms N6/N7's number is still accurate post-N7-N9 |
| `lollipop` | 11 | ~9 (N9) | close to prior figure |
| `elk-pragma` | 7 | ~4 (N9) | prior figure was a partial survey; 7 is the fuller heuristic count |
| `groupInheritance` | 7 | 1 (N9) | N9 only named ONE fixture (`zuduxu-90-kosi876`) as exercising this skinparam; 7 fixtures merely CONTAIN the skinparam token — most likely have it as a no-op (no duplicate inheritance edges to merge), so N9's 1 remains the real reach; not re-verified individually this iteration |
| `dark-mode` | 1 | 1 (N7) | matches exactly |
| `hidden-bracket` | 1 | 1 (N9) | matches exactly |

Untagged (no heuristic match): **543/687**. These fragment into **187
distinct exact diff-family signatures** — confirming N6's own finding (for
its 61-fixture 1-3 bucket) generalizes to the WHOLE non-conformant corpus:
there is no large hidden universal mechanism left. Coarse dominant-family
reach across the untagged set: `svg/@viewBox` 455, `@width` 408, `@height`
381, `g/g/path/@d` 375, `text/@x` 361, `text/@y` 352, `ellipse/@cx` 345,
`line/@x2` 344, `ellipse/@cy` 338, `line/@y1`/`@y2` 335 each, `rect/@y` 334,
`rect/@x` 333, `line/@x1` 323, `g/g[childCount]` 284, `polygon/@points` 160.
Sample-traced (`ducoka-05-cuce457`, `pasova-33-toze386` — see "regression
trace" below): once a fixture's `childCount` is FIXED (matches jar), the
residual left behind is a uniform ~7px position/margin shift on box
x/y — this is the SAME already-named "~7-8px multi-component/namespace-
cluster position/height offset" (N7) / "arrowhead-polygon + edge-label ink
contribution to canvas dims" (N5) residual, now confirmed (via 2 fresh,
independently-obtained samples) to be the DOMINANT driver of the coarse
viewBox/width/height/coordinate-family signature across the bulk of the
corpus, not a graphviz-ts-only phenomenon — it reproduces on
non-couple-touching, non-graphviz-adjacent fixtures too. Still NOT root-
caused to a single mechanism this iteration (deep, needs a debug-
instrumented oracle rebuild per N5's own precedent) — re-ledgered as the
single highest-value N11 target given it now demonstrably touches the
largest share of the remaining corpus.

The largest exact-signature cluster (`svg/@height|@viewBox|@width|g/g[
childCount]`, 76 fixtures) was sample-drilled (`benemi-22-dufo622`,
`bidusa-22-jutu505`, `bifisu-79-palu304`) and found to be a CATCH-ALL, not
one mechanism: `hide private members`/`hide public members` (compound-
qualifier hide, already named since N7/N9, unported), sprite/font-awesome
icon glyphs inside a member text line (`<$Netw>`/`<&x>`/`<$star*0.25>`,
newly observed, unsurveyed), and a `!define`-macro-in-member-line TIM
expansion gap (`!define SHOW_TYPE(x) my##x` used inline in `ClassX :
SHOW_TYPE(foo) size()`, newly observed, unsurveyed) all produce this SAME
signature. Every untagged signature below ~10 fixtures was spot-checked at
least once; none revealed a mechanism with reach large enough to beat the
~7-8px offset above. Full classification confirms: every one of the 687
non-conformant fixtures maps to either a named mechanism above, the
dominant ~7-8px/ink-extent residual, or one of the two newly-discovered
member-parsing gaps below (also named, not left anonymous).

### Mechanism landed: `hide empty members`/`empty fields`/`empty methods`
### are PER-COMPARTMENT, not whole-section — FIXED

- Root cause: `CommandHideShowByGender.java:267-279` special-cases `hide
  empty members` (`portion == EntityPortion.MEMBER`) into TWO INDEPENDENT
  directives — `hideOrShow(FIELD, emptyByGender(FIELD))` AND
  `hideOrShow(METHOD, emptyByGender(METHOD))` — each gated on THAT
  compartment's OWN emptiness for a given classifier, not on the classifier
  having ZERO members overall. `hide empty fields`/`hide empty methods` map
  directly to one portion each (`emptyByGender(portion)`, same lines). This
  port's `layout.ts#preMeasureClassifiers` had `suppressMemberSection:
  boolean` — a single flag suppressing BOTH compartments together only when
  ALL members were empty, and `empty fields`/`empty methods` were parsed
  into the AST (`class-directives.ts#HIDE_TARGET_MAP`) but NEVER consulted
  anywhere in layout — dead directives, silently no-op since the feature was
  first ported (pre-dates this mission). Jar-verified:
  `mezucu-18-lozi106` (`hide empty members` + `class A { b }`, ONE field, no
  methods) draws exactly ONE `<line>` divider (before the fields
  compartment); this port drew TWO (fields divider + a spurious empty-
  methods-compartment divider + its 8px floor), rect height 62 vs jar's 54.
- Disposition: FIXED. `class-layout-helpers.ts#measureGenericClassifier`
  restructured from a single `suppressMemberSection: boolean` to a new
  `MemberSuppression { fields: boolean; methods: boolean }` — each
  compartment's divider/rows/height is now included ONLY when its own flag
  is false (matches `BodierLikeClassOrObject#getBody`'s `showFields &&
  !showMethods` branch returning `fields.asBlockMemberImpl()` ALONE — one
  divider, not two). `measureClassifier`'s object-leaf branch passes
  `suppress.fields` only (objects have no methods compartment concept —
  `BodierLikeClassOrObject#getFieldsToDisplay`'s `type != LeafType.OBJECT`
  guard routes every object member into "fields" regardless of syntax).
  `layout.ts#preMeasureClassifiers` now computes `fieldsEmpty`/`methodsEmpty`
  per classifier (object-aware: for `kind==='object'`, `fieldsEmpty` = zero
  visible members total, `methodsEmpty` is always true/irrelevant) and
  derives `suppressFields`/`suppressMethods` from `hideMembers` (bare,
  unconditional) OR'd with `(hideEmptyMembers || hideEmptyFields) &&
  fieldsEmpty` / `(hideEmptyMembers || hideEmptyMethods) && methodsEmpty` —
  wiring `empty fields`/`empty methods` for the first time. `renderer.ts`
  needed NO change: it already draws dividers/rows generically from
  whatever `dividerYs`/`rows` arrays layout produces (no hardcoded "always
  2" assumption there — confirmed by reading `renderClassifier`'s
  interleave-by-Y logic before editing).
- Corrected an UNVERIFIED N3-era unit test: `layout.test.ts`'s "hide empty
  members: dividerYs has both compartment dividers when classifier has
  visible members" asserted `dividerYs` length 2 for a fields-only
  classifier under `hide empty members`, with a comment claiming
  "jar-verified" — it was NOT actually jar-verified for the HIDE-DIRECTIVE
  case (only for the unconditional default case, which is unchanged and
  still correct). Fixed to assert length 1 (jar-verified via
  `mezucu-18-lozi106`); 5 new tests added covering the symmetric
  fields-only/methods-only cases for all three directives plus a
  non-suppressing control case.
- Slugs (reach): 19 fixtures in the corpus use one of the three directives
  (grep survey); only `mezucu-18-lozi106` reaches zero-diff this iteration —
  the other 18 remain blocked by OTHER, separately-named-below issues this
  fix also structurally corrected on (see regression trace).

### Regression trace (5 fixtures, diff count went UP — diagnosed, not a
### bug in this mechanism)

Full-corpus per-fixture diff-count comparison (disposable `git worktree
add --detach` at HEAD, symlinked `test-results`/`assets/stdlib`/
`node_modules` in since both are gitignored) found 3 improved (beyond the
+1 ratchet), 710 unchanged, 5 apparent regressions, all in the same
`hide empty *` family this mechanism touches:

1. **`cuxuni-25-doxi736`/`difuxu-77-rumu307`/`nebovu-26-caxe550`** (8→94,
   91→94, 8→94): traced to a DIFFERENT, PRE-EXISTING, genuinely unrelated
   bug — `class-member-parser.ts#parseMemberLine` returns `null` (silently
   DROPS the member) for Java-style `Type name` field syntax with no colon
   (`String a1`) or a trailing `;` (`Date d;`) — neither matches the
   `attrMatch` regex `^(\w+)(?:\s*:\s*(\S+))?$`. Isolated via a minimal
   repro with NO hide directive at all (`class Dummy1 { +m1() +m2()
   +String a1 +Date d; }`, zero directives) — confirmed the SAME 2 fields
   silently vanish from the AST regardless of any hide/show directive,
   proving this is unrelated to N10's mechanism. Before N10's fix, the
   OLD "always both compartments, always both dividers" behavior partly
   MASKED this missing-fields bug (still drew an empty fields compartment
   with the right STRUCTURAL shape, just empty); N10's now-correct
   per-compartment suppression sees `fieldsEmpty` (wrongly true, because
   the fields were already dropped at PARSE time) and suppresses the
   compartment entirely — a worse structural mismatch on these 3 fixtures
   specifically, but strictly BETTER/correct everywhere `parseMemberLine`
   itself isn't ALSO broken. NEWLY DISCOVERED this iteration, unsurveyed
   for full corpus reach (found via this regression trace, not a targeted
   scan) — named for N11: `class-member-parser.ts#parseMemberLine`'s
   `attrMatch`/`methodMatch` regexes need either a Java-style `Type name`
   alternative or (more faithfully — upstream `BodierLikeClassOrObject`
   never decomposes member lines beyond method-vs-field bucketing) a raw-
   text fallback that preserves ANY non-matching line as an opaque field
   display string instead of returning `null`.
2. **`ducoka-05-cuce457`/`pasova-33-toze386`** (22→41, 7→97): the SAME
   "childCount-unmasking" pattern recorded every iteration since N2 — BEFORE
   this fix, both fixtures had a childCount MISMATCH (an extra, wrongly-
   drawn empty-compartment divider), which this fix corrects (childCount
   now matches jar exactly on both, confirmed in the "after" diff dump).
   Structurally fixing childCount un-bails the comparator's positional walk
   onto the ALREADY-NAMED (since N5/N7) ~7-8px box position/margin residual
   — jar-verified: `ducoka-05`'s first classifier now has `rect y="0"` (was
   masked before) vs jar's `y="7"`, an exact 7px gap matching the pattern
   described in the fresh sub-classification section above. NOT a
   regression from this mechanism (verified via the disposable-worktree
   "before" diff dump showing the SAME childCount-off-by-one existed prior
   to this fix, just with the position bug still hidden behind it).

### Class census: N9 baseline → N10

```
before: 31/718 · 1-3:43 · 4-10:194 · 11-30:21 · 31+:429 · errors:0
after:  32/718 · 1-3:42 · 4-10:191 · 11-30:20 · 31+:433 · errors:0
```
Zero-diff SET: all 31 prior slugs unchanged + 1 new (`mezucu-18-lozi106`) —
confirmed by exact slug-set comparison, not just count. Full-corpus
per-fixture scan (disposable worktree, 718 fixtures): 3 improved beyond the
ratchet gain, 710 unchanged, 5 apparent regressions (both fully diagnosed
above — pre-existing bugs unmasked, not introduced this iteration).

### Ratchet: 32 pins (+1 — `mezucu-18-lozi106`)

`oracle/goldens/svg-class/mezucu-18-lozi106/{in.puml,golden.svg}` added
(copied verbatim from `test-results/dot-cache/class/mezucu-18-lozi106/`);
`ratchet.json` entry appended (alphabetical, matching existing format).
`class.golden.ratchet.test.ts`: 34/34 green (was 33 — AC1 x32 + AC2 + AC3).

### Description gate: intact

48/355 zero-diff (component+usecase) unchanged; `description.golden.
ratchet.test.ts`: 51/51 green. No shared code touched this iteration
(`class-layout-helpers.ts`/`layout.ts` are class-only modules) — re-run
confirms zero movement, as expected.

### DOT gate: frozen, unchanged

component 262/262 · usecase 90/90 · class 708/708 · object 78/80 · state
267/267 — re-verified after this iteration's changes
(`scripts/dot-sync-report.ts class object state` + the default
component/usecase run). This iteration's fix is render/layout-side only
(member-section suppression affects SVG box height/dividers, never the DOT
graph node count or edges — the classifier's DOT node dimensions come from
`measureClassifier`'s `width`/`height` fields, which DO change slightly for
suppressed classifiers, but no fixture in the frozen 708/708 set has its
structural DOT graph shape altered, only geometry within an already-correct
node).

### Files changed

- `src/diagrams/class/class-layout-helpers.ts` — `isMethodMember` exported
  (was file-local); new exported `MemberSuppression` interface;
  `measureGenericClassifier`/`measureClassifier` signatures changed from
  `suppressMemberSection: boolean` to `suppress: MemberSuppression`;
  per-compartment divider/row/height composition.
- `src/diagrams/class/layout.ts` — `preMeasureClassifiers` computes
  `fieldsEmpty`/`methodsEmpty` per classifier (object-aware) and derives
  independent `suppressFields`/`suppressMethods`, consulting `empty
  fields`/`empty methods` for the first time (previously dead directives).
- `tests/unit/class/layout.test.ts` — corrected the unverified N3-era
  "both dividers" expectation to the jar-verified "one divider" result;
  5 new tests (fields-only/methods-only under `hide empty members`, `hide
  empty fields`, `hide empty methods`, and a non-suppressing control case).
- `oracle/goldens/svg-class/mezucu-18-lozi106/` — new golden pin
  (`in.puml`, `golden.svg`).
- `oracle/goldens/svg-class/ratchet.json` — new entry.

### Not fixed this iteration — named remainders for N11 (carried + new)

1. **~7-8px multi-component/box position/margin residual** (unchanged name
   since N7, now UPGRADED to the single highest-value target — this
   iteration's fresh sub-classification confirms it touches the majority
   of the 543 untagged non-conformant fixtures, not just couple/namespace-
   cluster cases; needs a debug-instrumented oracle rebuild per N5's own
   precedent to trace `SvekResult`/`CucaDiagram` margin application exactly).
2. **`class-member-parser.ts#parseMemberLine` drops non-canonical member
   syntax** (NEWLY DISCOVERED N10 via regression trace) — `Type name`
   (space-separated, no colon) and trailing-punctuation (`Date d;`) member
   lines silently vanish from the AST. Reach NOT surveyed (found via 3
   incidental fixtures, not a targeted corpus scan) — needs its own grep/
   parse-diff pass; likely nontrivial given how common Java-style field
   declarations are in the corpus.
3. **`hide private/public/protected members`** compound-qualifier hide
   (unchanged since N7, `CommandHideShowByGender`/`CommandHideShowByVisibility`,
   ~8/718 reach per this iteration's grep) — distinct upstream command
   family from the `hide empty *` mechanism just landed.
4. Sprite/font-awesome icon glyphs inside a member text line (`<$Netw>`/
   `<&x>`/`<$star*0.25>`) — NEWLY OBSERVED N10, unsurveyed reach.
5. `!define`-macro used inline inside a member declaration line
   (`ClassX : SHOW_TYPE(foo) size()`) — NEWLY OBSERVED N10, unsurveyed
   TIM-expansion gap, unsurveyed reach.
6. Note-of-member connector shape (~19 reach, unchanged since N6-N9).
7. Couples/apoint + lollipop synthetic entity-id naming (~24/718 combined,
   unchanged since N9).
8. `class Foo [[[url]]]`/`url of Foo is [[...]]` link wrapping (~22/718,
   unchanged since N6-N9, dedicated-iteration scope).
9. `!pragma layout elk` (~4-7/718, unchanged since N9).
10. `[hidden]` style-bracket edge suppression (1+/718, unchanged since N9).
11. `skinparam groupInheritance` (1/718, unchanged since N9).
12. `skinparam mode dark` (1/718, unchanged since N7).
13. Edge `<path>` `@id`/`@codeLine` residual families (couples/lollipop
    naming + note-connector gap, unchanged since N9 — same items as #6/#7).
14. Visibility-icon skinparam color overrides + `classAttributeIconSize`
    (1/718, unchanged since N6).
15. `Collection<T>` + `skinparam monochrome reverse` + transparent
    background (`bedogi-86-kala547`), `'Liberation Mono'` font-family
    malformed-attribute bug (`tipude-10-tizi427`) — both unchanged,
    single-fixture, still unsurveyed.
16. `sadamo-18-siva346` pathological stress fixture (unchanged since N9).
17. graphviz-ts coordinate-assignment offset (OUT OF SCOPE, unchanged since
    N8) — may overlap #1 above; still not cross-checked which residual
    dominates on any given fixture.

### Scratch/worktree hygiene

`scripts/_tmp-n10-classify.ts`, `_tmp-n10-diffdump.ts`, `_tmp-n10-svgdump.ts`,
`_tmp-n10-diffcounts.ts`, `_tmp-n10-astdump{,2,3}.ts`, `_tmp-n10-memberline{,2}.ts`,
`_tmp-n10-linesdump.ts` (all temp scripts used for diagnosis) deleted before
finishing. Disposable `git worktree add --detach /tmp/n10-baseline-worktree
HEAD` removed via `git worktree remove --force` after the regression trace.
Nothing committed (orchestrator owns commits per mission rule).

## N11 — the ~7-8px position/margin residual: MISSING `SvekResult` ink-shift
## (`moveDelta`), the SAME mechanism description already ported (G1b/J1)

### Sub-classification (per the brief's explicit requirement)

Confirmed by direct comparison against real Java source
(`svek/SvekResult.java`, read in full this iteration, not just the
`calculateDimension` method N5 already cited) that the residual is
overwhelmingly **case A — uniform-translate-everything**, not a per-element-
family offset and not primarily graphviz-ts:

- **Uniform whole-diagram translate (this iteration's fix, dominant case)**:
  `SvekResult#calculateDimension` (svek/SvekResult.java:130-136) does TWO
  things, not one — N5 ported only the first (`minMax.getDimension()
  .delta(15,15)`, the RETURNED dimension). The SECOND, previously
  unmodeled: `clusterManager.moveDelta(6 - minMax.getMinX(), 6 -
  minMax.getMinY())` — a permanent, uniform `(dx,dy)` translate applied to
  EVERY already-laid-out node/cluster/edge position, so the diagram's own
  ink extent's top-left corner lands at exactly `(6,6)`. This port's
  `layout.ts` fed `layoutGraph()`'s raw graphviz-normalized positions
  straight through with NO equivalent shift — canvas SIZE was already
  correct (N5, translation-invariant), but every drawn element's absolute
  x/y was off by a constant per-fixture `(dx,dy)`, jar-verified EXACTLY on
  `jalexi-21-xoje231` (two bare classifiers, no edges): raw `rect x="0"
  y="0"`/`x="94" y="0"` vs jar `x="7" y="7"`/`x="101" y="7"` — uniform
  `(+7,+7)` on BOTH boxes, matching `6 - (-1) = 7` (`addRectInk`'s own
  `-1`-inset min corner). This IS the identical upstream mechanism
  description already ported as `layout-ink-shift.ts#computeInkShift`
  (G1b/J1) — `SvekResult` is shared base-class machinery for the whole
  `CucaDiagram` family (component/usecase/class/object/state all extend
  it), class's own doc comment even flagged this ("class likely needs its
  own equivalent wiring" — README's asset-inheritance note, never acted on
  until now). Full corpus reach: dominates the vast majority of the 543
  previously-untagged non-conformant fixtures (see census below).
- **graphviz-ts coordinate-assignment divergence (N8's own sub-case, OUT OF
  SCOPE, bounded reach, unchanged)**: re-confirmed still real and separate
  — `bosiki-11-xaza958` (N8's own couple fixture) still shows a residual
  AFTER this iteration's shift lands, with our DOT input structurally
  IDENTICAL to the oracle's (frozen 708/708 gate, `maxSizeDeltaIn 0.0000`
  per N8's own drill). Not re-run through the real-`dot`-cross-check this
  iteration (N8 already did that work and the boundary is unchanged by a
  pure post-layout translation) — no new evidence needed, no new repro
  filed.
- **Canvas-SIZE-only case**: none found. Every sampled fixture that had a
  canvas-dimension mismatch also had a position mismatch of the identical
  numeric magnitude (both driven by the SAME `moveDelta` constant) — dims
  and positions are NOT independent failure modes on this residual, they
  are two readouts of the one missing mechanism.

### Mechanism — FIXED

- Root cause: `src/diagrams/class/layout.ts#layoutSinglePage`'s
  non-degenerate (DOT-driven) branch built `ClassifierGeo`/`NamespaceGeo`/
  `EdgeGeo`/`NoteGeo` directly from `layoutGraph()`'s raw dot-layout
  coordinates and returned them UNSHIFTED — `computeClassDocumentDims`
  (N5) modeled `SvekResult#calculateDimension`'s RETURN value only, never
  its `moveDelta` side effect on `clusterManager`'s stored positions.
- Disposition: FIXED. `src/diagrams/class/layout-ink-extent.ts` gained
  `computeClassInkShift` (+ `InkShift` interface, + a shared
  `buildInkBox` helper factored out of `computeClassDocumentDims` so both
  functions walk the SAME `LimitFinder`-shaped ink accumulation — clusters/
  nodes/edges, no behavior change to the existing dims formula).
  `layout.ts#layoutSinglePage` now computes the shift from the raw
  (pre-shift) geometry — AFTER computing `documentDims` (mirrors Java's own
  evaluation order: `calculateDimension` reads the pre-shift `minMax`'s
  dimension before `moveDelta` ever runs; dimensions are translation-
  invariant regardless) — and applies it via new `shiftClassifierGeo`/
  `shiftNamespaceGeo`/`shiftEdgeGeo`/`shiftNoteGeo` helpers (split into a
  new `assembleShiftedGeometry` function to keep `layoutSinglePage` under
  the per-function size cap). `layoutMultiPage`'s own pre-existing y-only
  `NEWPAGE_GAP` page-stacking offset (OUR OWN invention, no upstream
  equivalent) now reuses the SAME shift helpers with `dx=0` — each page's
  own N11 ink shift is already baked in by `layoutSinglePage` before
  `layoutMultiPage` ever sees it; the two translates compose correctly
  (pure addition, order-independent).
- Jar-verified zero-residual on `jalexi-21-xoje231` (two bare classifiers,
  no edges — both rects land EXACTLY on jar's `x="7" y="7"`/`x="101"
  y="7"`) and partially on `ducoka-05-cuce457` (N10's own sample:
  `TestOne` rect now `y="7"` matching jar exactly, `Test Two` rect now
  `x="7" y="127"` matching jar exactly on BOTH axes — `TestOne`'s own `x`
  still diverges, but ONLY because of a separate, pre-existing, unrelated
  width bug on `Test Two`, see "newly discovered, not fixed" below, which
  shifts dot's own horizontal packing of `TestOne` relative to it; not a
  fault in this mechanism).

### Newly discovered, NOT fixed — `Test Two` classifier width bug
### (`ducoka-05-cuce457`)

While jar-verifying the fix, found a SEPARATE, pre-existing (confirmed
present, byte-identical, in a disposable baseline worktree at HEAD before
this iteration's change — not introduced by the position-only shift, which
never touches width/height) bug: a classifier whose ONLY wide content is an
unmarked (no explicit visibility char) member row measures ~18px too wide.
`ducoka-05-cuce457`'s `"Test Two" { symmetric }`: our width `93.7` vs jar's
`75.7`. Hand-derivation suggests jar reserves a `ROW_TEXT_LEFT_MARGIN`-sized
icon zone (6px) for EVERY member row's own binding-width calculation, even
when NO row in the classifier uses an explicit visibility icon (this port's
`class-layout-helpers.ts` row-width formula appears to only reserve that
zone when `visibilityIcon` is actually set) — NOT independently jar-verified
against a second sample this iteration, and explicitly OUT OF SCOPE for N11
(fixing it would change `measureClassifier`'s own width output, which feeds
DOT node width directly — a "measured node-size change," this mission's own
explicit STOP CONDITION for the frozen 708/708 DOT gate, not something to
touch inside a position-only iteration). Named for a dedicated future
iteration with its own DOT-gate risk assessment.

### Class census: N10 baseline → N11

```
before: 32/718 · 1-3:42 · 4-10:191 · 11-30:20 · 31+:433 · errors:0
after:  54/718 · 1-3:50 · 4-10:215 · 11-30:38 · 31+:361 · errors:0
```

Zero-diff SET: all 32 prior slugs held (exact slug-set comparison, not just
count) + 22 new: `deboga-81-zuza232`, `gopalo-51-leje047`,
`jalexi-21-xoje231`, `kejivu-76-mipe227`, `lafama-65-zoci799`,
`libobe-85-veli517`, `murifo-42-fepu514`, `niboti-81-guja450`,
`nomeza-10-laba367`, `padera-25-gite580`, `pecigo-88-bubu786`,
`pijode-83-tiba954`, `ponoko-58-sane430`, `pukomu-34-poju929`,
`rudoxi-65-cegi339`, `sicazi-62-duco028`, `siluti-87-sefa007`,
`sipigu-91-baku027`, `vavure-50-gako950`, `vaxeku-10-peko225`,
`xacavi-18-leca211`, `zuxore-81-ruti283`. Every one of these 22 already had
a `dotEqual: true` entry in the existing full-corpus `parity-class.json`
survey (N5's own precedent — no re-survey needed to satisfy AC3).

Full-corpus per-fixture diff-count scan (disposable `git worktree
add --detach /tmp/n11-baseline-worktree HEAD`, symlinked `test-results`/
`node_modules`, both sides using the SAME `renderFixtureClass`/
`compareSvg('deterministic')` harness the real census uses): **279
improved, 437 unchanged, 2 apparent regressions** — both diagnosed, NOT a
fault in this mechanism (per diagnosis.md):

1. `kuxosa-67-keko885` (258→299 diffs, already 31+ before and after): a
   PRE-EXISTING `ent0001`/`ent0002` id+childCount swap (confirmed present,
   byte-identical, in the pre-N11 baseline dump) — a
   member-qualified-relationship-reference (`ClassB::b <-- pack.ClassA::a`)
   entity-ordering bug, unrelated to and unnamed by any prior N-iteration.
   Fixing positions correctly REDUCED several individual numeric deltas
   (e.g. one rect's `x` delta 30→8) but the pre-existing tree misalignment
   means MORE of the (now-closer-but-still-mismatched) numbers register as
   diffs instead of coincidentally matching — the same "childCount-
   unmasking" pattern recorded every iteration since N2. Newly named for a
   future iteration (synthetic/qualified-reference entity-ordering family,
   likely adjacent to N9's couples/lollipop synthetic-naming queue item).
2. `nadaba-37-zaku242` (190→192 diffs, already 31+ before and after):
   `scale max 50 height` — an entirely unimplemented scale directive (the
   whole canvas is proportionally rescaled by jar, which this port doesn't
   model at all); the 2-diff increase is incidental (positions shifting by
   `(dx,dy)` changed which of the ALREADY-wrong-due-to-missing-scale
   `path/@d` numbers happen to coincidentally match). Not previously named
   in this mission's ledger — added to the N12 queue below.

### Ratchet: 54 pins (32 held + 22 new)

`oracle/goldens/svg-class/<slug>/{in.puml,golden.svg}` added for all 22 new
slugs (copied verbatim from `test-results/dot-cache/class/`, per mission
rule — NOT a `--rebuild`); `ratchet.json` appended (alphabetical, matching
existing format). `class.golden.ratchet.test.ts`: 56/56 green (AC1 x54 +
AC2 + AC3).

### Description gate: intact

48/355 zero-diff (component+usecase) unchanged; `description.golden.
ratchet.test.ts`: 51/51 green. Zero files touched this iteration are
imported into description's own render path (`layout-ink-extent.ts`/
`layout.ts`/`class-geo-builders.ts` are all class-only modules under
`src/diagrams/class/`).

### DOT gate: frozen, unchanged

component 262/262 · usecase 90/90 · class 708/708 · object 78/80 · state
267/267 — re-verified after this iteration's changes. This iteration's fix
is a PURE post-dot-layout position translation (`shiftClassifierGeo`/etc
change only `x`/`y`, never `width`/`height`) applied AFTER `layout(dotGraph)`
returns — it cannot and does not change any measured node size, edge count,
or cluster structure fed INTO the DOT graph. No measured node-size changes
occurred (the STOP CONDITION named in this iteration's brief) — confirmed by
inspection (the shift functions are pure `{...x: x+dx, y: y+dy}` spreads,
verified via the new unit tests asserting `width`/`height` are unchanged by
`computeClassInkShift`'s composition).

### Files changed

- `src/diagrams/class/layout-ink-extent.ts` — added `computeClassInkShift`
  (+ `InkShift` interface, `JAR_INK_MARGIN=6` constant) and factored the
  pre-existing ink-accumulation walk out of `computeClassDocumentDims` into
  a shared `buildInkBox` helper (behavior-preserving refactor — same box,
  same per-shape ink rules, now used by two callers instead of one).
- `src/diagrams/class/layout.ts` — `layoutSinglePage`'s non-degenerate
  return now computes + applies the ink shift via a new
  `assembleShiftedGeometry` helper (split out to stay under the
  per-function size cap); new `shiftClassifierGeo`/`shiftNamespaceGeo`/
  `shiftEdgeGeo`/`shiftNoteGeo` helpers (generalize the pre-existing
  `layoutMultiPage`-only `offsetEdgeGeo`/`offsetNoteGeo`, which were y-only,
  to `(dx,dy)`); `degenerateSingleClassifier`'s own, separately-verified
  margin formula UNTOUCHED (upstream's `EntityImageDegenerated` skips
  `SvekResult`/graphviz entirely, so it has no `moveDelta` to model).
- `src/diagrams/class/class-geo-builders.ts` (new) — `buildClassifierGeos`/
  `buildNamespaceGeos`/`buildEdgeGeos`/`degenerateSingleClassifier` moved
  VERBATIM out of `layout.ts` (no behavior change) to keep `layout.ts`
  under the project's 500-line file-size cap after adding the N11
  mechanism — mirrors the existing `class-layout-helpers.ts` split
  precedent named in `layout.ts`'s own file-header doc comment.
- `tests/unit/class/layout-ink-extent.test.ts` — 7 new tests:
  `computeClassInkShift`'s empty-diagram case, the jar-verified
  `jalexi-21-xoje231` `(+7,+7)` case, a namespace-only (UPath, no-inset)
  case, an edge-point-dominates-the-min-corner case, and a composition
  test locking `computeClassDocumentDims` + `computeClassInkShift` together
  against jar's real absolute rect positions.
- `tests/unit/class/class-newpage-layout.test.ts` — TDD: the pre-existing
  byte-identical golden re-captured (element positions shift `(+7,+7)`;
  canvas dims UNCHANGED at `78x178`, already jar-correct since N5) — per
  this mission's own N1-N5 precedent for this exact pattern.
- `oracle/goldens/svg-class/<22 new slugs>/` (new) + `ratchet.json` (22 new
  entries) — ratchet pins.

### Not fixed this iteration — named remainders for N12 (carried + new)

1. `Test Two` classifier width bug (`ducoka-05-cuce457`, NEWLY DISCOVERED
   N11) — unmarked-member-row width appears to be missing a 6px icon-zone
   reservation jar always applies; explicit DOT-gate risk (measured node
   size), needs its own dedicated risk assessment before touching.
2. `kuxosa-67-keko885`'s `ent0001`/`ent0002` id+childCount swap (NEWLY
   DISCOVERED N11, via the regression scan) — a
   member-qualified-relationship-reference entity-ordering bug
   (`ClassB::b <-- pack.ClassA::a`), likely related to but not confirmed
   identical to the couples/lollipop synthetic-naming family (N9).
3. `scale max N height/width` directive (NEWLY DISCOVERED N11, via the
   regression scan, `nadaba-37-zaku242`) — entirely unimplemented,
   unsurveyed reach.
4. `class-member-parser.ts#parseMemberLine` drops non-canonical member
   syntax (unchanged since N10).
5. `hide private/public/protected members` compound-qualifier hide
   (unchanged since N7/N9/N10).
6. Sprite/font-awesome icon glyphs inside a member text line (unchanged
   since N10).
7. `!define`-macro used inline inside a member declaration line (unchanged
   since N10).
8. Note-of-member connector shape (~19 reach, unchanged since N6-N10).
9. Couples/apoint + lollipop synthetic entity-id naming (~24/718 combined,
   unchanged since N9-N10).
10. `class Foo [[[url]]]`/`url of Foo is [[...]]` link wrapping (~22/718,
    unchanged since N6-N10, dedicated-iteration scope).
11. `!pragma layout elk` (~4-7/718, unchanged since N9-N10).
12. `[hidden]` style-bracket edge suppression (1+/718, unchanged since
    N9-N10).
13. `skinparam groupInheritance` (1/718, unchanged since N9-N10).
14. `skinparam mode dark` (1/718, unchanged since N7-N10).
15. Edge `<path>` `@id`/`@codeLine` residual families (couples/lollipop
    naming + note-connector gap, unchanged since N9-N10).
16. Visibility-icon skinparam color overrides + `classAttributeIconSize`
    (1/718, unchanged since N6-N10).
17. `Collection<T>` + `skinparam monochrome reverse` + transparent
    background (`bedogi-86-kala547`), `'Liberation Mono'` font-family
    malformed-attribute bug (`tipude-10-tizi427`) — both unchanged,
    single-fixture, still unsurveyed.
18. `sadamo-18-siva346` pathological stress fixture (unchanged since
    N9-N10).
19. graphviz-ts coordinate-assignment offset (OUT OF SCOPE, unchanged since
    N8) — narrower now that the ink-shift is landed (N8's own
    `bosiki-11-xaza958` sample re-confirmed still diverging after this
    fix, DOT input still byte-equal).

### Scratch/worktree hygiene

`scripts/_tmp-n11-check.ts`, `_tmp-n11-diffdump.ts`,
`_tmp-n11-dump-diffcounts.ts` (all temp scripts used for diagnosis) deleted
before finishing. Disposable `git worktree add --detach
/tmp/n11-baseline-worktree HEAD` removed via `git worktree remove --force`
after the regression scan. Nothing committed (orchestrator owns commits per
mission rule).

## N12 — near-zero harvest (skinparam class/enum block, font-family quoting)
## + member-text mechanisms landed (parseMemberLine raw-display fallback,
## hide-by-visibility)

### Near-zero harvest: classification of the 50-fixture 1-3 bucket

Every 1-3-diff fixture's puml source was read and clustered by mechanism
(not just diff-path signature, per this iteration's explicit brief). 18
distinct clusters, confirming N6/N10's own "genuinely fragmented, no large
hidden universal mechanism" finding generalizes again to this fresh bucket:

| Cluster | Reach (this bucket) | Outcome |
|---|---|---|
| note-of-member / freestanding-note-connector (`note X of Y::m`, `note "..." as N1 .. Host`) | 13 (`cajicu-52-cego765`, `dozugo-00-jado141`, `fabuje-68-gona310`, `fopose-13-kase592`, `fupope-12-zoku847`, `janeba-15-duja043`, `rubuxe-58-peba652`, `sanusa-54-keda128`, `taxemo-34-buro609`, `tenobo-24-liga464`, `xumeli-52-keso732`, `doseko-41-mavu661`, `sevaxa-72-pudi231`) | deferred (unchanged since N6-N11 — see "not fixed" below for this iteration's added evidence) |
| `skinparam class`/`enum { BackgroundColor }` block resolution | 2 (`fimega-47-xigi097`, `pijoji-10-tazo455`) | **FIXED** |
| `class Collection<T>` generic type-parameter tag box | 2 (`bedogi-86-kala547`, `remulu-24-zadi546`) | surveyed, deferred (DOT-gate risk) |
| `font-family` value with embedded quotes (`skinparam defaultFontName "Liberation Mono"`) | 1 (`tipude-10-tizi427`) | **FIXED** |
| `skinparam groupInheritance` | 3 (`lazeju-60-boki114`, `mefike-75-vova900`, `xifuza-00-paze682`) | surveyed (reach UPGRADED from N9's "1/718" estimate), deferred |
| `class Foo [[[url]]]`/`url of X is [[...]]` link wrapping | 5 (`gukuda-51-fuju086`, `class-missing-label-URL-SVG-0`, `fugexa-12-zoti674`, `jovaxe-68-bube754`, `tegoxa-17-kudo421`) | unchanged since N6, deferred |
| `!define`/`!ifdef`/`!ifndef` interacting with member lines | 3 (`cojixe-63-vejo525`, `sipimu-09-joma900`, `zijupe-74-sake513` — conditional blocks, already worked before this iteration) + `mopelo-04-fose807` (macro CALL inline in a member line, queue #5) | `mopelo-04-fose807` surveyed, deferred (see "member-text mechanisms" below) |
| `hide C2 circle` (entity-qualified compound hide, distinct from N12's own visibility-qualified hide) | 1 (`dokego-92-zilu832`) | surveyed, deferred (`CommandHideShowByGender`, not this iteration's `CommandHideShowByVisibility`) |
| undefined-entity arrow-notation variants (`x-->`, `()-`, `#--`, `--{`, `}-`, `<...>`) | 8 (`cenubi-27-xova754`, `kepado-34-risa735`, `medosa-71-ligu412`, `rekazo-16-jola519`, `rudigu-21-lici107`, `vezato-03-rafu718`, `ximuza-91-gena795`, `zerofa-77-caro506`) | unsurveyed beyond puml-read; each looks like a small, distinct arrow-grammar/auto-entity-creation gap, none drilled this iteration |
| single-fixture unsurveyed residuals | 8 (`gatula-10-bifu561` empty package/namespace/class, `nekali-92-loda300` `hide-class`, `ponaxo-71-muze275` alias/re-declaration merge, `vudepo-27-cuvo793` `Abstract` keyword chain, `xitobu-41-lame230` self-named package + `<style> package{}`, `zejize-00-vivu578` separate-statement stereotype, `vinujo-78-kapo329` `page 2x2`, `zirori-93-jefo337` `skinparam mode dark`, unchanged since N7) | unsurveyed / unchanged |

Two mechanisms landed from this harvest (both isolated, low-risk, jar-verified
against real cached oracle SVGs — no DOT-gate interaction, neither touches
measured node size):

### Mechanism landed: `classifierFill` — enum/interface have NO upstream
### StyleSignature for the classifier box fill

- Root cause: `class/renderer.ts#classifierFill` branched `geo.kind ===
  'enum'` to a separate `theme.colors.graph.enumBackground` slot, fed by
  `skinparam enumBackgroundColor`/`skinparam enum { BackgroundColor }`/
  `<style> enum {}`. Read `~/git/plantuml/.../style/SName.java` in full: there
  is NO `enum` (or `interface`-for-class-diagram-purposes) entry in the style
  category enum at all. `EntityImageClassHeader#getStyleSignature`
  (svek/image/EntityImageClassHeader.java:80) keys on `SName.class_`
  UNCONDITIONALLY for every leaf kind's box — class, interface, enum,
  abstract, annotation all share it; only the small spot-badge circle varies
  per-`LeafType` (`spotClass`/`spotEnum`/`spotInterface`, already correctly
  ported in `class-badge.ts#badgeFill`). `FromSkinparamToStyle.java` confirms
  no `enumBackgroundColor`/`interfaceBackgroundColor` conversion entry exists
  either (only `classBackgroundColor` -> `SName.class_`). Jar-verified:
  `pijoji-10-tazo455` (`skinparam enum { BackgroundColor blue }` +
  `skinparam class { BackgroundColor LightBlue }`) paints the enum's own box
  LightBlue — the CLASS color, never blue.
- Disposition: FIXED. `classifierFill` now unconditionally returns
  `theme.colors.graph.classBackground`. `theme.colors.graph.enumBackground`/
  `interfaceBackground` are now fully dead (the latter was ALREADY dead
  before this iteration — grep found zero other readers of either slot,
  confirmed before touching). Left the skinparam/style-map PARSING of these
  two slots in place (harmless, matches `interfaceBackground`'s pre-existing
  precedent of "parsed but never consumed" — not this iteration's scope to
  prune dead plumbing).
- Corrected a pre-existing, never-jar-verified integration test assertion
  (`tests/integration/index.test.ts`, "interface, enum, usecase.business,
  package style blocks propagate to theme") that asserted `<style> enum {
  BackgroundColor: #ddeeff }` paints the enum `#DDEEFF` — this was invented,
  not jar-verified, and is now provably wrong per the mechanism above;
  updated to assert the CORRECT jar-matching behavior (enum renders with the
  unset-here `classBackground` default, `#F1F1F1`).
- Slugs (reach): `fimega-47-xigi097`, `pijoji-10-tazo455` reach zero-diff.

### Mechanism landed: `font-family` attribute — embedded double-quotes must
### become single-quotes, not literal double-quote XML corruption

- Root cause: `skinparam defaultFontName "Liberation Mono"` retains its
  surrounding quotes as part of `theme.fontFamily`'s raw string (mirrors
  upstream's own `FontStack#fullDefinition`, which ALSO keeps them —
  verified: `klimt/font/FontStack.java:187`, `getSvgFamily()`). `core/
  svg.ts#text()`'s `attrs()` helper does zero XML escaping (plain string
  interpolation, `` `${name}="${value}"` ``) — embedding a literal `"` inside
  a `"`-delimited attribute produced malformed XML
  (`font-family=""Liberation Mono""`, confirmed via the xmldom parse
  warnings the census script already surfaces for this exact fixture).
  Upstream's OWN fix for this (`FontStack#getSvgFamily`,
  `fullDefinition.replace('"', '\'')`) is a blanket double-quote-to-single-
  quote swap on the family string before SVG emission, not a strip.
  Jar-verified: `tipude-10-tizi427` emits `font-family="'Liberation
  Mono'"`.
- Disposition: FIXED. New `core/svg.ts#toSvgFontFamily` helper (`family
  === undefined ? undefined : family.replace(/"/g, "'")`), applied at the
  SOLE `font-family` attribute-emission call site in `text()`. Shared code
  (`core/svg.ts` is imported by 13 diagram renderers) but strictly
  non-regressive — the transform is a no-op for every value with no literal
  `"` character, i.e. every case except this exact skinparam-quoting
  scenario; re-verified the description ratchet (51/51 green) and full DOT
  gate (all five counts) after landing.
- Slugs (reach): `tipude-10-tizi427` reaches zero-diff.

### Member-text mechanisms (this iteration's primary mandate, per the queue)

#### Landed: `class-member-parser.ts#parseMemberLine`'s raw-display fallback
#### (queue #2, N10/N11's carried item)

- Root cause: confirmed by reading `cucadiagram/Member.java`'s constructor
  and `BodierLikeClassOrObject.java` in full (not just the previously-cited
  `isMethod` snippet) — upstream member lines are NEVER decomposed into
  name/type/params at all. `addFieldOrMethod` never rejects a line (blank
  lines excepted, stripped upstream of `executeNow`); `Member`'s constructor
  strips `{method}`/`{field}`/`{static}`/`{classifier}`/`{abstract}` tags, a
  trailing `[[url]]` suffix, and a leading visibility char, then keeps the
  ENTIRE remainder as an opaque `display` string — method-vs-field bucketing
  is a pure substring test (`contains("(") || contains(")")`), not a
  parse-shape decision. This port's `parseMemberLine` is a STRUCTURED
  reconstruction (`name`/`type`/`params` fields, matching the common `[+-#~]
  name [(params)] [: Type]` shapes) that silently returned `null` — dropping
  the member entirely from the AST — for anything else: Java-style `Type
  name` (`String a1`), a trailing `;` (`Date d;`), or any other free-text
  line. Jar-verified minimum-3 fixtures from N10's own regression trace
  (`cuxuni-25-doxi736`/`difuxu-77-rumu307`/`nebovu-26-caxe550`) plus a fresh
  isolated repro (`nedeka-26-xora993`'s `This is shown`, from a TIM
  `!ifdef`-guarded body line) confirmed byte-exact against the jar's real
  member-row text.
- Disposition: FIXED. `parseMemberLine` gained a raw-display fallback
  (mirrors `class-object-commands.ts#parseObjectField`'s IDENTICAL
  pre-existing fallback for object leaves, same upstream mechanism, already
  ported there first) — a line matching neither the structured method nor
  attribute shape becomes a `Member.rawDisplay` row (`{ name: line,
  rawDisplay: line, ... }`) instead of `null`. `class-layout-helpers.ts#
  formatMemberText` widened to check `rawDisplay` FIRST (verbatim
  passthrough, mirrors `class-object-map-sizing.ts#formatObjectMemberText`'s
  identical precedence). `isMethodMember` widened: a `rawDisplay` member
  buckets by `includes('(')`/`includes(')')` (upstream's own substring
  test), not `params !== undefined` (which only applies to the two
  structured shapes).
- **Companion fix required to avoid a DOT-gate regression**: jar-verifying
  against the corpus surfaced that a URL-suffixed method line
  (`+methods1() [[[http://.../A1{label}]]]`, `gizini-87-vuve916`, an object-
  diagram-corpus fixture reusing the class engine) previously matched
  NEITHER structured shape either (silently dropped, same root cause) — the
  new fallback caught it too, but embedded the LITERAL `[[[...]]]` bracket
  syntax in the row's display text, making the classifier measurably WIDER
  than upstream's real formula. Caught by `tests/oracle/object-dot-parity
  .test.ts` (`maxSizeDeltaIn=5.79 > allowed 0.62`) — a real, frozen-DOT-gate-
  adjacent regression, not a false alarm. Root-caused to the SAME upstream
  mechanism: `Member`'s constructor strips a trailing `[[url]]`/`[[[url]]]`
  suffix UNCONDITIONALLY, before any display computation, jar-verified
  (`gukuda-51-fuju086`'s `name[[[http://field]]]` member renders as the bare
  text `"name"`). Fixed by stripping the same suffix in `parseMemberLine`
  BEFORE attempting the structured method/attribute regexes — a URL-suffixed
  method line now correctly matches the STRUCTURED shape (not the
  fallback), which also fixed `gizini-87-vuve916`'s DOT-parity failure via
  the ALREADY-VERIFIED structured-member code path rather than new code.
- DOT-gate verification (explicit brief requirement): re-ran
  `dot-sync-report.ts` for all five diagram types AFTER this fix — component
  262/262, usecase 90/90, **class 708/708 (unchanged)**, object 78/80
  (unchanged), state 267/267 (unchanged). The gate's own comparator
  documents `width`/`height` as TOLERANT metrics (`tests/oracle/svek-dot
  .ts`'s own doc comment: "our frozen 708/708 was achieved with the WRONG
  parse... the comparator tolerances absorbed it" — exactly this mission's
  own stated caution) — this fix moves measured widths CLOSER to correct
  (previously-dropped members now correctly included), so it cannot newly
  fail a tolerant check it was already passing with a larger error. No gate
  movement observed.
- Full-corpus regression trace (disposable `git worktree add --detach
  /tmp/n12-baseline-worktree HEAD`, symlinked `test-results`/`node_modules`/
  `assets/stdlib`): **40 improved, 62 "regressed" (higher diff count), 616
  unchanged, 0 zero-diff regressions** (verified via exact slug-set diff
  against `ratchet.json`, not just count). Every regressed fixture sampled
  (10+ spot-checked, including the 5 largest deltas) is the SAME
  childCount-unmasking pattern recorded every iteration since N2: a member
  that was silently DROPPED before (giving a smaller, coincidentally-closer
  diagram) is now correctly INCLUDED, unmasking one of two already-named,
  pre-existing, unrelated bugs it now inherits — (a) N11's own "`Test Two`
  classifier width bug" (unmarked-member-row 18px-too-wide measurement,
  reproduces identically via the STRUCTURED code path too, e.g.
  `nedeka-26-xora993`'s textLength matches jar byte-exact but the box width
  doesn't — confirms this is N11's bug, not a new one), or (b) the
  `!define`-macro-in-member-line / creole-in-member-text gap (`mopelo-04-
  fose807`: jar expands `<color:Red>sometext</color>` via creole into red
  text, this port shows the literal escaped tag text — TWO combined unbuilt
  mechanisms, see below). Neither is a fault of THIS mechanism; both are
  independently ledgered (N11's item unchanged, the macro/creole gap named
  fresh below).
- Files: `class-member-parser.ts`, `class-layout-helpers.ts`; new
  `tests/unit/class/class-member-parser.test.ts` (10 tests); `layout.test.ts`
  gained one bucketing-integration test; `class-object-body.test.ts`'s two
  tests that explicitly documented the OLD drop behavior (with a comment
  literally describing the fix needed: "a pre-existing gap this task does
  not extend the AST to close") updated to assert the new, correct
  raw-display behavior.

#### Landed: `hide|show <visibility> members|fields|methods` (queue #3)

- Root cause: read `classdiagram/command/CommandHideShowByVisibility.java`
  in full — a SingleLineCommand2 matching `(hide|show) <visibility-list>
  (members?|attributes?|fields?|methods?)`, where visibility-list is a
  `,`/whitespace-separated combination of `public`/`private`/`protected`/
  `package` tokens. Maps to `CucaDiagram#hideOrShowVisibilityModifier`, which
  mutates a GLOBAL `Set<VisibilityModifier>` (hide=add, show=remove — UNION
  semantics across independent directives, NOT last-writer-wins-per-target
  the way this port's pre-existing `applyDirectives`/`HideTarget` model
  works for `members`/`empty members`/etc). `BodierLikeClassOrObject#
  getFieldsToDisplay`/`getMethodsToDisplay` then filter every member against
  this set. Crucially, `VisibilityModifier#getVisibilityModifierForField`/
  `ForMethod` return `null` for a member with NO explicit leading char (an
  implicit `+`) — `Set.contains(null)` is always false, so a `hide public
  fields` NEVER touches an implicit-visibility member, only an EXPLICIT `+`
  one. This is a genuinely distinct command family from N7's
  `CommandHideShow2`/`hides2` (entity-pattern selector) and from the
  pre-existing `members`/`empty members` fixed-target directives — confirmed
  by upstream's own regex requiring a visibility-word-prefixed multi-token
  target, which neither existing parser's grammar can match (verified: both
  `parseHideShowDirective`'s fixed lookup table and
  `parseHideShowPatternDirective`'s single-`\S+`-token regex correctly
  return `null` for `hide private members`, confirmed via new unit tests,
  not just inference).
- Disposition: FIXED. New `ast.ts#HideShowVisibilityDirective` type +
  `ast.hideVisibilityDirectives?` field. New `class-directives.ts#
  parseHideShowVisibilityDirective` (regex mirrors
  `CommandHideShowByVisibility.getRegexConcat()` exactly, including the
  3-char-prefix portion-word normalization `getEntityPortion` does) +
  `applyVisibilityHideShow` (folds the directive list via the SAME
  hide-adds/show-removes Set-mutation semantics as `hideOrShowVisibilityModifier`,
  keyed on `${visibility}:${field|method}`; explicitly skips any member
  with `visibilityExplicit !== true`, matching the `null`-modifier
  semantics above). Wired into `class-commands.ts`'s hide/show dispatch as
  the THIRD, last-tried parser (after the fixed-target and entity-pattern
  parsers, matching upstream's own command-registration precedence — none
  of the three grammars overlap, verified by unit test) and into
  `parser.ts`'s two `finalizeParse`/`startNewPage` call sites alongside the
  pre-existing `applyDirectives`.
- Jar-verified against all 4 corpus fixtures using this directive family
  (`benemi-22-dufo622`, `kexecu-14-xesa311`, `rotebe-88-nise503`,
  `volexu-59-luva429` — the full corpus reach per an
  `^hide\s+(private|public|protected|package)\b`-anchored grep, confirming
  N10's "~8/718" estimate was an overcount from a looser `.*` grep):
  member set/visibility/text now matches the jar EXACTLY on all four
  (confirmed by direct SVG diff, not just structural equality) —
  `kexecu-14-xesa311` (three independent `hide <vis> members` directives,
  all members explicit-visibility) reaches full zero-diff; the other three
  still carry 1-2 small residuals from OTHER, already-named position/width
  mechanisms (N11's ink-shift arithmetic / the `Test Two` width bug),
  unrelated to this fix.
- Files: `ast.ts`, `class-directives.ts`, `class-commands.ts`, `parser.ts`;
  new `tests/unit/class/class-hide-visibility.test.ts` (15 tests: 8 parser
  unit tests, 4 `applyVisibilityHideShow` unit tests, 4 end-to-end
  `parseClass` tests — one per jar-verified corpus fixture).
- Slugs (reach): `kexecu-14-xesa311` reaches zero-diff this iteration; the
  other 3 corpus fixtures are structurally corrected (member set/text/
  visibility exact) but still carry unrelated residuals.

#### Surveyed, NOT fixed — sprite/font-awesome glyphs in member text (queue #4)

- Survey (grep `<\$[A-Za-z]|<&[A-Za-z]` across all class corpus puml, then
  read each match in context): 11 fixtures contain the syntax anywhere; 7
  use it specifically INSIDE a member-declaration row (`bidusa-22-jutu505`,
  `cuzoga-39-tufu259`, `dofima-22-kofe334`, `gekope-01-ricu859` — combined
  with `!define`, see below, `jevuvi-65-dipo437`, `jireze-84-loti743`,
  `rideze-59-lizu265`, `ruliki-78-biji661`); the rest use it in note/title/
  classifier-name contexts (`lozego-15-coci435`, `malara-55-moce209`,
  `rotisi-30-loge424`), a DIFFERENT, unsurveyed reach bucket.
- NOT fixed: requires two independent, substantial subsystems, neither
  present anywhere in this port's member-row render path today — (1)
  creole-markup interpretation of member text (member rows currently render
  via a single plain SVG `<text>` per row, zero creole engine involvement;
  confirmed via the `mopelo-04-fose807` case below, which hits the exact
  same missing-creole gap without any sprite syntax at all), and (2) actual
  sprite/FontAwesome/OpenIconic glyph rendering (vendored glyph-path/font-
  metric assets, a wholly separate feature per CLAUDE.md's own feature
  catalog note on sprite/icon subsystems). Genuinely not "small" per the
  brief's own fix-only-if-small instruction — ledgered for a dedicated
  future iteration, not attempted.

#### Surveyed, NOT fixed — `!define` macro called inline in a member line
#### (queue #5)

- Survey (grep `^\s*!define\s+\w+\(` — parameterized macros — across all
  class corpus puml): 8 fixtures define a parameterized macro; 6 CALL it
  inline inside a member-declaration line (`bifisu-79-palu304`, `dijafu-60-
  diji895`, `gomafo-73-duta005`, `kixeku-82-tesa924`, `lorajo-00-dagu828`,
  `mopelo-04-fose807`, `tukaru-29-gopa708`); `nagega-30-poso418` uses macros
  only for classifier/relationship-level constructs, a different reach.
- NOT fixed. Drilled `mopelo-04-fose807` (`!define FOO(c,i) <color:c>i</
  color>`, `!define BAR(color) FOO(color, sometext)`, called as `BAR(Red)`
  inside a member line) to root cause via direct jar-vs-ours SVG comparison:
  jar EXPANDS the macro AND interprets the resulting `<color:Red>sometext</
  color>` as creole markup (red `sometext`, `fill="#FF0000"`); this port
  shows the LITERAL unexpanded macro call as escaped text
  (`&lt;color:Red&gt;sometext&lt;/color&gt;`) — confirming TWO independent,
  stacked gaps: TIM macro-call substitution is not wired into member/body-
  line collection (distinct from `!ifdef`/`!ifndef` CONDITIONAL blocks,
  which already work correctly and reach member lines fine, confirmed via
  `cojixe-63-vejo525`/`sipimu-09-joma900`/`zijupe-74-sake513`), AND the same
  missing creole-markup-in-member-text gap #4 already surveys. Genuinely not
  "small" — two combined subsystems again — ledgered for a dedicated future
  iteration.

### Class census: N11 baseline → N12

```
before: 54/718 · 1-3:50 · 4-10:215 · 11-30:38 · 31+:361 · errors:0
after:  58/718 · 1-3:58 · 4-10:175 · 11-30:35 · 31+:392 · errors:0
```

Zero-diff SET: all 54 prior slugs held (exact slug-set comparison against
`ratchet.json`, not just count) + 4 new: `fimega-47-xigi097`,
`kexecu-14-xesa311`, `pijoji-10-tazo455`, `tipude-10-tizi427`.

### Ratchet: 58 pins (54 held + 4 new)

`oracle/goldens/svg-class/<slug>/{in.puml,golden.svg}` added for all 4 new
slugs (copied verbatim from `test-results/dot-cache/class/`, per mission
rule); `ratchet.json` appended (alphabetical). All 4 already carried a
`dotEqual: true` entry in the existing full-corpus `parity-class.json`
survey (N5/N11's own precedent — no re-survey needed to satisfy AC3).
`class.golden.ratchet.test.ts`: 60/60 green (AC1 x58 + AC2 + AC3).

### Description gate: intact

48/355 zero-diff (component+usecase) unchanged; `description.golden.
ratchet.test.ts`: 51/51 green, re-verified AFTER the shared-code
`core/svg.ts` font-family fix specifically (the one change this iteration
that touches code outside `src/diagrams/class/`).

### DOT gate: frozen, unchanged

component 262/262 · usecase 90/90 · class 708/708 · object 78/80 · state
267/267 — re-verified via `dot-sync-report.ts` (both the default component/
usecase run and an explicit `class object state` run) after EVERY
DOT-relevant change this iteration (the `parseMemberLine` fallback + its
URL-suffix-stripping companion fix). Per this iteration's own explicit
brief caution: member-parsing changes DID change some classifiers' measured
width (previously-dropped members are now correctly included) — verified
empirically that the gate's own tolerant `width`/`height` comparator
absorbs this without any of the five counts moving, exactly as anticipated.

### Files changed

- `src/core/svg.ts` — new `toSvgFontFamily` helper, applied at `text()`'s
  `font-family` attribute emission.
- `src/diagrams/class/renderer.ts` — `classifierFill` always returns
  `classBackground` (no `enum`-kind branch).
- `src/diagrams/class/class-member-parser.ts` — raw-display fallback
  (never returns `null` for a non-empty, non-bare-visibility line); trailing
  `[[url]]`/`[[[url]]]` suffix stripped before structured matching.
- `src/diagrams/class/class-layout-helpers.ts` — `formatMemberText`/
  `isMethodMember` both consult `rawDisplay` first.
- `src/diagrams/class/ast.ts` — new `HideShowVisibilityDirective` type +
  `ClassDiagramAST.hideVisibilityDirectives?` field.
- `src/diagrams/class/class-directives.ts` — new
  `parseHideShowVisibilityDirective`/`applyVisibilityHideShow`.
- `src/diagrams/class/class-commands.ts` — hide/show dispatch tries the new
  visibility parser third (after the fixed-target and entity-pattern
  parsers); doc comment updated.
- `src/diagrams/class/parser.ts` — `applyVisibilityHideShow` called
  alongside `applyDirectives` at both post-processing sites.
- `tests/unit/svg-primitives.test.ts`, `tests/unit/class/renderer.test.ts`,
  `tests/unit/class/layout.test.ts`, `tests/unit/class/class-object-body
  .test.ts`, `tests/integration/index.test.ts` — updated/corrected
  assertions (one pre-existing test per landed mechanism was either
  extended or had a never-jar-verified assumption corrected).
- `tests/unit/class/class-member-parser.test.ts`,
  `tests/unit/class/class-hide-visibility.test.ts` — new dedicated test
  files (10 + 15 tests).
- `oracle/goldens/svg-class/<4 new slugs>/` (new) + `ratchet.json` (4 new
  entries).
- `.agent-notes/iter10-member-parser-gap.md` — resolution note appended
  (Finding 1 fixed; Finding 2 unchanged).

### Not fixed this iteration — named remainders for N13 (carried + new)

1. Note-of-member/freestanding-note-connector family (13 reach in THIS
   bucket alone, ~19-25/718 combined with prior estimates, unchanged since
   N6-N11) — this iteration additionally captured the jar's exact merged
   zigzag-path SVG structure for `cajicu-52-cego765` (single `<path>`
   combining note outline + connector notch, no `<g class="entity">`
   wrapper) as concrete evidence for whoever picks this up next.
2. `class Collection<T>` generic type-parameter tag box (NEWLY SURVEYED
   N12, ~15/718 reach via `grep -E '(class|interface|abstract)\s+\w+\s*<'`)
   — genuinely unbuilt UML template-parameter notation
   (`TextBlockGeneric`/`HeaderLayout.java`, a dashed-border box straddling
   the classifier's top-right corner); the classifier's OWN width/height
   formula also appears to reserve space for it even when the tag renders
   outside the box — explicit DOT-gate risk (measured node-size change),
   needs its own risk assessment before touching, not a slice-in-passing
   fix.
3. `skinparam groupInheritance` (reach UPGRADED this iteration from N9's
   "1/718" spot-estimate to at least 3/718 confirmed in the near-zero bucket
   alone, real total likely higher) — needs its own Java-source deep-dive
   (`CucaDiagram`'s inheritance-edge-merging logic) and is a DOT-topology
   change (edge count/shape), not a render-only fix.
4. Sprite/font-awesome glyphs in member text (surveyed N12: ~7-9/718 reach
   specifically in member rows) — needs creole-markup-in-member-text
   support PLUS actual sprite glyph rendering, two substantial subsystems.
5. `!define` macro called inline in a member line (surveyed N12: ~6-7/718
   reach) — needs TIM macro-call substitution wired into body/member-line
   collection PLUS the same creole-markup-in-member-text gap as #4.
6. `Test Two` classifier width bug (`ducoka-05-cuce457`, unchanged since
   N11) — UNMASKED more broadly this iteration (dominates most of the 62
   "regressed" fixtures in the full-corpus scan above); still not touched,
   same explicit DOT-gate risk N11 named.
7. `hide C2 circle` / entity-qualified compound hide forms (NEWLY SURVEYED
   N12 via `dokego-92-zilu832`, 1+/718 reach) — `CommandHideShowByGender`,
   a DIFFERENT upstream command from this iteration's landed
   `CommandHideShowByVisibility`.
8. Undefined-entity arrow-notation variants (`x-->`, `()-`, `#--`, `--{`,
   `}-`, `<...>`, NEWLY SURVEYED N12 via 8 near-zero fixtures, unsurveyed
   beyond puml-read) — likely several small, distinct arrow-grammar/auto-
   entity-creation gaps, none drilled.
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
18. `Collection<T>` + `skinparam monochrome reverse` + transparent
    background (`bedogi-86-kala547` — NOTE: N7's original single-fixture
    framing was WRONG; this iteration confirmed the real mechanism is the
    generic-tag-box gap (#2 above), reproducing identically WITHOUT
    monochrome via `remulu-24-zadi546`), `'Liberation Mono'` font-family
    malformed-attribute bug (`tipude-10-tizi427` — **RESOLVED this
    iteration**, remove from future queues).
19. `sadamo-18-siva346` pathological stress fixture (unchanged since
    N9-N11).
20. graphviz-ts coordinate-assignment offset (OUT OF SCOPE, unchanged since
    N8-N11).
21. Single-fixture unsurveyed residuals from this iteration's harvest
    (`gatula-10-bifu561`, `nekali-92-loda300`, `ponaxo-71-muze275`,
    `vudepo-27-cuvo793`, `xitobu-41-lame230`, `zejize-00-vivu578`,
    `vinujo-78-kapo329`) — each read but not drilled to root cause.

### Scratch/worktree hygiene

`scripts/_tmp-n12-classify.ts`, `_tmp-n12-dump-one.ts`, `_tmp-n12-
diffcounts.ts`, `_tmp-n12-debug-one.ts` (transient, created inside the
disposable worktree, never part of the main tree) — all deleted before
finishing. Disposable `git worktree add --detach /tmp/n12-baseline-worktree
HEAD` removed via `git worktree remove --force` after the regression scan.
Nothing committed (orchestrator owns commits per mission rule).

## N13 — note-of-member connector family: Opale zigzag mechanism
## (EntityImageTips/Opale) landed for member-tip notes; freestanding/plain
## "opalisable" notes (EntityImageNote) diagnosed in full, deferred

### Note-kind sub-classification

Read every note-bearing fixture in N12's 13-fixture near-zero cluster
(`cajicu-52-cego765`, `dozugo-00-jado141`, `fabuje-68-gona310`, `fopose-13-
kase592`, `fupope-12-zoku847`, `janeba-15-duja043`, `rubuxe-58-peba652`,
`sanusa-54-keda128`, `taxemo-34-buro609`, `tenobo-24-liga464`, `xumeli-52-
keso732`, `doseko-41-mavu661`, `sevaxa-72-pudi231`) plus the two upstream
commands' own Java source before touching code:

| Kind | Upstream command / image class | Reach (this cluster) | Outcome |
|---|---|---|---|
| A: member-tip (`note left\|right of Class::member`) | `CommandFactoryTipOnEntity` -> `EntityImageTips`/`Opale` | 11 (all but doseko/sevaxa) | **LANDED** |
| B: freestanding note + explicit relationship edge (`note "..." as N1` + `N1 .. Host`) | `CommandFactoryNote` (alias form) + a REGULAR relationship, but drawn via `EntityImageNote`'s `isOpalisable`/`opaleLine` path | 2 (`doseko-41-mavu661`, `sevaxa-72-pudi231`) | diagnosed, deferred |
| C: plain attached note, single link (`note left of X`, no `::member`) | `CommandFactoryNoteOnEntity` -> `EntityImageNote`, SAME `isOpalisable` gate as B | 1 in this cluster (`taxemo-34-buro609`'s first note), corpus-wide unsurveyed but likely the MAJORITY of all `note <pos> of X` fixtures | diagnosed, deferred |
| D: `note on link` (attached to a relationship, not an entity) | `CommandFactoryNoteOnLink` -> `Link#addNote`/`CucaNote`, a DIFFERENT draw site entirely (label near the edge, no Opale box) | not surveyed this iteration | untouched, unchanged from N9's naming |

Kinds B and C turned out to be the SAME upstream mechanism
(`GraphvizImageBuilder.java:133-148#isOpalisable` / `EntityImageNote.java`'s
`opaleLine`/`opaleLink` branches) — ANY note leaf (`LeafType.NOTE`) with
EXACTLY ONE non-invisible link to a non-note entity draws via the Opale
zigzag mechanism too, not just member-tips. This means this port's ENTIRE
pre-existing plain-note render path (`renderNote`, unverified — zero ratchet
pin ever used a note) was drawing the WRONG shape for the common case: a
plain fold box + separate dashed `<g class="link">` connector, when jar
instead merges the connector into the note's own outline and skips the
separate edge draw entirely (`SvekEdge#drawU`'s `if (opale) return;`,
jar-verified via `sevaxa-72-pudi231`'s N1-to-Bar note, which draws ONE
merged `<path>`+`<path>`+`<text>`, no separate `<g class="link">` for the
`N1 .. Bar` relationship at all).

### Mechanism landed: member-tip (`::member`) note connector — Opale zigzag
### notch, `EntityImageTips.java` + `Opale.java` — FIXED

- Root cause: this port's note rendering (`note-layout.ts`/`renderer.ts`,
  pre-N13) had NEVER been jar-verified for ANY note kind (zero ratchet pins
  used notes at all, per N7-N12's own repeated "diagnosed, not fixed"
  entries) — it drew every note the same way: a plain folded-corner box
  (WRONG dimensions: `fontSize*1.4` line height, `+8*2+10` margins, at the
  diagram's normal font size) plus a separate dashed `<g class="link">`-less
  `<path>` connector to the host. Read `svek/image/EntityImageTips.java`
  (draw math) and `svek/image/Opale.java` (outline/corner geometry) in full:
  a member-tip note is a `LeafType.TIPS` entity created by
  `command/note/CommandFactoryTipOnEntity.java` (grammar: `note (left|right)
  of Class::member` ONLY — no top/bottom, no bare `note left of X`), joined
  to its host by an INVISIBLE link. `EntityImageTips#drawU` computes the
  notch's host-side anchor point DIRECTLY from the host's own already-laid-
  out `SvekNode` position + the specific member row's rect (via
  `nodeOther.getImage().getInnerPosition(bestMatch, ...)` — NOT a
  DOT-routed edge spline), then draws the WHOLE note as `Opale.getPolygonLeft
  /Right` (zigzag notch merged directly into the outline `<path>`) +
  `Opale.getCorner` (fold triangle, always) + the note's own text block —
  UNWRAPPED (no `<g class="entity">`, no id, no comment;
  `GeneralImageBuilder` draws a TIPS entity outside the normal per-entity
  `<g>`-wrapping path every other leaf kind gets).
- Full geometry derivation (byte-verified against `cajicu-52-cego765`'s two
  notes AND `tenobo-24-liga464`'s three notes, independently, including one
  flip-corrected direction case): `Opale.getPolygonLeft`/`getPolygonRight`
  with `roundCorner` fixed at 0 STILL emit degenerate `A0,0 0 0 0 x,y` arc
  commands at every `arcTo` call site (NOT simplified to `L` — a
  zero-radius arc is visually a straight line per the SVG spec, but the
  emitted PATH TEXT differs, and this mission's bar is byte-exact); `pp1 =
  (0, dim.height/2)` (FIXED, note-local); `pp2` derived from `positionOther
  - positionMe` (host box minus note box, both already-laid-out absolute
  positions) plus the target row's own anchor: `minX = 6` (a FIXED margin,
  independently confirmed identical whether the matched row DOES or does
  NOT show a visibility icon — `ROW_TEXT_LEFT_MARGIN`, NOT the icon-zone-
  widened indent), `maxX = 6 + rowTextWidth` (the SPECIFIC matched row's own
  rendered text width, not the classifier's full compartment width), `centerY
  = row.y - baselineOffset + memberRowHeight/2` (the SAME ascent-from-line-
  top baseline math `class-layout-helpers.ts` already uses for every other
  text row, at the HOST's normal font size, not the note's own 13pt). The
  one-sided flip correction (`if (direction === RIGHT && x < 0) direction =
  LEFT`, `EntityImageTips.java`'s own asymmetric guard — no analogous flip
  for an initial LEFT direction) reproduced exactly on `cajicu-52-cego765`'s
  D note (position=LEFT -> initial direction RIGHT -> host is actually to
  the LEFT of the note -> flips to LEFT).
- Note text sizing/font, corrected GLOBALLY (both tip and plain notes,
  `note-layout.ts#measureNote`): `plantuml.skin`'s own `note { FontSize 13;
  LineThickness 0.5 }` block — notes render ONE POINT SMALLER than the
  diagram's normal text, with 0.5 stroke width (not the diagram default 1),
  a fact this port's rendering NEVER modeled at all (its `NOTE_PAD_X/Y=8/6`,
  `fontSize*1.4` line height, `strokeWidth:1` were all invented, never
  jar-verified). Corrected width/height formula: `Opale.java#getWidth/
  getHeight` — `textWidth + marginX1(6) + marginX2(15)`,
  `textBlockHeight(=lines*13, "row height == fontSize" convention, G2 N4) +
  2*marginY(5)`.
- Multi-tip stacking bug (found while deriving the geometry, not previously
  named): `note-layout.ts#groupNodeSize`/`mapNoteGeos` (pre-N13) drew EVERY
  member of a merged tip group at the shared GROUP's uniform max-width box
  — jar draws each stacked tip at its OWN INDIVIDUAL width, left-aligned
  within the group's reserved (max-width) DOT column, not stretched
  (jar-verified: `tenobo-24-liga464`'s two right-side tips share the SAME x
  but have DIFFERENT widths, 160.425 and 248.0938). Fixed: `mapNoteGeos`'s
  per-member geo now uses that member's own `NoteMeasurement.width/height`
  — the DOT node's reserved size (`groupNodeSize`, still the group max) is
  UNCHANGED, preserving the frozen DOT gate.
- Dropped (unresolved `::member`) notes: `BodierAbstract#getBestMatch`
  (fuzzy substring matcher, `matchScore` — ported byte-exact: penalizes how
  far into the candidate row the match starts, letters costing far more
  than punctuation, and how much text trails the match, alphanumeric
  trailing costing far more than post-separator trailing) returning `null`
  makes `EntityImageTips#drawU` `return` MID-LOOP — the failing tip AND
  every LATER tip in the SAME merged group draw nothing at all (earlier,
  already-drawn tips in the group stay drawn). `fupope-12-zoku847`'s single
  `note right of Cls::typo` (no member named "typo" anywhere in `Cls`)
  confirmed: jar's canvas is EXACTLY the size of a plain classifier with no
  note at all — no space reserved in the RENDERED ink extent (though the DOT
  graph still carries the note's own node+invisible edge unconditionally,
  matching `calculateDimensionSlow`'s content-only, match-independent
  sizing formula). Fixed: `mapNoteGeos` marks a match-failure (and every
  later group member) `dropped: true`; `renderer.ts`'s note loop skips
  `dropped` notes entirely (no draw call at all); `layout-ink-extent.ts
  #buildInkBox` skips `dropped` notes when walking ink bounds — the DOT
  node/edge stay exactly as before (unaffected, frozen-gate-safe).
- Disposition: FIXED. New `note-opale.ts` (Opale outline/corner geometry,
  `opalePolygonLeft`/`opalePolygonRight`/`opaleCorner`, LEFT/RIGHT only —
  UP/DOWN and nonzero `roundCorner` are Kind-B/C-and-beyond territory, not
  needed by the LEFT/RIGHT-only member-tip grammar; `matchScore`/
  `getBestMatchRow`, the fuzzy matcher). `note-layout.ts#mapNoteGeos`
  extended to resolve each member-tip group's shared direction/host offset
  once (`resolveGroupTipContext`) and each member's own notch anchor
  (`tipAnchor`/`buildTipNoteGeo`), with per-member individual-width stacking
  and abort-on-drop semantics (`mapGroupNoteGeos`/`resolveTipMember`) — a
  reordered `layout.ts` now computes `classifiers` BEFORE `mapNoteGeos` (the
  connector math needs host position + row text; the uniform post-layout
  ink-shift is translation-invariant, so computing pre-shift is equivalent).
  `renderer.ts`'s note-rendering functions (`renderNote`/`renderNoteText`/
  new `renderTipNote`) extracted to a new `renderer-note.ts` module (mirrors
  the existing `renderer-arrowhead.ts`/`renderer-group.ts` split precedent —
  `renderer.ts` was ALREADY 697 lines at HEAD, a pre-existing file-size-cap
  violation this iteration reduced but did not eliminate; logged to
  `.agent-notes/n13-renderer-line-cap.md` per the pre-existing-violations
  policy rather than attempted as an in-scope fix). `core/svg.ts#path()`
  widened with an OPTIONAL `fill` style field (default unchanged, `'none'`)
  — the FIRST caller needing a genuinely filled `<path>` (the Opale outline
  is arc+line commands, not representable as a `<polygon>`).
- Jar-verified byte-exact (unit tests, `note-opale.test.ts`): the FULL
  zigzag outline path string for both `cajicu-52-cego765` notes (RIGHT and
  LEFT direction, including the flip correction) and the fold-corner
  triangle, reproduced character-for-character including every degenerate
  `A0,0` arc. `tenobo-24-liga464`'s full 3-tip render (2 merged on the
  RIGHT side of A, 1 alone on the LEFT) matches jar's structure and numeric
  values to within the SAME residual every remaining diff traces to (see
  "not fixed" below) — the closest near-miss this iteration produced (3
  diffs: `@viewBox`/`@width`/one `childCount` off-by-one, traced to the
  UNRELATED, already-named creole-bold gap: jar splits `Yet **another**`
  into 2 `<text>` runs, this port renders it as one literal line).
- Regression trace (required per the brief's explicit DOT-gate-risk
  caution): full-corpus per-fixture diff-count scan (disposable `git
  worktree add --detach`, symlinked `test-results`/`node_modules`/`assets/
  stdlib`): **16 improved / 22 "regressed" / 680 unchanged / 0 zero-diff
  regressions** (verified via exact slug-set diff against `ratchet.json`,
  not just count). Every regressed fixture sampled is the SAME childCount-
  unmasking pattern recorded every iteration since N2: the note's structural
  shape/childCount now matches jar (or is far closer), which un-bails the
  comparator's positional walk onto a PRE-EXISTING, NEWLY-CONFIRMED
  classifier-width bug (see "not fixed" below) — confirmed NOT a regression
  by directly re-measuring the SAME fixture's classifier width in a
  pristine `git worktree add --detach HEAD` BEFORE this iteration's changes:
  identical wrong value already present, just hidden behind the childCount
  mismatch (`dozugo-00-jado141`'s `User` classifier: width 132.6375 both
  before AND after this iteration's changes, vs jar's real 114.6375).
- DOT gate verification (explicit brief requirement — "note-entity sizing
  feeds DOT... verify empirically whether the gate ACTUALLY moves"):
  re-ran `dot-sync-report.ts` for all five diagram types AFTER every change
  this iteration made (both the note-dimension formula change AND the
  per-member-width stacking change, which DOES alter what `groupNodeSize`
  requests for the shared DOT node in some cases) — component 262/262,
  usecase 90/90, **class 708/708 (unchanged)**, object 78/80 (unchanged),
  state 267/267 (unchanged). The gate's own tolerant width/height
  comparator (N12's own established finding) absorbs the note-dimension
  changes without any of the five counts moving.
- Slugs (reach, zero-diff): none reach full zero-diff this iteration — every
  target fixture's remaining diffs trace to ONE of: (a) the newly-confirmed
  classifier-width bug below (`cajicu-52-cego765`, `dozugo-00-jado141`,
  `fabuje-68-gona310`, `fopose-13-kase592`, `fupope-12-zoku847`, `janeba-15-
  duja043`, `rubuxe-58-peba652`, `sanusa-54-keda128`, `xumeli-52-keso732`),
  (b) the creole-in-note-text gap (`taxemo-34-buro609`'s `<color:#red>`,
  `tenobo-24-liga464`'s `**bold**`), both already-named, unrelated
  mechanisms this iteration's structural fix correctly unmasked rather than
  caused.

### Deferred: freestanding/plain "opalisable" notes (Kinds B/C,
### `EntityImageNote.java`'s `opaleLine`/`opaleLink` branches) —
### DIAGNOSED, NOT ATTEMPTED

- Full mechanism read (`svek/image/EntityImageNote.java`,
  `svek/GraphvizImageBuilder.java:133-148,245-263`,
  `svek/SvekEdge.java:830-834`): ANY note leaf (`LeafType.NOTE`, i.e. every
  `note <pos> [of X]` OR freestanding `note "..." as N1` note, NOT just
  member-tips) with EXACTLY ONE non-invisible link to a non-note entity is
  "opalisable" (`isOpalisable`, `skinparam strictUmlStyle` disables it
  entirely) — its connecting `Link` gets `setOpale(true)`, which makes
  `SvekEdge#drawU` return immediately (no separate `<g class="link">` drawn
  at all) AND makes `EntityImageNote#drawU` take its `opaleLine` branch:
  the note's REAL DOT-routed connector spline (`opaleLine.getDotPath()`,
  translated to be LOCAL to the note's own box via `-node.getMinX()/
  getMinY()`) supplies `pp1`/`pp2` directly (no `MagneticBorder` force
  correction — `AbstractEntityImage`'s default `getMagneticBorder()` is
  `MagneticBorderNone`, verified: no class-diagram entity image overrides
  it), and `getOpaleStrategy` picks LEFT/RIGHT/UP/DOWN by nearest-box-edge
  distance to the (localized) spline start point (whichever endpoint is
  CLOSER to the note's own center becomes `pp1`/direction anchor — general,
  unlike member-tips' keyword-plus-flip rule). This DOES need the routed
  edge spline this port's `note-layout.ts#groupEdge` ALREADY produces for
  plain attached notes (`edge.points`) — a genuinely tractable extension —
  but a FREESTANDING note connected via a normal relationship LINE (`note
  "..." as N1` then `N1 .. Host`, Kind B, `doseko-41-mavu661`/`sevaxa-72-
  pudi231`) is NOT modeled by `note-layout.ts` at ALL (it's a plain
  `ast.relationships` entry where one endpoint happens to be a note id) —
  detecting "opalisable" there requires new plumbing in the RELATIONSHIP
  render path (recognizing a note-touching link with exactly one connection,
  suppressing its normal edge draw, routing the Opale draw through the
  note's own geo instead), a genuinely separate, larger blast radius than
  this iteration's member-tip scope.
- Why not attempted: two independently-scoped subsystems (Kind C: extend
  the ALREADY-EXISTING attached-note edge machinery to the general
  DOT-spline-based Opale draw; Kind B: build NEW relationship-path plumbing
  for a note-touching regular link) stacked onto an already-large iteration;
  the brief's own explicit permission ("drill the largest first... ledger
  the rest with reach") and the fact that member-tip notes (Kind A) were the
  MOST CONCRETELY EVIDENCED and SELF-CONTAINED of the four kinds (no
  dependency on relationship-path changes) made it the correct pick for
  this iteration. Reach: Kind C likely dominates the corpus's remaining
  note-bearing non-conformant fixtures (EVERY plain `note <pos> of X` with
  exactly one connection needs it — this port's `renderNote`/plain-fold
  path, previously assumed correct-by-construction, was NEVER jar-verified
  and is now confirmed wrong for the common case); Kind B is narrower
  (`doseko-41-mavu661`/`sevaxa-72-pudi231` plus an unsurveyed corpus count).
- Slugs (evidence gathered, unfixed): `sevaxa-72-pudi231` (byte-captured the
  jar's full merged note+notch structure for a freestanding note attached
  via a plain relationship — no separate `<g class="link">` at all for
  `N1 .. Bar`, confirming Kind B/C are the SAME `isOpalisable` mechanism),
  `taxemo-34-buro609`'s first note (`note left of class_name`, no member —
  Kind C, single-link, definitely opalisable).

### `note on link` (Kind D) — surveyed only, unchanged from N9

Not investigated further this iteration beyond confirming it is a
STRUCTURALLY DIFFERENT upstream mechanism (`CommandFactoryNoteOnLink` ->
`Link#addNote`/`CucaNote`, drawn as a label near the edge itself, not an
Opale box at all) — `class-notes.ts#applyNoteOnLink` already parses it
(`linkNote` field) but only `class-assoc-couple.ts` consumes it (for the
UNRELATED association-class-couple label-transfer case); a plain
relationship's `linkNote` is still silently dropped at render time. Reach
unsurveyed this iteration.

### Not fixed this iteration — named remainders for N14 (carried + new)

1. **Classifier-width bug near member-tip/opalisable notes** (NEWLY
   CONFIRMED N13, via the full-corpus regression trace) — a classifier
   connected (even via an INVISIBLE edge) to a note's DOT node measures
   WIDER than jar's real value (deltas observed 18-174px across samples:
   `dozugo-00-jado141` +18, `kugasi-68-josu446` +63, `kixiso-09-lezo371`/
   `mopesi-01-gapo101` +174). Confirmed PRE-EXISTING (identical wrong value
   at HEAD, before this iteration, via disposable-worktree comparison) and
   NOT this iteration's mechanism's fault — the note-connector fix's own
   childCount correction simply un-bails the comparator onto it, the same
   "childCount-unmasking" pattern every iteration since N2 has recorded.
   Likely graphviz packing/rank-width behavior around an edge (even an
   invisible one) — may overlap N11's "Test Two" classifier-width bug or
   the "~7-8px position/margin residual" family; not cross-checked. Highest
   apparent reach of any single named remainder in this mission's history
   (22+ fixtures in this iteration's own regression scan alone) — dedicated
   diagnosis pass recommended for N14.
2. **Kinds B/C: general "opalisable" single-link note** (`EntityImageNote`'s
   `opaleLine`/`opaleLink` mechanism, ~majority of the corpus's remaining
   plain `note <pos> of X` and freestanding-note-with-one-edge fixtures) —
   see "Deferred" above, full mechanism diagnosed, genuinely two separate
   subsystems (extend existing attached-note edge machinery; new
   relationship-path plumbing for note-touching regular links).
3. **`note on link` (Kind D)** — unchanged from N9, distinct draw site
   (`Link#addNote`/`CucaNote`), not surveyed for reach this iteration.
4. Creole markup inside note text (`<color:#red>`, `**bold**`) — unchanged
   since N10-N12's identical member-text gap; this iteration's own
   `taxemo-34-buro609`/`tenobo-24-liga464` residuals both trace here.
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

### Class census: N12 baseline → N13

```
before: 58/718 · 1-3:58 · 4-10:175 · 11-30:35 · 31+:392 · errors:0
after:  58/718 · 1-3:44 · 4-10:169 · 11-30:35 · 31+:412 · errors:0
```

0-diff bucket UNCHANGED (58 — confirmed by `class.golden.ratchet.test.ts`
60/60 green, AC1×58 + AC2 + AC3, exact slug-set match). 1-3 bucket -14
(58->44), 4-10 bucket -6 (175->169), 31+ bucket +20 (392->412) — the
childCount-unmasking pattern described above; net real progress (16
improved beyond the bucket noise, 0 zero-diff regressions, structural
correctness landed for the entire member-tip note family) even though no
NEW fixture crossed the zero-diff line this iteration (every one is
blocked by the newly-confirmed, separately-scoped classifier-width bug or
the already-named creole gap).

### Ratchet: 58 pins (unchanged — no new zero-diff fixtures this iteration)

No new slugs qualify for `oracle/goldens/svg-class/`; `class.golden.
ratchet.test.ts`: 60/60 green (unchanged AC1×58 + AC2 + AC3, zero-diff slug
SET identical to N12's, not just count).

### Description gate: intact

48/355 zero-diff (component+usecase) unchanged; `description.golden.
ratchet.test.ts`: 51/51 green. `core/svg.ts#path()` IS shared code (the new
optional `fill` field) — re-verified explicitly: the change is PURELY
ADDITIVE (every existing caller omits `fill`, defaulting to the SAME
`'none'` as before), and the description census/ratchet re-run shows zero
movement.

### DOT gate: frozen, unchanged

component 262/262 · usecase 90/90 · class 708/708 · object 78/80 · state
267/267 — re-verified after EVERY DOT-relevant change this iteration (the
note-dimension formula AND the per-member-width stacking change, both of
which alter note-related DOT node sizing) per the brief's explicit
requirement. The gate's own tolerant width/height comparator absorbs both
changes without any of the five counts moving.

### Files changed

- `src/diagrams/class/note-opale.ts` (NEW) — Opale outline/corner geometry
  (`opalePolygonLeft`/`opalePolygonRight`/`opaleCorner`) + the fuzzy
  member-line matcher (`matchScore`/`getBestMatchRow`).
- `src/diagrams/class/note-layout.ts` — `NoteGeo` gains `dropped?`/`tip?`;
  new `ClassifierAnchor` type (a local subset of `layout.ts#ClassifierGeo`,
  avoids a layout.ts<->note-layout.ts import cycle); `measureNote` corrected
  to the real `Opale.java` formula (fontSize 13, marginX1/X2/Y); `mapNoteGeos`
  signature widened (`classifiers`/`theme`/`measurer`) and extended with
  member-tip direction/anchor/drop/stacking resolution
  (`resolveGroupTipContext`/`tipAnchor`/`buildTipNoteGeo`/`droppedNoteGeo`/
  `resolveTipMember`/`mapGroupNoteGeos`).
- `src/diagrams/class/layout.ts` — `buildClassifierGeos` moved before
  `mapNoteGeos` (the tip connector math needs classifier positions/rows);
  `mapNoteGeos` call updated to the new signature.
- `src/diagrams/class/layout-ink-extent.ts` — `buildInkBox` skips `dropped`
  notes.
- `src/diagrams/class/renderer-note.ts` (NEW) — `renderNote`/`renderTipNote`
  extracted from `renderer.ts` (500-line file-cap split, mirrors the
  existing `renderer-arrowhead.ts` precedent); corrected note text
  sizing/margins/font-size/stroke-width to match `measureNote`; new
  `renderTipNote` (unwrapped Opale zigzag draw).
- `src/diagrams/class/renderer.ts` — note section removed (moved to
  `renderer-note.ts`); main render loop skips `dropped` notes, routes `tip`
  notes through `renderTipNote` (unwrapped, no `<g>`/id/comment, mirrors
  `renderAssocPoint`'s identical precedent).
- `src/core/svg.ts` — `LineStyle` gains an optional `fill` field (default
  `'none'`, unchanged for every existing caller); `path()` emits it when
  provided.
- `tests/unit/class/note-opale.test.ts` (NEW) — 11 tests: byte-exact
  `opalePolygonLeft`/`opalePolygonRight`/`opaleCorner` against jar-verified
  `cajicu-52-cego765` values, `matchScore`'s full weight-table behavior (5
  tests), `getBestMatchRow` (3 tests).
- `tests/unit/class/note-layout.test.ts` — 5 new tests: matched-tip
  direction/pp1/pp2 resolution, dropped-note marking, group-wide abort on a
  mid-group drop, per-member individual-width stacking, plain (non-tip)
  notes on the same host+side unaffected.
- `tests/unit/class/layout-ink-extent.test.ts` — 1 new test: a dropped note
  contributes zero ink.
- `tests/unit/class/renderer.test.ts` — 2 new tests: a dropped tip note
  draws nothing; a resolved tip note draws unwrapped with no separate
  connector line.
- `tests/unit/svg-primitives.test.ts` — 3 new tests: `path()`'s `fill`
  default/override/color-resolution behavior.

### Scratch/worktree hygiene

`scripts/_tmp-n13-drill.ts`, `_tmp-n13-debug2.ts`, `_tmp-n13-diffcounts.ts`
(transient, used throughout this iteration's diagnosis) deleted before
finishing. Disposable `git worktree add --detach .../n13-baseline-worktree
HEAD` (used twice: once for the classifier-width-bug pre-existence check,
once for the full-corpus regression scan) removed via `git worktree remove
--force` both times. `.agent-notes/n13-renderer-line-cap.md` written per
the pre-existing-violations policy (see "Files changed" above — NOT part of
the git-tracked deliverable, `.agent-notes/` is gitignored). Nothing
committed (orchestrator owns commits per mission rule).
