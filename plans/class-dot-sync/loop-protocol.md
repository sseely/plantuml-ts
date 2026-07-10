# Loop Protocol (Phase L)

One iteration = one mechanism driven from "counted" to "fixed or ledgered".
Repeat until ≥581 EQUAL (of 645 non-oracle-blind) AND zero unledgered
non-EQUAL fixtures. Adapted from `plans/dot-oracle-sync/loop-protocol.md`.

## Iteration steps

1. **Measure.** `npx tsx scripts/dot-sync-report.ts class` (cached oracle
   dumps make re-runs fast). Record EQUAL / graph-count / per-check counts
   in decision-journal.md.
2. **Pick.** The bucket with the most affected fixtures. graph-count residue
   is a bucket too. Ties: earlier in the seeded list (README).
3. **Diagnose** (per `~/.claude/rules/diagnosis.md`). Take 2–3 representative
   fixtures; use `--slug` drill-down for oracle-vs-ours DOT side by side.
   Read the Java that produces the oracle's side (svek/, classdiagram/,
   cucadiagram/ — start from the citations in decisions.md). Write the
   mechanism — cause, file:line (ours AND Java's), causal chain, ruled-out —
   into the journal BEFORE changing code. Multiple mechanisms in one bucket:
   split; one mechanism per iteration.
4. **Fix at origin**, faithfully to the Java. TDD: pin the mechanism with a
   focused unit test first, then fix. Shared-file edits: additive only (D3).
5. **Re-measure.** EQUAL must not drop — anywhere (run the description
   ratchet too via `npm test`). Log the delta.
6. **Ratchet.** Promote newly-EQUAL slugs into `oracle/goldens/class/`
   (`oracle/capture.sh` or copy from `test-results/dot-cache/class/`);
   confirm `class-dot-parity.test.ts` passes.
7. **Gate + commit.** All four gates. One commit per iteration:
   `fix(class-dot): <mechanism summary>` with the Java citation in the body.
8. **Ledger.** If not fixable here (unimplemented subsystem, needs
   maintainer divergence sign-off), record every affected slug in
   `ledger.md` with the root-cause label, and move on.

## Compaction / session hygiene

Compact between iterations, not mid-diagnosis. After compaction re-read the
README, this file, decisions.md, and the journal tail. The numbers on disk
are the source of truth, not remembered numbers.

## Parallelism

Iterations are sequential (each changes the measurement the next depends
on). WITHIN an iteration, subagents may parallelize read-only research
(Java reading vs fixture triage); a single agent owns the write-set.
