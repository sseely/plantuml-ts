# T2 — YamlLine Tokenizer

## Context

plantuml-js ports PlantUML's Java source. The active YAML parse pipeline
uses `YamlLine.build()` to tokenize each raw line before the parser
processes it. This is a pure function with no dependencies on other new
files.

Java reference: `~/git/plantuml/src/main/java/net/sourceforge/plantuml/yaml/parser/YamlLine.java`

Stack: TypeScript, Vitest. Quality gates: `npm test`, `npm run typecheck`,
`npm run lint`.

## Task

Port `YamlLine.build()` and `YamlLineType` enum from Java to TypeScript.

### YamlLineType enum (port exactly)

```
EMPTY_LINE, NO_KEY_ONLY_TEXT, KEY_ONLY, KEY_AND_VALUE,
KEY_AND_FLOW_SEQUENCE, KEY_AND_BLOCK_STYLE, KEY_AND_FOLDED_STYLE,
PLAIN_ELEMENT_LIST, PLAIN_DASH
```

### YamlLine class / interface

Fields: `indent: number`, `key: string | null`, `value: string | null`,
`values: readonly string[] | null`, `listItem: boolean`, `type: YamlLineType`.

### build(line: string) algorithm (port faithfully):

1. Replace all `\t` with `    ` (4 spaces)
2. Count leading spaces → `count`
3. Extract `trimmedLine = line.substring(count).trim()`
4. Strip inline/full-line comment: call `removeYamlComment(trimmedLine)`
   - If trimmedLine starts with `#` → return `""`
   - Otherwise scan, tracking quote state (single/double); when outside
     quotes and we see ` #` (space + hash), truncate there
5. If empty → `EMPTY_LINE` with indent=0
6. If trimmedLine equals `"-"` → `PLAIN_DASH`, indent=count+1, listItem=true
7. Check `listItem = trimmedLine.startsWith("- ")`
   - If listItem: `count += 2; trimmedLine = trimmedLine.substring(2)`
8. Call `findColonSeparator(trimmedLine)` (quote-aware, returns -1 if none)
9. If colonIndex === -1:
   - If listItem → `PLAIN_ELEMENT_LIST`, value=unquote(trimmedLine)
   - Else → `NO_KEY_ONLY_TEXT`, value=unquote(trimmedLine)
10. `rawKey = trimmedLine.substring(0, colonIndex).trim()`
    `rawValue = trimmedLine.substring(colonIndex + 1).trim()`
11. Determine type from rawValue:
    - `""` → `KEY_ONLY`
    - `"|"` → `KEY_AND_BLOCK_STYLE`
    - `">"` → `KEY_AND_FOLDED_STYLE`
    - starts with `[` and ends with `]` → `KEY_AND_FLOW_SEQUENCE`;
      parse flow sequence via `toList(rawValue.substring(1, len-1))`
    - otherwise → `KEY_AND_VALUE`
12. Return line with unquote applied to key and value.

### findColonSeparator(line)

Scan chars, tracking quote state. Return index of first `:` outside quotes.

### toList(rawValue)

Parse comma-separated list items, handling quoted strings and `\` escapes.
Port exactly from Java (see Java source lines 130–185).

### unquote(str)

If str starts and ends with same quote char (`"` or `'`), strip them.

## Write-set

- `src/diagrams/yaml/yaml-line.ts` (create)
- `tests/unit/yaml/yaml-line.test.ts` (create)

## Read-set

- `~/git/plantuml/src/main/java/net/sourceforge/plantuml/yaml/parser/YamlLine.java`
- `~/git/plantuml/src/main/java/net/sourceforge/plantuml/yaml/parser/YamlLineType.java`

## Acceptance criteria

- `"fruit: Apple"` → KEY_AND_VALUE, key='fruit', value='Apple', indent=0, listItem=false
- `"  - Red"` → PLAIN_ELEMENT_LIST, value='Red', indent=4, listItem=true
- `"  - "` → PLAIN_DASH, indent=3, listItem=true (bare dash)

  Wait — `"  -"` trimmed is `"-"` which equals `"-"` → PLAIN_DASH. But
  `"  - Red"` trimmed is `"- Red"` which starts with `"- "` → listItem=true.
  Confirm this exact boundary.

- `"\t\tkey: val"` → indent=8 (2 tabs × 4 spaces), key='key', value='val'
- `"# comment"` → EMPTY_LINE
- `"value # inline"` → NO_KEY_ONLY_TEXT, value='value'
- `"name: val # comment"` → KEY_AND_VALUE, value='val'
- `'name: "val # not stripped"'` → value='val # not stripped' (inside quotes)
- `"tags: [a, b, c]"` → KEY_AND_FLOW_SEQUENCE, values=['a','b','c']
- `'tags: ["x", "y"]'` → KEY_AND_FLOW_SEQUENCE, values=['x','y'] (unquoted)
- `"key: |"` → KEY_AND_BLOCK_STYLE
- `"key: >"` → KEY_AND_FOLDED_STYLE
- `"key:"` → KEY_ONLY
- `'doe: "a deer"'` → KEY_AND_VALUE, value='a deer' (unquoted)
- `"  - key: value"` → after listItem=true and count+=2: KEY_AND_VALUE
  key='key', value='value', indent=4

## Quality bar

`npm test && npm run typecheck && npm run lint` must pass.
All acceptance criteria covered by tests.
