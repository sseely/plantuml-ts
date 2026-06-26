# Batch 2 — Break keyword: AST + parser + layout

## Description

Add full support for the `break` keyword inside `repeat` loops. Requires
a new AST type, parser rule, and layout wiring via `BranchResult.breakGeos`.

## Tasks

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T2 | break support — AST + parser + layout | typescript-pro | ast.ts, parser.ts, layout.ts, parser.test.ts, layout.test.ts | T1 | [x] |

## After this batch

Run all quality gates. If green, mark T2 `[x]` in README.md and commit.
Then proceed to Batch 3.
