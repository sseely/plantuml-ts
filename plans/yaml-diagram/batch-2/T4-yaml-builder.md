# T4 — YamlBuilder State Machine

## Context

plantuml-js ports PlantUML's Java source. `YamlBuilder` receives events from
`YamlParser` (one event per line) and builds a `Monomorph` tree. It uses two
parallel stacks to track indentation depth and the current node context.

Java reference:
`~/git/plantuml/src/main/java/net/sourceforge/plantuml/yaml/parser/YamlBuilder.java`

Stack: TypeScript, Vitest.

## Task

Port `YamlBuilder` to TypeScript in `src/diagrams/yaml/yaml-builder.ts`.

### Two-stack invariant (from Java Javadoc)

`indents` and `nodes` always satisfy: `nodes.length === indents.length + 1`.
`nodes[0]` is the root (created in constructor). `indents[i]` is the YAML
indentation level when `nodes[i+1]` was pushed.

### Methods to port

```typescript
class YamlBuilder {
  adjustIndentation(indent: number): void
  getResult(): Monomorph
  onListItemPlainDash(): void
  onKeyAndValue(key: string, value: string): void
  onKeyAndFlowSequence(key: string, list: string[]): void
  onOnlyKey(key: string): void
  onListItemOnlyKey(key: string): void
  onListItemOnlyValue(value: string): void
  onListItemKeyAndValue(key: string, value: string): void
  onListItemKeyAndFlowSequence(key: string, values: string[]): void
}
```

### adjustIndentation(indent) algorithm

```
if indents is empty:
  push indent to indents
  return
if indent > indents.last:
  push indent to indents
else:
  while indents not empty AND indent < indents.last:
    pop indents
    pop nodes
    if getLast().type === LIST:
      pop nodes     // also pop the list's current element
```

### isArrayAlreadyThere()

Returns true if:
- `nodes.length >= 2`
- `nodes[nodes.length - 2].type === LIST`
- `nodes[nodes.length - 2].getElementAt(size-1) === nodes[nodes.length - 1]`

### onListItemPlainDash()

```
if isArrayAlreadyThere(): pop nodes
newElement = new Monomorph()
getLast().addInList(newElement)
push newElement to nodes
```

### onOnlyKey(key)

```
newElement = new Monomorph()
getLast().putInMap(key, newElement)
push newElement to nodes
```

### onListItemOnlyKey(key)

```
if isArrayAlreadyThere(): pop nodes
newElement = new Monomorph()   // the list element
getLast().addInList(newElement)
push newElement to nodes
newElement2 = new Monomorph()  // the nested value for key
getLast().putInMap(key, newElement2)
push newElement2 to nodes
```

### onListItemOnlyValue(value)

```
if isArrayAlreadyThere(): pop nodes
getLast().addInList(Monomorph.scalar(value))
// do NOT push to nodes
```

### onListItemKeyAndValue(key, value)

```
if isArrayAlreadyThere(): pop nodes
newElement = new Monomorph()
getLast().addInList(newElement)
push newElement to nodes
getLast().putInMap(key, Monomorph.scalar(value))
```

### onListItemKeyAndFlowSequence(key, values)

```
if isArrayAlreadyThere(): pop nodes
newElement = new Monomorph()
getLast().addInList(newElement)
push newElement to nodes
getLast().putInMap(key, Monomorph.list(values))
```

### onKeyAndValue(key, value)

```
getLast().putInMap(key, Monomorph.scalar(value))
```

### onKeyAndFlowSequence(key, list)

```
getLast().putInMap(key, Monomorph.list(list))
```

## Write-set

- `src/diagrams/yaml/yaml-builder.ts` (create)
- `tests/unit/yaml/yaml-builder.test.ts` (create)

## Read-set

- Java source file above
- `src/diagrams/yaml/monomorph.ts` (T3 output — Monomorph class)

## Acceptance criteria

- `onKeyAndValue("a", "1")` → root is MAP `{a: "1"}`
- `adjustIndentation(2)` + `onOnlyKey("b")` + `adjustIndentation(4)` +
  `onKeyAndValue("c", "3")` → `{a: "1", b: {c: "3"}}`
- `onListItemOnlyValue("x")` + `onListItemOnlyValue("y")` → root is LIST
  `["x", "y"]`
- `onListItemPlainDash()` twice → root is LIST with two UNDETERMINATE elements
- `onListItemKeyAndValue("name", "Mark")` + `onListItemKeyAndValue("hr", "65")`
  with indent adjustment between → LIST of MAP `[{name:"Mark"},{hr:"65"}]`?

  Actually with the same indent: two list items at same level.
  First: creates list, adds MAP element with name:Mark.
  Second (same indent): `isArrayAlreadyThere()` → pops element, then adds
  new MAP element with hr:65. Result: `[{name:"Mark"},{hr:"65"}]`. This is
  the multi-object case. To get `[{name:"Mark", hr:"65"}]` you'd need hr to
  be at deeper indent (inside the first element).

- `adjustIndentation(0)` on indent decrease correctly pops stacks
- `onListItemOnlyKey("k")` creates a MAP element in the list with key k
  pointing to an UNDETERMINATE Monomorph (which will be filled by subsequent
  events at deeper indent)

## Quality bar

`npm test && npm run typecheck && npm run lint` must pass.
