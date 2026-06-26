# T16 — Public API Update + Integration Tests

> **Java source is the spec.** Before writing any code, read the relevant Java
> source in `~/git/plantuml`. The upstream code is 15+ years old and encodes
> accumulated knowledge as special cases and subtle tweaks that exist nowhere
> else. The Java code IS the requirement — not a reference. Reproduce every
> edge case faithfully.

## Context

`src/index.ts` currently registers only the sequence plugin. Phase 2 adds
four new plugins that must be registered at module load. Integration tests
verify end-to-end rendering for all four new diagram types, including the
`renderSync()` error path for ELK-backed plugins.

Stack: TypeScript 5 strict, Vitest, ESM.

## Task

Update `src/index.ts` to import and register the four new plugins. Create
integration test files and fixture `.puml` files for each diagram type.

## Write-Set

- `src/index.ts` — add imports + registry.register() for all 4 plugins
- `tests/integration/class.test.ts`
- `tests/integration/component.test.ts`
- `tests/integration/state.test.ts`
- `tests/integration/usecase.test.ts`
- `tests/fixtures/class/basic.puml`
- `tests/fixtures/class/relationships.puml`
- `tests/fixtures/class/namespaces.puml`
- `tests/fixtures/component/basic.puml`
- `tests/fixtures/component/containers.puml`
- `tests/fixtures/state/basic.puml`
- `tests/fixtures/state/composite.puml`
- `tests/fixtures/usecase/basic.puml`
- `tests/fixtures/usecase/stereotypes.puml`

## Read-Set

- `src/index.ts` — full file (existing plugin registration pattern)
- `src/diagrams/class/index.ts` — classPlugin export
- `src/diagrams/component/index.ts` — componentPlugin export
- `src/diagrams/state/index.ts` — statePlugin export
- `src/diagrams/usecase/index.ts` — usecasePlugin export
- `tests/integration/sequence.test.ts` — pattern to follow
- `tests/helpers/render.ts` — testMeasurer, renderFixture helpers
- `tests/helpers/svg-assertions.ts` — custom matchers
- `decisions.md#D1`, `decisions.md#D2`

## Fixture File Requirements

Each `.puml` fixture must be a valid PlantUML diagram that exercises the
diagram type's key features. They should NOT use unsupported syntax and must
render to SVG without an error SVG being produced.

Example `tests/fixtures/class/basic.puml`:
```
@startuml
class Animal {
  +name: String
  +speak(): void
}
class Dog {
  +fetch(): void
}
Animal <|-- Dog
@enduml
```

## Acceptance Criteria

- Given all 4 plugins are registered in `src/index.ts`, when `render()` is
  called with each diagram type's source, then the result starts with `"<svg"`
  and does not contain `"PlantUML error"`
- Given `renderSync()` called with class diagram source, then result contains
  `"not supported"` and starts with `"<svg"` (no throw)
- Given `renderSync()` called with component, state, and use case source,
  then same error SVG behaviour applies
- Given each fixture file in all four fixture dirs, when rendered via
  `render()`, then SVG starts with `"<svg"` and contains no `"PlantUML error"`
- Given `renderAll()` with two class diagram `@startuml` blocks, then the
  result array has length 2 and both entries start with `"<svg"`
- Given the Phase 1 sequence integration tests, when run, then all still pass

## Quality Bar

`pnpm typecheck && pnpm lint && pnpm test` — zero errors, coverage thresholds
maintained, all prior sequence tests still green.
