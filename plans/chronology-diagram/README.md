# Mission: @startchronology Diagram (Phase 5j)

## Objective

Add chronology/timeline visualization to plantuml-js. The feature is
`@startchronology` / `@endchronology` and renders a horizontal timeline where
named events are placed as diamond markers at their precise timestamps.

Branch: `feat/chronology-diagram` (from `main` — do NOT build on `feat/hcl-diagram`).

## Quality Gates

Run all four after every batch before committing:

```sh
npm test              # vitest + coverage (90/90/90 thresholds)
npm run typecheck     # tsc --noEmit
npm run lint          # eslint src tests demo
npm run build         # vite library build
```

## Constraints

### Stop and wait for human input when:
- Any task must modify files outside its declared write-set
- Two consecutive quality gate failures on the same check after two fix attempts
- Event x positions (day-aligned scale) deviate from expected values by >1px for the corpus fixture
- A new npm package would be required

### Push forward with judgment when:
- Diamond fill/stroke colors (use `#000000`)
- Label vertical offset from baseline (use `16px`)
- Whether `baselineY` is 40 or 42px — pick whichever looks balanced
- Obvious one-line typecheck/lint fixes

## Architecture Decisions

See [decisions.md](decisions.md) for all pre-made decisions.

Key: **Day-aligned x-scale** — `minMs = minEpochDay × 86_400_000`, `maxMs = (maxEpochDay+1) × 86_400_000`.

## Batch Status

| Batch | Description | Status |
|-------|-------------|--------|
| [Batch 1](batch-1/overview.md) | AST type definitions | [x] |
| [Batch 2](batch-2/overview.md) | Parser, layout, renderer (parallel) | [x] |
| [Batch 3](batch-3/overview.md) | Plugin wiring + integration | [x] |

## Links

- [decisions.md](decisions.md) — architecture decisions
- [decision-journal.md](decision-journal.md) — runtime log
- [diagrams/component-map.md](diagrams/component-map.md) — component relationships
- [batch-1/T1-ast-types.md](batch-1/T1-ast-types.md)
- [batch-2/T2-parser.md](batch-2/T2-parser.md)
- [batch-2/T3-layout.md](batch-2/T3-layout.md)
- [batch-2/T4-renderer.md](batch-2/T4-renderer.md)
- [batch-3/T5-wiring.md](batch-3/T5-wiring.md)

## Pre-flight

- [ ] Baseline `npm test` is green
- [ ] Branch `feat/chronology-diagram` created from `main`
- [ ] No uncommitted changes that would interfere
