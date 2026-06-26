# Batch 7 — Integration Tests (parallel)

Four tasks, all writing new test files. Independent — launch in parallel.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|-----------|------|
| T17 | Title + skinparam directives | typescript-pro | `tests/unit/yaml/parser-directives.test.ts` | T6 | [ ] |
| T18 | Style block integration | typescript-pro | `tests/integration/yaml-style.test.ts` | T16 | [ ] |
| T19 | Root-level array | typescript-pro | `tests/unit/yaml/parser-root-array.test.ts` | T6 | [ ] |
| T20 | End-to-end: plugin produces SVG | typescript-pro | `tests/integration/yaml-e2e.test.ts` | T16 | [ ] |

## Quality gate after Batch 7

```sh
npm test && npm run typecheck && npm run lint
```
