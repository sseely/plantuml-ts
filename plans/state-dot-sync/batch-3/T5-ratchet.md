# T5 — State DOT-parity ratchet

## Task
Copy the A3 ratchet pattern exactly (`tests/oracle/object-dot-parity.test.ts`
is the template — multi-graph aware already via svekFiles ordering):
1. `npx tsx scripts/dot-sync-report.ts --equal-list state`; seed
   `oracle/goldens/state/<slug>/` (input.puml + svek-N.dot from
   test-results/dot-cache/state/) for every EQUAL slug.
2. `tests/oracle/state-dot-parity.test.ts`: per golden, captured graph
   count == committed svek-N.dot count; each structurallyEqual; sizes
   pinned via `oracle/goldens/state/size-backlog.json` (shrink-only,
   absent slug = maxSizeDeltaIn 0; capture initial values honestly).
3. All four gates.

## Write-set
- tests/oracle/state-dot-parity.test.ts, oracle/goldens/state/**

## Acceptance criteria
- Given the ratchet suite, then every pinned golden passes.
- Given `npm test`, then everything green.

## Observability
N/A. **Rollback:** Reversible.

## Commit
`test(state-dot): parity ratchet + goldens + size backlog (T5)`
