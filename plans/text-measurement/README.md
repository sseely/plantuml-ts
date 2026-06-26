---
mission: text-measurement
branch: feat/text-measurement (create from feat/class-diagram)
---

# Text Measurement — Mission Brief

Port `StringBounderFixed`'s WIDTH table and formulas from upstream PlantUML Java
into `FormulaMeasurer`, fixing the height formula and adding `getDescent` to the
`StringMeasurer` interface. Add an LRU cache to `CanvasMeasurer` matching
`StringBounderTeaVM`.


## Standing Rule: Java Source Is the Spec

Before implementing any task in this mission, read the relevant Java source in
`~/git/plantuml`. The upstream code is 15+ years old and encodes accumulated
knowledge as special cases and subtle tweaks that are not documented anywhere
else. The Java code IS the requirement — not a reference. Reproduce every edge
case faithfully.

## Quality Gates

```sh
npm test              # vitest + coverage (90/90/90 thresholds)
npm run typecheck     # tsc --noEmit (both configs)
npm run lint          # eslint src tests demo
npm run build         # vite library build
```

All four must pass before any commit lands.

## Batches

| # | Description | Status |
|---|-------------|--------|
| 1 | Port WIDTH table + fix height formula | [x] |
| 2 | Add getDescent to interface + implementations | [x] |
| 3 | Add LRU cache to CanvasMeasurer | [x] |

## Write-Set (all batches)

- `src/core/measurer.ts`
- `tests/unit/measurer.test.ts`

## Links

- [decisions.md](decisions.md)
- [Batch 1 overview](batch-1/overview.md) — [T1](batch-1/T1-width-table.md)
- [Batch 2 overview](batch-2/overview.md) — [T2](batch-2/T2-get-descent.md)
- [Batch 3 overview](batch-3/overview.md) — [T3](batch-3/T3-lru-cache.md)
- [Component map](diagrams/component-map.md)
- [Decision journal](decision-journal.md)

## Constraints

### Stop when:
- Any file outside `src/core/measurer.ts` / `tests/unit/measurer.test.ts` needs changes
- Two consecutive quality gate failures on the same check
- `getDescent` is discovered to be called by existing layout code
- Transcribed WIDTH values differ from Java source

### Push forward when:
- Test helper code needs minor reorganisation to fit new tests
- LRU eviction uses a slightly different strategy (max 8192 still enforced)
- TypeScript inference requires a minor helper type local to the file
