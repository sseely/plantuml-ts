# Decision Journal — state-dot-sync

| Date | Decision / event | Detail | Why | Status |
|------|------------------|--------|-----|--------|
| 2026-07-11 | Brief generated autonomously | /plan-mission run in an unattended session ("move on to the next known items"): the skill's phase-by-phase user confirmations could not be collected. All D1–D5 decisions follow A2/A3 precedent or mission-index sequencing (SI1-after-A4); marked pending ratification in decisions.md. Planning evidence: baseline report + oracle-dump drills (bemena-23-zebu249 two-pass structure) + GroupMakerState/GeneralImageBuilder reads + state engine survey. | Autonomous grind protocol (mission-index) vs skill gates — logged, not silent | open — maintainer ratifies |
| 2026-07-11 | T0 baseline captured | `dot-sync-report state`: 278 manifest, 0 EQUAL (0%), 118 graph-count mismatch, 12 no-candidate, 6 oracle-blind. Buckets: shape 174, nodesep 174, degree 77, nodeCount 58 (over 16/under 42), edge/minlen 48 (over 2/under 46), label 43, ranksep 43, cluster 30 (all under), rankdir 1. Gates green at A3 close (5834 tests, post-merge main). | Brief T0 | done |
