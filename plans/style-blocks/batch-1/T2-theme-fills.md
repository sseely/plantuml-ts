# T2 — Extend Theme with actor/usecase fill colors

> **Java source is the spec.** Before writing any code, read the relevant Java
> source in `~/git/plantuml`. The upstream code is 15+ years old and encodes
> accumulated knowledge as special cases and subtle tweaks that exist nowhere
> else. The Java code IS the requirement — not a reference. Reproduce every
> edge case faithfully.
>
> Read before implementing:
> - `~/git/plantuml/src/main/java/net/sourceforge/plantuml/style/SName.java`
>   (confirm `actor`, `usecase`, `business` selector names)
> - `~/git/plantuml/src/main/java/net/sourceforge/plantuml/decoration/symbol/USymbolUsecase.java`
>   (confirm default fill for usecase ellipse)
> - `~/git/plantuml/src/main/java/net/sourceforge/plantuml/decoration/symbol/USymbolActorBusiness.java`
>   (confirm default fill for business actor head)

## Context

plantuml-js is a TypeScript port of PlantUML (GPL-3.0). Stack: TypeScript +
Vite, Vitest tests (90/90/90 coverage). ESLint. Working directory:
`/Users/scottseely/git/plantuml-js`. Branch: `feat/style-blocks`.

Batch 1 runs in parallel — do not depend on T1 or T3 output.
Read `src/core/theme.ts` and `tests/unit/theme.test.ts` fully before editing.

## Task

Add four new properties to `Theme.colors.graph` for element-scoped fill colors.

### New properties

```typescript
// In the GraphColors interface (inside Theme.colors.graph):
actorFill: string;           // actor head fill
usecaseFill: string;         // usecase ellipse fill
businessActorFill: string;   // business-actor head fill
businessUsecaseFill: string; // business-usecase ellipse fill
```

### Default values

| Property | Default | Rationale |
|---|---|---|
| `actorFill` | `'none'` | Current renderer uses `fill="none"` on head circle |
| `usecaseFill` | *(see below)* | Current renderer uses `theme.colors.background` |
| `businessActorFill` | `'none'` | Same default as actorFill |
| `businessUsecaseFill` | *(see below)* | Same default as usecaseFill |

For `usecaseFill` and `businessUsecaseFill`: the default should match the
current behavior where the usecase ellipse fill is `theme.colors.background`.
You cannot store a reference to another property in the interface, so set the
default value in each concrete theme definition to the same value as
`colors.background` in that theme.

Verify the upstream Java defaults before setting values. If upstream defaults
differ from current behavior, add a comment noting the divergence (same pattern
as the `noteBackground` comment added in the skinparam mission).

### Update all theme definitions

Update `defaultTheme`, `darkTheme`, `sketchyTheme`, and `monochromeTheme` in
`src/core/theme.ts` to include all four new properties.

## Write-Set

- `src/core/theme.ts`
- `tests/unit/theme.test.ts`

## Read-Set

- `src/core/theme.ts` — read fully before editing
- `tests/unit/theme.test.ts` — read fully before editing

## Acceptance Criteria

- Given `defaultTheme`, then `actorFill = 'none'`, `businessActorFill = 'none'`
- Given `defaultTheme`, then `usecaseFill` equals `defaultTheme.colors.background`
- Given `deepMergeTheme(base, { colors: { graph: { actorFill: '#0000FF' } } })`,
  then result has `actorFill = '#0000FF'` and all other graph properties unchanged
- Given `darkTheme`, `sketchyTheme`, `monochromeTheme`, then all four new
  properties are present and non-undefined
- All existing `theme.test.ts` tests pass (regression)

## Quality Bar

`npm test && npm run typecheck && npm run lint && npm run build`. Coverage ≥ 90/90/90.

Commit message:
```
feat(theme): add actorFill/usecaseFill/business variant fill properties

Add four fill color properties to colors.graph for actor head circles and
usecase ellipses. Defaults preserve current rendering behavior (actor head
transparent, usecase uses background color).

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```
