# LaTeX Math Rendering — Mission Brief

Render `<latex>...</latex>` node labels as MathML inside SVG `<foreignObject>`
elements, using KaTeX for synchronous client-side conversion.

Branch: `feat/latex-rendering` (create from main)

## Objective

PlantUML supports `<latex>...</latex>` tags in node labels. Currently the raw
tag string is rendered as plain text. This mission adds KaTeX as a production
dependency, parses latex spans at layout/render time, and emits MathML in a
`<foreignObject>` element. Targets inline SVG in browser and markdown viewer
plugin environments.

Reference fixture: `~/git/pdiff/dbhum/b_ig/bigobe-53-denu394.puml`

## Quality Gates

```sh
npm test              # vitest + coverage (90/90/90 thresholds)
npm run typecheck     # tsc --noEmit (both configs)
npm run lint          # eslint src tests demo
npm run build         # vite library build
```

## Batches

| # | Description | Status |
|---|-------------|--------|
| 1 | KaTeX core module + svg.ts foreignObject primitive | [x] |
| 2 | Use case layout + renderer integration | [x] |

## Constraints

### Stop when:
- Any file outside the declared write-set needs changes
- Two consecutive quality gate failures on the same check
- `katex.renderToString` throws despite `throwOnError: false` — API mismatch
- KaTeX MathML output lacks `<math` element — version incompatibility
- `UCNodeGeo` interface needs a new field to carry LaTeX data — D1 violated

### Push forward when:
- Heuristic sizing constants need minor tuning — adjust, document in journal
- KaTeX installs a newer patch version than expected — proceed if API stable
- A label contains multiple `<latex>` spans — `parseLatexLabel` multi-span
  design already handles this, implement it
- Minor TypeScript narrowing on `LabelSpan` union — resolve inline

### Known approximation
Heuristic sizing (D3) is pre-acknowledged as rough. A future mission will
replace it with accurate measurement. Do not block progress on sizing fidelity.

## Links

- [decisions.md](decisions.md)
- [Batch 1 overview](batch-1/overview.md) · [T1](batch-1/T1-latex-core.md)
- [Batch 2 overview](batch-2/overview.md) · [T2](batch-2/T2-layout.md) · [T3](batch-2/T3-renderer.md)
- [Data flow](diagrams/data-flow.md)
- [Component map](diagrams/component-map.md)
- [Decision journal](decision-journal.md)
