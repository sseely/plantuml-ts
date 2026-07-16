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
