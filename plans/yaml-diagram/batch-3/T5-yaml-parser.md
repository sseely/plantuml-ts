# T5 — YamlParser Orchestrator

## Context

plantuml-js ports PlantUML's Java source. `YamlParser` is the top-level
parser that iterates raw YAML lines via a Peeker abstraction, dispatches
each line to the right `YamlBuilder` method, and handles multi-line lookahead.

Java reference:
`~/git/plantuml/src/main/java/net/sourceforge/plantuml/yaml/parser/YamlParser.java`

Stack: TypeScript, Vitest.

## Task

Port `YamlParser.parse(lines: string[])` to TypeScript.

There is no `Peeker` class in the codebase. Implement one locally or inline
the lookahead using an index. A simple approach:

```typescript
function parseYamlLines(lines: string[]): Monomorph {
  const builder = new YamlBuilder();
  let i = 0;
  while (i < lines.length) {
    const yamlLine = YamlLine.build(lines[i]!);
    // ... dispatch
    i++;
  }
  return builder.getResult();
}
```

The Peeker needs `peek(offset)` — return `lines[i + offset]` or null.
Use a simple index-based lookahead (no external library).

### Main dispatch loop (port faithfully)

```
for each line (with peeker at current position):
  yamlLine = YamlLine.build(line)
  if EMPTY_LINE: continue
  if NO_KEY_ONLY_TEXT at root level: throw YamlSyntaxException
  if PLAIN_DASH: builder.onListItemPlainDash(); continue

  builder.adjustIndentation(yamlLine.indent)

  if yamlLine.isListItem:
    if KEY_ONLY:    builder.onListItemOnlyKey(key)
    if PLAIN_ELEMENT_LIST: builder.onListItemOnlyValue(value)
    if KEY_AND_VALUE: builder.onListItemKeyAndValue(key, value)
    if KEY_AND_FLOW_SEQUENCE: builder.onListItemKeyAndFlowSequence(key, values)
    else: throw UnsupportedOperationException
  else:
    if KEY_ONLY:
      next = peekNext(peeker)  // skip EMPTY_LINEs
      if next is null OR next.indent <= yamlLine.indent:
        builder.onKeyAndValue(key, "")
      else if next.type === NO_KEY_ONLY_TEXT:
        builder.onKeyAndValue(key, peekNextOnlyText(peeker))
      else:
        builder.onOnlyKey(key)
    if KEY_AND_VALUE: builder.onKeyAndValue(key, value)
    if KEY_AND_BLOCK_STYLE: builder.onKeyAndValue(key, getBlockStyleString(indent, peeker))
    if KEY_AND_FLOW_SEQUENCE: builder.onKeyAndFlowSequence(key, values)
    else: throw UnsupportedOperationException
```

### peekNext(peeker): YamlLine | null

Skip ahead past EMPTY_LINEs to find the next non-empty line. Returns null
if no more lines.

### peekNextOnlyText(peeker): string

Collect subsequent NO_KEY_ONLY_TEXT lines (skipping EMPTY_LINEs) into a
space-joined string. Advance the iterator past each consumed line.

### getBlockStyleString(indent, peeker): string

Collect subsequent lines where:
- type is NO_KEY_ONLY_TEXT OR EMPTY_LINE, AND
- if not EMPTY_LINE: `line.indent > indent` OR is an EMPTY_LINE

Join with `\n`. Apply `cleanBlockStyle` (just trim the line). Advance iterator.

### Implement YamlSyntaxException

A plain `Error` subclass with a message.

### Decision D5

`KEY_AND_FOLDED_STYLE` is detected by YamlLine but `YamlParser` should
degrade gracefully: call `builder.onKeyAndValue(key, "")` and log a
warning to `console.warn` (do not throw — be more forgiving than Java here
since the JS context is browser-friendly).

## Write-set

- `src/diagrams/yaml/yaml-parser.ts` (create)
- `tests/unit/yaml/yaml-parser.test.ts` (create)

## Read-set

- Java source file above
- `src/diagrams/yaml/yaml-line.ts` (T2 — YamlLine, YamlLineType)
- `src/diagrams/yaml/yaml-builder.ts` (T4 — YamlBuilder)
- `src/diagrams/yaml/monomorph.ts` (T3 — Monomorph, monomorphToJson)

## Acceptance criteria

- `["fruit: Apple", "size: Large"]` → MAP `{fruit:"Apple", size:"Large"}`
- `["metadata:", "  name: foo", "  namespace: bar"]` →
  MAP `{metadata: {name:"foo", namespace:"bar"}}`
- `["color:", "  - Red", "  - Green"]` →
  MAP `{color: ["Red", "Green"]}`
- `["- hosts: webservers", "  vars:", "    http_port: 80"]` →
  LIST `[{hosts:"webservers", vars:{http_port:"80"}}]`
- `["key:"]` (no next line) → MAP `{key: ""}` (empty value)
- `["key:", "  # comment", "  value text"]` →
  MAP `{key: "value text"}` (comment skipped in peekNextOnlyText)
- `["text: |", "  line1", "  line2"]` →
  MAP `{text: "line1\nline2\n"}` (block scalar)
- Empty lines between key and value are skipped
- `KEY_AND_FOLDED_STYLE (">")`  → key with empty string value (no throw)

## Quality bar

`npm test && npm run typecheck && npm run lint` must pass.
