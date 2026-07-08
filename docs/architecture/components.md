# Component Maps

Per-repo internal structure. plantuml-ts is shown in full; graphviz-ts
(the consumed layout engine) is shown at module granularity; the Java
upstream is summarized (reference-only, not built here).

## plantuml-ts

```mermaid
graph TD
    subgraph entry["Entry — src/index.ts"]
        R["render / renderSync / renderAll"]
    end

    subgraph core["Core — src/core/"]
        PRE["preprocessor.ts"]
        BLK["block-extractor.ts"]
        DISP["dispatcher.ts (registry)"]
        THEME["theme.ts · themes-builtin.ts"]
        SKIN["skinparam.ts · style-map-theme.ts"]
        MEAS["measurer.ts · measurer-width-table.data.ts"]
        CREOLE["creole.ts (markup)"]
        DESCKW["descriptive-keywords.ts"]
        GL["graph-layout.ts (+ .types)"]
        SVEK["svek-dot-emit.ts"]
        SVG["svg.ts · svg-sanitize.ts"]
        LATEX["latex.ts (KaTeX)"]
        INC["include-resolver.ts (+ -node)"]
        COMMON["core/common/*"]
    end

    subgraph diag["Diagram plugins — src/diagrams/*"]
        direction LR
        SEQ["sequence"]
        CLS["class"]
        STA["state"]
        DESC["description"]
        ACT["activity"]
        OBJ["object"]
        JSON["json"]
        YAML["yaml"]
        HCL["hcl"]
        DOT["dot"]
        MISC["board · chronology · files ·<br/>packetdiag · chart"]
    end

    R --> PRE --> BLK --> DISP
    R --> THEME --> SKIN
    R --> INC
    DISP --> diag
    diag --> MEAS
    diag --> CREOLE
    diag --> SVG
    diag --> LATEX
    CLS --> GL
    STA --> GL
    DESC --> GL
    ACT --> GL
    JSON --> GL
    OBJ --> GL
    DOT --> GL
    GL --> SVEK
    DESC --> DESCKW

    GL ==>|"graphviz-ts"| EXT["graphviz-ts engines"]
    DOT ==>|"parse()"| EXT
```

**Plugin contract** (`dispatcher.ts`): every plugin implements
`accepts(lines) → boolean`, `parse(source) → AST`,
`layoutSync(ast, theme, measurer) → Geo`, and `render(geo, theme) →
string`. All 15 current plugins expose `layoutSync` (so all are
`renderSync`-capable); the interface also permits async `layout` for a
future WASM/worker engine. Each plugin directory typically contains
`index.ts` (the plugin object), `parser.ts`/`ast.ts`, `layout.ts`, and
`renderer.ts`.

**Layout split:**
- *Own layout* — `sequence` (lifelines/messages), and the data-shape
  diagrams (`json`, `yaml`, `hcl`, `board`, `packetdiag`, `chart`,
  `files`, `chronology`) which compute geometry directly.
- *graphviz-ts layout* — graph-topology diagrams (`class`, `state`,
  `description`/deployment, `activity`, `object`, `dot`) route through
  `graph-layout.ts`.

## graphviz-ts

Faithful port of Graphviz 2.38's C modules, consumed by plantuml-ts.

```mermaid
graph TD
    subgraph api["Public — src/index.ts, src/api"]
        RS["renderSvg / tryRenderSvg"]
        PARSE["parse (DOT)"]
        CTX["GvcContext"]
    end
    subgraph front["Front end"]
        PARSER["parser/ (Peggy DOT grammar)"]
        MODEL["model/ (Graph/Node/Edge)"]
        BUILDER["api/builder (GvGraphBuilder)"]
    end
    subgraph layout["Layout — src/layout (dotgen)"]
        RANK["rank (network simplex)"]
        MINCROSS["mincross (crossing min)"]
        POS["position (x/y coords)"]
        SPLINE["splines / edge routing"]
    end
    subgraph support["Support modules"]
        CDT["cdt/ (splay, hash)"]
        RB["rbtree/"]
        VPSC["vpsc/ · ortho/ · pathplan/"]
        LABEL["label/"]
        COMMON["common/ (arrows, color,<br/>htmltable, textmeasure)"]
    end
    subgraph back["Back end"]
        GVC["gvc/ (context, device, usershape)"]
        RENDER["render/ · xdot/"]
    end

    RS --> PARSER --> MODEL --> layout
    CTX --> GVC
    BUILDER --> MODEL
    layout --> RANK --> MINCROSS --> POS --> SPLINE
    layout --> support
    layout --> back
    back --> RENDER
    RENDER -->|"SVG string"| RS
```

Notable: **zero runtime dependencies**; text measurement is injectable
(`setTextMeasurer`) so it stays DOM-free, which is exactly how
plantuml-ts drives it (it injects its own deterministic measurer). The
DOT parser is generated from a Peggy grammar (`src/parser/dot.pegjs`).

## plantuml (upstream Java) — reference only

Not built in this workspace. Relevant packages under
`net.sourceforge.plantuml/` used as the porting spec:

- `sequencediagram/`, `classdiagram/`, `descdiagram/`,
  `componentdiagram/`, `activitydiagram3/` — parser + AST semantics.
- `command/` — the `Command*` classes that define per-keyword parsing.
- `klimt/` / `skin/` — rendering + skin parameter resolution.
- an embedded **Smetana** (Java transpile of Graphviz 2.38 C) — the
  same algorithm graphviz-ts ports, kept as a cross-check.

~3,656 `.java` files; treated as authoritative for both behavior and
engine/parser boundaries.
