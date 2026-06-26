# T15 — Use Case Diagram Renderer + Plugin Wiring

> **Java source is the spec.** Before writing any code, read the relevant Java
> source in `~/git/plantuml`. The upstream code is 15+ years old and encodes
> accumulated knowledge as special cases and subtle tweaks that exist nowhere
> else. The Java code IS the requirement — not a reference. Reproduce every
> edge case faithfully.

## Context

Consumes `UseCaseGeometry` (T11) and produces an SVG string. Wires as an
`AsyncPlugin`. Actors render as stick figures; use cases render as ellipses.

Stack: TypeScript 5 strict, Vitest, ESM. No DOM.

## Task

Create `src/diagrams/usecase/renderer.ts` and `src/diagrams/usecase/index.ts`.
Write unit tests.

## Write-Set

- `src/diagrams/usecase/renderer.ts`
- `src/diagrams/usecase/index.ts`
- `tests/unit/usecase/renderer.test.ts`

## Read-Set

- `src/diagrams/usecase/ast.ts` — full file
- `src/diagrams/usecase/layout.ts` — UseCaseGeometry types
- `src/core/svg.ts` — all primitives including ellipse
- `src/core/theme.ts` — Theme interface (colors.graph.actorStroke)
- `src/diagrams/sequence/renderer.ts` — pattern
- `src/diagrams/sequence/index.ts` — plugin wiring pattern
- `decisions.md#D1`

## Rendering Rules

**Actor:** stick figure — head circle + vertical body line + two arm lines +
two leg lines. Label below. Stroke: `theme.colors.graph.actorStroke`.

**Use case:** horizontal ellipse using `ellipse()`. Display name centred inside.

**Container nodes** (rectangle, package, etc.): dashed-border rect with label
in top-left corner.

**Edges:**
- Solid lines: `style="solid"` links
- Dashed lines: `style="dashed"` links (<<include>>, <<extend>>)
- Stereotype label rendered midpoint in `«»` brackets if present
- Open arrowhead at target end for directed links

## Acceptance Criteria

- Given an actor node geo, when rendered, then SVG contains a `<circle>`
  (head) and at least 3 `<line>` elements (body, arms, legs)
- Given a use case node geo, when rendered, then SVG contains an `<ellipse>`
- Given an edge with stereotype="include", when rendered, then SVG contains
  the text `«include»`
- Given a dashed link geo, when rendered, then the line element has
  `stroke-dasharray` attribute set
- Given usecasePlugin registered, when `render()` called with
  `"@startuml\nactor User\n(Login)\nUser --> (Login)\n@enduml"`, then
  result starts with `"<svg"`

## Quality Bar

`pnpm typecheck && pnpm lint && pnpm test` — zero errors, ≥ 90% coverage.
