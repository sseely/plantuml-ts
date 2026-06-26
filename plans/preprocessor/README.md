---
mission: preprocessor
branch: feat/preprocessor (create from main)
---

# Preprocessor — Mission Brief

Complete the PlantUML preprocessor pipeline: add `<style>` block extraction,
`!else` conditional branching, parametric macros (`!define MACRO(args) body`),
recursive `!include` with circular-cycle detection, a Node.js filesystem
fetcher, and wire the include resolver into the public `render()` API.


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
| 1 | `<style>` extraction + `!else` / recursive includes + circular detection | [x] |
| 2 | Parametric macros / Node.js fs fetcher | [x] |
| 3 | Wire includes into render pipeline | [x] |

## Write-Set by task

| Task | Files |
|------|-------|
| T1 | `src/core/preprocessor.ts`, `tests/unit/preprocessor.test.ts` |
| T3 | `src/core/include-resolver.ts`, `tests/unit/include-resolver.test.ts` |
| T2 | `src/core/preprocessor.ts`, `tests/unit/preprocessor.test.ts` |
| T4 | `src/core/include-resolver-node.ts` *(new)*, `tests/unit/include-resolver-node.test.ts` *(new)* |
| T5 | `src/index.ts`, `tests/integration/index.test.ts` |

## Links

- [decisions.md](decisions.md)
- [Batch 1 overview](batch-1/overview.md) — [T1](batch-1/T1-style-else.md) · [T3](batch-1/T3-recursive-includes.md)
- [Batch 2 overview](batch-2/overview.md) — [T2](batch-2/T2-parametric-macros.md) · [T4](batch-2/T4-node-fs-fetcher.md)
- [Batch 3 overview](batch-3/overview.md) — [T5](batch-3/T5-wire-pipeline.md)
- [Data flow](diagrams/data-flow.md)
- [Component map](diagrams/component-map.md)
- [Decision journal](decision-journal.md)

## Constraints

### Stop when:
- Any file outside the declared write-set needs changes
- Two consecutive quality gate failures on the same check
- `PreprocessorResult` interface change breaks callers beyond `src/index.ts`
- Parametric macro expansion produces infinite substitution loops
- Path traversal protection in Node.js fetcher requires a security decision

### Push forward when:
- Test helper refactoring needed to fit new tests
- Minor TypeScript inference requires a private helper type
- `<style>` block spans `@startuml`/`@enduml` boundary — strip and continue
- `CircularIncludeError` needs a minor extra property for diagnostics
- Integration test fixture needs small update due to pipeline changes
