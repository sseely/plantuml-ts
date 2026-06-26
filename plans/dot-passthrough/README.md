# Mission Brief — @startdot DOT Passthrough (Phase 5d)

## Objective

Add `@startdot` / `@enddot` support to plantuml-js. The upstream Java
implementation shells out to a graphviz binary; this TypeScript port parses
the DOT syntax to extract nodes, edges, and graph-level attributes, then
feeds them to the existing `src/core/dot/` Sugiyama layout engine.
Intentional improvement over upstream: `title` and `skinparam` directives
are supported (upstream silently ignores them).

## Branch

`feat/dot-passthrough` — branch off `main`, PR back to `main` when all batches complete.

## Quality Gates

```sh
npm test              # vitest + coverage (90/90/90 thresholds)
npm run typecheck     # tsc --noEmit (both tsconfig.json + tsconfig.node.json)
npm run lint          # eslint src tests demo
npm run build         # vite library build
```

All four must pass before any commit lands.

## Batches

| # | Description | Status |
|---|-------------|--------|
| [Batch 1](batch-1/overview.md) | AST + Parser + block-extractor registration + parser tests | [x] |
| [Batch 2](batch-2/overview.md) | Layout + layout tests | [x] |
| [Batch 3](batch-3/overview.md) | Renderer + plugin wiring + registration + tests + visual page | [x] |

## Constraints

### Stop conditions

- Any file outside a task's declared write-set needs changes to make tests pass
- Two consecutive quality gate failures on the same check
- Implementation contradicts a pre-made architecture decision (D1–D8)
- DOT parsing logic requires touching existing diagram parsers

### Push-forward conditions

- Minor TypeScript type annotation style choices
- Test fixture naming and wording within established conventions
- Choice of DOT examples in the visual demo page
- A quality gate failure is a lint nit with an obvious fix

## Key References

- Java source: `~/git/plantuml/src/main/java/net/sourceforge/plantuml/directdot/`
  (not a useful parsing reference — Java shells out to graphviz binary)
- DOT language spec: https://www.graphviz.org/doc/info/lang.html
- Layout engine: `src/core/dot/types.ts` (DotInputGraph, DotLayoutResult)
- Structural reference: `src/diagrams/files/` or `src/diagrams/packetdiag/`
- Architecture decisions: [decisions.md](decisions.md)
- Component map: [diagrams/component-map.md](diagrams/component-map.md)
- Decision journal: [decision-journal.md](decision-journal.md)

## Corpus fixtures (2 total)

```
~/git/pdiff/dbhum/b_em/bemepi-16-kuzo249.puml  — digraph, single node
~/git/pdiff/dbhum/c_id/ciditi-21-xacu710.puml  — undirected graph, 4 nodes
```

Both must render without error. Include as integration test cases in T3.
