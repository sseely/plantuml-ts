# T17 — Demo App Updates

> **Java source is the spec.** Before writing any code, read the relevant Java
> source in `~/git/plantuml`. The upstream code is 15+ years old and encodes
> accumulated knowledge as special cases and subtle tweaks that exist nowhere
> else. The Java code IS the requirement — not a reference. Reproduce every
> edge case faithfully.

## Context

The demo app (`demo/`) currently has a single "Sequence" nav button that loads
`demo/examples/sequence/canonical.puml`. Phase 2 adds four diagram types, each
needing a nav button and a canonical `.puml` example file.

Stack: TypeScript, Vite, browser. The app uses `import.meta.glob` for .puml
files and the `render()` async API.

## Task

Add nav buttons for Class, Component, State, and Use Case to `demo/index.html`.
Update `demo/app.ts` to load the new examples. Create four canonical `.puml`
files.

## Write-Set

- `demo/index.html` — add 4 nav `<button data-type="...">` elements
- `demo/app.ts` — already handles any `data-type` via glob loader; verify
  the new types resolve and re-render correctly
- `demo/examples/class/canonical.puml`
- `demo/examples/component/canonical.puml`
- `demo/examples/state/canonical.puml`
- `demo/examples/usecase/canonical.puml`

## Read-Set

- `demo/index.html` — full file (existing nav button pattern)
- `demo/app.ts` — full file (glob loader pattern)
- `demo/examples/sequence/canonical.puml` — pattern for a rich example

## Canonical File Requirements

Each canonical file should demonstrate the diagram type's key features in a
visually interesting way (not just a two-node minimum). Examples:

**class/canonical.puml** — 4-5 classes with inheritance, an interface,
attributes, and methods.

**component/canonical.puml** — 3-4 components across 2 packages with
labelled dependencies.

**state/canonical.puml** — initial state, 3-4 normal states, a composite
state, transitions with guards, final state.

**usecase/canonical.puml** — 2 actors, 4-5 use cases in a system rectangle,
<<include>> and <<extend>> relationships.

## Acceptance Criteria

- Given the "Class" nav button is clicked in the demo app, then
  `demo/examples/class/canonical.puml` loads and `render()` produces a valid
  SVG in the preview panel without an error SVG
- Given the "Component" nav button is clicked, then component diagram renders
- Given the "State" nav button is clicked, then state diagram renders
- Given the "Use Case" nav button is clicked, then use case diagram renders
- Given `pnpm dev` is running, then all four nav buttons are visible without
  scrolling in the nav panel

## Quality Bar

`pnpm typecheck && pnpm lint` — zero errors. Visual verification via
`pnpm dev` (human check that each button loads and renders its diagram).
