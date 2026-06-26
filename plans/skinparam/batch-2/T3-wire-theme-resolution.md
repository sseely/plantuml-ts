# T3 — Wire three-stage theme resolution into render pipeline

> **Java source is the spec.** Before writing any code, read the relevant Java
> source in `~/git/plantuml`. The upstream code is 15+ years old and encodes
> accumulated knowledge as special cases and subtle tweaks that exist nowhere
> else. The Java code IS the requirement — not a reference. Reproduce every
> edge case faithfully.

## Context

plantuml-js is a TypeScript port of PlantUML (GPL-3.0). Stack: TypeScript + Vite,
Vitest tests (90/90/90 coverage). ESLint. Working directory: `/Users/scottseely/git/plantuml-js`.
Branch: `feat/skinparam`.

Batch 1 (T1 + T2) is complete:
- `PreprocessorResult` now has `skinparam: ReadonlyMap<string,string>`
- `src/core/skinparam.ts` exports `resolveSkinparam` and `parseStyleBlock`
- `src/core/theme.ts` exports `deepMergeTheme`

Read `src/index.ts` and `tests/integration/index.test.ts` fully before editing.

## Task

Replace the current single-step theme resolution in `render()`, `renderAll()`,
and `renderSync()` with a three-stage pipeline.

### Current pattern (in all three functions)

```typescript
const themeOption = options?.theme ?? (preprocessed.theme ?? 'default');
const theme = resolveTheme(
  typeof themeOption === 'string'
    ? (themeOption as 'default' | 'dark' | 'sketchy' | 'monochrome')
    : themeOption,
);
```

### New pattern

Extract a helper (module-private, not exported) to avoid repeating across three functions:

```typescript
function buildTheme(preprocessed: PreprocessorResult, options?: RenderOptions): Theme {
  // Stage 1: named base theme
  // String options.theme overrides !theme from source (existing behavior)
  const themeName =
    typeof options?.theme === 'string'
      ? options.theme
      : (preprocessed.theme ?? 'default');
  const base = resolveTheme(themeName as 'default' | 'dark' | 'sketchy' | 'monochrome');

  // Stage 2: apply skinparam directives from source
  const withSkinparam = resolveSkinparam(preprocessed.skinparam, base).theme;

  // Stage 3: apply <style> blocks from source
  const styleMap = preprocessed.styles
    .map(parseStyleBlock)
    .reduce<Map<string, string>>((acc, m) => { m.forEach((v, k) => acc.set(k, v)); return acc; }, new Map());
  const withStyles = resolveSkinparam(styleMap, withSkinparam).theme;

  // Stage 4: caller Partial<Theme> wins over everything
  if (options?.theme !== undefined && typeof options.theme === 'object') {
    return deepMergeTheme(withStyles, options.theme);
  }
  return withStyles;
}
```

Replace the `const themeOption` / `const theme` block in each of the three
render functions with a single call: `const theme = buildTheme(preprocessed, options);`

### Imports to add

```typescript
import { resolveSkinparam, parseStyleBlock } from './core/skinparam.js';
import { deepMergeTheme } from './core/theme.js';
```

## Write-Set

- `src/index.ts`
- `tests/integration/index.test.ts`

## Read-Set

- `src/index.ts` — read fully before editing
- `src/core/skinparam.ts` — for `resolveSkinparam`, `parseStyleBlock` signatures
- `src/core/theme.ts` — for `deepMergeTheme` signature
- `tests/integration/index.test.ts` — read fully before editing

## Architecture Decisions

- D5: Three-stage resolution — base theme → skinparam → caller override
  (confirmed against upstream `TContext.java:executeTheme()`)

## Acceptance Criteria

- Given source `skinparam classBackgroundColor #AABBCC\n@startuml\nclass Foo\n@enduml`,
  when `render()` called, then SVG contains `#AABBCC`
- Given `!theme dark` in source then `skinparam backgroundColor #FFFFFF` after it,
  when rendered, then diagram's skinparam wins (`#FFFFFF` background, not dark theme default)
- Given caller `options.theme = { colors: { background: '#112233' } }` with `skinparam`
  also setting `backgroundColor`, when rendered, then caller partial wins (`#112233`)
- Given source with `<style>\nbackgroundColor: #CCDDEE\n</style>`, when rendered,
  then style block color applied (same as skinparam)
- Given source with no `skinparam` and no `<style>`, when rendered,
  then output unchanged from current behavior (regression)
- All existing integration tests pass (regression)

## Quality Bar

`npm test && npm run typecheck && npm run lint && npm run build`. Coverage ≥ 90/90/90.

Commit message:
```
feat(render): three-stage theme resolution (base → skinparam → caller)

Replace single-step resolveTheme call with buildTheme helper that applies
skinparam directives and <style> block content before the caller override.
Resolution order confirmed against upstream TContext.java:executeTheme().

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```
