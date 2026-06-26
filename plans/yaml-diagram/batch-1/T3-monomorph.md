# T3 — Monomorph + MonomorphToJson

## Context

plantuml-js ports PlantUML's Java source. `Monomorph` is the intermediate
tree type produced by `YamlBuilder` and consumed by `MonomorphToJson` to
produce `JsonValue`. It is a tagged union (SCALAR / LIST / MAP / UNDETERMINATE)
in a single mutable object.

Java references:
- `~/git/plantuml/src/main/java/net/sourceforge/plantuml/yaml/parser/Monomorph.java`
- `~/git/plantuml/src/main/java/net/sourceforge/plantuml/yaml/parser/MonomorphType.java`
- `~/git/plantuml/src/main/java/net/sourceforge/plantuml/yaml/parser/MonomorphToJson.java`

Stack: TypeScript, Vitest.

## Task

Port both files into `src/diagrams/yaml/monomorph.ts`.

### MonomorphType

```typescript
export type MonomorphType = 'UNDETERMINATE' | 'SCALAR' | 'LIST' | 'MAP';
```

### Monomorph class

```typescript
export class Monomorph {
  private _type: MonomorphType = 'UNDETERMINATE';
  private _value: string | null = null;
  private _list: Monomorph[] | null = null;
  private _map: Map<string, Monomorph> | null = null;  // insertion-order Map

  get type(): MonomorphType { ... }
  setValue(value: string): void { ... }     // transitions to SCALAR
  addInList(el: Monomorph): void { ... }    // transitions to LIST
  putInMap(key: string, val: Monomorph): void { ... }  // transitions to MAP
  getValue(): string { ... }    // throws if not SCALAR
  getElementAt(i: number): Monomorph { ... }  // throws if not LIST
  getMapValue(key: string): Monomorph { ... } // throws if not MAP
  keys(): IterableIterator<string> { ... }    // throws if not MAP
  size(): number { ... }                      // LIST or MAP only
  static scalar(value: string): Monomorph { ... }
  static list(items: string[]): Monomorph { ... }  // for flow sequences
}
```

**Key invariants:**
- `setValue()` allowed only from UNDETERMINATE or SCALAR (Java allows SCALAR→SCALAR)
- `setValue()` from LIST or MAP throws
- Transition LIST→SCALAR or MAP→SCALAR is illegal
- `Map<string, Monomorph>` uses insertion order (JS Map already does this)

### MonomorphToJson

```typescript
export function monomorphToJson(input: Monomorph): JsonValue | null {
  // SCALAR → Json.value(string)   (use the existing json lib from src/diagrams/json)
  // LIST → JsonArray
  // MAP → JsonObject (key order preserved)
  // UNDETERMINATE → null
  // LIST-of-LIST throws (not in corpus, mirror Java)
}
```

For JSON types, use whatever `JsonValue` / `JsonArray` / `JsonObject` types
are already used by the JSON diagram. Read `src/diagrams/json/parser.ts` and
`src/diagrams/json/ast.ts` to find the import path for the JSON library.

The JSON library used is `jsonc-parser` for parsing, but the AST stores plain
JS values (`unknown`). Look at how `parseJson` returns `root: unknown` — use
the same pattern. `monomorphToJson` should return `unknown` (not a typed
JsonValue), matching the `root` field in `JsonDiagramAST`.

Concretely:
- SCALAR → string value
- MAP → plain JS object `{}` with keys in insertion order (use `Object.fromEntries` or build manually)
- LIST → plain JS array `[]`
- UNDETERMINATE → null

## Write-set

- `src/diagrams/yaml/monomorph.ts` (create)
- `tests/unit/yaml/monomorph.test.ts` (create)

## Read-set

- Java source files listed above
- `src/diagrams/json/ast.ts` — JsonDiagramAST root type
- `src/diagrams/json/parser.ts` — how root is typed as `unknown`

## Acceptance criteria

- Scalar monomorph: `setValue("hello")`, `getValue()` → `"hello"`; `type === 'SCALAR'`
- List monomorph: `addInList(Monomorph.scalar("a"))`, `addInList(Monomorph.scalar("b"))`,
  `getElementAt(0).getValue()` → `"a"`, `size()` → 2
- Map monomorph: `putInMap("k", Monomorph.scalar("v"))`, `getMapValue("k").getValue()` → `"v"`
- `setValue()` on MAP monomorph → throws
- UNDETERMINATE → `monomorphToJson()` returns `null`
- SCALAR → `monomorphToJson()` returns `"hello"` (string)
- MAP `{a: "1", b: "2"}` → `monomorphToJson()` returns `{a: "1", b: "2"}`
- Insertion order preserved: MAP with keys added in order a, b, c →
  `Object.keys(result)` === `["a", "b", "c"]`
- `Monomorph.list(["x", "y"])` → LIST with two scalars
- `Monomorph.scalar("v")` → SCALAR

## Quality bar

`npm test && npm run typecheck && npm run lint` must pass.
