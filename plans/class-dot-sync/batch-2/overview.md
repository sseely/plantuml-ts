# Batch 2 — Pre-diagnosed graph-count mechanisms + shielded ports

T5 and T8 share `class-dot-graph.ts` → sequential (T5 then T8, or collapse
into one agent if convenient). T6 is parallel-safe with T5. T7 needs both
T5 and T6 (it touches `layout.ts` after T5 and consumes T6's pages).

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|-----------|------|
| T5 | Degenerate-diagram skip (0–1 entities → no DOT) | sonnet | src/diagrams/class/class-dot-graph.ts, layout.ts, tests | T2, T9 | [ ] |
| T6 | newpage parsing → ClassAst.pages | sonnet | src/diagrams/class/class-commands.ts, parser.ts, ast.ts, tests | T1, T9 | [ ] |
| T7 | newpage layout + stacked render + CHANGELOG | sonnet | src/diagrams/class/layout.ts, class-dot-graph.ts, renderer.ts, CHANGELOG.md, tests | T5, T6 | [ ] |
| T8 | Shielded/qualifier `:h` edge ports | sonnet | src/diagrams/class/class-dot-graph.ts, src/core/svek-dot-emit.ts (additive), tests | T5 | [ ] |

After batch 2: re-run the report, journal the new EQUAL count, ratchet all
newly-EQUAL slugs (loop-protocol step 6), then enter Phase L.
