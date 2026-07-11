# Loop Protocol (Phase L) — state

One iteration = one mechanism driven from "counted" to "fixed or
ledgered". Repeat until EVERY comparable fixture is either structurally
EQUAL or a ledgered, maintainer-validated divergence — 100% minus the
ledger; zero unledgered non-EQUAL fixtures. Copy of
`plans/object-dot-sync/loop-protocol.md` with state specifics.

## Iteration steps

1. **Measure.** `npx tsx scripts/dot-sync-report.ts state`. Record
   EQUAL / no-candidate / graph-count / per-check counts in
   decision-journal.md.
2. **Pick.** The bucket with the most affected fixtures; graph-count
   mismatch and no-candidate residues are buckets too.
3. **Diagnose** (per `~/.claude/rules/diagnosis.md`). 2–3
   representative fixtures; `--slug <slug> state` drill-down. Read the
   Java producing the oracle's side (svek/, statediagram/,
   cucadiagram/). Write the mechanism — cause, file:line (ours AND
   Java's), causal chain, ruled-out — into the journal BEFORE changing
   code. One mechanism per iteration. Consult mechanisms.md (T1's
   catalog) first — it may already name the mechanism.
4. **Fix at origin**, faithfully to the Java. TDD. Shared-file edits
   (svek-dot-emit, graph-layout.types) must keep ALL sibling ratchets
   green (stop condition 4).
5. **Re-measure.** EQUAL must not drop anywhere — `npm test` runs all
   ratchets. Log the delta.
6. **Ratchet.** Promote newly-EQUAL slugs into `oracle/goldens/state/`
   (input.puml + svek-N.dot from `test-results/dot-cache/state/`);
   size-backlog entries only shrink or are deleted.
7. **Gate + commit.** All four gates. One commit per iteration:
   `fix(state-dot): <mechanism summary>` with the Java citation in the
   body.
8. **Ledger.** If not fixable here (unimplemented subsystem, needs
   maintainer sign-off), record every affected slug in `ledger.md`
   with the root-cause label, and move on.

## Close-out (after exit bar)

Regenerate `docs/parity-report.md` (`--markdown state class object`),
flip A4 in `planning/mission-index.md`, write the mission summary in
README.md, final gates, merge to main with a merge commit.

## Compaction / session hygiene

Compact between iterations, not mid-diagnosis. After compaction re-read
the README, this file, decisions.md, mechanisms.md, and the journal
tail. The numbers on disk are the source of truth.

## Parallelism

Iterations are sequential. WITHIN an iteration, subagents may
parallelize read-only research; a single agent owns the write-set.
