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

## Gates table (baseline verified fresh at C0 start, unchanged at C0 end
## — zero `src/` files touched this iteration)

| Gate | Value |
| --- | --- |
| `npm run typecheck` | clean (both configs) |
| `npm run lint` | clean |
| `npm test -- --run` | 10128/10128 (377 files) |
| DOT gate | component 262/262 · usecase 90/90 · class 708/708 · object 78/80 · state 267/267 |
| `state-dot-parity.test.ts` (size-backlog ratchet) | 268/268 |
| `description.golden.ratchet.test.ts` | 51 tests |
| `class.golden.ratchet.test.ts` | 305 tests |
| `object.golden.ratchet.test.ts` | 24 tests |
| `state.golden.ratchet.test.ts` | 54 tests |
| description census (no-arg) | 48/355 |
| class census | 303/718 |
| object census | 22/80 |
| state census | 52/271 |
| `oracle/goldens/state/size-backlog.json` | 103 entries, untouched |

## Protected sets (movement rules, per mission brief)

- DOT gate: movement in EITHER direction on any of the five counts = STOP
  and report to orchestrator (a size-driven structural change is possible
  if the font-size bug above is ever fixed — see Next iteration).
- `size-backlog.json`: tighten-only (entries may only shrink/pass).
- Four censuses: each may grow, none may shrink.
- `npm test -- --run`: must stay green; ratchet test files may only gain
  tests (new pins), never lose them.

## Iteration log

- **C0** (this iteration): harness (`scripts/measurer-calibration-report.ts`),
  full corpus-wide characterization, jar-verified diagnosis (mechanism
  found: font-size 14-vs-13 caller bug, NOT a measurer defect). Zero `src/`
  changes — no in-scope fix exists. See `ledger.md` §C0 and
  `decision-journal.md` for the full record.

## Next iteration — recommended scope

1. **Primary fix** (requires write-set expansion — orchestrator decision):
   change the five identified call sites
   (`src/diagrams/state/state-dot-graph.ts:179`,
   `src/diagrams/state/state-composite-pass.ts:244,326`,
   `src/diagrams/class/class-dot-graph.ts:298`,
   `src/diagrams/description/layout.ts:735`) from `theme.fontSize` to a
   shared `ARROW_LABEL_FONT_SIZE = 13` constant (the exact pattern already
   proven safe and jar-verified twice in this codebase:
   `class-layout-helpers.ts`'s `CARDINALITY_FONT_SIZE` and
   `description/renderer-edge.ts`'s `ARROW_LABEL_FONT_SIZE`). MUST run the
   full protection protocol (DOT gate, size-backlog, all four censuses,
   full test suite) after EACH call site, not batched — a size-driven
   structural DOT-gate change is plausible per
   `class-layout-helpers.ts:96-100`'s own prior-iteration warning, and
   isolating which call site (if any) moves the gate is essential
   diagnostic information.
2. **After (1) lands**, the edge-label-ink mechanism (G4 S11/S12/S13,
   parked) becomes re-attemptable for a FOURTH time with the measurement
   half of its compounding error removed — S13's own estimate: "roughly
   half the observed error [is] attributed to the measurement gap alone."
   Still requires either a real `SvekEdge.java` label-placement port or a
   fourth geometric-box formula attempt; not guaranteed to converge, but
   no longer blocked on unresolved measurement uncertainty.
3. **Secondary, unrelated finding** (component diagrams only, low corpus
   impact — 1 of 265 fixtures dominates): `component/gutute-00-gaki684`
   (a `!pragma svek_trace on` stress-test fixture, ~9000px tall, deeply
   nested `protocol X { C1 C2 ... }` port declarations) shows a real,
   small, growing-with-string-length divergence between
   `WidthTableMeasurer` and jar's textLength for port labels
   (`"C1"` -3.25%, `"C10"` -6.08%). NOT root-caused this iteration (ruled
   out: SVG-level scale/transform, the `svek_trace` pragma itself — it
   does not exist in current upstream source, confirmed via
   `grep -rn svek_trace ~/git/plantuml/src/main/java/net/`, so it is a
   no-op and not the mechanism). Low priority: affects 1/265 component
   fixtures, unrelated to the S13 founding evidence's mechanism.
