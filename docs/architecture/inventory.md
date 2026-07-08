# Repository Inventory

GitHub org: **`sseely`**. Analyzed the current project plus the two org
repositories it is directly coupled to (a runtime dependency and the
upstream reference it ports).

| Repo | Language | Runtime | Framework | Database | Key Deps | Entry | Notes |
|------|----------|---------|-----------|----------|----------|-------|-------|
| plantuml-ts | TypeScript 5.4 | Node 18+ / browser (ESM) | Vite 5 lib build, Vitest 1 | — | graphviz-ts (file dep), katex 0.16, jsonc-parser 3 | `src/index.ts` (`render`/`renderSync`/`renderAll`) | Pure-SVG PlantUML port; no DOM/canvas/async in core |
| graphviz-ts | TypeScript 6.0 | Node 26.3.1 (engines) / browser (ESM) | esbuild bundle, Vitest 4, Peggy parser | — | none (zero runtime deps) | `src/index.ts` (`renderSvg`, `parse`, `GvcContext`) | Faithful port of Graphviz 2.38 C; DOT layout engine consumed by plantuml-ts |
| plantuml | Java (upstream ref) | JVM (Gradle Kotlin DSL) | Gradle, TeaVM | — | (upstream Java libs) | `net.sourceforge.plantuml.Run` (CLI) | Reference implementation being ported; v1.2026.7beta3, ~3,656 `.java` files; **not built here** |

Field `—` means not applicable / none. Neither TypeScript repo uses a
database — both are pure in-memory string-to-SVG transforms.

## Per-repo detail

### plantuml-ts (current project)
- **Languages:** TypeScript (primary); Python (corpus/tooling scripts).
- **Key components:** 15 diagram plugins under `src/diagrams/*`
  (sequence, class, state, description, activity, object, json, yaml,
  hcl, board, chronology, files, packetdiag, chart, dot). Core pipeline
  in `src/core/` (preprocessor, block-extractor, dispatcher, theme,
  skinparam, measurer, graph-layout, svg).
- **Databases / external services:** none. Optional `IncludeFetcher`
  (injected `fetch`) for `!include` URL resolution in the async path only.
- **Entry points:** library API `renderSync` / `render` / `renderAll`
  in `src/index.ts`. Demo app under `demo/` (Vite dev server).
- **Layout:** all 15 plugins expose `layoutSync`; graph-topology
  diagrams delegate layout to graphviz-ts via `src/core/graph-layout.ts`.

### graphviz-ts (runtime dependency)
- **Languages:** TypeScript (primary); a generated Peggy grammar
  (`src/parser/dot.pegjs` → `dot.js`) for DOT parsing.
- **Key components:** faithful C-module ports — `layout/` (dotgen:
  rank, mincross, position, splines), `cdt/` (container data types),
  `common/` (arrows, colors, html tables, text measure), `gvc/`
  (graphviz context/device), `ortho/`, `pathplan/`, `vpsc/`, `xdot/`,
  `render/`, `parser/`.
- **Databases / external services:** none (zero runtime dependencies).
- **Entry points:** `renderSvg(dot, engine)`, `tryRenderSvg`, `parse`,
  `GvcContext`, plus `./api` and `./render` subpath exports.
- **Consumed by plantuml-ts** as `file:../graphviz-ts/graphviz-ts-0.1.0.tgz`
  (pinned tarball, not live source — see project memory).

### plantuml (upstream reference)
- **Role:** authoritative behavioral + architectural spec for the port.
  Not compiled or shipped by this workspace.
- **Languages:** Java (~3,656 files), with TeaVM for JS transpilation
  upstream and an embedded Smetana (Java transpile of Graphviz 2.38 C).
- **Relevance:** parser/AST packages (`classdiagram/`, `sequencediagram/`,
  `componentdiagram/`, `descdiagram/`) are the source of truth for
  plantuml-ts diagram semantics.
