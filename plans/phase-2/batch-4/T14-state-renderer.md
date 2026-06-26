# T14 — State Diagram Renderer + Plugin Wiring

> **Java source is the spec.** Before writing any code, read the relevant Java
> source in `~/git/plantuml`. The upstream code is 15+ years old and encodes
> accumulated knowledge as special cases and subtle tweaks that exist nowhere
> else. The Java code IS the requirement — not a reference. Reproduce every
> edge case faithfully.

## Context

Consumes `StateGeometry` (T10) and produces an SVG string. Wires as an
`AsyncPlugin`. Pseudostates require specific shapes: filled circle (initial),
bullseye (final), horizontal bar (fork/join), diamond (choice).

Stack: TypeScript 5 strict, Vitest, ESM. No DOM.

## Task

Create `src/diagrams/state/renderer.ts` and `src/diagrams/state/index.ts`.
Write unit tests.

## Write-Set

- `src/diagrams/state/renderer.ts`
- `src/diagrams/state/index.ts`
- `tests/unit/state/renderer.test.ts`

## Read-Set

- `src/diagrams/state/ast.ts` — full file
- `src/diagrams/state/layout.ts` — StateGeometry types
- `src/core/svg.ts` — all primitives including ellipse and diamond
- `src/core/theme.ts` — Theme interface
- `src/diagrams/sequence/renderer.ts` — pattern
- `src/diagrams/sequence/index.ts` — plugin wiring pattern
- `decisions.md#D1`

## Rendering Rules

**Normal state:** rounded rect (`rx="8"`). Display name centred.

**Initial pseudostate:** filled circle `<circle>` with
`fill=theme.colors.border`.

**Final pseudostate:** outer circle (stroke only) + inner filled circle
(bullseye pattern).

**Fork/Join:** thin filled horizontal rectangle spanning the node width.

**Choice/Junction:** `diamond()` primitive.

**Composite state:** outer rounded rect (dashed border) with children rendered
inside. Concurrent regions separated by internal horizontal dashed line.

**Transitions:** polyline through route points. Label at midpoint if present.
Arrowhead at target end.

## Acceptance Criteria

- Given initial pseudostate geo, when rendered, then SVG contains a filled
  `<circle>` with `fill` matching `theme.colors.border`
- Given final pseudostate geo, when rendered, then SVG contains two concentric
  circle elements (bullseye)
- Given a fork geo, when rendered, then SVG contains a thin wide filled rect
- Given statePlugin registered, when `render()` called with
  `"@startuml\n[*] --> A\nA --> [*]\n@enduml"`, then result starts with `"<svg"`

## Quality Bar

`pnpm typecheck && pnpm lint && pnpm test` — zero errors, ≥ 90% coverage.
