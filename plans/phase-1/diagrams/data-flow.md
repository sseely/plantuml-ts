# Data Flow — Render Pipeline

```mermaid
sequenceDiagram
    participant Caller
    participant API as src/index.ts
    participant Pre as preprocessor.ts
    participant Ext as block-extractor.ts
    participant Dis as dispatcher.ts
    participant Par as sequence/parser.ts
    participant Lay as sequence/layout.ts
    participant Ren as sequence/renderer.ts

    Caller->>API: render(source, options)
    API->>Pre: preprocess(lines)
    Pre-->>API: expanded lines + theme name
    API->>Ext: extract(lines)
    Ext-->>API: UmlSource[]
    API->>Dis: resolve(umlSource.type)
    Dis-->>API: DiagramPlugin
    API->>Par: plugin.parse(umlSource)
    Par-->>API: SequenceDiagramAST
    API->>Lay: plugin.layout(ast, theme, measurer)
    Lay-->>API: SequenceGeometry
    API->>Ren: plugin.render(geometry, theme)
    Ren-->>API: SVG string
    API-->>Caller: SVG string (or error SVG)
```
