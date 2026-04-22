# Component Map — Phase 1 Dependencies

```mermaid
graph TD
    API[src/index.ts] --> Pre[core/preprocessor.ts]
    API --> Ext[core/block-extractor.ts]
    API --> Dis[core/dispatcher.ts]
    API --> Seq[diagrams/sequence/index.ts]
    API --> Theme[core/theme.ts]

    Dis --> Seq

    Seq --> Par[sequence/parser.ts]
    Seq --> Lay[sequence/layout.ts]
    Seq --> Ren[sequence/renderer.ts]

    Par --> AST[sequence/ast.ts]
    Lay --> AST
    Lay --> Meas[core/measurer.ts]
    Lay --> Theme
    Ren --> AST
    Ren --> SVG[core/svg.ts]
    Ren --> Cre[core/creole.ts]
    Ren --> Theme

    Ext --> Pre

    style API fill:#f9f,stroke:#333
    style Seq fill:#bbf,stroke:#333
    style Par fill:#dfd,stroke:#333
    style Lay fill:#dfd,stroke:#333
    style Ren fill:#dfd,stroke:#333
```

## Module responsibilities

| Module | Responsibility |
|--------|---------------|
| `index.ts` | Public API — `render()`, `renderSync()`, `renderAll()` |
| `preprocessor.ts` | `!define`, `!ifdef`, comment stripping |
| `block-extractor.ts` | `@startuml…@enduml` detection + type probe |
| `dispatcher.ts` | Plugin registry + type → plugin lookup |
| `theme.ts` | `Theme` type + `default` and `dark` built-ins |
| `measurer.ts` | `StringMeasurer` interface + `FormulaMeasurer` |
| `svg.ts` | SVG string primitives (rect, line, text, path, group) |
| `creole.ts` | Creole markup → `<tspan>` elements |
| `sequence/ast.ts` | All sequence AST and Geometry types |
| `sequence/parser.ts` | Command dispatch → `SequenceDiagramAST` |
| `sequence/layout.ts` | `SequenceDiagramAST` → `SequenceGeometry` |
| `sequence/renderer.ts` | `SequenceGeometry` → SVG string |
| `sequence/index.ts` | `DiagramPlugin` wiring |
