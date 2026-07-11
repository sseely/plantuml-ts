# T0 — Branch + baseline

## Task
1. Create `feature/state-dot-sync` off main.
2. Run `npx tsx scripts/dot-sync-report.ts state`; record the full
   baseline (EQUAL / no-candidate / oracle-blind / graph-count /
   per-check buckets) in decision-journal.md. No EXPECTED_TAG change
   needed (state → 'STATE' already correct).
3. All four gates green (they were at A3 close — confirm).

## Acceptance criteria
- Given the report, then baseline matches the README numbers (0 EQUAL,
  118 graph-count, etc.) or the delta is journaled with a mechanism.
- Given the gates, then all pass.

## Observability
N/A. **Rollback:** Reversible.

## Commit
`chore(state-dot): baseline journal (0/~255 EQUAL)` — plans dir only.
