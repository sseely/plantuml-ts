# T8 — List Items (Simple + Objects)

## Context

Verifies list parsing: simple scalar lists, list-of-objects, plain dash
separator (`-` alone), and root-level lists. Based on corpus fixtures
sudabi-56, gatuva-87, gobavi-45, and finofu-94.

## Task

Write `tests/unit/yaml/parser-lists.test.ts` exercising `parseYaml()`.

## Write-set

- `tests/unit/yaml/parser-lists.test.ts` (create)

## Read-set

- `src/diagrams/yaml/parser.ts` (T6)
- Corpus fixtures: sudabi-56, gatuva-87, gobavi-45, finofu-94

## Test cases to implement

```typescript
// sudabi-56 — simple scalar list under a key
parse(['fruit: Apple', 'size: Large', 'color:', ' - Red', ' - Green'])
  → root === { fruit:'Apple', size:'Large', color:['Red','Green'] }

// gatuva-87 — list of objects (whitespace indented)
parse(['  - name: Mark McGwire', '    hr:   65', '    avg:  0.278',
       '  - name: Sammy Sosa',   '    hr:   63', '    avg:  0.288'])
  → root === [
      { name: 'Mark McGwire', hr: '65', avg: '0.278' },
      { name: 'Sammy Sosa',   hr: '63', avg: '0.288' }
    ]

// gobavi-45 — plain dash then object (- \n  data: value)
parse(['- DATA', '-', '  data: value'])
  → root === ['DATA', { data: 'value' }]

// finofu-94 — root-level scalar list
parse(['- A', '- B', '- C'])
  → root === ['A', 'B', 'C']

// Ansible-style (issue #1409)
parse(['- hosts: webservers', '  vars:', '    http_port: 80', '    max_clients: 200'])
  → root === [{ hosts:'webservers', vars:{ http_port:'80', max_clients:'200' } }]

// Nested list inside map
parse(['parent:', '  children:', '    - alpha', '    - beta'])
  → root === { parent: { children: ['alpha', 'beta'] } }

// List item with inline flow sequence (T9 covers flow but also test here)
// polela-38 style — list at root level via YAML indent
parse(['  -', '    name: Mark McGwire', '    hr:   65'])
  → root === [{ name: 'Mark McGwire', hr: '65' }]
```

## Quality bar

`npm test` must pass with all cases above.
