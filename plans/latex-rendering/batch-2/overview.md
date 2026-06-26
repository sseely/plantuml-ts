# Batch 2 — Use case layout + renderer integration

T2 and T3 write different files and can run in parallel. Both depend on T1.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T2 | Layout: LaTeX node sizing via measureLatex() | typescript-pro | layout.ts, layout.test.ts | T1 | [x] |
| T3 | Renderer: LaTeX label → foreignObject in SVG output | typescript-pro | renderer.ts, renderer.test.ts | T1 | [x] |
