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

## Gates table (re-verified fresh at C2 end — all protected sets
## byte-identical to C1's baseline; `npm test -- --run` count grew only
## by C2's own new, currently-passing test cases)

| Gate | Value |
| --- | --- |
| `npm run typecheck` | clean (both configs) |
| `npm run lint` | clean |
| `npm test -- --run` | 10138 passed \| 5 skipped (381 files) — C2's own 4 new `graph-layout.test.ts` cases; the 5 skipped are UNCHANGED, still C1's reverted sites 2/3 evidence |
| DOT gate | component 262/262 · usecase 90/90 · class 708/708 · object 78/80 · state 267/267 (unchanged after C2's chunk-1 landing) |
| `state-dot-parity.test.ts` (size-backlog ratchet) | 268/268 (unchanged) |
| `description.golden.ratchet.test.ts` | 51 tests (unchanged) |
| `class.golden.ratchet.test.ts` | 305 tests (unchanged) |
| `object.golden.ratchet.test.ts` | 24 tests (unchanged) |
| `state.golden.ratchet.test.ts` | 54 tests (unchanged) |
| description census (no-arg) | 48/355 (unchanged) |
| class census | 303/718 (unchanged) |
| object census | 22/80 (unchanged) |
| state census | 52/271 (unchanged) |
| `oracle/goldens/state/size-backlog.json` | 103 entries, untouched |

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
- **C2** (this iteration): landed chunk 1 — `layoutGraph()`'s
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

## Next iteration (C3) — recommended scope

1. **Mechanism 16 shape half** (entity-vs-cluster wrap render, 92
   fixtures + the 20-fixture entrypoint/exitpoint family): precisely
   scoped by C2 into 5 named sub-items (ledger §C2's "C3+ queue" #1) —
   (a) sign-off to depend on graphviz-ts's unexported `HTML_STRING_MARK`
   marker, OR wait for `docs/graphviz-issues/07-html-label-mark-not-
   exported.md` to land upstream; (b) the WIDTH/side-margin formula
   (chunk 1's real bbox, re-verified against the marker-based technique
   specifically); (c) the `getTitleAndAttributeHeight()` height-
   convention discrepancy (this port's `height = font.size` convention
   does not match jar's real single-line composite-title TextBlock
   height); (d) a NEW render-shape function (jar's real cluster shape
   fills its whole body, unlike the existing autonom-composite renderer);
   (e) multi-line/action-text/stereotype coverage, verified only for the
   single-line case this iteration.
2. **After (1) lands**: the entrypoint/exitpoint family (20 fixtures)
   becomes reachable — `hasBorderPointDescendant` unconditionally routes
   through mechanism 16's `'cluster'` path (G4 §S15).
3. **Sites 2/3 remain blocked, confirmed for a DIFFERENT reason than
   previously hypothesized**: C2 confirmed (direct inspection, not
   assumption) that cluster geometry does NOT unblock
   `buildPlainAutonomSpec`'s floor — the founding fixture
   (`bemena-23-zebu249`'s `Configuring` composite) has zero nested
   clusters. The real, unchanged blocker is the G4 S11-S13 edge-label-ink
   mechanism (3-strike parked) — REQUIRES orchestrator/maintainer sign-off
   before a 4th attempt. Expected residual after that mechanism closes:
   S13's own smaller, single-variable label-placement divergence
   (~2px-scale on the left edge), not the current tangle.
4. **Secondary, unrelated finding, unchanged from C0** (component
   diagrams only, low corpus impact — 1 of 265 fixtures dominates):
   `component/gutute-00-gaki684` (a `!pragma svek_trace on` stress-test
   fixture, ~9000px tall, deeply nested `protocol X { C1 C2 ... }` port
   declarations) shows a real, small, growing-with-string-length
   divergence between `WidthTableMeasurer` and jar's textLength for port
   labels (`"C1"` -3.25%, `"C10"` -6.08%). NOT root-caused (ruled out:
   SVG-level scale/transform, the `svek_trace` pragma itself — confirmed
   unrecognized/no-op in current upstream source). Low priority.
