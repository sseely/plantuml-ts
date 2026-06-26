# Mission: JSON Diagram

## Objective

Implement `@startjson`/`@endjson` diagram support. Each JSON object or
array renders as a two-column table (key | value). Nested objects/arrays
become child nodes connected by Bézier arrows, laid out left-to-right
via the existing dot engine. Value types are colored via theme keys.
The `#highlight` directive highlights specific rows.

## Branch

`feat/json-diagram`

## Quality Gates

```sh
npm test              # vitest + coverage (90/90/90 thresholds)
npm run typecheck     # tsc --noEmit
npm run lint          # eslint src tests demo
npm run build         # vite library build
```

All four must pass before any commit.

## Batches

| Batch | Tasks | Status |
|-------|-------|--------|
| [Batch 1](batch-1/overview.md) | T1 infra, T2 parser (parallel) | [x] |
| [Batch 2](batch-2/overview.md) | T3 layout | [x] |
| [Batch 3](batch-3/overview.md) | T4 renderer | [x] |
| [Batch 4](batch-4/overview.md) | T5 plugin wiring | [x] |

## Stop Conditions

- Any file outside the declared write-set needs changes
- Two consecutive quality gate failures on the same check
- An architecture decision in [decisions.md](decisions.md) is contradicted
- `src/core/theme.ts` `deepMergeTheme` does not merge `json` colours
  correctly after T1 (verify before T3 starts)

## Push-Forward Conditions

- Minor import ordering / lint auto-fixes
- Choosing padding constants (use `H_PAD=8, V_PAD=4` as defaults)
- Picking MIN_WIDTH / MIN_HEIGHT values for empty nodes

## Links

- [decisions.md](decisions.md)
- [decision-journal.md](decision-journal.md)
- [diagrams/component-map.md](diagrams/component-map.md)
- [diagrams/data-flow.md](diagrams/data-flow.md)
- Java reference: `~/git/plantuml/src/main/java/net/sourceforge/plantuml/jsondiagram/`
