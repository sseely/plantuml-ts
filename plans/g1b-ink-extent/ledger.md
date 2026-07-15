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
