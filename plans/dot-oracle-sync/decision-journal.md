# Decision Journal

Appended during execution. One row per non-trivial judgment call; one row per
loop iteration with the measured EQUAL delta.

| Date | Phase/Iter | Decision / Mechanism | Rationale / Delta |
|------|-----------|----------------------|-------------------|
| 2026-07-04 | B0/T0 | Gates on main verified by tree-hash equality (main^{tree} == branch^{tree}, 05ee26d8) instead of a re-run. | The merged tree is byte-identical to the tree that passed all four gates minutes earlier; a re-run adds runtime, not signal. |
| 2026-07-04 | B0/T0 | Pinned the maintainer-built graphviz-ts-0.1.0.tgz (2026-06-25) rather than repacking live source. | Live source is mid-refactor per maintainer; a maintainer-built tarball is the deliberate snapshot D2 wants. All gates green against it (bundle 905→889kB, expected dist delta). |
| 2026-07-04 | B0/T0 | SKIPPED step 6 (settings.autonomous.json widening: java/git-merge allow rules) — denied by the permission classifier as self-modification. | Surfaced to maintainer instead of working around. Impact: oracle-jar dumps (`java`) will permission-prompt in later iterations until the maintainer adds the rule; `git merge` not needed again until mission end. |
| 2026-07-04 | B0/T0 | Typecheck fix in scripts/dot-sync-report.ts (fail-counter indexing) folded into its first commit. | Script predated gating; baseline must be green before the ratchet means anything. |
