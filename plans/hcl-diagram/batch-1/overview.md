# Batch 1 — HCL Parser Core

## Description

Create the HCL tokenizer and parser (`src/diagrams/hcl/parser.ts`), register
the `'hcl'` type in the block extractor, and write unit tests for the parser.
No dependency on any other batch.

## Tasks

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T1 | HCL parser + block-extractor + parser tests | typescript-pro | `src/diagrams/hcl/parser.ts`, `src/core/block-extractor.ts`, `tests/unit/hcl/parser.test.ts` | — | [x] |

## Notes

- T1 is the only task in this batch — no parallelism needed.
- After T1 completes, run all four quality gates before starting Batch 2.
- The `src/diagrams/hcl/index.ts` plugin is NOT created in this batch —
  T1's parser is tested in isolation via direct import.
