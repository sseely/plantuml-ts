# T1 — HCL Parser + Block-Extractor Registration + Parser Tests

## Context

You are working on `plantuml-js`, a TypeScript port of PlantUML. The project
renders PlantUML diagram source to SVG strings with no DOM dependency.

Stack: TypeScript, Vitest, Vite. Test command: `npm test`. Typecheck:
`npm run typecheck`. Lint: `npm run lint`. Build: `npm run build`.

The project already has `@startjson` and `@startyaml` diagram types. Both
parse their source into a `JsonDiagramAST` and delegate to shared
`layoutJson` / `renderJson` functions. You are adding `@starthcl` as a
third type using the same pattern.

## Task

Implement the HCL parser and wire it into the block extractor.

1. Create `src/diagrams/hcl/parser.ts` — exports `parseHcl(source: UmlSource): JsonDiagramAST`
2. Modify `src/core/block-extractor.ts` — add `'hcl'` to the `DiagramType`
   union and to `START_SUFFIX_MAP`
3. Create `tests/unit/hcl/parser.test.ts` — unit tests for `parseHcl` and
   the block-extractor change

## Write-set

- `src/diagrams/hcl/parser.ts` (create)
- `src/core/block-extractor.ts` (modify)
- `tests/unit/hcl/parser.test.ts` (create)

## Read-set

- `~/git/plantuml/src/main/java/net/sourceforge/plantuml/hcl/HclParser.java`
  — the Java source to port (tokenizer + parser logic)
- `~/git/plantuml/src/main/java/net/sourceforge/plantuml/hcl/HclSource.java`
  — shows comment stripping (`trim().startsWith("#")` → skip line)
- `~/git/plantuml/src/main/java/net/sourceforge/plantuml/hcl/SymbolType.java`
  — token type enum
- `src/diagrams/yaml/parser.ts` — the structural pattern to follow for
  `parseHcl` (directive stripping, UmlSource consumption, JsonDiagramAST return)
- `src/diagrams/json/ast.ts` — the `JsonDiagramAST` and `HighlightEntry` types
- `src/core/block-extractor.ts` — current state before modification

## Architecture decisions (pre-made)

See `plans/hcl-diagram/decisions.md` for full rationale. Summary:

**D1 — Function calls:** no-arg `name()` → string `"name()"`;
with-args `name(a,b)` → `{ "name()": ["a", "b"] }`

**D2 — Comments:** strip lines where `.trim().startsWith('#')` before
tokenizing — done in `parseHcl()`, not in the tokenizer.

**D5 — Title:** strip `title …` lines before tokenizing (same as YAML
parser does) but do NOT populate `ast.title`. HCL has no title support.

**D7 — Expression behavior (port Java exactly):**
- `var.foo` → string `"var.foo"` (`.` is not a special char)
- `[for k in list : k]` → `[]` (STRING_SIMPLE tokens silently ignored
  inside arrays — only CURLY_BRACKET_OPEN and STRING_QUOTED add items)
- Ternary `cond ? "a" : "b"` → parse error → `root: null`
- `"${var.name}"` → literal string `"${var.name}"` (verbatim)

## Interface contracts

### `parseHcl` signature

```typescript
import type { JsonDiagramAST } from '../json/ast.js';
import type { UmlSource } from '../../core/block-extractor.js';

export function parseHcl(source: UmlSource): JsonDiagramAST
```

### Return value

- `parseError` is always `false` (HCL parser never sets this — errors
  produce `root: null` instead, matching how Java catches exceptions)
- `highlights` is always `[]` (HCL has no `#highlight` directive)
- `title` is always `undefined` (D5)
- `root` is the parsed object tree, or `null` on parse failure

### `DiagramType` after modification

```typescript
export type DiagramType =
  | 'sequence' | 'class' | 'component' | 'state' | 'usecase'
  | 'activity' | 'object' | 'timing' | 'mindmap' | 'gantt'
  | 'wbs' | 'json' | 'yaml' | 'hcl' | 'unknown';
```

`START_SUFFIX_MAP` gets one new entry: `hcl: 'hcl'`

## HCL tokenizer — port notes

The Java tokenizer (`HclParser.parse()`) is a single-pass character
iterator. Port it as a function `tokenize(chars: string): HclTerm[]`.

Token types to implement (from `SymbolType.java`):
```
STRING_SIMPLE   — bare identifier (anything not caught by getType)
STRING_QUOTED   — "..." with \-escape handling
FUNCTION_NAME   — bare string immediately followed by '('
CURLY_BRACKET_OPEN / CLOSE
SQUARE_BRACKET_OPEN / CLOSE
PARENTHESIS_OPEN / CLOSE
EQUALS          — '='
TWO_POINTS      — ':'
COMMA           — ','
SPACE           — whitespace (consumed, not emitted)
```

Newlines are whitespace — HCL is not line-sensitive in the tokenizer.
Join all non-comment, non-directive lines with a space before tokenizing.

Key tokenizer rules:
- If current char triggers `PARENTHESIS_OPEN` and `pendingString` is
  non-empty: emit `FUNCTION_NAME(pendingString)`, clear pending
- If current char is any other special type and `pendingString` is
  non-empty: emit `STRING_SIMPLE(pendingString)`, clear pending
- SPACE: flush pending if any, then `continue` (don't emit SPACE token)
- `"` char: call `eatUntilDoubleQuote()` — collect until next unescaped
  `"`, emit `STRING_QUOTED(content)`
- Otherwise: append to `pendingString`

## Parser functions — port notes

**`parseMe()`** (call this the top-level entry after tokenizing):
- Collects `getModuleOrSomething()` calls into a map
- If map has exactly 1 entry, return that entry's value directly
- If map has >1 entry, build a JsonObject with all entries

**`getModuleOrSomething()`**:
- Reads STRING_SIMPLE / STRING_QUOTED tokens to build a name (joined
  with spaces, quoted strings include the `"…"` wrapper)
- When CURLY_BRACKET_OPEN is seen: return `{ name → getBracketData() }`

**`getBracketData()`**:
- Reads until CURLY_BRACKET_CLOSE
- Each iteration: reads fieldName (STRING_SIMPLE or STRING_QUOTED data),
  then EQUALS or TWO_POINTS, then `getValue()`
- Builds a plain JS object

**`getValue()`**:
- COMMA / PARENTHESIS_CLOSE → return the token itself (sentinel)
- STRING_QUOTED → return `current.data` (the string value)
- STRING_SIMPLE → return `current.data`
- SQUARE_BRACKET_OPEN → `getArray()`
- CURLY_BRACKET_OPEN → `getBracketData()`
- FUNCTION_NAME → `getFunctionData(name)`
- Anything else → throw (caught by outer try/catch → `root: null`)

**`getArray()`**:
- Reads until SQUARE_BRACKET_CLOSE
- CURLY_BRACKET_OPEN → call `getBracketData()`, push result
- STRING_QUOTED → push `current.data`
- COMMA → continue
- STRING_SIMPLE / TWO_POINTS / everything else → silently continue
  (this is why `[for k in list : k]` produces `[]`)
- Returns a JS array

**`getFunctionData(name)`**:
- Expects PARENTHESIS_OPEN next (throw if not)
- Collects args until PARENTHESIS_CLOSE; COMMA tokens skip
- If 0 args: return string `"name()"`
- If >0 args: return object `{ "name()": [args] }`

## Acceptance criteria

1. Given `key = "value"\nkey2 = "value2"`, when `parseHcl(source)` is called,
   then `ast.root` equals `{ key: 'value', key2: 'value2' }` and
   `ast.parseError` is `false` and `ast.highlights` is `[]`

2. Given a block `resource "aws_s3_bucket" "b" {\n  bucket = "test"\n}`, when
   parsed, then `ast.root` has key `'resource "aws_s3_bucket" "b"'` containing
   `{ bucket: 'test' }`

3. Given `# this is a comment\nkey = "value"`, when parsed, then the comment
   line is excluded and `ast.root` equals `{ key: 'value' }`

4. Given `fn("a", "b")` as a value, when parsed, then stored as
   `{ "fn()": ["a", "b"] }` and no-arg `fn()` is stored as `"fn()"`

5. Given `tags = [for k, v in map : k]`, when parsed, then `ast.root.tags`
   equals `[]`

6. Given a source with `type: 'hcl'`, when `extractBlocks()` processes
   `@starthcl\nresource "r" "n" { }\n@endhcl`, then the block has
   `type: 'hcl'`

7. Given `<style>\nnode { color: red }\n</style>\nkey = "val"`, when parsed,
   then the style block is stripped and `ast.root` equals `{ key: 'val' }`

8. Given `title My Title\nkey = "val"`, when parsed, then `ast.title` is
   `undefined` and `ast.root` equals `{ key: 'val' }`

## Quality bar

Run `npm test`, `npm run typecheck`, `npm run lint` before finishing.
All must pass. Coverage for `src/diagrams/hcl/parser.ts` must meet
90/90/90 (line / branch / function).
