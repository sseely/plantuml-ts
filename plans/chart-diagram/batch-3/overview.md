# Batch 3 — Sub-Renderers (Parallel)

Four agents run in parallel. Each writes one file with no overlap.
All depend on T2 (ChartGeometry types from layout.ts).

## Task Table

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T3 | BarRenderer | typescript-pro | `src/diagrams/chart/renderers/bar.ts` | T2 | [x] |
| T4 | LineRenderer | typescript-pro | `src/diagrams/chart/renderers/line.ts` | T2 | [x] |
| T5 | AreaRenderer | typescript-pro | `src/diagrams/chart/renderers/area.ts` | T2 | [x] |
| T6 | ScatterRenderer | typescript-pro | `src/diagrams/chart/renderers/scatter.ts` | T2 | [x] |

T3–T6 have no write-set overlap and no dependency on each other — launch all four
simultaneously.

## After This Batch

- Run all four quality gates
- One commit per task (four commits total)
  - `feat(chart): add BarRenderer`
  - `feat(chart): add LineRenderer`
  - `feat(chart): add AreaRenderer`
  - `feat(chart): add ScatterRenderer`
- Mark T3–T6 `[x]` here and in README.md
- Proceed to Batch 4
