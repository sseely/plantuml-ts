# T5 — Plugin Wiring

## Context

plantuml-js dispatches diagram rendering via a plugin registry. Each plugin
implements `SyncPlugin<AST, Geo>` from `src/core/dispatcher.ts`. Plugins are
registered in `src/index.ts` in specificity order. See
`src/diagrams/object/index.ts` as a minimal reference for the plugin pattern.

The JSON plugin's `accepts()` must return true when the block type is `'json'`
(set by block-extractor from `@startjson` keyword). The simplest check:
`source.type === 'json'` OR match on `lines` content — but since `@startjson`
sets `type` directly via `START_SUFFIX_MAP`, `accepts` can rely on type.

Actually: `accepts(lines)` receives the content lines (not the full source).
So check for JSON-like content: the first non-empty content line starts with
`{`, `[`, or `#highlight`. Alternatively, check the block type in the plugin.

**Note:** the SyncPlugin interface passes `lines` to `accepts()`, not `type`.
Look at how other keyword-suffix plugins handle this — the activity plugin uses
pattern matching on content lines. For JSON, the simplest reliable signal is
the first non-empty line being `{` or `[` (JSON container start) or
`#highlight`. Bare primitives are wrapped in an array by the parser (matching
upstream `JsonDiagram` constructor behavior).

## Task

### 1. `src/diagrams/json/index.ts`

```typescript
import type { SyncPlugin } from '../../core/dispatcher.js';
import type { JsonDiagramAST } from './ast.js';
import type { JsonGeometry } from './layout.js';
import { parseJson } from './parser.js';
import { layoutJson } from './layout.js';
import { renderJson } from './renderer.js';

export const jsonPlugin: SyncPlugin<JsonDiagramAST, JsonGeometry> = {
  type: 'json',

  accepts(lines: readonly string[]): boolean {
    // JSON blocks arrive via @startjson/@endjson keyword suffix.
    // The first meaningful content line is either a #highlight directive
    // or the start of a JSON value ({ or [).
    const first = lines.find((l) => l.trim().length > 0)?.trim() ?? '';
    return first.startsWith('{') || first.startsWith('[')
      || first.startsWith('#highlight');
  },

  parse(source) { return parseJson(source); },
  layoutSync(ast, theme, measurer) { return layoutJson(ast, theme, measurer); },
  render(geo, theme) { return renderJson(geo, theme); },
};
```

### 2. `src/index.ts`

- Add import: `import { jsonPlugin } from './diagrams/json/index.js';`
- Register: `registry.register(jsonPlugin);` — insert **before**
  `registry.register(sequencePlugin)` (sequence is last, most general).

## Write-set

- `src/diagrams/json/index.ts`
- `src/index.ts`

## Read-set

- `src/core/dispatcher.ts` (SyncPlugin interface)
- `src/diagrams/object/index.ts` (minimal plugin pattern)
- `src/index.ts` lines 1-35 (current imports and registration order)

## Acceptance criteria

- Given `render('@startjson\n{"key":"val"}\n@endjson')`, when called,
  then returns an SVG string containing the text `key`
- Given a source block of type `'json'`, when `registry.resolve` runs,
  then it returns `jsonPlugin` (not the error sentinel)
- Given `render('@startuml\nA->B\n@enduml')`, when called, then
  `jsonPlugin.accepts()` returns `false` for the sequence content lines
- Given `render('@startjson\nnull\n@endjson')`, when called, then
  returns a non-empty SVG (null is wrapped in an array by the parser)

## Quality bar

`npm test && npm run typecheck && npm run lint && npm run build` must
all pass. This is the final batch — run the full gate set.
Commit message: `feat(json): wire plugin and register in dispatcher`
