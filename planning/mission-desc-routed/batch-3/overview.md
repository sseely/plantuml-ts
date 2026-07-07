# Batch 3 — Re-measure, mid-tier, labelOk, close-out

**Prereq:** Batch 2's shape fixes landed.

## Tasks

| id | task | output |
|----|------|--------|
| T3.1 | Re-run class + description parity; re-run the description-routed status script. Record new EQUAL and which of the 18 flipped. | numbers |
| T3.2 | Mid-tier: the fixtures that failed shape+other checks may now be closer. Re-triage the 18; any newly single-fail → chase if a clean mechanism, else ledger. | flips or ledger notes |
| T3.3 | sijisi (labelOk-only): mixed `class` + `rectangle "foo2" { rectangle "foo3" }` + `foo2 --> foo1::Temp` port. Shapes already match; find the label-count gap in the failing graph. Fix only if surgical. | flip or ledger |
| T3.4 | Update `../mission-a2b-class-parity/residual-ledger.md`: new EQUAL %, what flipped, what remains (oracle-blind 36, any unsafe-to-fix rows, deep-divergence fixtures). Merge branch to main (merge commit, per pr-workflow). | ledger + merge |

## Exit criterion
Class parity up with **zero** description-corpus regression; residual ledger
current; mission summary written (tasks done vs planned, EQUAL delta, decisions,
follow-ups) per autonomous-execution §Session End.

## Definition of done for the mission
Not "all 54 fixtures pass" — that is unreachable (36 oracle-blind, several
deep-divergence). Done = the safe, oracle-verified description-engine fidelity
fixes are landed, class parity moved by the grounded ~+6–10, description parity
did not drop, and the residual is honestly recorded.
