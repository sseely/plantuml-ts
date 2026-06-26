# T20 — End-to-End: Plugin Produces SVG

## Context

Verifies the full pipeline for a representative set of corpus fixtures:
parse → layout → render → SVG. This catches integration issues not visible
in unit tests.

Depends on T16 (style selectors complete).

## Task

Write `tests/integration/yaml-e2e.test.ts`.

## Write-set

- `tests/integration/yaml-e2e.test.ts` (create)

## Read-set

- `src/index.ts` (after T1, T16)
- `tests/visual/data/yaml.json` — all fixture slugs + markup

## Test cases to implement

```typescript
import { renderSync } from '../../src/index.js';

// Helper: expect non-empty valid SVG
function expectSvg(markup: string, slug: string) {
  const svg = renderSync(markup);
  expect(svg, `${slug} must produce SVG`).toContain('<svg');
  expect(svg.length, `${slug} must be non-trivial`).toBeGreaterThan(200);
  expect(svg, `${slug} must not contain ERROR`).not.toContain('ERROR');
}

// lifuxe-66: simple key-value (FOO1/FOO2)
expectSvg('@startyaml\nFOO1: bar1\nFOO2: bar2\n@endyaml', 'lifuxe-66');

// medosa-24: dot-keys (compile: extends: .sbt-compile-cross)
expectSvg(medosa24.markup, 'medosa-24');

// sudabi-56: fruit + color list
expectSvg(sudabi56.markup, 'sudabi-56');

// xubife-72: deep Kubernetes YAML (many nested levels)
expectSvg(xubife72.markup, 'xubife-72');

// finofu-94: root-level list
expectSvg(finofu94.markup, 'finofu-94');

// coxima-79: key with dots and slash
expectSvg('@startyaml\napp.kubernetes.io/component: grafana\n@endyaml', 'coxima-79');

// poxedu-72: complex highlight + tab-indented
expectSvg(poxedu72.markup, 'poxedu-72');

// ketunu-15: full test fixture (comments, multiline, block scalar)
expectSvg(ketunu15.markup, 'ketunu-15');
```

Load fixtures from `tests/visual/data/yaml.json`.

## Quality bar

`npm test` must pass. All 8 fixtures must produce valid SVG.
