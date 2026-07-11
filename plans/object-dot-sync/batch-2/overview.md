# Batch 2 — Layout/DOT/SVG + plugin removal

Sequential (T4→T5). T4 makes the class engine's output correct for
object/map leaves; T5 removes the now-dead plugin and proves dispatch
non-regression.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|-----------|------|
| T4 | object/map sizing + DOT emission + SVG render | sonnet | class/layout.ts, class-dot-graph.ts, renderer.ts, class-layout-helpers.ts?, tests | T1, T2, T3 | [ ] |
| T5 | Delete object plugin, migrate tests, dispatch verification | sonnet | src/diagrams/object/** (delete), src/index.ts, migrated tests | T4 | [ ] |
