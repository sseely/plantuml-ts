# Architecture Overview

## What the system does

**plantuml-ts** is a TypeScript port of [PlantUML](https://plantuml.com)
that turns PlantUML diagram source text into **SVG strings**,
synchronously, with no server, no DOM, no canvas, and no Java runtime.
It is designed to run in a browser or in Node with a single library
call. The deliverable is fidelity to upstream PlantUML's accumulated
behavior — the long tail of arrow styles, label placement, layout
quirks, and rendering decisions — not merely "a diagram that is
structurally correct."

The system takes a string like:

```
@startuml
Alice -> Bob : hello
@enduml
```

and returns an `<svg>…</svg>` string.

## How the repos relate

Three repositories in the `sseely` org form the working set:

```
plantuml (Java, upstream)        graphviz (C, upstream — not in org)
        │  ports behavior/AST                 │  ports algorithms
        ▼                                      ▼
   plantuml-ts  ───── depends on ─────►   graphviz-ts
   (this repo)     (file: tarball dep)   (DOT layout engine)
```

- **plantuml (upstream Java, `sseely/plantuml`)** — the authoritative
  reference. Its parser packages and rendering rules define what
  plantuml-ts must reproduce. It is consulted, not built or shipped.
- **graphviz-ts (`sseely/graphviz-ts`)** — a faithful pure-TypeScript
  port of Graphviz 2.38's C source. plantuml-ts delegates all
  graph-topology layout (rank assignment, crossing minimization,
  coordinate assignment, edge routing) to it through a single seam,
  `src/core/graph-layout.ts`. It is consumed as a pinned tarball
  (`file:../graphviz-ts/graphviz-ts-0.1.0.tgz`), not as live source.
- **plantuml-ts (this repo)** — owns preprocessing, block extraction,
  diagram-type dispatch, parsing into per-type ASTs, theme/skinparam
  resolution, text measurement, and SVG rendering. It owns layout for
  non-graph diagram types (e.g. sequence) and borrows graphviz-ts for
  the graph-topology ones.

Two further repos are referenced by code/docs but are **not in the
`sseely` org** (they are local upstream mirrors / corpora): `graphviz`
(the Graphviz C source, used as the algorithm spec for graphviz-ts) and
`pdiff` (a 5,600-file `.puml` fixture corpus keyed to upstream GitHub
issues, used as the work queue).

## Key data flows

The core render pipeline is a pure, synchronous transform:

```
source string
  → preprocess()            (!define/!include/!theme, macros, comments)
  → buildTheme()            (theme + skinparam resolution)
  → extractBlocks()         (split @start…@end, detect diagram type)
  → registry.resolve()      (pick the diagram plugin via accepts())
  → plugin.parse()          (source → per-type AST)
  → plugin.layoutSync()     (AST → positioned geometry)
        └─ graph-layout.ts → graphviz-ts.renderSvg (topology diagrams only)
  → plugin.render()         (geometry → SVG string)
```

`renderSync` runs this entirely in-memory. `render` (async) adds one
capability: resolving `!include` URLs through an injected
`IncludeFetcher` before the same pipeline runs. `renderAll` runs the
pipeline once per `@start…@end` block.

## Tech stack summary

| Repo | Language | Runtime | Framework | Database | External deps |
|------|----------|---------|-----------|----------|---------------|
| plantuml-ts | TypeScript 5.4 | Node 18+ / browser (ESM) | Vite 5, Vitest 1, Playwright | — | graphviz-ts, katex, jsonc-parser |
| graphviz-ts | TypeScript 6.0 | Node 26.3.1 / browser (ESM) | esbuild, Vitest 4, Peggy | — | none (zero runtime deps) |
| plantuml | Java | JVM | Gradle (Kotlin DSL), TeaVM | — | upstream Java libraries |

## Documents in this folder

- [`inventory.md`](./inventory.md) — per-repo component/runtime inventory.
- [`tech-health.md`](./tech-health.md) — runtime/framework EOL and CVE status.
- [`architecture.md`](./architecture.md) — system architecture diagram.
- [`components.md`](./components.md) — per-repo internal component maps.
- [`data-flow.md`](./data-flow.md) — sequence diagrams for critical flows.
