# plantuml-js — Project Plan

TypeScript-native PlantUML renderer targeting browser SVG output. Goal: render
PlantUML source in Markdown the same way Mermaid does — no Java server, no
external process, just import and render.

## Scope

**In scope**
- Parse PlantUML source text
- Render SVG in the browser
- Feature compatibility with PlantUML (syntax-level, not pixel-perfect)
- Preprocessor directives: `!define`, `!include` (local), `!if`/`!endif`

**Out of scope**
- PNG, PDF, EPS, ASCII art output
- Server-side Graphviz process
- TeaVM / Java transpilation
- `!include` from remote URLs (security)
- Math / LaTeX rendering
- Ditaa / DOT pass-through
- Wire mockup (Salt)

## Documents

| File | Contents |
|------|----------|
| [architecture.md](architecture.md) | Layer design, key interfaces, data flow |
| [phases.md](phases.md) | Phased delivery plan with diagram-type-to-phase table |
| [diagram-types.md](diagram-types.md) | Per-type priority, layout strategy, AST sketches |
| [toolchain.md](toolchain.md) | Build system, testing, packaging decisions |
| [tdd-plan.md](tdd-plan.md) | Full Red/Green test sequence for every layer and phase |
| [demo-app.md](demo-app.md) | Canonical demo app: one live example per diagram type |
| [markdown-integration.md](markdown-integration.md) | Phase 5: autoload, markdown-it, remark plugins + renderSync |

## Status

- [ ] Phase 1 — Foundation + Sequence diagrams
- [ ] Phase 2 — Graph diagrams (Class, Component, State, Use Case)
- [ ] Phase 3 — Activity diagrams
- [ ] Phase 4 — Specialized (Timing, Mind Map, Gantt, Object, WBS, Network)
- [ ] Phase 5 — Markdown integration (autoload, markdown-it, remark, renderSync)
