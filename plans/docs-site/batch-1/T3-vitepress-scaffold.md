# T3 — VitePress scaffold + guide pages

## Context
plantuml-ts (Vite lib build; npm). Model: `~/git/graphviz-ts/docs-site`
(VitePress; read its `.vitepress/config.ts`, `index.md`, `guide/`
whole). GH Pages project site → base `/plantuml-ts/`.

## Task
1. `npm i -D vitepress` (pin like graphviz-ts does).
2. `docs-site/.vitepress/config.ts`: title/description, base
   `/plantuml-ts/`, local MiniSearch (`search: {provider: 'local'}`),
   nav + sidebar covering: Guide (getting-started, api), Playground,
   Parity, Divergences. Port the graphviz-ts config shape; adjust
   naming.
3. `docs-site/index.md`: hero (name, tagline: PlantUML in pure
   TypeScript — no Java, no server; browser-native), features (faithful
   to upstream incl. 680/680 class DOT parity; pure SVG renderer;
   preprocessor with documented scope), actions → guide + playground.
4. `docs-site/guide/getting-started.md`: install, `renderSync` minimal
   example, browser + Node usage (read src/index.ts exports + README
   for accuracy — do NOT invent API).
5. `docs-site/guide/api.md`: public API surface from src/index.ts
   (renderSync, measurer seam, include-resolver seam, theme/skinparam
   notes). Accuracy over completeness — document what exists.
6. Stub `docs-site/parity.md` + `docs-site/divergences.md` ("generated
   at build time — see copy-reports") so nav links resolve pre-T4.
7. package.json: `docs:dev`, `docs:build`, `docs:preview` scripts
   (copy-reports wiring comes in T4 — leave the hook point).
8. .gitignore: `docs-site/.vitepress/dist`, `docs-site/.vitepress/cache`.

## Write-set
- docs-site/.vitepress/config.ts, docs-site/index.md,
  docs-site/guide/getting-started.md, docs-site/guide/api.md,
  docs-site/parity.md + divergences.md (stubs), package.json, .gitignore

## Read-set
- ~/git/graphviz-ts/docs-site/.vitepress/config.ts, index.md, guide/
- src/index.ts (public exports), README.md
- plans/docs-site/decisions.md

## Acceptance criteria
- Given `npm run docs:build`, when run, then it exits 0 and
  `.vitepress/dist` contains the site.
- Given the config, then local search is enabled and every nav/sidebar
  link resolves (stubs count).
- Given `npm test && npm run typecheck && npm run lint && npm run
  build`, then all pass (lib untouched; package.json valid).

## Observability
N/A (deploy detection is T6's workflow).

## Rollback
Reversible.

## Commit
`feat(docs): VitePress scaffold, guide pages, local search`
