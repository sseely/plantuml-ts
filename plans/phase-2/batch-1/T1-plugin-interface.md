# T1 — Plugin Interface Split (SyncPlugin / AsyncPlugin)

> **Java source is the spec.** Before writing any code, read the relevant Java
> source in `~/git/plantuml`. The upstream code is 15+ years old and encodes
> accumulated knowledge as special cases and subtle tweaks that exist nowhere
> else. The Java code IS the requirement — not a reference. Reproduce every
> edge case faithfully.

## Context

plantuml-js is a TypeScript-strict browser SVG renderer for PlantUML.
Phase 1 ships sequence diagrams via a `DiagramPlugin<AST, Geo>` interface
with a synchronous `layoutSync()` method. Phase 2 adds ELK.js-backed diagram
types whose layout is inherently async. The interface must be extended without
breaking the Phase 1 sequence plugin.

Stack: TypeScript 5 strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`),
Vitest, pnpm. All files are ESM (`.js` extensions in imports).

## Task

Split `DiagramPlugin` into a `SyncPlugin | AsyncPlugin` union in
`src/core/dispatcher.ts`. Update `src/index.ts` to call `layout()` (async)
or `layoutSync()` (sync) based on which interface the resolved plugin
implements. Update the existing dispatcher unit tests.

## Write-Set

- `src/core/dispatcher.ts` — replace `DiagramPlugin` with the union; update
  registry to accept both
- `src/index.ts` — update `render()` to await `plugin.layout()` when
  `'layout' in plugin`; update `renderSync()` to return error SVG for
  AsyncPlugin
- `tests/unit/dispatcher.test.ts` — add tests for both plugin shapes

## Read-Set

- `src/core/dispatcher.ts` — full file (current interface + registry)
- `src/index.ts` — full file (current render pipeline)
- `tests/unit/dispatcher.test.ts` — full file (existing tests to extend)
- `decisions.md#D1` and `decisions.md#D2`

## Architecture Decisions

**D1:** Use `SyncPlugin | AsyncPlugin` union. Type-narrow with
`'layout' in plugin` at call sites. Do NOT add a dead `layoutSync` to
AsyncPlugin.

**D2:** `renderSync()` called with an AsyncPlugin-backed diagram returns an
error SVG: `"renderSync() is not supported for [type] diagrams — use render()"`
— never throws.

## Interface Contracts

```typescript
// dispatcher.ts — replace existing DiagramPlugin with:

export interface SyncPlugin<AST = unknown, Geo = unknown> {
  accepts(block: Block): boolean;
  parse(block: Block): AST;
  layoutSync(ast: AST, theme: Theme, measurer: StringMeasurer): Geo;
  render(geo: Geo, theme: Theme): string;
}

export interface AsyncPlugin<AST = unknown, Geo = unknown> {
  accepts(block: Block): boolean;
  parse(block: Block): AST;
  layout(ast: AST, theme: Theme, measurer: StringMeasurer): Promise<Geo>;
  render(geo: Geo, theme: Theme): string;
}

export type DiagramPlugin<AST = unknown, Geo = unknown> =
  | SyncPlugin<AST, Geo>
  | AsyncPlugin<AST, Geo>;
```

The sequence plugin already satisfies `SyncPlugin` — no changes needed there.

In `src/index.ts`, `renderSync()` type-narrows:
```typescript
if ('layout' in plugin) {
  // AsyncPlugin — return error SVG
  return errorSvg(`renderSync() is not supported for this diagram type — use render()`);
}
// SyncPlugin path
const geo = plugin.layoutSync(ast, theme, measurer);
```

`render()` (async):
```typescript
const geo = 'layout' in plugin
  ? await plugin.layout(ast, theme, measurer)
  : plugin.layoutSync(ast, theme, measurer);
```

## Acceptance Criteria

- Given a SyncPlugin is registered, when `renderSync()` is called, then
  `layoutSync()` is invoked and a valid SVG string is returned
- Given an AsyncPlugin is registered, when `render()` is called, then
  `layout()` is awaited and a valid SVG string is returned
- Given an AsyncPlugin is registered, when `renderSync()` is called, then
  an error SVG containing "not supported" is returned without throwing
- Given TypeScript strict mode, when the plugin union is defined, then
  `'layout' in plugin` narrows the type correctly with zero `any` casts
- Given the existing sequence diagram tests, when run after this change,
  then all still pass (non-regression)

## Quality Bar

`pnpm typecheck && pnpm lint && pnpm test` — zero errors, all existing tests
pass, new dispatcher tests cover both plugin shapes.
