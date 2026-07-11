# T5 — Live playground

## Context
Model: graphviz-ts's playground (find its theme component under
`~/git/graphviz-ts/docs-site/.vitepress/theme/` and `playground.md`;
read whole). Our library: `renderSync(source)` → SVG string, pure,
browser-safe (decisions.md#d2: import from `../src` via Vite alias in
docs-site/.vitepress/config.ts — VitePress compiles TS fine).

## Task
Port the playground pattern: a Vue component (editor textarea + live
SVG pane) registered in the VitePress theme, used by
`docs-site/playground.md`. Default sample: a small class diagram
(showcase the 100%-parity type). Errors from parseSync/renderSync
render INLINE in the output pane (never blank/console-only). Add the
`plantuml-ts` → `../src/index.ts` alias to config.ts (T5 owns config.ts
in this batch). Check how the library's default measurer behaves in the
browser (WidthTableMeasurer is deterministic and DOM-free — use the
public API exactly as a consumer would; if renderSync needs a measurer
argument, use the documented default).

## Write-set
- docs-site/.vitepress/theme/** (new), docs-site/playground.md,
  docs-site/.vitepress/config.ts (alias + theme registration)

## Read-set
- ~/git/graphviz-ts/docs-site/playground.md + theme component (whole)
- src/index.ts (public API), plans/docs-site/decisions.md#d2

## Acceptance criteria
- Given the playground page in `docs:dev`, when a valid .puml is
  typed, then the SVG updates live.
- Given invalid input, then a readable error renders inline.
- Given `npm run docs:build`, then it exits 0 (the lib compiles into
  the site bundle).

## Observability
Client-side only; inline error rendering IS the observability.

## Rollback
Reversible.

## Commit
`feat(docs): live in-browser playground`
