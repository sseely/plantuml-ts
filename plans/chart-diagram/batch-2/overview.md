# Batch 2 — Layout + ChartGeometry Contract

Single task. Depends on Batch 1 (needs ChartDiagramAST types from `ast.ts`).

This batch is the most critical: it defines `ChartGeometry` and all sub-geometry interfaces
that Batch 3 agents will consume. **The interface contract in T2 must be stable before
Batch 3 begins.**

## Task Table

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T2 | Layout: ChartGeometry types + layoutChart() + layout tests | typescript-pro | `src/diagrams/chart/layout.ts`, `tests/unit/chart/layout.test.ts` | T1 | [x] |

## After This Batch

- Run all four quality gates
- Commit: `feat(chart): add layout and ChartGeometry types`
- Mark T2 `[x]` here and in README.md
- Proceed to Batch 3 (all four sub-renderers launch in parallel)
