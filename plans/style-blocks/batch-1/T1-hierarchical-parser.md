# T1 — Hierarchical `<style>` block parser

> **Java source is the spec.** Before writing any code, read the relevant Java
> source in `~/git/plantuml`. The upstream code is 15+ years old and encodes
> accumulated knowledge as special cases and subtle tweaks that exist nowhere
> else. The Java code IS the requirement — not a reference. Reproduce every
> edge case faithfully.
>
> Read before implementing:
> - `~/git/plantuml/src/main/java/net/sourceforge/plantuml/style/StyleLoader.java`
> - `~/git/plantuml/src/main/java/net/sourceforge/plantuml/style/SName.java`

## Context

plantuml-js is a TypeScript port of PlantUML (GPL-3.0). Stack: TypeScript +
Vite, Vitest tests (90/90/90 coverage). ESLint. Working directory:
`/Users/scottseely/git/plantuml-js`. Branch: `feat/style-blocks`.

## Task

Replace the flat `parseStyleBlock` in `src/core/skinparam.ts` with a
hierarchical version that preserves selector paths.

### New `StyleMap` type

Add to `src/core/skinparam.ts`:

```typescript
export type StyleMap = Map<string, Map<string, string>>;
```

Outer key: dot-separated lowercase selector path (e.g. `"actor"`,
`"actor.business"`, `""` for top-level bare declarations).
Inner key: lowercased property name. Inner value: trimmed value string.

### New `parseStyleBlock` signature

```typescript
export function parseStyleBlock(raw: string): StyleMap
```

The return type changes from `Map<string, string>` to `StyleMap`.

### Algorithm

Parse the block content line by line, tracking a selector stack:

1. A line matching `/^\s*([\w.-]+)\s*\{/` opens a selector — push the
   lowercased selector name onto the stack.
2. A line matching `/^\s*\}\s*$/` closes a block — pop the stack.
3. A line matching `/^\s*([\w-]+)\s*:\s*(.+)$/` is a declaration:
   - selector path = stack joined with `"."` (empty string if stack is empty)
   - key = `match[1].toLowerCase()`
   - value = `match[2].trim()`, strip trailing `;` if present
   - Store in `StyleMap[selectorPath][key] = value`
4. Strip trailing `\r` from each line before processing (CRLF safety).
5. Other lines are silently skipped.

Support up to 2 nesting levels (element type + stereotype). If a third level
is encountered, stop and throw `new Error('style nesting depth > 2 not supported')`.

### Backward-compatible `resolveSkinparam` callsite

`buildTheme` in `src/index.ts` currently calls:
```typescript
preprocessed.styles.map(parseStyleBlock).reduce(...)
```
This will break because the return type changed. That callsite is updated in
T4 — **do not touch `src/index.ts` in this task**. The existing integration
tests that call `render()` will temporarily fail at the type level; that is
expected and resolved in T4.

To keep existing unit tests of `resolveSkinparam` passing, note that
`resolveSkinparam` accepts `ReadonlyMap<string, string>` — it is not affected
by the `StyleMap` type change.

## Write-Set

- `src/core/skinparam.ts`
- `tests/unit/skinparam.test.ts`

## Read-Set

- `src/core/skinparam.ts` — read fully before editing
- `tests/unit/skinparam.test.ts` — read fully before editing

## Acceptance Criteria

- Given `"actor { BackGroundColor blue; }"`, then `StyleMap` has key `"actor"`
  with `{ backgroundcolor: "blue" }`
- Given `"actor { business { BackGroundColor red; } }"`, then `StyleMap` has
  key `"actor.business"` with `{ backgroundcolor: "red" }`
- Given a bare `"BackGroundColor green;"` at top level (no selector), then
  `StyleMap` has key `""` with `{ backgroundcolor: "green" }`
- Given mixed content with selector and bare declarations, then both are
  collected under their respective keys
- Given `parseStyleBlock("")`, then returns empty `StyleMap`
- Given a line with trailing `;`, then the value is stored without the `;`
- All existing `resolveSkinparam` and `parseStyleBlock` tests pass (regression)

## Quality Bar

`npm test && npm run typecheck && npm run lint && npm run build`. Coverage ≥ 90/90/90.

Note: `npm run typecheck` may fail if `src/index.ts` references the old
`parseStyleBlock` return type. That is a known cross-task dependency resolved
in T4. If typecheck fails only on `src/index.ts`, note it and commit anyway —
T4 will fix it.

Commit message:
```
feat(style): hierarchical <style> block parser with selector paths

Replace flat parseStyleBlock with StyleMap-returning version that tracks
selector nesting up to 2 levels. Selector paths are dot-separated and
lowercased ("actor", "actor.business"). Bare top-level declarations use
empty-string key.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```
