# T5 — Wire resolveIncludes into render pipeline

> **Java source is the spec.** Before writing any code, read the relevant Java
> source in `~/git/plantuml`. The upstream code is 15+ years old and encodes
> accumulated knowledge as special cases and subtle tweaks that exist nowhere
> else. The Java code IS the requirement — not a reference. Reproduce every
> edge case faithfully.

## Context

plantuml-js is a TypeScript port of PlantUML (GPL-3.0). Stack: TypeScript + Vite,
Vitest tests (90/90/90 coverage). ESLint.

Branch: `feat/preprocessor`. Working directory: `/Users/scottseely/git/plantuml-js`.

Batch 2 (T2 + T4) is complete. `preprocessor.ts` has parametric macros.
`include-resolver.ts` has recursive expansion. Read `src/index.ts` fully.

## Task

### `RenderOptions` — add `fetcher`

```typescript
import type { IncludeFetcher } from './core/include-resolver.js';
import { resolveIncludes } from './core/include-resolver.js';

export interface RenderOptions {
  theme?: 'default' | 'dark' | 'sketchy' | 'monochrome' | Partial<Theme>;
  measurer?: StringMeasurer;
  maxWidth?: number;
  fetcher?: IncludeFetcher;   // ← NEW: custom !include resolver
}
```

### `render()` — call resolveIncludes first

```typescript
export async function render(source: string, options?: RenderOptions): Promise<string> {
  try {
    const resolved = await resolveIncludes(source, options?.fetcher);
    const preprocessed = preprocess(resolved);
    // ... rest unchanged
  }
}
```

### `renderAll()` — same pattern

```typescript
export async function renderAll(source: string, options?: RenderOptions): Promise<string[]> {
  try {
    const resolved = await resolveIncludes(source, options?.fetcher);
    const preprocessed = preprocess(resolved);
    // ... rest unchanged
  }
}
```

### `renderSync()` — detect and throw

After `preprocess(source)`, check whether the original source contained any
`!include` lines. If yes, throw before rendering:

```typescript
export function renderSync(source: string, options?: RenderOptions): string {
  try {
    // Check for !include directives — not supported in sync path
    if (/^!include\s/m.test(source)) {
      throw new Error(
        '!include directives are not supported in renderSync — use render() instead',
      );
    }
    const preprocessed = preprocess(source);
    // ... rest unchanged
  }
}
```

## Write-Set

- `src/index.ts`
- `tests/integration/index.test.ts`

## Read-Set

- `src/index.ts` — read fully before editing
- `src/core/include-resolver.ts` — for `resolveIncludes` + `IncludeFetcher` exports
- `tests/integration/index.test.ts` — read fully to understand existing tests

## Architecture Decision

- D6: `renderSync` throws on `!include`; `render()` and `renderAll()` resolve first

## Acceptance Criteria

- Given source with `!include url` and `fetcher` option returning `'Alice -> Bob'`,
  when `render(source, {fetcher})` called, then SVG contains the rendered diagram
- Given no `fetcher` option and source without `!include`,
  when `render()` called, then output unchanged (regression)
- Given `renderSync` called with `!include foo` in source,
  when called, then throws Error mentioning 'renderSync'
- Given `renderSync` called with source containing no `!include`,
  when called, then renders normally (regression)
- All existing integration tests pass (regression)

## Quality Bar

`npm test && npm run typecheck && npm run lint && npm run build`. Coverage ≥ 90/90/90.

Commit message:
```
feat(render): wire resolveIncludes into render pipeline

render() and renderAll() now call resolveIncludes before preprocessing.
Callers may pass a custom fetcher via RenderOptions. renderSync throws
if the source contains !include directives.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```
