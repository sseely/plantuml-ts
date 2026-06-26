# T6 — Symbol-dispatched renderer

## Context

`component/renderer.ts` (298 LOC) draws boxes/packages/lollipops; `usecase/renderer.ts`
(459 LOC) draws ellipses/stick-actors/rectangles. Upstream renders each element by
its `USymbol`. Unify into one renderer that switches on `symbol`; the two source
renderers become symbol branches.

## Task

Create `src/diagrams/description/renderer.ts` exporting
`renderDescription(geo: DescriptionGeometry, theme: Theme): string`. Switch on
`symbol`:
- `component` → box with two side-tabs; `interface` → lollipop/circle
- `node` → 3D box; `database` → cylinder; `cloud` → cloud path
- `folder`/`frame`/`package` → tabbed/labelled container (dashed where upstream
  is — preserve `DASHED_CONTAINER_KINDS` behavior)
- `usecase`/`usecase-business` → ellipse; `actor`/`actor-business` → stick figure
- `rectangle` → rectangle; `artifact`/`card`/`file`/`queue`/`stack`/etc. → their
  existing shapes if drawn by a source renderer
- **not-yet-drawn symbols** (person, hexagon, label, circle, collections, port,
  action, process, archimate) → **rect fallback** with the node label, plus a
  `// TODO: upstream USymbol<X>` comment (D2). Must not throw.

Render links with style/arrowhead and, when `stereotype` is set, the
`«include»`/`«extend»` label (dashed for include/extend per upstream).

Reuse SVG helpers in `src/core/svg.ts`. Keep the unified `CONTAINER_KINDS` in
sync with layout (note in `.claude/CLAUDE.md`: `CONTAINER_KINDS` appears in both
layout and renderer — keep identical).

## Read-set

- `src/diagrams/component/renderer.ts`, `src/diagrams/usecase/renderer.ts`
  (merge source — every shape branch).
- `src/core/svg.ts` (rect/ellipse/path/polygon/text helpers).
- `src/diagrams/description/layout.ts` (T5 — `DescriptionGeometry`).
- `tests/unit/component/renderer.test.ts`, `tests/unit/usecase/renderer.test.ts`
  (assertions to migrate).
- Upstream `~/git/plantuml/.../svek/image/` USymbol images for shape reference.

## Architecture decisions

D2 (rect fallback for undrawn symbols, no silent drop, no throw). Locked.

## Interface contract (consumed by T7)

```ts
export function renderDescription(geo: DescriptionGeometry, theme: Theme): string;
```

## Acceptance criteria

- Given each implemented symbol, when rendered, then its expected shape primitive
  appears in the SVG (e.g. ellipse for `usecase`, cylinder path for `database`).
- Given a `hexagon` (undrawn) node, when rendered, then a rect with the label and
  no throw.
- Given an `<<include>>` link, when rendered, then a dashed connector with an
  `«include»` label.
- Given a migrated component/usecase golden case, when rendered, then output
  matches the migrated expectation.

## Observability

N/A — renderer. The migrated render assertions + oracle gate (Batch 7/8) are the
faithfulness detectors.

## Rollback

Reversible — delete the file; old renderers live until Batch 8.

## Quality bar

`pnpm typecheck && pnpm lint && pnpm test` green; 90/90/90. One commit:
`feat(T6): add symbol-dispatched descriptive renderer`.
