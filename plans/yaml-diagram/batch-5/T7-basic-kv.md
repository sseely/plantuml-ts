# T7 — Basic Key-Value + Nested Objects

## Context

Verifies the most fundamental YAML parser behaviors: simple key-value pairs,
nested objects via indentation, empty values, and common-indent stripping.
Based on upstream fixtures from issues #434 and related.

## Task

Write `tests/unit/yaml/parser-basic.test.ts` exercising `parseYaml()` from
`src/diagrams/yaml/parser.ts`.

## Write-set

- `tests/unit/yaml/parser-basic.test.ts` (create)

## Read-set

- `src/diagrams/yaml/parser.ts` (T6)
- `src/diagrams/json/ast.ts` — JsonDiagramAST
- Corpus fixture: lifuxe-66 (`FOO1: bar1\nFOO2: bar2`)
- Corpus fixture: medosa-24 (`compile:\n  extends: .sbt-compile-cross`)

## Test cases to implement

```typescript
// Issue #434 — two simple key-value pairs
parse(['FOO1: bar1', 'FOO2: bar2'])
  → root === { FOO1: 'bar1', FOO2: 'bar2' }

// Nested object via indentation
parse(['metadata:', '  name: foo', '  namespace: bar'])
  → root === { metadata: { name: 'foo', namespace: 'bar' } }

// Three levels deep
parse(['a:', '  b:', '    c: deep'])
  → root === { a: { b: { c: 'deep' } } }

// Key with no value (KEY_ONLY + no deeper content) → empty string
parse(['test:'])
  → root === { test: '' }

// Key with explicit empty value followed by sibling
parse(['key:', 'other: val'])
  → root === { key: '', other: 'val' }

// Common indent stripped — all lines start with 2 spaces
// After stripping 2-space prefix, parses normally
parse(['  fruit: Apple', '  size: Large'])
  → root === { fruit: 'Apple', size: 'Large' }

// Key with a space in it (ketunu-15 "the key" fixture)
parse(['the key: the value'])
  → root === { 'the key': 'the value' }

// Dot-key (medosa-24 — .sbt-compile-cross)
parse(['compile:', '  extends: .sbt-compile-cross'])
  → root.compile.extends === '.sbt-compile-cross'

// Empty lines between entries are ignored
parse(['a: 1', '', 'b: 2'])
  → root === { a: '1', b: '2' }

// Number values are preserved as strings (PlantUML behavior)
parse(['replicas: 1'])
  → root === { replicas: '1' }
```

## Quality bar

`npm test` must pass with all cases above.
