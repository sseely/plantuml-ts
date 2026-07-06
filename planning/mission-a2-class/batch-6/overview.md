# Batch 6 — Re-baseline + measure

Re-run the class gate, pin all newly-EQUAL goldens, update the ratchet, and
report the final structural-EQUAL %. Ledger every non-EQUAL residual.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|-----------|------|
| T8 | Re-baseline goldens + measure to ≥90% | typescript-pro | `oracle/goldens/class/**`, `tests/oracle/class-dot-parity.test.ts`, `../decision-journal.md` | T4, T5, T6, T7 | [ ] |

Final gate: full suite + ratchet. If < 90%, ledger the residual categories and
stop cleanly (no speculative fixes).
