# Batch 1 — AST Types + Parser + Block-Extractor

Single task. Tightly coupled: the AST types, parser, and block-extractor change are all
interdependent and must land in one commit.

## Task Table

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T1 | AST types, parser (all 11 commands), block-extractor update, parser tests | typescript-pro | `src/diagrams/chart/ast.ts`, `src/diagrams/chart/parser.ts`, `tests/unit/chart/parser.test.ts`, `src/core/block-extractor.ts` | — | [x] |

## After This Batch

- Run all four quality gates
- Commit with message: `feat(chart): add AST types and parser`
- Mark T1 `[x]` in this file and in README.md
- Proceed to Batch 2
