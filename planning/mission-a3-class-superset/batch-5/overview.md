# Batch 5 — Re-measure, ledger, close-out

**Prereq:** Batches 1-4 landed.

## Tasks

| id | task | output |
|----|------|--------|
| T5.1 | Full re-measure: class + description parity. Record final EQUAL for both corpora and the per-tier flip count vs the 18. | numbers |
| T5.2 | Re-triage any of the 18 still failing: single-fail → chase only if a clean, oracle-verified mechanism; else ledger with the specific gap. | flips or ledger |
| T5.3 | Update `../mission-a2b-class-parity/residual-ledger.md`: new class EQUAL %, what each tier flipped, the description-corpus net (must be ≥ 0), and the remaining tail (oracle-blind 36, deep-divergence fixtures, any unsafe-to-route). | ledger |
| T5.4 | Merge the mission branch to main (merge commit, per pr-workflow). Write the mission summary (tasks done vs planned, EQUAL delta on BOTH corpora, decisions with any flagged for review, follow-ups incl. the deferred cucadiagram convergence) per autonomous-execution §Session End. | merge + summary |

## Definition of done for the mission
Not "all 18 pass." Done = the routing consolidation landed with **zero
description-corpus regression**, the four tiers' safe oracle-verified wins are in,
class parity moved by the grounded per-tier amount, and the residual is honestly
recorded — including which fixtures resisted and why.
