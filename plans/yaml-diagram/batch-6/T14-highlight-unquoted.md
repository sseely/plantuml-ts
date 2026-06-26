# T14 — Highlight Unquoted Path + Stereotype

## Context

YAML highlight paths differ from JSON: they can be unquoted and use `/`
without surrounding spaces. This task verifies the YAML path parser handles
both forms, wildcards as path segments, and stereotype stripping.

Corpus fixtures: poxedu-72 (`#highlight * /french-hens`, `#highlight ** /location`)
and jukejo-54 (`#highlight "french-hens" <<h1>>`).

## Task

Write `tests/unit/yaml/parser-highlight-unquoted.test.ts`.

## Write-set

- `tests/unit/yaml/parser-highlight-unquoted.test.ts` (create)

## Read-set

- `src/diagrams/yaml/parser.ts` (T6 — parseYamlHighlightLine)
- Corpus fixtures listed above

## Test cases to implement

```typescript
// Unquoted path, no spaces around slash (corpus: poxedu-72)
parseYaml(['#highlight xmas-fifth-day/partridges', 'foo: bar'])
  → ast.highlights === [['xmas-fifth-day', 'partridges']]

// Wildcard * at first position (corpus: poxedu-72)
parseYaml(['#highlight * /french-hens', 'foo: bar'])
  → ast.highlights === [['*', 'french-hens']]

// Double wildcard ** (corpus: poxedu-72)
parseYaml(['#highlight ** /location', 'foo: bar'])
  → ast.highlights === [['**', 'location']]

// Stereotype stripped from path — <<h1>> does not appear in path
parseYaml(['#highlight "french-hens" <<h1>>', 'foo: bar'])
  → ast.highlights === [['french-hens']]

// Stereotype with two-segment path
parseYaml(['#highlight "xmas-fifth-day" / "partridges" <<h2>>', 'foo: bar'])
  → ast.highlights === [['xmas-fifth-day', 'partridges']]

// Mixed quoted and unquoted in one diagram
parseYaml(['#highlight "a"', '#highlight b/c', 'a: 1', 'b:', '  c: 2'])
  → ast.highlights === [['a'], ['b', 'c']]

// Leading/trailing spaces in unquoted path segments are trimmed
parseYaml(['#highlight  key / subkey ', 'foo: bar'])
  → ast.highlights === [['key', 'subkey']]
```

## Quality bar

`npm test` must pass with all cases above.
