# T11 — Multiline Values

## Context

Verifies two forms of multiline values:
1. Block scalar (`|`) — literal lines joined with `\n`
2. KEY_ONLY + NO_KEY_ONLY_TEXT continuation — text lines space-joined

Both are from the `ketunu-15-poli031` corpus fixture.

## Task

Write `tests/unit/yaml/parser-multiline.test.ts` exercising `parseYaml()`.

## Write-set

- `tests/unit/yaml/parser-multiline.test.ts` (create)

## Read-set

- `src/diagrams/yaml/parser.ts` (T6)
- Corpus fixture: ketunu-15 (`tests/visual/data/yaml.json` contains full markup)

## Test cases to implement

```typescript
// Block scalar | — lines trimmed and joined with \n
parse(['text: |', '  line1', '  line2', '  line3'])
  → root === { text: 'line1\nline2\nline3\n' }
  // Note: cleanBlockStyle just trims each line. Trailing \n from the
  // way getBlockStyleString appends "\n" per line.

// Block scalar stops at less-indented next key
parse(['text: |', '  line1', '  line2', 'key: val'])
  → root === { text: 'line1\nline2\n', key: 'val' }

// KEY_ONLY + NO_KEY_ONLY_TEXT continuation (ketunu-15 multiline)
// "multiline:" followed by indented text-only lines (no colon)
parse(['multiline:', '  line 1', '  line 2', '  line 3'])
  → root === { multiline: 'line 1 line 2 line 3' }  // space-joined

// Comment within continuation block is skipped (EMPTY_LINE after strip)
parse(['multiline:', '  # comment', '  actual value'])
  → root === { multiline: 'actual value' }

// Multiple comment-skips
parse(['text:', '  # comment 1', '  part 1', '  # comment 2', '  part 2'])
  → root === { text: 'part 1 part 2' }

// KEY_ONLY where next sibling is at same level — empty string, not continuation
parse(['key:', 'other: value'])
  → root === { key: '', other: 'value' }

// Block scalar inside list item
parse(['- text: |', '  line1', '  line2'])
  // Hmm — this is: listItem=true, KEY_AND_BLOCK_STYLE
  // Parser calls onListItemKeyAndValue with block scalar string
  → root === [{ text: 'line1\nline2\n' }]
```

## Quality bar

`npm test` must pass with all cases above.
