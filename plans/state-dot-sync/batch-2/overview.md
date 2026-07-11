# Batch 2 — Svek-faithful structural port

Sequential (T3→T4): both rewrite the state layout/DOT layer. T3 lands
the flat-diagram svek foundation; T4 adds composites on top. Both are
specced against mechanisms.md (T1's catalog) — if the catalog
contradicts a spec detail below, the catalog wins (journal it).

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|-----------|------|
| T3 | Flat-state svek emission (shapes/sizes/edges/attrs) | sonnet | src/diagrams/state/** (layout rewrite), tests | T1, T2 | [ ] |
| T4 | Composite states: child passes + cluster envelopes | sonnet | src/diagrams/state/**, src/core/svek-dot-emit.ts + graph-layout.types.ts (additive only), tests | T3 | [ ] |
