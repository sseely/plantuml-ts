# T13 — Component Diagram Renderer + Plugin Wiring

> **Java source is the spec.** Before writing any code, read the relevant Java
> source in `~/git/plantuml`. The upstream code is 15+ years old and encodes
> accumulated knowledge as special cases and subtle tweaks that exist nowhere
> else. The Java code IS the requirement — not a reference. Reproduce every
> edge case faithfully.

## Context

Consumes `ComponentGeometry` (T9) and produces an SVG string. Wires as an
`AsyncPlugin`. Uses SVG primitives from T3 and theme graph colors.

Stack: TypeScript 5 strict, Vitest, ESM. No DOM.

## Task

Create `src/diagrams/component/renderer.ts` and `src/diagrams/component/index.ts`.
Write unit tests.

## Write-Set

- `src/diagrams/component/renderer.ts`
- `src/diagrams/component/index.ts`
- `tests/unit/component/renderer.test.ts`

## Read-Set

- `src/diagrams/component/ast.ts` — full file
- `src/diagrams/component/layout.ts` — ComponentGeometry types
- `src/core/svg.ts` — all primitives
- `src/core/theme.ts` — Theme interface
- `src/diagrams/sequence/renderer.ts` — pattern
- `src/diagrams/sequence/index.ts` — plugin wiring pattern
- `decisions.md#D1`

## Rendering Rules

**Component node:** rect with a small component icon (two small rectangles
protruding from the left side) or simple labelled rect. Display name centred.
Stereotype below name if present.

**Interface node:** circle (using `ellipse()` with equal rx/ry). Label below.

**Container nodes** (package, folder, frame, cloud, database, storage):
dashed-border rect with label in top-left corner. Children rendered inside.

**Edges:** polyline through ELK route points. Dashed lines for `..>` links.
Open arrowhead at target for `-->`. Label midpoint if present.

## Acceptance Criteria

- Given a component node geo, when rendered, then SVG contains the
  component's display name in a `<text>` element
- Given an interface node geo, when rendered, then SVG contains a
  `<circle>` or `<ellipse>` element
- Given a package container, when rendered, then SVG contains a dashed-border
  `<rect>` enclosing the children's positions
- Given componentPlugin registered, when `render()` called with
  `"@startuml\n[Foo]\n@enduml"`, then result starts with `"<svg"`

## Quality Bar

`pnpm typecheck && pnpm lint && pnpm test` — zero errors, ≥ 90% coverage.
