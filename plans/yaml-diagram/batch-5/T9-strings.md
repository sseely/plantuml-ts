# T9 — Quoted Strings + Flow Sequences

## Context

Verifies quoted value handling (double and single quotes stripped by
`unquote()`), flow sequence parsing (`[a, b, c]`), and escape sequences
in flow sequence items.

## Task

Write `tests/unit/yaml/parser-strings.test.ts` exercising `parseYaml()`.

## Write-set

- `tests/unit/yaml/parser-strings.test.ts` (create)

## Read-set

- `src/diagrams/yaml/parser.ts` (T6)
- Corpus fixture: poxedu-72, gabalo-23 (double-quoted values)

## Test cases to implement

```typescript
// Double-quoted value (gabalo-23 style)
parse(['doe: "a deer, a female deer"'])
  → root === { doe: 'a deer, a female deer' }  // quotes stripped

// Single-quoted value
parse(["name: 'O\\'Brien'"])
  // Note: single-quoted in YAML has its own escaping but YamlLine
  // just strips outer quotes. Value is O'Brien (the \' is literal ').
  // Actually YamlLine.unquote strips outer quotes only, doesn't unescape.
  → root === { name: "O\\'Brien" }   // unquote strips outer single quotes
  // Document actual behavior: just strip outer quote chars

// Double-quoted key
parse(['"quoted key": value'])
  → root === { 'quoted key': 'value' }

// Flow sequence simple
parse(['tags: [a, b, c]'])
  → root === { tags: ['a', 'b', 'c'] }

// Flow sequence quoted items (spaces trimmed)
parse(['tags: ["alpha", "beta"]'])
  → root === { tags: ['alpha', 'beta'] }  // quotes stripped by toList

// Flow sequence with commas in quoted items
parse(['tags: ["a, b", "c"]'])
  → root === { tags: ['a, b', 'c'] }  // quoted comma not a separator

// Flow sequence escaped quote
// Tags: ["it\\"s", "ok"]  → ['it"s', 'ok']
parse(['tags: ["it\\"s", "ok"]'])
  → root === { tags: ['it"s', 'ok'] }

// Boolean and numeric values stay as strings (PlantUML behavior)
parse(['pi: 3.14159', 'xmas: true', 'count: 3'])
  → root === { pi: '3.14159', xmas: 'true', count: '3' }

// poxedu-72 — nested flow sequence under key
parse(['calling-birds: [huey, dewey, louie, fred]'])
  → root === { 'calling-birds': ['huey', 'dewey', 'louie', 'fred'] }
```

## Quality bar

`npm test` must pass with all cases above.
