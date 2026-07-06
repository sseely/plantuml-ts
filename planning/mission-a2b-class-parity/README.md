# Mission A2b — Class DOT parity (re-plan)

**Supersedes `planning/mission-a2-class/`**, whose premises were falsified by
evidence during execution (4/4 architectural claims wrong). This brief is
grounded in `evidence.md` (all numbers instrumented) and `decisions.md`
(corrected ADRs). Read both before executing.

## Status at re-plan
- Branch `feat/a2-class-dot-sync` (13 commits, all gates green, mergeable).
- **137/680 EQUAL (20%)**, up from 9 (1%). The jump = one constant (nodesep 35).
- Batches 1–3 of the old brief landed useful work (goldens, parser fixes, misroute
  fix, parser split); their per-check gains are banked.

## Objective (corrected)
Raise class structural DOT parity from **20% toward a grounded ~33–40%** by
fixing the four checks that are the SOLE failure for the most fixtures. **90% is
not a target** (unreachable — evidence.md §Realistic ceiling). Ledger the residual.

## Levers, ranked by distance-to-EQUAL (evidence.md)
Each fixes fixtures that currently fail ONLY that check → direct EQUAL flips.

| # | Lever | Single-fail fixtures | ADR | Prereq |
|---|-------|----------------------|-----|--------|
| B1 | Package/namespace clustering (clusterOk) | 34 | A2 | A5 |
| B2 | Edge label counts (labelOk) | 21 | A3 | — |
| B3 | Narrow plaintext + minlen-per-type (shape/minlen) | 19 + 15 | A4 | A5 (plaintext) |
| B0 | **Prereq:** decompose `layoutClass`/`measureClassifier` under CCN 10 | — | A5 | — |
| B4 | Re-measure + residual ledger | — | A6 | — |

Critical path: **B0 → B1 → B3** (all touch `layout.ts`, single-writer, and are
gated behind the CCN decomposition). **B2** (edge labels) may be layout-local too
— confirm; if so it also needs B0. Sequence B0 first.

## Quality gates (per task; full set between batches)
```
npm run typecheck && npm run lint && npm test        # 90/90/90 coverage
npx vitest run tests/oracle/class-dot-parity.test.ts # 9 goldens stay EQUAL
```
Plus: 500-line file cap + per-function CCN ≤ 10 (PostToolUse hook — it BLOCKS,
it does not warn; `layout.ts` is currently blocked, hence B0). One-writer-per-file.

## Measurement
```
npx tsx scripts/dot-sync-report.ts class    # EQUAL %; the mission metric
```
For distance-to-EQUAL re-measurement, re-run the scratch probe documented in
`evidence.md` (per-fixture failing-check histogram).

## Constraints
- **STOP** if: a lever's premise fails verification (the recurring lesson here —
  verify against `~/git/plantuml` + the oracle cache BEFORE coding); a shared
  file (e.g. `descriptive-keywords.ts`) regresses another diagram type; the same
  approach fails a check 3×; an ADR is contradicted.
- **PUSH FORWARD** on upstream-mirroring rules (the port is the spec) and
  behavior-preserving refactors guarded by coverage (B0).
- Verify every premise first. The original brief's failure mode was assuming
  oracle behavior instead of measuring it.

## Index
- `evidence.md` — instrumented facts + distance-to-EQUAL analysis
- `decisions.md` — corrected ADRs (A1–A6) + the falsified premises
- Prior trail: `../mission-a2-class/decision-journal.md` (the falsification history)
