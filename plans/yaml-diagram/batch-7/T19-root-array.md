# T19 — Root-Level Array

## Context

Some YAML diagrams start with a list at the root level (no wrapping object).
This is different from the JSON renderer's typical root-object case but
is supported because `JsonDiagramAST.root` is `unknown`.

Corpus fixtures: finofu-94 (`- A\n- B\n- C`), gatuva-87 (list of objects).

## Task

Write `tests/unit/yaml/parser-root-array.test.ts`.

## Write-set

- `tests/unit/yaml/parser-root-array.test.ts` (create)

## Read-set

- `src/diagrams/yaml/parser.ts` (T6)
- Corpus fixtures: finofu-94, gatuva-87

## Test cases to implement

```typescript
// finofu-94 — pure scalar list at root
parse(['- A', '- B', '- C'])
  → root is an array: ['A', 'B', 'C']
  AND Array.isArray(root) === true

// gatuva-87 — list of objects at root (whitespace-indented)
parse(['  - name: Mark McGwire', '    hr:   65',
       '  - name: Sammy Sosa',   '    hr:   63'])
  → root === [
      { name: 'Mark McGwire', hr: '65' },
      { name: 'Sammy Sosa',   hr: '63' }
    ]

// List with mixed scalar and object (gobavi-45)
parse(['- DATA', '-', '  data: value'])
  → root === ['DATA', { data: 'value' }]

// Ansible-style list at root (issue #1409)
parse(['- hosts: webservers', '  vars:', '    http_port: 80'])
  → root === [{ hosts: 'webservers', vars: { http_port: '80' } }]

// Two list items with inline flow sequences
parse(['- tags: [a, b]', '- tags: [c, d]'])
  → root === [{ tags: ['a','b'] }, { tags: ['c','d'] }]

// Plugin produces SVG for a root-array input
// (renderSync must succeed — root array is valid for the JSON renderer)
import { renderSync } from '../../src/index.js';
const svg = renderSync('@startyaml\n- A\n- B\n- C\n@endyaml');
expect(svg).toContain('<svg');
```

## Quality bar

`npm test` must pass with all cases above.
