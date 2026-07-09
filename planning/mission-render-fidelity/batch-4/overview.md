# Batch 4 — Descriptive renderers

Both tasks wire the Paint foundation (T1), primitive layer (T2/T3), and geometry
(T4/T5/T6) into the two renderers that draw descriptive elements. Each task
touches a different renderer file, so they run in parallel once their shared
dependencies (T3, T6) are done.

| ID | Description | Agent | Writes | Depends On | Done |
|----|--------------|-------|--------|------------|------|
| T7 | description renderer reads per-element buckets, passes Paint | typescript-pro (sonnet) | `src/diagrams/description/renderer-helpers.ts`, + its test | T3, T6 | [x] |
| T8 | class renderer per-element color + plain `--` no arrowhead | typescript-pro (sonnet) | `src/diagrams/class/renderer.ts`, + its test | T3, T6 | [x] |

**Parallel:** T7 and T8 write disjoint files (`src/diagrams/description/` vs
`src/diagrams/class/`) and neither depends on the other's output — dispatch
both agents in the same batch once T3 and T6 are merged.

## Quality gates
Run the mission-level gates from `README.md` after both tasks land:
`npm run typecheck && npm test && npm run lint && npm run build`, plus the
DOT-parity probe (350/221/41 unchanged — a color-only change must not move
layout).
