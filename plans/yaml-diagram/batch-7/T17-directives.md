# T17 — Title + Skinparam Directives

## Context

`parseYaml()` strips directive lines (title, skinparam, scale, skin, hide)
before passing content to the YAML parser. This task verifies that directive
stripping is correct and the title appears in the AST.

## Task

Write `tests/unit/yaml/parser-directives.test.ts`.

## Write-set

- `tests/unit/yaml/parser-directives.test.ts` (create)

## Read-set

- `src/diagrams/yaml/parser.ts` (T6)
- Corpus fixture: `litife-43-novo083` (`skinparam handwritten true\nfruit: Apple`)

## Test cases to implement

```typescript
// Title extracted
parse(['title My YAML Diagram', 'fruit: Apple', 'size: Large'])
  → ast.title === 'My YAML Diagram'
  AND root === { fruit: 'Apple', size: 'Large' }

// skinparam stripped from YAML body (litife-43)
parse(['skinparam handwritten true', 'fruit: Apple', 'size: Large', 'color:', ' - Red', ' - Green'])
  → root === { fruit:'Apple', size:'Large', color:['Red','Green'] }
  AND ast.title === undefined

// scale directive stripped
parse(['scale 200', 'foo: bar'])
  → root === { foo: 'bar' }

// Multiple directives before body
parse(['title My Title', 'skinparam handwritten true', 'scale 200', 'key: val'])
  → ast.title === 'My Title' AND root === { key: 'val' }

// Directive after body start is NOT stripped (it becomes a YAML key)
// 'title' only recognized before first YAML line
parse(['key: val', 'title in body'])
  // 'title in body' has no colon → NO_KEY_ONLY_TEXT or continuation
  // Depends on what comes before/after. Just verify it doesn't crash.

// Empty title
parse(['title', 'foo: bar'])
  // 'title' alone — /^title\s+/i does NOT match 'title' (requires space after)
  // So 'title' alone is treated as a YAML key? Or directive?
  // Java behavior: if the regex requires space, 'title' alone becomes YAML body.
  → root should contain 'title' key (not extracted as title directive)

// #highlight lines do not conflict with directive stripping
parse(['title My Title', '#highlight "foo"', 'foo: bar'])
  → ast.title === 'My Title' AND highlights === [['foo']]
```

## Quality bar

`npm test` must pass with all cases above.
