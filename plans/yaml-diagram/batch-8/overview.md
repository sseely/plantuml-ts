# Batch 8 — Corpus + Catalog (sequential)

T21 runs the full corpus. T22 updates the catalog (depends on T21 passing).

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|-----------|------|
| T21 | Corpus fixture smoke tests | typescript-pro | `tests/integration/yaml-corpus.test.ts` | T17–T20 | [x] |
| T22 | Catalog update | typescript-pro | `.claude/catalog.md` | T21 | [x] |

## Quality gate after Batch 8 (final)

```sh
npm test && npm run typecheck && npm run lint && npm run build
```

All four must pass. This is the ship gate.
