# Batch 4 — Orchestrator + Plugin Wiring

Single task. Depends on all of Batch 3 (needs all four sub-renderers).

Writes the `ChartRenderer` orchestrator, the plugin entry point, wires into `src/index.ts`,
and adds integration tests.

## Task Table

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T7 | ChartRenderer + axes + grid + legend + annotations + plugin wiring + integration tests | typescript-pro | `src/diagrams/chart/renderer.ts`, `src/diagrams/chart/index.ts`, `src/index.ts`, `tests/unit/chart/renderer.test.ts` | T3, T4, T5, T6 | [x] |

## After This Batch

- Run all four quality gates
- Commit: `feat(chart): add ChartRenderer orchestrator and plugin registration`
- Mark T7 `[x]` here and in README.md
- Mission complete — run final quality gates on the full branch
