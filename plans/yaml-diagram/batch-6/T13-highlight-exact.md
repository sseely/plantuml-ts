# T13 — Highlight Exact Path

## Context

Verifies that `#highlight` directives with quoted paths are parsed correctly
into path arrays, and that the JSON layout's `buildHighlightMap` marks the
correct rows as highlighted.

## Task

Write `tests/unit/yaml/parser-highlight-exact.test.ts`.
Tests operate at the `parseYaml()` level (checking `ast.highlights`) AND at
the full render level (checking that `yamlPlugin` processes highlights
end-to-end via the existing JSON layout path).

## Write-set

- `tests/unit/yaml/parser-highlight-exact.test.ts` (create)

## Read-set

- `src/diagrams/yaml/parser.ts` (T6)
- `src/diagrams/json/layout.ts` — buildHighlightMap (verify exact path matching)
- `tests/unit/json/parser.test.ts` — pattern reference for highlight tests

## Test cases to implement

```typescript
// Single-key highlight
parseYaml(['#highlight "fruit"', 'fruit: Apple', 'size: Large'])
  → ast.highlights === [['fruit']]

// Two-segment path
parseYaml(['#highlight "xmas-fifth-day" / "partridges"', 'xmas-fifth-day:', '  partridges:', '    count: 1'])
  → ast.highlights === [['xmas-fifth-day', 'partridges']]

// Multiple #highlight lines
parseYaml(['#highlight "a"', '#highlight "b"', 'a: 1', 'b: 2'])
  → ast.highlights === [['a'], ['b']]

// Highlight line mixed with title directive
parseYaml(['title My Diagram', '#highlight "key"', 'key: val'])
  → ast.title === 'My Diagram' AND ast.highlights === [['key']]

// Layout: buildHighlightMap marks correct row
// Use layoutJson + a flat JsonDiagramAST to verify the highlight flag
// appears on the correct FlatNode row (check that the existing JSON layout
// test patterns apply to YAML-produced ASTs)
import { layoutJson } from '../../../src/diagrams/json/layout.js';
import { FormulaMeasurer } from '../../../src/core/measurer.js';
const ast = { root: { fruit: 'Apple', size: 'Large' },
               highlights: [['fruit']], parseError: false };
const geo = layoutJson(ast, defaultTheme, new FormulaMeasurer());
// The rendered rows include the node rows. Check that fruit row is
// highlighted but size is not.
// (geo structure: find the row with key 'fruit' and check .highlight)
```

## Quality bar

`npm test` must pass with all cases above.
