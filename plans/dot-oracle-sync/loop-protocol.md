# Loop Protocol (phases 2–5)

One iteration = one divergence category driven from "counted" to "fixed or
ledgered". Repeat until the phase's exit bar holds (EQUAL ≥ 90% of the type's
corpus AND zero unexplained non-EQUAL fixtures).

## Iteration steps

1. **Measure.** `npx tsx scripts/dot-sync-report.ts <type>` (cached oracle
   dumps make re-runs fast). Record EQUAL / no-candidate / graph-count /
   per-check counts in decision-journal.md.
2. **Pick.** The category with the most affected fixtures. no-candidate and
   graph-count buckets are categories too. Ties: pick the one earlier in the
   seeded list (phase overview).
3. **Diagnose** (per `~/.claude/rules/diagnosis.md`). Take 2–3 representative
   fixtures. Use the `--slug` drill-down to see oracle vs ours side by side.
   Read the Java that produces the oracle's side (svek/, descdiagram/, …).
   Write the mechanism — cause, file:line (ours AND Java's), causal chain,
   ruled-out — into the journal BEFORE changing code. If one category has
   several mechanisms, split it; one mechanism per iteration.
4. **Fix at origin** (decisions.md D6), faithfully to the Java. TDD: pin the
   mechanism with a focused unit test first, then fix.
5. **Re-measure.** EQUAL must not drop. Log the delta (e.g. "minlen semantics:
   component 18→61 EQUAL").
6. **Ratchet.** Add newly-EQUAL slugs: capture their oracle dumps into
   `oracle/goldens/<type>/` (`oracle/capture.sh` or copy from
   `test-results/dot-cache/`), confirm the ratchet vitest passes.
7. **Gate + commit.** All quality gates. One commit per iteration:
   `fix(<type>-dot): <mechanism summary>` with Java citation in the body.
8. **Ledger.** If the category is *not fixable here* (unimplemented subsystem,
   needs maintainer divergence decision), record every affected slug in
   `phase-N-*/ledger.md` with the root-cause label, and move on.

## Ledger entry format

```
## <category label>
- Mechanism: <one sentence> (Java: <file:line>; ours: <file:line>)
- Disposition: fixed <commit> | blocked-on <subsystem> | needs-signoff
- Slugs: <slug, slug, …>
```

## Compaction / session hygiene

Compact between iterations, not mid-diagnosis. After compaction re-read this
file, the phase overview, and the journal tail — per
`~/.claude/rules/autonomous-execution.md`. The report numbers on disk (journal)
are the source of truth, not remembered numbers.

## Parallelism

Iterations are sequential (each changes the measurement the next depends on).
WITHIN an iteration, subagents may parallelize read-only research (Java source
reading vs fixture triage) but a single agent owns the write-set.
