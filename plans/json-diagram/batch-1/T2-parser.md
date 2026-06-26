# T2 — AST + Parser

## Context

plantuml-js is a TypeScript SVG renderer for PlantUML. Each diagram type
has an `ast.ts` (types) and `parser.ts` (pure function: lines → AST).
See `src/diagrams/sequence/ast.ts` and `src/diagrams/sequence/parser.ts`
as reference for the pattern. The parser receives `UmlSource` (from
`src/core/block-extractor.ts`) which has `lines: readonly string[]` —
the content lines between `@startjson` and `@endjson`, already stripped
of the start/end tags by the block extractor.

Stack: TypeScript, Vitest (90/90/90 coverage), ESLint.
Tests: `npm test`. Typecheck: `npm run typecheck`.

## Task

### 1. `src/diagrams/json/ast.ts`

```typescript
export interface JsonDiagramAST {
  /** Parsed JSON value. null means the body was invalid JSON. */
  root: unknown;
  /** Highlight paths from #highlight directives. Each is an array of
   *  key segments (split on " / "). */
  highlights: ReadonlyArray<readonly string[]>;
}
```

### 2. `src/diagrams/json/parser.ts`

The parser must:
1. Walk `source.lines`, separating `#highlight` lines from JSON body lines.
   - A highlight line starts with `#highlight ` (case-sensitive).
   - All other non-empty lines are JSON body.
2. Parse `#highlight` lines:
   - Strip the `#highlight ` prefix.
   - Strip any trailing `<<stereotype>>` (regex: `\s*<<[^>]*>>\s*$`).
   - Split remaining text on `" / "` (with surrounding whitespace).
   - Trim each segment and strip enclosing double-quotes.
   - Result: `string[]` path array — push to `highlights`.
3. Join JSON body lines with `\n`, call `JSON.parse`.
   - On `SyntaxError`: set `root = null`.
4. Return `{ root, highlights }`.

Export: `export function parseJson(source: UmlSource): JsonDiagramAST`

`UmlSource` is imported from `../../core/block-extractor.js`.

### 3. `tests/unit/json/parser.test.ts`

Import `parseJson` and write tests using `describe`/`it`/`expect` (Vitest).
Helper: `function parse(lines: string[]) { return parseJson({ lines, type: 'json' }); }`

## Acceptance criteria

- Given a valid JSON object body, when `parseJson` runs, then `ast.root`
  equals the parsed object (deep equality)
- Given `#highlight "key"` before JSON body, when `parseJson` runs, then
  `ast.highlights` contains `[['key']]`
- Given `#highlight "a" / "b" <<foo>>`, when `parseJson` runs, then
  `ast.highlights` contains `[['a', 'b']]` (stereotype stripped)
- Given invalid JSON, when `parseJson` runs, then `ast.root === null`
  and `ast.highlights` is empty
- Given a bare JSON array `[1,2,3]`, when `parseJson` runs,
  then `ast.root` is `[1, 2, 3]`

## Write-set

- `src/diagrams/json/ast.ts`
- `src/diagrams/json/parser.ts`
- `tests/unit/json/parser.test.ts`

## Read-set

- `src/core/block-extractor.ts` lines 1-30 (UmlSource type)
- `src/diagrams/sequence/parser.ts` lines 1-30 (pattern reference)

## Quality bar

`npm test && npm run typecheck && npm run lint` must pass.
Commit message: `feat(json): add AST types and parser`
