# Data Flows

Sequence diagrams for the most important flows, derived from
`src/index.ts` and `src/core/`. All steps are in-process synchronous
calls except where an `async`/`await` boundary is drawn explicitly.

## 1. `renderSync` of a graph-topology diagram (the graphviz-ts seam)

The critical path: a class/state/description/dot diagram that borrows
graphviz-ts for layout. This is the flow where most accumulated fidelity
lives.

```mermaid
sequenceDiagram
    autonumber
    participant App as Consumer
    participant API as index.ts renderSync
    participant Pre as preprocessor
    participant Blk as block-extractor
    participant Reg as dispatcher registry
    participant Plg as diagram plugin (e.g. class)
    participant GL as graph-layout.ts
    participant GV as graphviz-ts
    participant Ren as plugin.render + svg.ts

    App->>API: renderSync(source, options)
    API->>API: reject if source has !include
    API->>Pre: preprocess(source)
    Pre-->>API: {lines, theme hint}
    API->>API: buildTheme() + getDefaultMeasurer()
    API->>Blk: extractBlocks(lines)
    Blk-->>API: UmlSource (type detected)
    API->>Reg: resolve(block)
    Reg->>Plg: accepts(lines) most-specific-first
    Reg-->>API: matched plugin
    API->>Plg: parse(source) → AST
    API->>Plg: layoutSync(ast, theme, measurer)
    Plg->>GL: layout DotInputGraph
    GL->>GL: serialize nodes/edges/clusters,<br/>measure labels via LUT
    GL->>GV: renderSvg / run engine
    GV-->>GL: LayoutSnapshot (coords, splines)
    GL->>GL: map centres→top-left, shift to origin,<br/>compute canvas size
    GL-->>Plg: positioned geometry
    Plg-->>API: Geo
    API->>Ren: render(geo, theme)
    Ren-->>API: SVG string (with arrowhead <defs>)
    API-->>App: "<svg>…</svg>"
    Note over API,App: any throw → errorSvg(message) is returned, never propagated
```

## 2. `render` (async) with `!include` resolution

The only flow that touches the outside world. `renderSync` explicitly
rejects `!include`; the async `render` resolves includes first, then
runs the identical pipeline. A plugin without `layoutSync` (a future
WASM/worker engine) is `await`ed here.

```mermaid
sequenceDiagram
    autonumber
    participant App as Consumer
    participant API as index.ts render (async)
    participant Inc as include-resolver
    participant Fetch as injected IncludeFetcher
    participant Pipe as preprocess → extract → dispatch → parse
    participant Plg as diagram plugin

    App->>API: await render(source, {fetcher})
    API->>Inc: await resolveIncludes(source, fetcher)
    loop each !include URL
        Inc->>Fetch: fetch(url)
        alt CSP connect-src violation
            Fetch-->>Inc: throw CspIncludeError
        else CORS failure
            Fetch-->>Inc: throw CorsIncludeError
        else ok
            Fetch-->>Inc: included text
        end
    end
    Inc-->>API: fully-resolved source
    API->>Pipe: same pipeline as renderSync
    Pipe->>Plg: parse → layout
    alt plugin has layoutSync
        API->>Plg: layoutSync(...)
    else async plugin
        API->>Plg: await layout(...)
    end
    Plg-->>API: Geo
    API-->>App: Promise<SVG string>
    Note over API,App: errors (including include errors) → errorSvg
```

## 3. `renderSync` of a self-laying-out diagram (sequence)

Contrast case: no graphviz-ts. Sequence (and the data-shape diagrams)
compute geometry directly from the AST, so the pipeline is shorter and
never crosses the layout seam.

```mermaid
sequenceDiagram
    autonumber
    participant App as Consumer
    participant API as index.ts renderSync
    participant Plg as sequence plugin
    participant Meas as measurer (width LUT)
    participant Ren as sequence renderer + svg.ts

    App->>API: renderSync("@startuml … @enduml")
    API->>API: preprocess + buildTheme + extractBlocks
    API->>Plg: accepts() → parse(source) → AST<br/>(participants, messages)
    API->>Plg: layoutSync(ast, theme, measurer)
    Plg->>Meas: measure participant/message text
    Meas-->>Plg: deterministic widths
    Plg->>Plg: place lifelines, arrows, activations
    Plg-->>API: geometry
    API->>Ren: render(geo, theme)
    Ren-->>API: SVG string
    API-->>App: "<svg>…</svg>"
```

## Why these three

- **Flow 1** exercises the single most complex and highest-value seam
  (graphviz-ts integration) and the full plugin contract.
- **Flow 2** is the only async/effectful path and the only place the
  library reaches outside the process — the security-relevant boundary
  (CSP/CORS-aware fetch injection).
- **Flow 3** shows the self-contained layout path, confirming graphviz-ts
  is a per-diagram-type dependency, not a global one.
