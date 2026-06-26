# T18 — Playwright E2E Tests for Graph Diagrams

> **Java source is the spec.** Before writing any code, read the relevant Java
> source in `~/git/plantuml`. The upstream code is 15+ years old and encodes
> accumulated knowledge as special cases and subtle tweaks that exist nowhere
> else. The Java code IS the requirement — not a reference. Reproduce every
> edge case faithfully.

## Context

Phase 1 established Playwright e2e tests in `tests/e2e/`. Phase 2 needs
visual regression guards for the four new diagram types: text overflow,
correct SVG rendering, theme switching, and nav button wiring.

The demo app (port 5173) must be running. The `webServer` config in
`playwright.config.ts` starts it automatically.

Stack: TypeScript, `@playwright/test`, Chromium.

## Task

Create `tests/e2e/graph-diagrams.spec.ts` with tests for all four new
diagram types.

## Write-Set

- `tests/e2e/graph-diagrams.spec.ts`

## Read-Set

- `tests/e2e/text-overflow.spec.ts` — fillAndWait pattern and overflow check
- `tests/e2e/rendering.spec.ts` — theme, height, error state patterns
- `playwright.config.ts` — full file
- `demo/index.html` — button `data-type` attribute values

## Test Cases

### Text overflow guard (regression for all 4 types)
For each diagram type, load a diagram with moderately long labels. Assert no
`<text>` element's right edge exceeds the SVG viewport's right edge.

### Nav button wiring (4 tests)
Click each new nav button. Assert the preview SVG becomes visible within
5 seconds and does not contain "PlantUML error".

### Theme switching with graph diagram
Load a class diagram. Switch to dark theme via the `#theme` select. Assert
the preview innerHTML contains the dark background color.

### Error state
Fill the editor with `"@startuml\nclass\n@enduml"` (malformed — no class
name). Assert preview shows a valid SVG (either rendered or error SVG — no
blank/crash).

### SVG contains expected shapes
- Class diagram loaded → SVG contains at least one `<rect>` (class box)
- State diagram loaded → SVG contains a `<circle>` (initial pseudostate)
- Use case diagram loaded → SVG contains an `<ellipse>` (use case oval)

## Acceptance Criteria

- Given class diagram loaded in demo, then no `<text>` element overflows
  the SVG viewport width (right-edge check, 1px tolerance)
- Given each of the 4 nav buttons clicked, then `#preview svg` is visible
  within 5 seconds
- Given dark theme selected with class diagram active, then
  `#preview` innerHTML contains `#1E1E1E`
- Given state diagram loaded, then `#preview svg` contains a `<circle>`
  element
- Given use case diagram loaded, then `#preview svg` contains an `<ellipse>`
  element

## Quality Bar

`pnpm test:e2e` — all tests pass including existing Phase 1 e2e tests.
