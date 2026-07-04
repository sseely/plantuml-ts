# Decision Journal

Appended during execution. One row per non-trivial judgment call; one row per
loop iteration with the measured EQUAL delta.

| Date | Phase/Iter | Decision / Mechanism | Rationale / Delta |
|------|-----------|----------------------|-------------------|
| 2026-07-04 | B0/T0 | Gates on main verified by tree-hash equality (main^{tree} == branch^{tree}, 05ee26d8) instead of a re-run. | The merged tree is byte-identical to the tree that passed all four gates minutes earlier; a re-run adds runtime, not signal. |
| 2026-07-04 | B0/T0 | Pinned the maintainer-built graphviz-ts-0.1.0.tgz (2026-06-25) rather than repacking live source. | Live source is mid-refactor per maintainer; a maintainer-built tarball is the deliberate snapshot D2 wants. All gates green against it (bundle 905→889kB, expected dist delta). |
| 2026-07-04 | B0/T0 | SKIPPED step 6 (settings.autonomous.json widening: java/git-merge allow rules) — denied by the permission classifier as self-modification. | Surfaced to maintainer instead of working around. Impact: oracle-jar dumps (`java`) will permission-prompt in later iterations until the maintainer adds the rule; `git merge` not needed again until mission end. |
| 2026-07-04 | B0/T0 | Typecheck fix in scripts/dot-sync-report.ts (fail-counter indexing) folded into its first commit. | Script predated gating; baseline must be green before the ratchet means anything. |
| 2026-07-04 | B1 | Corrected batch plan: T3 depends on T1 (pins under the NEW bar); ran T1∥T2 then T3. Dependency column fixed in overview. | Pinning under the old bar would have baked in false-EQUAL goldens. |
| 2026-07-04 | B1/T1 | Maintainer added Bash(java) to settings.autonomous.json (the classifier had blocked me self-adding it in T0). | Oracle-jar runs no longer prompt. |
| 2026-07-04 | B1/T3 | **Baseline under the tightened bar: 0 EQUAL of 312 cached fixtures** (was 18+1 under the old bar). Ratchet ships with an empty pin set; zero-goldens path verified. | Every fixture fails ≥1 of rankdir/nodesep/ranksep — confirms graph attrs as Phase 2 category #1. |
| 2026-07-04 | B1/T2 | Probe: json and dot produce NO svek-*.dot (0/5 each). Phase 5 is a maintainer-decision phase as scoped. | Evidence in phase-5-json-dot/probe.md. |
| 2026-07-04 | B1 close | Executor follow-ups to T2's commit: added rankdir/nodesep/ranksep to the aggregate's per-check breakdown (T2 had deliberately deferred to honor byte-compatibility during parallel work); split drill-down into scripts/dot-sync-drilldown.ts (file-size hook, 501>500); replaced `1 << 28` and svek regex literals that broke lizard's TS parser (bogus CCN-67 swallow-to-EOF); gitignored /svek.dot,/svek.svg (oracle-jar trace droppings, DotStringFactory.java:312). | Fresh component breakdown under new bar: 0/263 EQUAL; rankdirOk fails 229, nodesepOk/ranksepOk 233. All four gates green (3083 tests). |
