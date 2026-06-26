# Batch 3 — Renderer, Plugin Wiring, Registration, Tests, Visual Page

## Description

Render `DotGeometry` to SVG, wire the `SyncPlugin`, register the plugin in
`src/index.ts`, write renderer tests, add both corpus fixtures as integration
test cases, create the visual demo page, and document the D7 divergence in
`DIVERGENCES.md`.

Depends on Batch 2 (T2) for `DotGeometry`.

## Tasks

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T3 | Renderer + plugin + registration + tests + visual page | typescript-pro | `src/diagrams/dot/renderer.ts`, `src/diagrams/dot/index.ts`, `src/index.ts`, `tests/unit/dot/renderer.test.ts`, `tests/visual/dot.html`, `DIVERGENCES.md` | T2 | [x] |

## Notes

- T3 is the only task — no parallelism needed.
- After T3 completes, run all four quality gates. All must pass before done.
