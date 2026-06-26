# T10 — Comments + Whitespace

## Context

Verifies full-line comment stripping, inline comment stripping (quote-aware),
tab-to-4-space expansion, and blank-line skipping.

## Task

Write `tests/unit/yaml/parser-whitespace.test.ts` exercising `parseYaml()`.

## Write-set

- `tests/unit/yaml/parser-whitespace.test.ts` (create)

## Read-set

- `src/diagrams/yaml/parser.ts` (T6)
- Corpus fixture: poxedu-72 (tab-indented YAML)
- Corpus fixture: ketunu-15 (comments throughout)

## Test cases to implement

```typescript
// Full-line comment stripped
parse(['# this is a comment', 'fruit: Apple'])
  → root === { fruit: 'Apple' }

// Inline comment after value
parse(['fruit: Apple # juicy'])
  → root === { fruit: 'Apple' }

// Inline comment after space only — # must be preceded by space
parse(['url: http://example.com'])
  → root === { url: 'http://example.com' }  // :// not a comment

// Inline comment with quoted value — # inside quotes is NOT stripped
parse(['msg: "hello # world"'])
  → root === { msg: 'hello # world' }

// Multiple full-line comments between entries
parse(['# header', 'a: 1', '# between', 'b: 2', '# footer'])
  → root === { a: '1', b: '2' }

// Tab-indented (poxedu-72 style — real tabs in the corpus)
const tabLines = ['metadata:\t', '\tname: foo']
// After tab→4-space: 'metadata:    ' and '    name: foo'
parse(tabLines)
  → root === { metadata: { name: 'foo' } }

// Tab-prefixed value (4 spaces per tab for indent calculation)
parse(['\tkey: val'])
  → root === { key: 'val' }  // indent=4

// Empty lines between entries ignored
parse(['a: 1', '', '', 'b: 2'])
  → root === { a: '1', b: '2' }

// ketunu-15 — comment within multiline value block (see T11 for full case)
// Here just verify orphan comment at end doesn't crash
parse(['fruit: Apple', '# final comment'])
  → root === { fruit: 'Apple' }
```

## Quality bar

`npm test` must pass with all cases above.
