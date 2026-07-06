# T8 — Re-baseline goldens + measure

## Context
After the shape (T4), edge (T5), newpage (T6), and qualifier (T7) work, many
more class fixtures should be structurally EQUAL. Pin them as committed goldens
(deterministic, per S1L) and update the ratchet, then report the final metric
against the ≥90% exit bar.

## Task
1. Run `npx tsx scripts/dot-sync-report.ts class`; record structural-EQUAL % and
   the per-check failure counts (nodeCount/edgeCount/degree/shape/label/cluster).
2. Pin all newly-EQUAL fixtures into `oracle/goldens/class/` (scan analogous to
   the S1L `pin-equal.ts`; measure with `WidthTableMeasurer`; do NOT re-capture
   the oracle DOTs — copy the deterministic cache).
3. Ensure `tests/oracle/class-dot-parity.test.ts` covers all pinned goldens and
   is green.
4. Ledger the outcome in `decision-journal.md`: final EQUAL %, and for every
   remaining non-EQUAL category, a one-line root cause (tolerance/latex, unbuilt
   feature, or a follow-up fix).

## Write-set
- `oracle/goldens/class/**`
- `tests/oracle/class-dot-parity.test.ts`
- `../decision-journal.md`

## Read-set
- `scripts/dot-sync-report.ts`, `tests/oracle/svek-dot.ts`
- the S1L pin-equal pattern (session scratchpad / `pin-equal.ts` history)

## Architecture decisions
Deterministic goldens (S1L). Exit bar ≥90% EQUAL; if unmet, ledger + stop
(push-forward rule — no number-chasing).

## Acceptance criteria
- Given the final engine, when the report runs, then the structural-EQUAL % is
  recorded and the ratchet pins all EQUAL fixtures (green).
- Given < 90%, then every residual category has a ledgered root cause and the
  mission stops cleanly.
- Given ≥90%, then A2's exit bar is met; flag A2 `done` in `mission-index.md`.

## Observability / Rollback
N/A. Reversible.

## Quality bar
Full suite + ratchet green. Final report + residual ledger written.

## Commit
`test(T8): re-baseline class goldens; report structural conformance`
