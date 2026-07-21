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

## Gates table (re-verified fresh at C1 end — all protected sets
## byte-identical to C0's baseline; `npm test -- --run` count grew only
## by C1's own new, currently-passing/skipped tests)

| Gate | Value |
| --- | --- |
| `npm run typecheck` | clean (both configs) |
| `npm run lint` | clean |
| `npm test -- --run` | 10134 passed \| 5 skipped (381 files) — C1's own 5 new test files; the 5 skipped are the reverted sites 2/3 evidence, preserved for C2 |
| DOT gate | component 262/262 · usecase 90/90 · class 708/708 · object 78/80 · state 267/267 (unchanged at every C1 site landing) |
| `state-dot-parity.test.ts` (size-backlog ratchet) | 268/268 (regressed to 251/268 with all five C1 sites landed — sites 2/3 reverted specifically to restore this) |
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
- **C1** (this iteration): landed 3 of 5 call sites (state flat pipeline,
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

## Next iteration (C2) — recommended scope

1. **Priority, well-scoped, jar-verifiable in isolation**:
   `state-composite-autonom.ts#buildPlainAutonomSpec`'s `childImg =
   Math.max(geometry.width, result.width)` floor — replace with a formula
   that folds edge-label ink into `geometry.width` (that function's OWN
   doc comment already names this "NOT FULLY CLOSED... Queued for S5",
   predating this mission — C1 proved it ALSO blocks G5's own remaining
   two sites, not just G4's parked edge-label-ink mechanism). Re-enable
   `tests/unit/state/state-composite-pass.test.ts`'s five `describe.skip`
   blocks as the TDD anchor once this lands.
2. **After (1) lands**: re-land G5 sites 2/3
   (`state-composite-pass.ts:244,326`) verbatim — the font-size fix is
   already correct and jar-verified; only the composite-bbox prerequisite
   was missing. Full protection protocol again (DOT gate + size-backlog +
   censuses + full suite), same discipline as C1.
3. **After (1) AND (2) land**: the edge-label-ink mechanism (G4
   S11/S12/S13, parked) becomes re-attemptable for a FOURTH time —
   REQUIRES orchestrator/maintainer sign-off first (the mission's own
   3-strike rule; G4 S13 already frames itself as attempt #3). Expected
   residual after (1)+(2): S13's own smaller, single-variable
   label-placement divergence (~2px-scale on the left edge), not the
   current three-variable (measurement × ink-folding × placement) tangle.
4. **Secondary, unrelated finding, unchanged from C0** (component
   diagrams only, low corpus impact — 1 of 265 fixtures dominates):
   `component/gutute-00-gaki684` (a `!pragma svek_trace on` stress-test
   fixture, ~9000px tall, deeply nested `protocol X { C1 C2 ... }` port
   declarations) shows a real, small, growing-with-string-length
   divergence between `WidthTableMeasurer` and jar's textLength for port
   labels (`"C1"` -3.25%, `"C10"` -6.08%). NOT root-caused (ruled out:
   SVG-level scale/transform, the `svek_trace` pragma itself — confirmed
   unrecognized/no-op in current upstream source). Low priority.
