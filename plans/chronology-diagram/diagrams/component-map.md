# Component Map

```mermaid
graph TD
    A[src/index.ts] -->|registers| B[chronologyPlugin]
    B --> C[src/diagrams/chronology/index.ts]
    C --> D[parser.ts]
    C --> E[layout.ts]
    C --> F[renderer.ts]
    D --> G[ast.ts]
    E --> G
    F --> G
    F --> H[src/core/svg.ts\ndiamond, line, text, svgRoot]
    I[src/core/block-extractor.ts] -->|routes 'chronology'| B
    J[src/core/dispatcher.ts] -->|SyncPlugin interface| C
```

```mermaid
graph LR
    SRC["@startchronology source"] --> P[parseChronology]
    P --> AST[ChronologyDiagramAST\nevents: ChronologyEvent\{\}]
    AST --> L[layoutChronology]
    L --> GEO[ChronologyGeometry\nevents x/labelAbove\ndayTicks x/label\ndimensions]
    GEO --> R[renderChronology]
    R --> SVG["SVG string"]
```
