# Mission A2 — Class DOT-sync structural port

## Objective

Bring the class diagram's svek DOT into structural parity with the PlantUML
oracle: from **1% structurally EQUAL (9/680) → ≥90%**. Class svek nodes are
HTML-table `plaintext` nodes (compartments) not plain rects, class relationships
emit a different edge topology, and `newpage` produces multiple graphs — none of
which the current engine does. This is the *structural* port (the class analog
of description's original 7%→90% grind), reusing the S1L sizing infrastructure.

Scope background: `planning/a2-class-dot-sync.md`.

## Branch

`feat/a2-class-dot-sync` (create from `main`; mission-brief branches use
**merge commits**, not squash — preserve per-task commit IDs).

## Startup

1. Read this README.
2. Read `decisions.md` (5 ADRs, all approved).
3. Read `decision-journal.md` (may have entries from earlier in the session).
4. Start at the lowest-numbered batch with unchecked tasks. Read that batch's
   `overview.md`, then each `TN-*.md` (usable directly as the agent prompt).

## Quality gates (run per task; full set between batches)

```
- command: npm run typecheck        # tsc --noEmit (both tsconfigs)   | pass: exit 0 | on_fail: fix_and_rerun
- command: npm run lint             # eslint src tests demo           | pass: exit 0 | on_fail: fix_and_rerun
- command: npm test                 # vitest + 90/90/90 coverage      | pass: exit 0 | on_fail: fix_and_rerun
- command: npx vitest run tests/oracle/class-dot-parity.test.ts       | pass: exit 0 | on_fail: fix_and_rerun
```
Also: 500-line-per-file complexity cap (PostToolUse hook) and one-writer-per-file
per batch. After the **newpage batch (batch-4)**, run the FULL suite as a
cross-type regression guard (it touches shared `block-extractor.ts`).

## Measurement

```
npx tsx scripts/dot-sync-report.ts class     # structural-EQUAL %; the mission metric
```

## Constraints

**STOP** when: a task needs files outside its write-set; 2 consecutive gate
failures on one check; the newpage change breaks another diagram type's tests;
the same shape/edge approach fails a check 3×; the upstream shape condition
(ADR-1) can't be determined unambiguously; an ADR is contradicted.

**PUSH FORWARD** on: upstream-mirroring shape/edge/label rules (the port is the
spec); golden pinning / ratchet updates; stylistic no-ops; simpler-than-estimated
tasks (log why). If 90% isn't reached after T8, **ledger the residual and stop
cleanly** — no speculative number-chasing.

## Batches

| # | Batch | Tasks | Status |
|---|-------|-------|--------|
| 1 | Foundation (diagnose, pin, label builder) | T1, T2, T3 | [ ] |
| 2 | Class node shapes (plaintext/rect) | T4 | [ ] |
| 3 | Relationship-edge topology | T5 | [ ] |
| 4 | `newpage` shared-infra (multi-graph) | T6 | [ ] |
| 5 | Qualifier ports | T7 | [ ] |
| 6 | Re-baseline + measure | T8 | [ ] |

Critical path: **T3 → T4 → T5 → T7** (the `layout.ts` single-writer chain).
**T1, T2, T6** parallelize (disjoint files).

## Index

- `decisions.md` — the 5 ADRs
- `batch-N/overview.md` — batch task tables + write-sets
- `batch-N/TN-*.md` — full task specs (agent prompts)
- `diagrams/component-map.md`, `diagrams/data-flow.md`
- `decision-journal.md` — appended during execution
