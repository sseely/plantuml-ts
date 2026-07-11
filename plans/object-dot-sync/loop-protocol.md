# Loop Protocol (Phase L)

One iteration = one mechanism driven from "counted" to "fixed or
ledgered". Repeat until EVERY comparable fixture (80 at baseline) is
either structurally EQUAL or a ledgered, maintainer-validated
divergence — 100% minus the ledger; zero unledgered non-EQUAL
fixtures. Adapted from `plans/class-dot-sync/loop-protocol.md`.

## Iteration steps

1. **Measure.** `npx tsx scripts/dot-sync-report.ts object` (cached
   oracle dumps make re-runs fast). Record EQUAL / no-candidate /
   per-check counts in decision-journal.md.
2. **Pick.** The bucket with the most affected fixtures; no-candidate
   residue is a bucket too. Seeded order (baseline): degree 18,
   minlen 18, edgeCount 17, shape 9, label 7, nodeCount 4 — expect
   batch-1/2 consolidation to reshuffle these before the first pick.
3. **Diagnose** (per `~/.claude/rules/diagnosis.md`). 2–3
   representative fixtures; `--slug` drill-down for oracle-vs-ours DOT
   side by side. Read the Java producing the oracle's side (svek/,
   classdiagram/, objectdiagram/, cucadiagram/). Write the mechanism —
   cause, file:line (ours AND Java's), causal chain, ruled-out — into
   the journal BEFORE changing code. One mechanism per iteration.
4. **Fix at origin**, faithfully to the Java. TDD: pin the mechanism
   with a focused unit test first, then fix. Shared class-engine
   edits must keep the class ratchet green (stop condition 4).
5. **Re-measure.** EQUAL must not drop anywhere — `npm test` runs the
   class + description ratchets too. Log the delta.
6. **Ratchet.** Promote newly-EQUAL slugs into `oracle/goldens/object/`
   (copy from `test-results/dot-cache/object/`); confirm
   `tests/oracle/object-dot-parity.test.ts` passes.
7. **Gate + commit.** All four gates. One commit per iteration:
   `fix(object-dot): <mechanism summary>` with the Java citation in
   the body.
8. **Ledger.** If not fixable here (unimplemented subsystem, needs
   maintainer divergence sign-off), record every affected slug in
   `ledger.md` with the root-cause label, and move on.

## Close-out (after exit bar)

Regenerate `docs/parity-report.md` (`--markdown`), flip A3 in
`planning/mission-index.md`, write the mission summary in README.md,
final gates.

## Compaction / session hygiene

Compact between iterations, not mid-diagnosis. After compaction re-read
the README, this file, decisions.md, and the journal tail. The numbers
on disk are the source of truth, not remembered numbers.

## Parallelism

Iterations are sequential (each changes the measurement the next
depends on). WITHIN an iteration, subagents may parallelize read-only
research (Java reading vs fixture triage); a single agent owns the
write-set.
