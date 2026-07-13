# T4 — Newly-comparable fixture triage (goldens + ledger)

## Context

T2 (merged) made ~42 smetana/vizjs fixtures comparable and delivered a
per-newcomer verdict table (journal + T2 report). Per decisions.md D4:
EQUAL newcomers join the per-type ratchet goldens; non-EQUAL newcomers are
recorded for the per-type DOT queue — NOT fixed here.

Golden conventions (verified):
- class (oracle/goldens/class/): ratchet fixtures = input.puml + svek-N.dot,
  NO input.svg (that marks harness-health), EQUAL-only, no size pins
  (class-dot-parity.test.ts:104-138).
- state/object: EQUAL + size-backlog.json entry `{slug: maxSizeDeltaIn}` if
  measured delta > 0 (shrink-only assertions, test asserts ≤ pinned+1e-6).
- description (component/usecase share oracle/goldens/description/):
  input.puml + svek-N.dot, EQUAL under the tightened svek-dot bar.
- Copy source: the warm test-results/dot-cache/<type>/<slug>/ entries
  (in.puml → input.puml naming per each dir's existing convention — check
  an existing entry first).

## Task

1. From T2's verdict table (re-verify by running
   `npx tsx scripts/dot-sync-report.ts <type>` yourself per type):
   for each EQUAL newcomer, copy its fixture into the type's golden dir
   following that dir's exact file naming; for state newcomers with size
   deltas, add size-backlog entries at the measured value.
2. Run each type's parity ratchet test suite and the full suite — all green.
3. Write `plans/g0-limitfinder/newcomer-triage.md`: table of all newcomers —
   slug, type, verdict, action taken (golden/backlogged/recorded), and for
   non-EQUAL ones the diverging-check summary from the report (these seed
   the future per-type DOT drill queue).
4. Do NOT modify any script, any src/ file, or existing golden entries.

## Read-set

- decisions.md D4/D6; T2's journal rows + report table
- oracle/goldens/{class,state,object,description}/ (one existing entry each
  for the naming), oracle/README.md if present
- tests/oracle/{class,state,object}-dot-parity.test.ts,
  description-parity.ratchet.test.ts (:1-140 — the selection + assertion
  logic)
- .agent-notes/dot-sync-denominator.md

## Boundaries

Write ONLY: oracle/goldens/** (additions + the two size-backlog.json),
plans/g0-limitfinder/newcomer-triage.md. No git mutations; do not commit.
Run: the four parity test files + npm test at the end (T3 runs in parallel
with a disjoint write-set; if failures appear only in description renderer
areas, report separately — do not touch).

## Acceptance criteria

- Every EQUAL newcomer is pinned in a golden dir and its ratchet passes.
- No existing golden entry modified (git diff shows additions only, plus
  the two backlog files).
- newcomer-triage.md complete: every newcomer accounted for.
- Full suite green.

## Quality bar: gates; DOT gate exactly at the post-T2 baseline.
## Observability: N/A. Rollback: Reversible.
## Commit: `test(T4): pin newly-comparable smetana/vizjs fixtures in ratchet goldens` (orchestrator)
