# Batch 2 — YamlBuilder (sequential)

Single task; depends on T3 (Monomorph types).

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|-----------|------|
| T4 | YamlBuilder state machine | typescript-pro | `src/diagrams/yaml/yaml-builder.ts`, `tests/unit/yaml/yaml-builder.test.ts` | T3 | [x] |

## Quality gate after Batch 2

```sh
npm test && npm run typecheck && npm run lint
```
