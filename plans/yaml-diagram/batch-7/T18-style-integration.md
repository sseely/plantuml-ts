# T18 — Style Block Integration

## Context

Verifies that `yamlDiagram { ... }` style blocks are properly stripped from
the YAML body and applied to the rendered output. Uses real corpus fixtures.

Depends on T16 (yamlDiagram style selectors in src/index.ts).

## Task

Write `tests/integration/yaml-style.test.ts`.

## Write-set

- `tests/integration/yaml-style.test.ts` (create)

## Read-set

- `src/index.ts` (after T16 changes)
- `src/diagrams/yaml/parser.ts` (T6)
- Corpus fixture: bedega-54 (full markup in `tests/visual/data/yaml.json`)
- Corpus fixture: polela-38 (full markup in `tests/visual/data/yaml.json`)

## How to get fixture markup

```typescript
import yamlFixtures from '../visual/data/yaml.json';
const bedega = yamlFixtures.find(f => f.slug === 'bedega-54-romu926')!.markup;
```

## Test cases to implement

```typescript
import { renderSync } from '../../src/index.js';

// bedega-54: yamlDiagram with node highlight style + #highlight "fruit"
// Verify: produces SVG, no error
const bedegaSvg = renderSync(bedega54.markup);
expect(bedegaSvg).toContain('<svg');
expect(bedegaSvg.length).toBeGreaterThan(100);

// polela-38: yamlDiagram with node background + list of objects
const polelaSvg = renderSync(polela38.markup);
expect(polelaSvg).toContain('<svg');

// lelofi-17: style with quoted line style values ("10;5")
const lelofiSvg = renderSync(lelofi17.markup);
expect(lelofiSvg).toContain('<svg');

// gipoxa-19: element selector (yamlDiagram { element { backgroundColor yellow } })
const gipoxaSvg = renderSync(gipoxa19.markup);
expect(gipoxaSvg).toContain('<svg');

// Verify style block content does NOT appear in YAML data
// (yamlDiagram, node, BackGroundColor should not be keys in the tree)
// Check that the style block was stripped before parsing
const ast = parseYaml({ lines: bedega54.markup.split('\n'), type: 'yaml' });
expect(ast.root).toHaveProperty('fruit');  // the actual YAML key
expect(ast.root).not.toHaveProperty('yamlDiagram');
```

## Quality bar

`npm test` must pass. Integration tests may be slower — that's acceptable.
