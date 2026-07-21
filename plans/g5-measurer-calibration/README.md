# Mission G5 — StringMeasurer width calibration

**Authorization.** Maintainer, follow-up to G4 ("Start work on the
StringMeasurer calibration gap"). Branch: `feat/g5-measurer-calibration`.

**Founding evidence.** `plans/g4-state-svg/ledger.md` §S13: three
independent attempts (S4, S12, S13) at the composite-internal-labeled-
transition edge-label-ink mechanism all failed on the SAME wall — a
divergence between this port's own computed edge-label width and jar's
real rendered label box. S13's own root-cause analysis named it a
"text-measurement calibration gap": this port's `StringMeasurer`
(`WidthTableMeasurer`/`LutTextMeasurer`, depending on call site) was
reported to measure `bemena-23-zebu249`'s `"EvNewValueSaved"` label at
120.05px vs jar's real `textLength` of 111.475px (~7% overestimate), and
S13 speculated this compounds with a label-placement divergence to explain
the mechanism's ~10.6px right-edge error.

**C0's finding — the mission's premise does not survive verification.**
`WidthTableMeasurer` (the `DeterministicMeasurer` used everywhere jar
comparisons happen) is NOT miscalibrated. It is jar-exact (0.000% mean
error, floating-point-noise-only max error) across 13,564 in-scope oracle
text samples spanning component/usecase/class/object/state at every
observed font-size/weight/style combination. **120.05 IS the measurer's
correct, exact answer for `"EvNewValueSaved"` at font-size 14 — the jar's
real value (111.475) is ALSO this exact measurer's exact answer, but at
font-size 13.** The "calibration gap" is a caller-side bug: the call site
building this edge label's `FontSpec` uses `theme.fontSize` (14, the
`FontParam.STATE` body-text default) instead of upstream's
`FontParam.ARROW` default (13) for arrow/transition/relationship label
text. See `ledger.md` §C0 for the full jar-verified derivation and the
five call sites (spanning THREE diagram engines — state, class/object,
description) carrying the identical bug.

**Consequence for scope.** The fix lives in `src/diagrams/state/*.ts` and
`src/diagrams/class/*.ts` (and `src/diagrams/description/layout.ts`) —
all explicitly OUTSIDE this iteration's write-set
(`src/core/** measurer/font-metrics modules only`). Per
`~/.claude/rules/autonomous-execution.md`'s STOP conditions ("a task
requires modifying files outside its declared write-set AND those files
aren't in any other task's write-set either"), C0 did NOT modify any
`src/` file — there is no in-scope measurer bug to fix. See "Next
iteration" below.

## Gates table (re-verified fresh at C3 end — DOT gate/censuses/golden
## ratchets byte-identical to C2's baseline; `size-backlog.json` tightened
## (a real, independent, jar-verified size-accuracy win); `npm test -- --run`
## count grew only by C3's own new, currently-passing test cases)

| Gate | Value |
| --- | --- |
| `npm run typecheck` | clean (both configs) |
| `npm run lint` | clean |
| `npm test -- --run` | 10142 passed \| 5 skipped (381 files) — C3's own 4 new `graph-layout.test.ts` cases; the 5 skipped are UNCHANGED, still C1's reverted sites 2/3 evidence |
| DOT gate | component 262/262 · usecase 90/90 · class 708/708 · object 78/80 · state 267/267 (unchanged) |
| `state-dot-parity.test.ts` (size-backlog ratchet) | 268/268 (unchanged pass count; the ratchet's OWN tolerance file tightened, see below) |
| `description.golden.ratchet.test.ts` | 51 tests (unchanged) |
| `class.golden.ratchet.test.ts` | 305 tests (unchanged) |
| `object.golden.ratchet.test.ts` | 24 tests (unchanged) |
| `state.golden.ratchet.test.ts` | 54 tests (unchanged) |
| description census (no-arg) | 48/355 (unchanged) |
| class census | 303/718 (unchanged) |
| object census | 22/80 (unchanged) |
| state census | 52/271 (unchanged) |
| `oracle/goldens/state/size-backlog.json` | 92 entries (was 103 — 10 removed at 0, 13 tightened) |

## Protected sets (movement rules, per mission brief)

- DOT gate: movement in EITHER direction on any of the five counts = STOP
  and report to orchestrator. C1 confirmed all five call sites individually
  keep this gate byte-identical (262/90/708/78/267) — the size-driven risk
  materialized elsewhere (the size-backlog ratchet, below), not here.
- `size-backlog.json`: tighten-only (entries may only shrink/pass). C1
  found this rule DOES bind in practice: sites 2/3 (state composite)
  regressed it (16-17/103 entries) despite the DOT gate staying clean —
  reverted per this rule, not per the DOT-gate rule above. Treat the two
  protected sets as INDEPENDENT checks, not one proxy for the other.
- Four censuses: each may grow, none may shrink. C1: unchanged (0 growth,
  0 shrink) at all landed sites.
- `npm test -- --run`: must stay green; ratchet test files may only gain
  tests (new pins), never lose them. C1's own new test files (not ratchet
  files) may be freely edited/skipped by the iteration that authored them.

## Iteration log

- **C0**: harness (`scripts/measurer-calibration-report.ts`),
  full corpus-wide characterization, jar-verified diagnosis (mechanism
  found: font-size 14-vs-13 caller bug, NOT a measurer defect). Zero `src/`
  changes — no in-scope fix exists. See `ledger.md` §C0 and
  `decision-journal.md` for the full record.
- **C1**: landed 3 of 5 call sites (state flat pipeline,
  class relationship labels, description edge labels — the last requiring
  a mandatory 500-line file split, `layout.ts`→`layout-dot-tree.ts`, plus
  a materially more careful fix than a constant swap, since that site's
  `fontSpec` is shared with node/title measurement). Reverted 2 sites
  (state composite pipeline, `addLevelEdges`/`sweepOrphanEdges`) after a
  jar-verified `state-dot-parity.test.ts` size-backlog regression, traced
  to an ALREADY-NAMED, pre-existing gap in `state-composite-autonom.ts`
  (unrelated to this mission, predates it) — see `ledger.md` §C1 for the
  full mechanism, bisection evidence, and the edge-label-ink
  re-attemptability assessment (still blocked; a third compounding gap
  identified). All protected sets (DOT gate, four censuses, four golden
  ratchets) verified byte-identical to baseline at every site landing and
  in the final state.
- **C2**: landed chunk 1 — `layoutGraph()`'s
  `DotLayoutResult` now exposes real per-cluster geometry
  (`graphviz-ts` 0.1.26072115's new `getLayout().clusters`, TDD, 4 new
  tests, additive/no-consumer-yet). Deep jar-verified diagnosis of
  mechanism 16 (entity-vs-cluster wrap)'s RENDER half found it blocked on
  a graphviz-ts programmatic-builder-API gap (no supported way to
  construct an HTML-table cluster label outside DOT-text parsing) — filed
  `docs/graphviz-issues/07-html-label-mark-not-exported.md`, with a
  jar-verified 19px header-height constant (18/19 real fixtures exact, the
  19th fully explained by a `scale` pragma) and a confirmed-working (but
  not-yet-sanctioned) marker-based technique that reproduces it exactly.
  Re-examined C1's own sites-2/3 hypothesis ("cluster geometry might
  unblock the `buildPlainAutonomSpec` floor") and found it does NOT hold —
  the founding fixture's autonom composite has zero nested clusters; the
  real, unrelated blocker is the already-3-strike-parked G4 S11-S13
  edge-label-ink mechanism. Zero `src/diagrams/state/*.ts` changes (per
  the mission's own "do not force" guidance) — see `ledger.md` §C2 for the
  full derivation, evidence trail, and C3+ queue.
- **C3**: landed mechanism 16's SHAPE half — DOT-side `setHtmlAttr` seam
  (opt-in via new `DotInputCluster.titleTableWidth`/`titleTableHeight`
  fields), real cluster-bbox sizing wired into the state composite path, a
  NEW jar-verified `renderClusterMeasured` render shape, and a document-
  nesting fix (a cluster's children render as flat SIBLINGS, not nested,
  matching jar's real DOM structure) — for the eligibility-gated majority
  case (single-line title, default font-size, no border points, top-level
  pass only; nested-inside-autonom clusters explicitly excluded after a
  jar-verified size-backlog regression traced to the SAME parked
  `buildPlainAutonomSpec#Math.max` floor C1/C2 already named). Tightened
  `size-backlog.json` 103→92 entries (13 shrunk, 10 removed at 0) — a real,
  independent size-accuracy win. Discovered TWO new, precisely-scoped open
  items blocking true byte-exact ratchet pins (document order for
  cluster/autonom/leaf siblings; a conditional body-fill path for
  content-less clusters) — neither closed this iteration; the
  entrypoint/exitpoint family remains deferred pending both. 0 new golden-
  ratchet pins; all four protected censuses and the DOT gate re-verified
  byte-identical. See `ledger.md` §C3 for the full derivation, the
  corpus-wide 134-sample probe, and the C4+ queue.

- **C4** (maintainer sign-off 2026-07-21, "Attempt the ink mechanism" —
  fourth attempt at the G4 S4/S12/S13 edge-label-ink mechanism): derived and
  landed a principled mechanism -- HTML `<TABLE FIXEDSIZE>` edge labels via
  `GvEdge.setHtmlAttr` (mirrors `SvekEdge.appendTable`, C3's public-API
  precedent extended from subgraphs to edges) sized with C1's jar-exact
  13pt measurement, plus reading graphviz's own real `labelX`/`labelY`
  back for render placement (via `textAscent()`, an EXISTING convention,
  not a new formula) instead of the pre-existing perpendicular-offset
  approximation. Re-landed C1's sites 2/3 font-size fix verbatim
  (un-skipped its TDD tests, all passing). Measured against the S12/S13
  control set (15 unique fixtures): 9/15 improved (including the S13
  founding fixture `bemena-23-zebu249`, now well inside its size-backlog
  allowance, and two fixtures S13 itself had proven "unrelated to this
  mechanism at all 3 variants" also improved) but 6/15 regressed — same
  already-4-times-attempted `buildPlainAutonomSpec#Math.max(geometry.width,
  result.width)` floor (C1/C3's own named gap), now precisely re-confirmed
  as the SOLE remaining blocker for three independent, otherwise-working
  mechanisms. Per the mission's own explicit protocol ("if this attempt
  fails the control set, journal it and stop; do not try formula variants
  past your first principled derivation"), REVERTED IN FULL (7 files
  restored byte-for-byte to the C3 HEAD commit) rather than widen any
  `size-backlog.json` entry. All protected sets (DOT gate, four censuses,
  four golden ratchets, size-backlog ratchet) re-verified byte-identical
  to the C3 baseline after the revert. See `ledger.md` §C4 for the full
  derivation, the 15-fixture control-set table, the jar-verified mechanism
  of the 6 regressions, and the C5+ queue.

## Next iteration (C5) — recommended scope

0. **PRIORITY, now the confirmed sole blocker for THREE independent
   mechanisms** (this iteration's own edge-label-ink derivation, mechanism
   16's nested-cluster adoption from C3, and sites 2/3): `state-composite-
   autonom.ts#buildPlainAutonomSpec`'s `Math.max(geometry.width,
   result.width)` floor. C4 proved `result.width` is now jar-accurate for
   the label-reservation component (9/15 control-set fixtures improved) —
   the remaining gap is `geometry.width`'s own `computeSvekResultGeometry`
   ink walk never folding label ink in at all. A fifth attempt at this
   floor (S4 + S13's 3 variants = 4 prior attempts) needs its own explicit
   orchestrator/maintainer sign-off — C4's own sign-off covered the
   injection/readback mechanism only. See `ledger.md` §C4's C5+ queue item
   2 for the specific next-derivation candidate (fold `TransitionGeo
   .label`'s now-jar-verified real box into `addNodeInk` directly, rather
   than re-deriving an approximation).
1. **Document order** (largest remaining lever toward the first true
   byte-exact cluster-shape pin): jar's real top-level document order does
   NOT match `.puml` declaration order once a `'cluster'`-classified
   composite is present (`gojuja-90-pune699`/`decede-10-buvu414`
   jar-verified: cluster-classified entities render in a DIFFERENT relative
   position than autonom/leaf ones). Needs jar's `GraphvizImageBuilder`/
   `SvekResult`'s own document-assembly order read directly from source.
2. **Conditional body-fill path** for a content-less cluster (anchor-only
   children, no real drawn content) — `renderClusterMeasured` currently
   ALWAYS draws both header + body fill paths; jar's real `gojuja-90-
   pune699`'s `A` draws header-only. Likely tied to whether the cluster's
   own `nodeIds`/portRanks are non-empty vs. only-pseudo — not derived yet.
3. **Entrypoint/exitpoint family** (20 fixtures): reachable once (1) and
   (2) close. C3 already derived and corpus-verified its own baseline-
   margin constant (`5`, matching the autonom shape's `MARGIN`).
4. **Multi-line/action-text/stereotype cluster titles**: still excluded by
   the eligibility gate; C3's corpus probe found only 2 multi-line samples
   (`gap=47`, a starting data point, not a derived formula).
5. **Nested-cluster (inside-autonom-pass) title-table adoption**: blocked
   on the SAME parked `buildPlainAutonomSpec#Math.max` floor that already
   blocks sites 2/3 (C1/C2) — this iteration's `insideAutonomPass` finding
   independently re-confirms the floor is load-bearing for TWO unrelated
   mechanisms now. Still requires orchestrator/maintainer sign-off (3-strike
   rule) before any attempt to fix the floor itself.
6. **Sites 2/3 remain blocked** — unchanged from C1/C2, same G4 S11-S13
   edge-label-ink mechanism, same sign-off requirement.
7. **Two confirmed-unrelated, pre-existing gaps** (NOT mechanism 16, not
   this mission's scope, logged for a future iteration): `class="entity"`
   vs jar's `class="cluster"` (this port's renderer-wide convention); the
   `<style stateDiagram>` cascade (`RoundCorner`/`BackgroundColor`/
   `LineColor`/`FontColor`) not yet applied to state diagrams at all.
8. **Secondary, unrelated finding, unchanged from C0** (component
   diagrams only, low corpus impact — 1 of 265 fixtures dominates):
   `component/gutute-00-gaki684` (a `!pragma svek_trace on` stress-test
   fixture) shows a real, small, growing-with-string-length divergence
   between `WidthTableMeasurer` and jar's textLength for port labels. NOT
   root-caused. Low priority.
