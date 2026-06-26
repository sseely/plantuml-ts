# T5 — Usecase renderer: business element visuals + fill colors

> **Java source is the spec.** Before writing any code, read the relevant Java
> source in `~/git/plantuml`. The upstream code is 15+ years old and encodes
> accumulated knowledge as special cases and subtle tweaks that exist nowhere
> else. The Java code IS the requirement — not a reference. Reproduce every
> edge case faithfully.
>
> **Read these files before writing a single line of rendering code:**
> - `~/git/plantuml/src/main/java/net/sourceforge/plantuml/decoration/symbol/USymbolActorBusiness.java`
>   — exact dimensions and draw calls for business actor
> - `~/git/plantuml/src/main/java/net/sourceforge/plantuml/decoration/symbol/USymbolUsecase.java`
>   — `isBusiness` branch: exact line coordinates for the diagonal

## Context

plantuml-js is a TypeScript port of PlantUML (GPL-3.0). Stack: TypeScript +
Vite, Vitest tests (90/90/90 coverage). ESLint. Working directory:
`/Users/scottseely/git/plantuml-js`. Branch: `feat/style-blocks`.

Batch 1 is complete:
- `UCNodeKind` has `'business-actor'` and `'business-usecase'` (T3)
- `Theme.colors.graph` has `actorFill`, `usecaseFill`, `businessActorFill`,
  `businessUsecaseFill` (T2)

Read `src/diagrams/usecase/renderer.ts` and `tests/unit/usecase/renderer.test.ts`
fully before editing.

## Task

### Part A — Use fill colors for actor head and usecase ellipse

Update `renderActor`: change the head `<circle>` from `fill="none"` to
`fill="${theme.colors.graph.actorFill}"`.

Update `renderUseCaseNode`: change the ellipse fill from `theme.colors.background`
to `theme.colors.graph.usecaseFill`.

### Part B — Add `renderBusinessActor`

```typescript
function renderBusinessActor(node: UCNodeGeo, theme: Theme): string
```

Read `USymbolActorBusiness.java` for the exact draw calls. The business actor
is a stickman with a diagonal line crossing through the torso area. Extract the
line coordinates from the Java. The head fill uses
`theme.colors.graph.businessActorFill`.

### Part C — Add `renderBusinessUseCaseNode`

```typescript
function renderBusinessUseCaseNode(node: UCNodeGeo, theme: Theme): string
```

Read `USymbolUsecase.java` (`isBusiness = true` branch) for the exact `drawLine`
call. The business use case is an ellipse with a diagonal line across its
interior. The ellipse fill uses `theme.colors.graph.businessUsecaseFill`.

### Part D — Update `renderNode` dispatch

```typescript
function renderNode(node: UCNodeGeo, theme: Theme): string {
  if (node.kind === 'actor') return renderActor(node, theme);
  if (node.kind === 'business-actor') return renderBusinessActor(node, theme);
  if (node.kind === 'usecase') return renderUseCaseNode(node, theme);
  if (node.kind === 'business-usecase') return renderBusinessUseCaseNode(node, theme);
  if (isContainerKind(node.kind)) return renderContainer(node, theme);
  // fallback
  ...
}
```

## Write-Set

- `src/diagrams/usecase/renderer.ts`
- `tests/unit/usecase/renderer.test.ts`

## Read-Set

- `src/diagrams/usecase/renderer.ts` — read fully
- `tests/unit/usecase/renderer.test.ts` — read fully
- `src/diagrams/usecase/ast.ts` — for `UCNodeGeo` type

## Acceptance Criteria

- Given `kind = 'business-actor'` node with `businessActorFill = '#FF0000'`,
  then SVG head circle has `fill="#FF0000"`
- Given `kind = 'business-actor'` node, then SVG contains a diagonal line
  element through the torso (coordinates match upstream Java)
- Given `kind = 'business-usecase'` node with `businessUsecaseFill = '#FFA500'`,
  then SVG ellipse has `fill="#FFA500"`
- Given `kind = 'business-usecase'` node, then SVG contains a diagonal line
  across the ellipse interior
- Given `kind = 'actor'` with `actorFill = '#0000FF'`, then head circle
  has `fill="#0000FF"` (not `fill="none"`)
- Given `kind = 'actor'` with default theme (`actorFill = 'none'`), then
  head circle has `fill="none"` (backward compatible)
- Given `kind = 'usecase'` with default theme, then ellipse fill equals
  `theme.colors.graph.usecaseFill` (backward compatible)
- All existing usecase renderer tests pass (regression)

## Quality Bar

`npm test && npm run typecheck && npm run lint && npm run build`. Coverage ≥ 90/90/90.

Commit message:
```
feat(usecase): render business actor/usecase with diagonal + fill colors

Add renderBusinessActor and renderBusinessUseCaseNode using coordinates
from USymbolActorBusiness.java and USymbolUsecase.java. Actor head and
usecase ellipse now use theme fill properties instead of hardcoded values.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```
