# T3 — RenderFragment plugin contract + central svgRoot assembly

## Context

plantuml-ts. Today every plugin's `render(geo, theme)` returns a COMPLETE
`<svg>` document string; 13 of 14 engines build it via `svgRoot(width,
height, children, bgColor, extraDefs)` (`src/core/svg.ts:484-505`); only
`description` emits through klimt. Upstream's order is
`getTextBlock → addChrome → exporter`: the diagram produces a block, chrome
decorates, ONE exporter emits. This task re-mirrors that seam so batch 2+
can decorate centrally. **This is a pure refactor: zero output change.**

## Task

1. `src/core/dispatcher.ts`: change `SyncPlugin.render` / `AsyncPlugin.render`
   to return `RenderFragment`:
   ```ts
   export interface RenderFragment {
     body: string;            // inner SVG markup (svgRoot's children arg)
     width: number; height: number;
     background?: string;     // svgRoot bgColor arg
     extraDefs?: string;      // svgRoot extraDefs arg
   }
   ```
   The description plugin may instead return `{ completeSvg: string }`
   (a discriminated union member `AssembledSvg`) — klimt owns its document
   emission until T7 decides fragment mechanics (decisions.md D2). Model the
   union explicitly; do NOT force description through string surgery here.

2. For each svgRoot engine — class, state, sequence, activity, json, board,
   chart, chronology, files, packetdiag, dot, yaml (if it has its own
   renderer — check; yaml/hcl may route through json's), hcl — change the
   final `return svgRoot(w, h, children, …)` into
   `return { body: children, width: w, height: h, background, extraDefs }`.
   Where a renderer inlines its own `<svg>` (chart error path
   `src/diagrams/chart/renderer.ts:416`; any other inline emitters you find)
   convert identically. The error sentinel (`dispatcher.ts:64-70`) and
   `errorSvg` path keep producing complete documents — they bypass plugins.

3. `src/index.ts` (`renderSync` :177-209, `renderBlock` :258 area): after
   `plugin.render`, assemble via ONE central `svgRoot(fragment…)` call
   (import from core/svg.ts). Leave an obvious seam:
   `const fragment = plugin.render(geo, theme); /* chrome applies here (T7) */
   return assembleSvg(fragment)`.

4. Update tests that call `plugin.render(...)` directly (grep
   `\.render(` under tests/) to wrap with the new assembler or assert on
   fragments — mechanical, keep assertions equivalent.

## Read-set

- `src/core/dispatcher.ts:20-70`, `src/index.ts:100-260`, `src/core/svg.ts:484-505`
- Every engine's `renderer.ts` final-return site (renderer entry points:
  class renderer.ts:378, state :257, sequence :414, activity :638, json
  :342/:375, board :68, chart :519 + :416, chronology :74, files :70,
  packetdiag :109, dot :326, description :210-230 — description is the
  union's AssembledSvg branch, unchanged internally)
- `tests/helpers/render.ts`

## Interface contract (consumed by T7)

`RenderFragment` / `AssembledSvg` union as above, exported from
`src/core/dispatcher.ts`; `assembleSvg(fragment): string` in `src/index.ts`
(or `src/core/svg.ts` — pick where svgRoot lives and journal it).

## Acceptance criteria

- Given the full existing test suite (7,643 tests incl. SVG ratchets and
  golden emitter tests), when run after the refactor, then ALL pass with
  ZERO golden/expectation edits except tests that called `plugin.render`
  directly (list those files in the commit body).
- Given `renderSync` on any corpus fixture (spot-check one per engine),
  then output is byte-identical to main (`git stash`-free check: render
  before/after into scratch files and `diff`).
- Given the DOT gate, then EXACTLY 251/259, 81/87, 680/680, 78/80, 260/261.

## Quality bar

All four gates + DOT gate. This task has the widest file touch — run
`npm run typecheck` continuously; do not trust stale LSP diagnostics.

## Boundaries

- Never do: change any emitted SVG byte; touch layout files, svek-dot-emit,
  graph-layout; touch description's klimt internals.
- Ask first (journal + stop): if an engine's renderer proves impossible to
  convert without behavior change.

## Observability: N/A.
## Rollback: Reversible.
## Commit: `refactor(T3): plugins return RenderFragment; svgRoot assembled centrally`
