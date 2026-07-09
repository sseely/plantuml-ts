# Batch 5 — Renderer cutover

Single task: the migration itself. Everything upstream of it must be
green first.

| ID | Description | Agent | Writes | Depends On | Done |
|----|--------------|-------|--------|------------|------|
| T17 | Rewrite description renderer to draw through klimt | typescript-pro (sonnet) | src/diagrams/description/{renderer,renderer-helpers,index}.ts, tests/unit/description/renderer.test.ts, tests/integration/description.test.ts | T1, T4, T12, T13, T14 | [ ] |

## Quality gates
Mission-level gates from `../README.md`. After this batch, `npm run
svg:survey` runs for real — journal the first genuine verdict counts.

## Next
Mark T17 `[x]`, commit, proceed to Batch 6.
