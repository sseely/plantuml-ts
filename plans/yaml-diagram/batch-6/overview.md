# Batch 6 — Highlights + Style (parallel)

Four tasks. T13 and T14 write new test files. T15 modifies
`src/diagrams/json/layout.ts` (and its test file). T16 modifies
`src/index.ts`. All are independent — no write conflicts.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|-----------|------|
| T13 | Highlight exact path | typescript-pro | `tests/unit/yaml/parser-highlight-exact.test.ts` | T6 | [ ] |
| T14 | Highlight unquoted path + stereotype | typescript-pro | `tests/unit/yaml/parser-highlight-unquoted.test.ts` | T6 | [ ] |
| T15 | Highlight wildcard * and ** | typescript-pro | `src/diagrams/json/layout.ts`, `tests/unit/json/layout.test.ts` | T13 | [ ] |
| T16 | yamlDiagram style selectors | typescript-pro | `src/index.ts`, `tests/unit/yaml/plugin-style.test.ts` | T6 | [ ] |

**Note:** T15 modifies `src/diagrams/json/layout.ts`. Existing JSON diagram
tests must continue to pass — the change is backward compatible.

## Quality gate after Batch 6

```sh
npm test && npm run typecheck && npm run lint
```
