# Batch 5 — Behavior Verification (parallel)

All six tasks are independent — each writes a NEW test file. No source files
are modified. Launch all in parallel after T6 completes.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|-----------|------|
| T7 | Basic key-value + nested objects | typescript-pro | `tests/unit/yaml/parser-basic.test.ts` | T6 | [ ] |
| T8 | List items (simple + objects) | typescript-pro | `tests/unit/yaml/parser-lists.test.ts` | T6 | [ ] |
| T9 | Quoted strings + flow sequences | typescript-pro | `tests/unit/yaml/parser-strings.test.ts` | T6 | [ ] |
| T10 | Comments + whitespace | typescript-pro | `tests/unit/yaml/parser-whitespace.test.ts` | T6 | [ ] |
| T11 | Multiline values | typescript-pro | `tests/unit/yaml/parser-multiline.test.ts` | T6 | [ ] |
| T12 | Special keys | typescript-pro | `tests/unit/yaml/parser-special-keys.test.ts` | T6 | [ ] |

## Quality gate after Batch 5

```sh
npm test && npm run typecheck && npm run lint
```

These are pure test additions. If any test fails, it indicates a parser bug
introduced in T2–T6 that must be fixed before proceeding.
