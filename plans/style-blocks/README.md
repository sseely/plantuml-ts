---
mission: style-blocks
branch: feat/style-blocks (already created from main)
---

# Scoped `<style>` Blocks + Business Element Variants — Mission Brief

Replace the flat `parseStyleBlock` with a hierarchical parser that preserves
selector paths (`actor`, `actor.business`, `usecase.business`). Wire the
resulting `StyleMap` into `buildTheme` so element-scoped colors reach the
renderers via new `Theme` properties. Add `/`-suffix parsing to produce
`business-actor` and `business-usecase` AST node kinds, then render them with
the upstream visual (filled head/ellipse + diagonal line).

Reference fixture: `~/git/pdiff/dbhum/b_al/baleji-17-reru445.puml`

## Standing Rule: Java Source Is the Spec

Before implementing any task in this mission, read the relevant Java source in
`~/git/plantuml`. The upstream code is 15+ years old and encodes accumulated
knowledge as special cases and subtle tweaks that exist nowhere else. The Java
code IS the requirement — not a reference. Reproduce every edge case faithfully.

Key upstream files for this mission:
- `~/git/plantuml/src/main/java/net/sourceforge/plantuml/style/StyleLoader.java`
- `~/git/plantuml/src/main/java/net/sourceforge/plantuml/style/StyleSignature.java`
- `~/git/plantuml/src/main/java/net/sourceforge/plantuml/style/PName.java`
- `~/git/plantuml/src/main/java/net/sourceforge/plantuml/style/SName.java`
- `~/git/plantuml/src/main/java/net/sourceforge/plantuml/decoration/symbol/USymbolActorBusiness.java`
- `~/git/plantuml/src/main/java/net/sourceforge/plantuml/decoration/symbol/USymbolUsecase.java`

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
| 1 | Hierarchical style parser / Theme fills / Business AST | [x] |
| 2 | Wire buildTheme / Usecase renderer / Class renderer fix | [x] |

## Write-Set by task

| Task | Files |
|------|-------|
| T1 | `src/core/skinparam.ts`, `tests/unit/skinparam.test.ts` |
| T2 | `src/core/theme.ts`, `tests/unit/theme.test.ts` |
| T3 | `src/diagrams/usecase/ast.ts`, `src/diagrams/usecase/parser.ts`, `tests/unit/usecase/parser.test.ts` |
| T4 | `src/index.ts`, `tests/integration/index.test.ts` |
| T5 | `src/diagrams/usecase/renderer.ts`, `tests/unit/usecase/renderer.test.ts` |
| T6 | `src/diagrams/class/renderer.ts`, `tests/unit/class/renderer.test.ts` |

## Links

- [decisions.md](decisions.md)
- [Batch 1 overview](batch-1/overview.md) — [T1](batch-1/T1-hierarchical-parser.md) · [T2](batch-1/T2-theme-fills.md) · [T3](batch-1/T3-business-ast.md)
- [Batch 2 overview](batch-2/overview.md) — [T4](batch-2/T4-wire-buildtheme.md) · [T5](batch-2/T5-usecase-renderer.md) · [T6](batch-2/T6-class-renderer.md)
- [Data flow](diagrams/data-flow.md)
- [Component map](diagrams/component-map.md)
- [Decision journal](decision-journal.md)

## Constraints

### Stop when:
- Any file outside the declared write-set needs changes
- Two consecutive quality gate failures on the same check
- `StyleMap` type change breaks callers beyond `src/index.ts`
- Style blocks with more than 2 nesting levels encountered — upstream supports
  arbitrary depth; stop rather than guess truncation behavior
- Business actor/usecase diagonal line coordinates can't be faithfully derived
  from upstream Java — visual fidelity requires a human decision
- `UCNodeKind` exhaustiveness check reveals an unhandled renderer `kind` case

### Push forward when:
- A `SName` element type maps cleanly to an existing `Theme` property — add it
- Minor TypeScript narrowing needed for `StyleMap` key iteration
- Integration test fixture needs trivial update due to new Theme default values
- Business element coordinates are unambiguous in the upstream Java — implement directly
