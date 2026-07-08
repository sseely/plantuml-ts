# System Architecture

High-level architecture of plantuml-ts and its coupling to graphviz-ts
and the upstream reference. Communication is **in-process, synchronous
function calls** unless labeled otherwise — there are no network hops,
services, or databases in the runtime path.

```mermaid
graph TD
    subgraph client["Consumer (browser or Node)"]
        APP["Application code"]
    end

    subgraph plantumlts["plantuml-ts (this repo)"]
        API["src/index.ts<br/>render / renderSync / renderAll"]

        subgraph core["src/core/"]
            PRE["preprocessor.ts<br/>!define / !ifdef / macros"]
            INC["include-resolver.ts<br/>!include (async only)"]
            BLK["block-extractor.ts<br/>split @start…@end + type detect"]
            THEME["theme.ts / skinparam.ts<br/>style-map-theme.ts"]
            DISP["dispatcher.ts<br/>plugin registry + accepts()"]
            MEAS["measurer.ts<br/>deterministic text width LUT"]
            GL["graph-layout.ts<br/>graphviz-ts adapter seam"]
            SVG["svg.ts / svg-sanitize.ts<br/>SVG assembly + defs"]
            LATEX["latex.ts → KaTeX"]
        end

        subgraph plugins["src/diagrams/* (15 plugins)"]
            SEQ["sequence"]
            CLS["class"]
            STA["state"]
            DESC["description / deployment"]
            ACT["activity"]
            DOTP["dot"]
            OTHER["object · json · yaml · hcl ·<br/>board · chronology · files ·<br/>packetdiag · chart"]
        end
    end

    subgraph deps["Dependencies"]
        GVTS["graphviz-ts<br/>(pinned .tgz)<br/>DOT layout engines"]
        KATEX["katex 0.16"]
        JSONC["jsonc-parser"]
    end

    subgraph refs["Upstream references (not shipped, not in-process)"]
        PUML["plantuml (Java)<br/>parser/AST + render spec"]
        GVC["graphviz (C)<br/>algorithm spec"]
        PDIFF["pdiff corpus<br/>5600 .puml fixtures"]
    end

    APP -->|"render(source)"| API
    API --> PRE --> BLK --> DISP
    PRE -. "async path" .-> INC
    API --> THEME
    DISP -->|"resolve → parse → layoutSync → render"| plugins

    plugins --> MEAS
    SEQ -->|"own layout"| SVG
    CLS --> GL
    STA --> GL
    DESC --> GL
    ACT --> GL
    DOTP --> GL
    GL -->|"serialize DOT graph<br/>+ read geometry snapshot"| GVTS
    LATEX --> KATEX
    DOTP -.->|"parse DOT"| GVTS
    plugins --> SVG
    SVG -->|"SVG string"| API

    PUML -.->|"ports behavior/AST"| plugins
    GVC -.->|"ports algorithms"| GVTS
    PDIFF -.->|"work queue / test corpus"| plantumlts
    KATEX -. "runtime" .- deps
    JSONC -.->|"parses JSON/YAML diagrams"| OTHER

    classDef ref fill:#eee,stroke:#999,stroke-dasharray:4 3,color:#333;
    class PUML,GVC,PDIFF ref;
```

## Communication model

| Edge | Kind | Protocol / mechanism |
|------|------|----------------------|
| Consumer → `render`/`renderSync` | sync (async wrapper for includes) | direct function call |
| core → diagram plugins | sync | `DiagramPlugin` interface (`accepts`/`parse`/`layoutSync`/`render`) |
| graph plugins → graphviz-ts | sync | `graph-layout.ts` serializes a `DotInputGraph` into a graphviz-ts builder, runs an engine, reads back a `LayoutSnapshot` |
| dot plugin → graphviz-ts | sync | `parse()` (Peggy DOT grammar) |
| latex → KaTeX | sync | `renderToString` |
| async path → `IncludeFetcher` | **async** | injected `fetch`-like callback (CSP/CORS aware); only reachable via `render`, never `renderSync` |

## Architectural invariants

- **No DOM, no canvas, no async in the core transform.** Text width is
  resolved by a deterministic lookup table (`measurer.ts`), which is why
  layout is reproducible and server-safe. graphviz-ts is consumed
  through the same DOM-free contract.
- **Single layout seam.** All graph-topology diagrams reach graphviz-ts
  through exactly one adapter (`graph-layout.ts`); no plugin talks to
  the engine directly except the `dot` plugin's parser.
- **Plugin dispatch is order-sensitive.** The registry tries `accepts()`
  most-specific-first (object → class → state → description → activity →
  sequence); a graceful error-SVG sentinel handles no-match.
- **`CONTAINER_KINDS` is mirrored** in `layout.ts` and `renderer.ts` and
  must stay in sync; childless containers are treated as leaf nodes.
- **Upstream architecture is authoritative.** Engine/parser boundaries
  mirror upstream PlantUML; structural divergence is treated as a bug to
  re-mirror, not patch around.
