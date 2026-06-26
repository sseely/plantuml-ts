# Batch 1 — AST, Parser, Block-Extractor Registration, Parser Tests

## Description

Define the DOT diagram AST types, implement the DOT syntax parser, register
the `'dot'` type in the block extractor, and write unit tests for the parser.
No dependency on any other batch.

## Tasks

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T1 | AST + parser + block-extractor + parser tests | typescript-pro | `src/diagrams/dot/ast.ts`, `src/diagrams/dot/parser.ts`, `src/core/block-extractor.ts`, `tests/unit/dot/parser.test.ts` | — | [x] |

## Notes

- T1 is the only task — no parallelism needed.
- `src/diagrams/dot/index.ts` is NOT created in this batch.
- After T1 completes, run all four quality gates before starting Batch 2.
