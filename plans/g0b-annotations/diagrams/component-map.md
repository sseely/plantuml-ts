# G0b component map

```mermaid
graph TD
    subgraph new["src/core/annotations/ (NEW — port of upstream chrome)"]
        model["model.ts<br/>DisplayPositioned, DiagramAnnotations (T1)"]
        commands["commands.ts<br/>11 Command* regexes (T1)"]
        style["style.ts<br/>plantuml.skin defaults (T2)"]
        chrome["chrome.ts / blocks.ts<br/>DecorateEntityImage math,<br/>bordered blocks, applyChrome (T4, T9)"]
    end

    subgraph parsers["engine parsers (T5/T6)"]
        p1["class / state / sequence"]
        p2["description / activity / small engines"]
        p3["json / dot / chart (title migrates in T8)"]
    end

    subgraph pipeline["src/index.ts (T3, T7)"]
        renderSeam["plugin.render → RenderFragment (T3)"]
        apply["applyChrome(fragment, ast.annotations,<br/>styles, measurer) (T7)"]
        assemble["assembleSvg → svgRoot (T3)"]
    end

    commands --> model
    p1 & p2 & p3 -- "matchAnnotationCommand" --> commands
    p1 & p2 & p3 -- "ast.annotations" --> apply
    style --> chrome
    model --> chrome
    chrome --> apply
    renderSeam --> apply --> assemble

    skin["src/core/skinparam.ts +<br/>style-map-theme.ts (T2 extends)"] --> style
    measurer["StringMeasurer seam<br/>(deterministic / jar)"] --> chrome
    klimt["src/core/klimt/<br/>(TextBlockMarged, +TextBlockBordered)"] --> chrome
    desc["description klimt renderer<br/>(T7: same chrome, klimt adapter)"] --> apply
```

Upstream mirror: `TitledDiagram` fields → `DiagramAnnotations`;
`CommonCommands.addTitleCommands` → `commands.ts`; `DiagramChromeFactory` +
`DecorateEntityImage` + `EntityImageLegend` → `chrome.ts`/`blocks.ts`;
`UgDiagram.getExporter` (getTextBlock → addChrome → exporter) →
`plugin.render → applyChrome → assembleSvg`.
