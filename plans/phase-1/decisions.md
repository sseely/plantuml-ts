# Architecture Decisions — Phase 1

## D1: Diagram type detection from @startuml

**Decision:** Plugin `accepts()` probe — dispatcher iterates registered plugins
in priority order; first plugin whose `accepts(lines)` returns true is used.

**Rejected:**
- First-line keyword scan — becomes a maintenance burden as diagram types grow
- Require explicit `@startsequence` — breaks PlantUML compatibility

**Interface contract:**
```typescript
interface DiagramPlugin<AST, Geo> {
  readonly type: DiagramType;
  accepts(lines: readonly string[]): boolean;
  // ...
}
```

---

## D2: Public API — both render() and renderSync() from day one

**Decision:** Export both from `src/index.ts` on day one.
- `render()` returns `Promise<string>` (wraps renderSync in Phase 1; diverges in Phase 2 with ELK async)
- `renderSync()` returns `string` directly (required by markdown-it/remark plugins in Phase 5)

**Rejected:**
- Sync-only now, async later — breaking API change in Phase 2
- Async-only — markdown integration plugins need sync

---

## D3: SVG generation — string building

**Decision:** All SVG output is produced by pure string-building functions in
`src/core/svg.ts`. No DOM API (`document.createElementNS`).

**Rejected:**
- DOM API — requires jsdom in non-browser contexts; verbose
- Templating library — unnecessary runtime dependency

---

## D4: Text measurement — injectable StringMeasurer with three implementations

**Decision:** `StringMeasurer` interface injected at call sites. Three impls:

| Implementation | Used in | Method |
|----------------|---------|--------|
| `CanvasMeasurer` | Production browser | `canvas.measureText()` |
| `FormulaMeasurer` | Unit tests, SSR | `charWidth × fontSize × 0.55` |
| `PlaywrightMeasurer` | Integration tests | `page.evaluate()` → real canvas |

**Interface contract:**
```typescript
interface StringMeasurer {
  measure(text: string, font: FontSpec): { width: number; height: number };
}
interface FontSpec {
  family: string;
  size: number;
  weight?: 'normal' | 'bold';
  style?: 'normal' | 'italic';
}
```

**Rejected:**
- Formula everywhere — layout geometry in tests never matches browser
- Canvas-only — breaks in SSR and unit tests

---

## D5: Error handling — render() returns error SVG, never throws

**Decision:** `render()` and `renderSync()` catch all errors and return an SVG
containing a red error message. Internal parser/layout errors still throw
within the pipeline; only the public API boundary catches and formats.

**Rejected:**
- Throw at public API — markdown integrations crash if caller forgets try/catch
- Result<T,E> type — verbose for the common case

**Error SVG format:**
```
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="100">
  <rect width="400" height="100" fill="#fee" stroke="#f00"/>
  <text x="10" y="30" fill="#c00" font-family="monospace">
    PlantUML error: {message}
  </text>
</svg>
```

---

## D6: Fixture files — separate test fixtures from demo canonical files

**Decision:** Two distinct sets of PlantUML files:
- `tests/fixtures/sequence/` — exhaustive edge-case files (all syntax variations)
- `demo/examples/sequence/canonical.puml` — one showcase scenario per type

`tests/integration/canonical-examples.test.ts` auto-discovers all
`demo/examples/**/*.puml` files and tests each one. Adding a canonical demo
file automatically adds an integration test.

**Rejected:**
- Single shared set — edge-case fixtures would clutter the demo
