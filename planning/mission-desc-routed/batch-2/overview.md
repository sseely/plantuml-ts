# Batch 2 — Surgical shape fixes (path B)

**Prereq:** Batch 1's verified per-element fix table. One targeted change per
row, each committed + gated independently.

## Principle
Implement exactly the condition from each Batch-1 row. NEVER a blanket
class→rect. After every single change, run the full gate (ADR-3): class parity +
description parity + before/after EQUAL-set diff on BOTH corpora. A description
regression blocks the commit.

## Task shape (repeat per fix row)

| id | task | gate |
|----|------|------|
| T2.k | Implement fix row k (narrowest condition) in `description/layout.ts` or `layout-helpers.ts`. Add/extend a `tests/unit/description/*` test asserting the shape for the specific trigger AND asserting a genuine shielded-interface / wide-port stays plaintext (guard the guard). | full gate + BOTH-corpora diff = 0 regressions |

## Ordering
Do the row that flips the most close fixtures first, but only if it is also the
lowest description-corpus risk. If the highest-yield row is also the riskiest,
do a low-risk row first to validate the gate harness end-to-end.

## Exit criterion
All safe rows landed; each with zero regressions on both corpora. Rows judged
unsafe (would regress deployment) are documented as skipped in the residual
ledger with the reason.

## Reminder
`description/layout.ts` and `layout-helpers.ts` are near the 500-line / CCN-10 /
NLOC-30 hooks — extract to a helper module (as done repeatedly in the class
engine) rather than inflating a function.
