# T12 — Special Keys

## Context

Verifies keys with dots, slashes, spaces, and leading special characters.
Kubernetes and GitLab CI YAML use these extensively. Based on corpus fixtures
xubife-72 (Kubernetes), medosa-24, zebapi-77, coxima-79.

## Task

Write `tests/unit/yaml/parser-special-keys.test.ts` exercising `parseYaml()`.

## Write-set

- `tests/unit/yaml/parser-special-keys.test.ts` (create)

## Read-set

- `src/diagrams/yaml/parser.ts` (T6)
- Corpus fixture: coxima-79 (`app.kubernetes.io/component: grafana`)
- Corpus fixture: medosa-24 (`.sbt-compile-cross`)
- Corpus fixture: zebapi-77 (`test mario-domain: ...`)

## Test cases to implement

```typescript
// coxima-79 — key with dots and slash (Kubernetes label)
parse(['app.kubernetes.io/component: grafana'])
  → root === { 'app.kubernetes.io/component': 'grafana' }

// medosa-24 — key with leading dot
parse(['compile:', '  extends: .sbt-compile-cross'])
  → root === { compile: { extends: '.sbt-compile-cross' } }

// zebapi-77 — key with internal space (findColonSeparator uses first colon)
parse(['test mario-domain:', '  extends: .sbt-test-cross'])
  → root === { 'test mario-domain': { extends: '.sbt-test-cross' } }

// Key with hyphen
parse(['french-hens: 3'])
  → root === { 'french-hens': '3' }

// Key with underscore
parse(['pod_name: nginx'])
  → root === { pod_name: 'nginx' }

// Value with colon (URL) — findColonSeparator returns first colon
// 'url: http://example.com' → key='url', value='http://example.com'
parse(['url: http://example.com'])
  → root === { url: 'http://example.com' }
  // The second colon in the value is part of the value string,
  // because findColonSeparator returns index of FIRST colon.

// Kubernetes nested labels (xubife-72 style)
parse([
  'labels:',
  '  app: blazor',
  '  pod-template-hash: "7966669766"',
])
  → root === { labels: { app:'blazor', 'pod-template-hash':'7966669766' } }

// Key starting with number (unusual but valid in PlantUML YAML)
parse(['123abc: value'])
  → root === { '123abc': 'value' }

// Empty key edge case — skip if YamlLine produces empty key (shouldn't happen
// with normal YAML, but be defensive: key = '' or null should not crash)
// Just verify the parser doesn't throw on unusual inputs
```

## Quality bar

`npm test` must pass with all cases above.
