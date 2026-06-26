# Batch 4 — Merged parser (Phase 2)

The heaviest task. Merges the two structurally-parallel parsers into one keyed by
`KEYWORD_TO_SYMBOL`, faithful to upstream `CommandCreateElementFull`.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|-----------|------|
| T4 | `description/parser.ts` + tests | typescript-pro | `src/diagrams/description/parser.ts`, `tests/unit/description/parser.test.ts` | T3 | [ ] |

See [T4-parser.md](T4-parser.md). If it runs long, use TodoWrite sub-steps
(declarations → containers/nesting → links) — but keep it one commit.
