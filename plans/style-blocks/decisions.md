# Architecture Decisions

## D1: Element-type styles flattened into Theme (no plugin interface change)

Scoped `<style>` block entries are resolved to `Theme` properties inside
`buildTheme`. Renderers receive `Theme` as before — they are unaware of style
blocks. This is consistent with how `skinparam` directives are handled and
requires no changes to `SyncPlugin`/`AsyncPlugin` or `dispatcher.ts`.

Options considered: pass `StyleMap` as third arg to `render()` (rejected —
touches every plugin); wrap in `RenderContext` (rejected — larger refactor with
no current benefit).

## D2: `StyleMap` type

```typescript
export type StyleMap = Map<string, Map<string, string>>;
// outer key: dot-separated lowercase selector path ("actor", "actor.business")
// inner key: lowercased property name ("backgroundcolor")
// inner value: trimmed value string
```

`parseStyleBlock` return type changes from `Map<string,string>` to `StyleMap`.
`buildTheme` in `src/index.ts` is the only caller; it is updated in T4.

## D3: Business element representation — new `UCNodeKind` values

`'business-actor'` and `'business-usecase'` added to the `UCNodeKind` union.
Rejected: `isBusiness: boolean` field — new kind values keep the renderer's
`switch` exhaustive and compiler-checkable.

## D4: New `colors.graph` Theme properties

Four new properties added to `Theme.colors.graph`:

| Property | Default | Populated from |
|---|---|---|
| `actorFill` | `'none'` | `actor { BackGroundColor }` |
| `usecaseFill` | *(colors.background)* | `usecase { BackGroundColor }` |
| `businessActorFill` | `'none'` | `actor.business { BackGroundColor }` |
| `businessUsecaseFill` | *(colors.background)* | `usecase.business { BackGroundColor }` |

Defaults preserve current rendering behavior (actor head transparent,
usecase ellipse uses background color).

## D5: Business element visuals

Per upstream `USymbolActorBusiness` and `USymbolUsecase(isBusiness=true)`:
- **Business actor**: head circle uses `businessActorFill`; diagonal line
  drawn through the torso. Exact coordinates read from Java before implementing.
- **Business usecase**: ellipse fill uses `businessUsecaseFill`; diagonal
  line drawn across the ellipse interior. Exact coordinates read from Java.
