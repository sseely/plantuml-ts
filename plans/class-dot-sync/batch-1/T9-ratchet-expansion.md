# T9 — Bulk ratchet expansion: pin the 357 EQUAL baseline

## Context
`tests/oracle/class-dot-parity.test.ts` ratchets only 9 pinned goldens
(mostly zero-graph degenerates). 357 fixtures are now EQUAL; pinning them
BEFORE batch-2 behavior changes makes any regression loud.

## Task
1. Run the report; collect the current EQUAL slug list (add a `--equal-list`
   flag or write `test-results/class-equal.txt` if no machine-readable
   output exists — small additive change to the script is in-scope).
2. Promote each EQUAL slug into `oracle/goldens/class/<slug>/`
   (`input.puml` + `svek-N.dot`), copying from the warm cache
   `test-results/dot-cache/class/` (same files the report graded).
3. Ensure the ratchet suite in `class-dot-parity.test.ts` asserts
   `structurallyEqual` for every golden without `input.svg` (it already
   does — verify it scales to ~357 dirs and stays fast enough for npm test).

## Write-set
- `oracle/goldens/class/**` (grows to ~357 slugs)
- `tests/oracle/class-dot-parity.test.ts`
- `scripts/dot-sync-report.ts` (only if the equal-list output is needed)

## Read-set
- `tests/oracle/class-dot-parity.test.ts` (whole — 138 lines)
- `tests/oracle/description-parity.ratchet.test.ts:53-82` (the pattern)
- `oracle/capture.sh`

## Interface contracts
Consumed by every loop iteration (step 6): golden layout =
`oracle/goldens/class/<slug>/{input.puml, svek-0.dot[, svek-N.dot…]}`.

## Acceptance criteria
- Given the ~357 EQUAL slugs, when `npm test` runs, then the ratchet suite
  asserts structural equality for all of them and passes.
- Given any pinned slug regresses, then the suite fails naming the slug.
- Given the full `npm test`, then wall-clock stays acceptable (<2× current;
  description's 294-golden suite is the precedent).

## Observability
The ratchet suite is the alarm; no other instrumentation.

## Rollback
Reversible (goldens are committed files).

## Commit
`test(class-dot): ratchet the 357-fixture EQUAL baseline`

## Depends on
T4 (goldens must be graded by the same jar the report uses).
