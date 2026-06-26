# Batch 3 — YamlParser Orchestrator (sequential)

Single task; depends on T2 (YamlLine) and T4 (YamlBuilder).

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|-----------|------|
| T5 | YamlParser orchestrator | typescript-pro | `src/diagrams/yaml/yaml-parser.ts`, `tests/unit/yaml/yaml-parser.test.ts` | T2, T4 | [ ] |

## Quality gate after Batch 3

```sh
npm test && npm run typecheck && npm run lint
```
