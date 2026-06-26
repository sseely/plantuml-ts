# T1 — Shared descriptive-keyword table

## Context

plantuml-ts is a faithful TypeScript port of PlantUML (pure SVG renderer, no
DOM/async). Upstream's descriptive diagram engine keys every element off
`CommandCreateElementFull.ALL_TYPES`. This task creates the single source of
truth for that keyword set, the `USymbol` shape enum, and the dispatch-guard
helper — consumed by Phase 1 (class/sequence guards) and Phase 2 (the engine).

Test framework: vitest. Conventions: camelCase functions, UPPER_SNAKE for
module constants, PascalCase types. Do not introduce magic strings.

## Task

Create `src/core/descriptive-keywords.ts` exporting:

- `USymbol` — string union of every shape in upstream `ALL_TYPES`:
  `person artifact actor folder card file package rectangle hexagon label node
  frame cloud action process database queue stack storage agent usecase
  component boundary control entity interface circle collections port`.
  (Map upstream `actor/` and `usecase/` business variants to `'actor-business'`
  and `'usecase-business'`.)
- `ALL_TYPES: readonly string[]` — the keyword list (lowercase).
- `KEYWORD_TO_SYMBOL: ReadonlyMap<string, USymbol>` — keyword → `USymbol`.
- `DESCRIPTIVE_ONLY_KEYWORDS: ReadonlySet<string>` — `ALL_TYPES` minus
  `interface`, `package`, `actor` (per D3).
- `hasDescriptiveSignal(lines: readonly string[]): boolean` — true if any of the
  first 20 lines, trimmed, starts with a `DESCRIPTIVE_ONLY_KEYWORDS` keyword
  (word-boundary, case-insensitive) **or** matches the element shorthands
  `/^\[.+\]/` (component bracket) or `/^\(.+\)/`···`/^\(\)/` (interface/usecase
  paren). Reuse the same 20-line slice convention as existing `accepts()`.

Derive the keyword regexes from `ALL_TYPES` — do not hand-duplicate the list.

## Read-set

- `~/git/plantuml/src/main/java/net/sourceforge/plantuml/descdiagram/command/CommandCreateElementFull.java`
  — `ALL_TYPES` (authoritative list + business-variant handling).
- `src/diagrams/component/index.ts`, `src/diagrams/usecase/index.ts` — existing
  shorthand patterns (`/^\[.+\]/`, `/^\(\)/`, `/^\(\w/`) to mirror.
- `decisions.md#d2`, `decisions.md#d3`.

## Architecture decisions

D2 (full `ALL_TYPES`), D3 (exclusions `interface`/`package`/`actor`; shorthands
count as signals). Locked.

## Interface contract (consumed by T2, T3, T4)

```ts
export type USymbol = 'component' | 'interface' | 'node' | 'package' | 'folder'
  | 'frame' | 'cloud' | 'database' | 'storage' | 'actor' | 'actor-business'
  | 'usecase' | 'usecase-business' | 'rectangle' | 'artifact' | 'card' | 'file'
  | 'queue' | 'stack' | 'agent' | 'boundary' | 'control' | 'entity' | 'person'
  | 'hexagon' | 'label' | 'circle' | 'collections' | 'port' | 'action' | 'process';
export const ALL_TYPES: readonly string[];
export const KEYWORD_TO_SYMBOL: ReadonlyMap<string, USymbol>;
export const DESCRIPTIVE_ONLY_KEYWORDS: ReadonlySet<string>;
export function hasDescriptiveSignal(lines: readonly string[]): boolean;
```

## Acceptance criteria

- Given `node`/`cloud`/`usecase`/`rectangle`, when looked up, then each is in
  `KEYWORD_TO_SYMBOL` and in `DESCRIPTIVE_ONLY_KEYWORDS`.
- Given `interface`/`package`/`actor`, when looked up, then each is in
  `KEYWORD_TO_SYMBOL` but **not** in `DESCRIPTIVE_ONLY_KEYWORDS`.
- Given `['actor Bob', '(Login)']`, when `hasDescriptiveSignal`, then `true`.
- Given `['[Comp]']`, when `hasDescriptiveSignal`, then `true`.
- Given `['class Foo', 'Foo : x']`, when `hasDescriptiveSignal`, then `false`.

## Observability

N/A — no new observable operations (pure module).

## Rollback

Reversible — delete the new file; no consumers until T2.

## Quality bar

`pnpm typecheck && pnpm lint && pnpm test` green. One commit:
`feat(T1): add shared descriptive-keyword table for dispatch + engine`.
