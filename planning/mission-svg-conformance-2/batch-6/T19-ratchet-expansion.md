# T19 — Expansion + divergence triage (iterate until dry)

## Context
Grow the ratchet across the DOT-EQUAL corpus. Loop: survey → pick
diverged DOT-EQUAL fixtures → overlay-triage → root-cause → fix the
port bug → re-survey → ratchet in the newly conformant. Stop when a
full pass adds nothing (dry) or only irreducible residue remains.

## Task
Iterate the loop above. Rules:
- **Port bugs get fixed at the origin** (diagnosis rules apply: state
  mechanism + file:line before fixing). Fixes will touch Batch 1–5
  files owned by other tasks — each `src/**` file needs a write-set
  expansion request (ASK) the first time it's touched; batch the asks
  (one ask listing all files found in a triage round is fine).
- **Irreducible residue** (expected family: text metrics where AWT and
  our table still disagree, per D12): propose
  `oracle/accepted-divergences.json` entries — root cause, bound
  (maxΔ), family, affected fixtures — and STOP for maintainer
  sign-off. Never pin loose, never widen the band.
- Journal each round: fixtures triaged, bugs fixed (mechanism + commit),
  fixtures ratcheted, residue classification.
- Every fix round re-runs full gates before the next survey.

## Write-set
- `oracle/goldens/svg-description/**` (manifest + goldens grow)
- `tests/oracle/svg-conformance/{parity.json,PARITY-SVG.md}` (refresh)
- `src/**` fixes: ASK per file, per round
- `oracle/accepted-divergences.json`: maintainer sign-off ONLY

## Read-set
- T15 survey/dashboard, T16 overlay tooling
- Whatever triage points at (unbounded by design; read-only until ASK)

## Acceptance criteria
1. Given the final survey, then every DOT-EQUAL fixture is either
   ratcheted (conformant) or classified (tracked gap with named
   follow-up, or signed accepted divergence). No untracked residue
   among DOT-EQUAL fixtures (D5′).
2. Given the dashboard, then PARITY-SVG.md reflects the final state and
   is committed.
3. Given the journal, then every fix round is recorded with mechanisms.

## Observability / Rollback
Dashboard + journal. / Reversible.

## Quality bar
Full gates green after every round; ratchet monotonically grows (a
previously locked fixture never leaves).

## Commit
One commit per fix round (`fix(T19): <mechanism summary>`) + one final
`test(T19): ratchet expansion — <N> fixtures locked`.
