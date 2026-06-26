# Mission Brief — @starthcl Diagram Type

## Objective

Add HCL (HashiCorp Configuration Language) visualization support to
plantuml-js. The feature is `@starthcl` / `@endhcl` and renders an HCL
config file as an interactive tree — identical output to `@startjson` /
`@startyaml`. HCL is a thin parser front-end that produces a
`JsonDiagramAST` and delegates entirely to the existing JSON layout and
renderer. No new layout or renderer code is needed.

## Branch

Work on `main` (no separate feature branch needed — feature is self-contained).

## Quality Gates

```sh
npm test              # vitest + coverage (90/90/90 thresholds)
npm run typecheck     # tsc --noEmit (both tsconfig)
npm run lint          # eslint src tests demo
npm run build         # vite library build
```

All four must pass before any commit lands.

## Batches

| # | Description | Status |
|---|-------------|--------|
| [Batch 1](batch-1/overview.md) | HCL parser + block-extractor registration + parser tests | [x] |
| [Batch 2](batch-2/overview.md) | Plugin wiring + index registration + style selectors + integration tests + visual page | [x] |

## Constraints

### Stop conditions

- Files outside the declared write-set need changes to make tests pass
- Two consecutive quality gate failures on the same check
- HCL tokenizer output conflicts with a confirmed architecture decision
- Adding `hcldiagram.*` selectors would require touching existing
  `yamldiagram.*` or `jsondiagram.*` logic (beyond appending a parallel block)

### Push-forward conditions

- Minor TypeScript type annotation style choices
- Test fixture wording and naming within the accepted pattern
- Choice of HCL examples in the visual smoke test page
- A quality gate failure is a lint nit with an obvious fix

## Key References

- Java source: `~/git/plantuml/src/main/java/net/sourceforge/plantuml/hcl/`
- YAML template: `src/diagrams/yaml/` (exact structural pattern to follow)
- JSON AST: `src/diagrams/json/ast.ts`
- Architecture decisions: [decisions.md](decisions.md)
- Component diagram: [diagrams/component-map.md](diagrams/component-map.md)
- Decision journal: [decision-journal.md](decision-journal.md)
