# T21 — Corpus Fixture Smoke Tests

## Context

`tests/visual/data/yaml.json` contains 20+ YAML fixtures drawn from real
PlantUML GitHub issues. This test runs all of them through the full pipeline
and asserts each produces a non-empty SVG without throwing.

## Task

Write `tests/integration/yaml-corpus.test.ts` that iterates every fixture.

## Write-set

- `tests/integration/yaml-corpus.test.ts` (create)

## Read-set

- `tests/visual/data/yaml.json` — all fixture markup
- `src/index.ts` — renderSync

## Implementation

```typescript
import { describe, it, expect } from 'vitest';
import { renderSync } from '../../src/index.js';
import yamlFixtures from '../visual/data/yaml.json';

describe('YAML corpus fixtures', () => {
  for (const { slug, markup } of yamlFixtures) {
    it(`renders ${slug}`, () => {
      const svg = renderSync(markup);
      expect(svg).toContain('<svg');
      expect(svg.length).toBeGreaterThan(100);
    });
  }
});
```

If any fixture fails, investigate and fix the parser before proceeding.
Document any fixture that is intentionally skipped in `decision-journal.md`
with the reason.

## Acceptance criteria

- All fixtures in `tests/visual/data/yaml.json` produce non-empty SVG
- No fixture throws an uncaught exception
- If a fixture produces `root: null` (parse failure), the renderer produces
  a minimal error SVG (matches JSON diagram error behavior) — this is acceptable

## Quality bar

`npm test && npm run typecheck && npm run lint && npm run build` must pass.
