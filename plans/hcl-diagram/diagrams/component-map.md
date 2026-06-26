# Component Map

```mermaid
graph TD
    BE[src/core/block-extractor.ts<br/>DiagramType + START_SUFFIX_MAP] -->|type 'hcl'| DISP[src/core/dispatcher.ts]
    IDX[src/index.ts<br/>register + applyStyleMap] -->|registers| PLUG[src/diagrams/hcl/index.ts<br/>hclPlugin]
    PLUG -->|parse| PARSE[src/diagrams/hcl/parser.ts<br/>parseHcl]
    PLUG -->|layoutSync| LAYOUT[src/diagrams/json/layout.ts<br/>layoutJson — unchanged]
    PLUG -->|render| RENDER[src/diagrams/json/renderer.ts<br/>renderJson — unchanged]
    PARSE -->|produces| AST[src/diagrams/json/ast.ts<br/>JsonDiagramAST]
    IDX -->|hcldiagram.* selectors| THEME[src/core/theme.ts<br/>Theme]
```

## Write-set by batch

| Batch | Files written |
|-------|--------------|
| T1 | `src/diagrams/hcl/parser.ts`, `src/core/block-extractor.ts`, `tests/unit/hcl/parser.test.ts` |
| T2 | `src/diagrams/hcl/index.ts`, `src/index.ts`, `tests/unit/hcl/plugin.test.ts`, `tests/visual/hcl.html`, `DIVERGENCES.md` |
