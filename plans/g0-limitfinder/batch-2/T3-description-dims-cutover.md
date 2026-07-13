# T3 — Description document-dims cutover (SvekResult recipe)

## Context

The F4 defect: our description SVG documents are ~1px short of the jar
(jar 190×65 vs ours 189×64; 327/348 diverging fixtures; named F4 examples:
vapalu, jesibe, cifaki). Root cause (mission research, jar-verified):

- Upstream `SvekResult.calculateDimension` (svek/SvekResult.java:130-136):
  `minMax = TextBlockUtils.getMinMax(this, sb, false)` (a LimitFinder ink
  walk over clusters+nodes+edges) → `clusterManager.moveDelta(6−minX,
  6−minY)` (re-anchor ink to a (6,6) origin) → return
  `minMax.getDimension().delta(15,15)`. That dimension flows into
  `SvgOption.minDim` → `ensureVisible` (`(int)(x+1)`).
- Our path: `computeTotalDimensions` (layout-geo-post.ts:155-168) hand-scans
  node boxes + edge points with LAYOUT_MARGIN=12 → renderer.ts:218 minDim →
  our ensureVisible (`Math.trunc(x)+1` — ALREADY faithful; untouched).

T1 (merged) provides `LimitFinder`/`TextBlockUtils.getMinMax`/`MinMax`.

## Task

1. In `renderDescription` (src/diagrams/description/renderer.ts:211-231):
   before the real `UGraphicSvg` pass, run the SAME draw sequence
   (`drawClusters`/`drawEntities`/`drawEdges`) through
   `LimitFinder.create(driverBounder(...), false)` to get the ink MinMax.
   Then mirror SvekResult: compute the re-anchor delta `(6−minX, 6−minY)`;
   size = `minMax.getDimension().delta(15,15)`; feed THAT into
   `basicSvgOption.minDim` (replacing `geo.totalWidth/Height`).
2. The re-anchor: upstream MOVES content so ink-min sits at (6,6). Measure
   what our current anchoring is on the F4 fixtures (render vapalu/jesibe/
   cifaki + the 190×65 fixture; compare every interior element's x/y to the
   jar's cached in.svg under DeterministicMeasurer). THREE possible
   findings, handle per decisions.md D2:
   (a) our ink-min already ≈(6,6): apply delta≈0, dims fix alone closes F4;
   (b) our ink-min differs but interior geometry ALREADY matches the jar
       (the anchor difference is illusory — e.g. our hand-scan margin
       compensated): apply dims only, do NOT translate;
   (c) our ink-min differs AND interior geometry is offset from the jar by
       exactly that difference: apply the translate too (a real fidelity
       fix — wrap the draw passes in the delta translate).
   Journal which case held, with the measured numbers. If it's none of the
   three cleanly, STOP and report (diagnosis.md applies).
3. `computeTotalDimensions` stays (grep its other consumers first; if the
   renderer was its only consumer, mark it deprecated in a doc comment —
   do not delete in this task).
4. Tests: `tests/unit/description-doc-dims.test.ts` pins the F4 fixtures'
   exact document width/height against the jar's cached
   `test-results/dot-cache/component|usecase/<slug>/in.svg` values
   (deterministic measurer; read the width/height attrs from the cached
   jar svg and assert equality). Include the 190×65 fixture by slug.
5. Guards that MUST stay green unchanged: the 5-fixture SVG ratchet
   (tests/oracle/svg-conformance/description.golden.ratchet.test.ts) — if
   a golden's dims change, that means case (b)/(c) mishandling: STOP; the
   description DOT parity ratchet (dims don't touch DOT — any movement is
   a bug); the census conformant count must not DROP (expect it to RISE —
   run scripts/svg-conformance-census.ts before/after and record).

## Read-set

- decisions.md D2, D7. `src/diagrams/description/renderer.ts:200-260` (incl.
  unwrapKlimtSvg), `src/diagrams/description/layout-geo-post.ts:140-170`,
  `layout.ts:500-510`, `src/core/klimt/drawing/LimitFinder.ts` (T1),
  `src/core/klimt/drawing/svg/svg-graphics-core.ts:190-260` (ensureVisible
  — READ ONLY, do not touch), `tests/oracle/svg-conformance/render-fixture.ts`
- `~/git/plantuml/src/main/java/net/sourceforge/plantuml/svek/SvekResult.java:70-140`
- Hook playbook per project memory; tests in tests/unit/; no git mutations;
  do not commit; you may run the full suite (you run alone with T4 whose
  write-set is disjoint — but coordinate nothing; if failures appear only
  under oracle/goldens churn, report separately).

## Acceptance criteria

- Given the named F4 fixtures under DeterministicMeasurer, our emitted
  width/height EQUAL the jar's cached in.svg values exactly.
- Given the census, conformant ≥ previous (record numbers; expect rise).
- Given the SVG ratchet + description DOT ratchet + full suite: green with
  zero golden edits.
- Given 3 spot fixtures WITHOUT the F4 defect, output byte-identical.

## Quality bar: all gates; DOT gate at post-T2 baseline (read the journal for the numbers).
## Observability: N/A. Rollback: Reversible.
## Commit: `fix(T3): description doc dims via LimitFinder (SvekResult recipe)` (orchestrator)
