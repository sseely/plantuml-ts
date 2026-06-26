---
mission: skinparam
branch: feat/skinparam (create from main)
---

# Skinparam / Theming — Mission Brief

Wire `skinparam` directives and `<style>` block content into the render
pipeline. The preprocessor collects skinparam key/value pairs; a new
`resolveSkinparam` function maps them onto `Theme`; `render()`, `renderAll()`,
and `renderSync()` apply the three-stage resolution order (base theme →
skinparam → caller override).


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
| 1 | Preprocessor skinparam collection / `resolveSkinparam` + `deepMergeTheme` | [x] |
| 2 | Wire theme resolution into render pipeline | [x] |

## Write-Set by task

| Task | Files |
|------|-------|
| T1 | `src/core/preprocessor.ts`, `tests/unit/preprocessor.test.ts` |
| T2 | `src/core/theme.ts`, `tests/unit/theme.test.ts`, `src/core/skinparam.ts` *(new)*, `tests/unit/skinparam.test.ts` *(new)* |
| T3 | `src/index.ts`, `tests/integration/index.test.ts` |

## Links

- [decisions.md](decisions.md)
- [Batch 1 overview](batch-1/overview.md) — [T1](batch-1/T1-skinparam-collection.md) · [T2](batch-1/T2-resolve-skinparam.md)
- [Batch 2 overview](batch-2/overview.md) — [T3](batch-2/T3-wire-theme-resolution.md)
- [Data flow](diagrams/data-flow.md)
- [Component map](diagrams/component-map.md)
- [Decision journal](decision-journal.md)

## Constraints

### Stop when:
- Any file outside the declared write-set needs changes
- Two consecutive quality gate failures on the same check
- `resolveSkinparam` produces a `Theme` that breaks an existing rendered fixture
- Adding a skinparam key mapping requires extending `Theme` with a new property — defer to Phase 4i
- The `skinparam { }` block parser requires tracking nesting depth beyond one level

### Push forward when:
- A skinparam key is a clear alias for an existing key — add both mappings
- `parseStyleBlock` encounters a line that's neither a selector nor a `key: value` pair — skip silently
- Integration test needs a trivial fixture update due to theme resolution order change
- Minor TypeScript type narrowing requires a small helper type inside `skinparam.ts`
