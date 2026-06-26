# T4 — Wire `StyleMap` into `buildTheme` for element-scoped colors

> **Java source is the spec.** Before writing any code, read the relevant Java
> source in `~/git/plantuml`. The upstream code is 15+ years old and encodes
> accumulated knowledge as special cases and subtle tweaks that exist nowhere
> else. The Java code IS the requirement — not a reference. Reproduce every
> edge case faithfully.
>
> Read before implementing:
> - `~/git/plantuml/src/main/java/net/sourceforge/plantuml/style/StyleSignature.java`
>   (how selector paths resolve to element types — confirms our "actor.business" path)

## Context

plantuml-js is a TypeScript port of PlantUML (GPL-3.0). Stack: TypeScript +
Vite, Vitest tests (90/90/90 coverage). ESLint. Working directory:
`/Users/scottseely/git/plantuml-js`. Branch: `feat/style-blocks`.

Batch 1 is complete:
- `parseStyleBlock` now returns `StyleMap` (T1)
- `Theme.colors.graph` has `actorFill`, `usecaseFill`, `businessActorFill`,
  `businessUsecaseFill` (T2)

Read `src/index.ts` and `tests/integration/index.test.ts` fully before editing.

## Task

Update `buildTheme` in `src/index.ts` to consume `StyleMap` entries and
populate the new Theme fill properties.

### Selector → Theme property mapping

After the existing `resolveSkinparam` and flat-style passes, add a third pass
that reads element-scoped entries from the merged `StyleMap`:

| StyleMap key | Property | Theme field |
|---|---|---|
| `"actor"` | `backgroundcolor` | `colors.graph.actorFill` |
| `"actor.business"` | `backgroundcolor` | `colors.graph.businessActorFill` |
| `"usecase"` | `backgroundcolor` | `colors.graph.usecaseFill` |
| `"usecase.business"` | `backgroundcolor` | `colors.graph.businessUsecaseFill` |
| `"class"` | `backgroundcolor` | `colors.graph.classBackground` |
| `"interface"` | `backgroundcolor` | `colors.graph.interfaceBackground` |
| `"enum"` | `backgroundcolor` | `colors.graph.enumBackground` |
| `"package"` | `backgroundcolor` | `colors.graph.packageBackground` |
| `"package"` | `bordercolor` | `colors.graph.packageBorder` |

Top-level bare declarations (key `""`) continue to flow through
`resolveSkinparam` unchanged (they already do in the existing flat pass).

### Updated `buildTheme`

Extract a helper (module-private):

```typescript
function applyStyleMap(styleMap: StyleMap, base: Theme): Theme {
  // build a Partial<Theme> from the selector → Theme field table above
  // call deepMergeTheme(base, partial) and return result
}
```

Call it after the existing `withStyles` step:

```typescript
const withStyleMap = applyStyleMap(mergedStyleMap, withStyles);
// then apply caller Partial<Theme> on top as before
```

Where `mergedStyleMap` is the merged `StyleMap` produced from
`preprocessed.styles.map(parseStyleBlock)` (after T1 the return type is now
`StyleMap`, so the reduce needs updating too).

### Update the reduce

Old (flat):
```typescript
const styleMap = preprocessed.styles
  .map(parseStyleBlock)
  .reduce<Map<string, string>>((acc, m) => { m.forEach((v, k) => acc.set(k, v)); return acc; }, new Map());
const withStyles = resolveSkinparam(styleMap, withSkinparam).theme;
```

New (hierarchical):
```typescript
const styleMap = preprocessed.styles
  .map(parseStyleBlock)
  .reduce<StyleMap>((acc, m) => {
    m.forEach((props, selector) => {
      const existing = acc.get(selector) ?? new Map<string, string>();
      props.forEach((v, k) => existing.set(k, v));
      acc.set(selector, existing);
    });
    return acc;
  }, new Map());
// flat top-level entries ("" key) → resolveSkinparam (existing behavior)
const flatRoot = styleMap.get('') ?? new Map<string, string>();
const withStyles = resolveSkinparam(flatRoot, withSkinparam).theme;
// element-scoped entries → applyStyleMap
const withStyleMap = applyStyleMap(styleMap, withStyles);
```

## Write-Set

- `src/index.ts`
- `tests/integration/index.test.ts`

## Read-Set

- `src/index.ts` — read fully before editing
- `src/core/skinparam.ts` — for `StyleMap` type import
- `src/core/theme.ts` — for new `colors.graph` properties
- `tests/integration/index.test.ts` — read fully before editing

## Acceptance Criteria

- Given `<style>\nactor { BackGroundColor blue; }\n</style>` in source,
  when `render()` called with a use case diagram, then SVG contains `blue`
- Given `<style>\nusecase { BackGroundColor lightBlue; }\n</style>`,
  then SVG contains `lightBlue`
- Given `<style>\nactor { business { BackGroundColor red; } }\n</style>`,
  then SVG contains `red` (requires a business-actor node in the diagram)
- Given `<style>\nclass { BackGroundColor #AABBCC; }\n</style>` with a
  class diagram, then SVG contains `#AABBCC`
- Given source with no `<style>`, then output unchanged (regression)
- All existing integration tests pass (regression)

## Quality Bar

`npm test && npm run typecheck && npm run lint && npm run build`. Coverage ≥ 90/90/90.

Commit message:
```
feat(render): wire StyleMap into buildTheme for element-scoped colors

Read selector-keyed StyleMap entries and map them to Theme properties
(actorFill, usecaseFill, classBackground, etc.). Top-level bare declarations
continue through the existing resolveSkinparam path.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```
